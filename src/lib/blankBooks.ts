import type { CardData } from "@/components/KnowledgeCardNode";
import { actions, getState } from "./store";
import type { StudyDeskPosition } from "./study";

export const BLANK_BOOK_ID_PREFIX = "blank-book:";
export const BLANK_BOOK_DRAFT_ID_PREFIX = "blank-draft:";
export const BLANK_BOOK_WRITTEN_EVENT = "study-blank-book-written";

export interface BlankBookDraftContext {
  kind: "blank-book-draft";
  blankBookId: string;
  place: "shelf" | "desk";
  desk?: StudyDeskPosition;
  categoryId: string | null;
  orderInShelf: number;
  decorColor: string;
}

export type BlankBookCardDraft = CardData & {
  __blankBookDraft: BlankBookDraftContext;
};

export interface BlankBookWrittenEventDetail {
  blankBookId: string;
}

export function blankBookCardId(decorBookId: string): string {
  return `${BLANK_BOOK_ID_PREFIX}${decorBookId}`;
}

export function isBlankBookId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(BLANK_BOOK_ID_PREFIX);
}

/** Build the editor's empty card-shaped draft without adding anything to workspace state. */
export function makeBlankBookDraft(
  workspaceId: string,
  context: Omit<BlankBookDraftContext, "kind">,
): BlankBookCardDraft {
  const normalizedContext: BlankBookDraftContext = {
    ...context,
    kind: "blank-book-draft",
    desk: context.place === "desk" && context.desk ? { ...context.desk } : undefined,
  };
  return {
    id: `${BLANK_BOOK_DRAFT_ID_PREFIX}${context.blankBookId}`,
    workspaceId,
    title: "",
    domain: "",
    granularity: "L2 定理/機制",
    reasoningShape: "A",
    shapeAccepted: false,
    bloomLevel: "理解",
    soloLevel: "單點結構",
    cardFont: "quicksand",
    pageMode: "single",
    assumptions: [],
    claims: [],
    thoughtPoints: [],
    intuitionTraps: [],
    whatData: {
      summary: "",
      readings: [],
      readingQuestions: [],
      readingBridges: [],
      perspectives: [],
      distinctionFromHow: "",
      extensions: {
        deeper: "",
        shallower: "",
        generalize: "",
        specialize: "",
        translate: "",
        construct: "",
        constructDetails: { name: "", choice: "", alternative: "", linkBack: "" },
        questions: {},
      },
    },
    whyData: {
      confidenceBefore: 3,
      closedBookDraft: "",
      fullReasoning: "",
      confidenceAfter: 3,
      subGoals: [],
    },
    howData: { checks: [], branches: [], can: [], status: "uncompiled" },
    __blankBookDraft: normalizedContext,
  };
}

const NON_WRITING_FIELDS = new Set([
  "__blankBookDraft",
  "id", "workspaceId", "createdAt", "updatedAt",
  "granularity", "reasoningShape", "shapeAccepted", "shapeConfidence", "shapeAcceptedAt",
  "bloomLevel", "soloLevel", "cardFont", "pageMode", "status", "fieldShape",
  "epistemicMark", "skillType", "kind", "type", "source", "sourceCardIds", "code",
  "cardTags", "compositeShapes", "passed", "isCompiled", "onlyForUnderstanding",
  "categoryId", "orderInShelf", "place", "desk", "blankBookId", "decorColor",
  "color", "spineColor", "shapeHex", "spineHex", "x", "y", "z", "yawDeg",
  "order", "confidenceBefore", "confidenceAfter", "occurrenceCount", "accepted",
  "declaredLevel", "autoSuggestedLevel", "autoRationale", "lastTestedAt",
]);

function containsWrittenString(value: unknown, field = ""): boolean {
  if (NON_WRITING_FIELDS.has(field) || field.startsWith("__")) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) {
    if (field === "cardTags" || field === "compositeShapes" || field === "sourceCardIds") return false;
    return value.some((entry) => containsWrittenString(entry, field));
  }
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value as Record<string, unknown>)
    .some(([key, entry]) => containsWrittenString(entry, key));
}

/** Metadata selections alone do not count; any non-empty user-authored card text does. */
export function hasWrittenCardContent(card: Partial<CardData> | Record<string, unknown>): boolean {
  return containsWrittenString(card);
}

export function getBlankBookDraftContext(
  card: Partial<CardData> | Record<string, unknown>,
): BlankBookDraftContext | null {
  const value = (card as Record<string, unknown>).__blankBookDraft;
  if (!value || typeof value !== "object") return null;
  const context = value as Partial<BlankBookDraftContext>;
  if (
    context.kind !== "blank-book-draft" ||
    typeof context.blankBookId !== "string" ||
    !isBlankBookId(context.blankBookId) ||
    typeof context.decorColor !== "string"
  ) return null;

  const validDesk = !!context.desk &&
    Number.isFinite(context.desk.x) &&
    Number.isFinite(context.desk.z) &&
    Number.isFinite(context.desk.yawDeg);
  return {
    kind: "blank-book-draft",
    blankBookId: context.blankBookId,
    place: context.place === "desk" && validDesk ? "desk" : "shelf",
    ...(context.place === "desk" && validDesk ? { desk: { ...context.desk! } } : {}),
    categoryId: typeof context.categoryId === "string" ? context.categoryId : null,
    orderInShelf: Number.isFinite(context.orderInShelf) ? Math.max(0, Math.floor(context.orderInShelf!)) : 0,
    decorColor: context.decorColor,
  };
}

/**
 * Promote a written blank-book draft to a normal persisted card/book pair. Calling this for an
 * untouched draft is a no-op, so empty-book records never enter the persisted workspace.
 */
export function persistBlankBookDraft(
  draft: BlankBookCardDraft,
  position = { x: 100, y: 100 },
): string | null {
  const context = getBlankBookDraftContext(draft);
  if (!context || !hasWrittenCardContent(draft)) return null;

  const {
    __blankBookDraft: _draftContext,
    id: _draftId,
    ...cardData
  } = draft;
  const workspaceId = cardData.workspaceId || getState().workspace.id;
  const cardId = actions.createCard({ ...cardData, workspaceId }, position);
  if (!getState().cards.some((card) => card.id === cardId)) return null;

  const current = getState();
  const categoryId = context.categoryId &&
    current.studyCategories.some((category) => category.id === context.categoryId)
    ? context.categoryId
    : null;
  const categoryBooks = current.studyBooks.filter((book) =>
    (book.categoryId ?? "cat-uncategorized") === (categoryId ?? "cat-uncategorized") &&
    book.cardId !== cardId
  );
  actions.reorderBook(cardId, categoryId, Math.min(context.orderInShelf, categoryBooks.length));
  actions.setBookDecor(cardId, {
    decorColor: context.decorColor,
    decorSourceId: context.blankBookId,
  });
  if (context.place === "desk" && context.desk) {
    actions.setBookPlace(cardId, "desk", context.desk);
  }
  return cardId;
}
