/**
 * v9 card/paper data model.
 * A workspace's card collection is the knowledge system. Each card owns an ordered
 * index of paper instances; each paper points to one field instance on the card (or
 * to the card-scoped relation/log collections). Paper records contain metadata and
 * notes, while field content stays in its existing typed fields for v8 compatibility.
 */
export type CardPaperField =
  | "card-head"
  | "inquiry-situation"
  | "inquiry-reasoning"
  | "inquiry-organization"
  | "inquiry-recovery"
  | "inquiry-output"
  | "what"
  | "apply"
  | "relations"
  | "process-log"
  | "diagnostic";

export interface InquiryStep {
  id: string;
  kind: "thinking" | "derivation";
  content: string;
  /** How this step follows the preceding thought/derivation; absent on the first step. */
  connectionToPrevious?: string;
}

export interface InquiryGroup {
  id: string;
  title: string;
  situation: string;
  /** Alternating 思路 → 推演 → 思路 → 推演… sequence. */
  steps: InquiryStep[];
  organization: string;
  recovery: string;
  output: string;
}

export interface CardPaperRecord {
  id: string;
  /** Re-numbered in display order; stable identity is `id`, not this sequence number. */
  number: number;
  field: CardPaperField;
  inquiryId?: string;
  /** Logical pointer to the field content stored on this card/workspace. */
  contentRef: string;
  /** Optional card-head directory note for this field instance. */
  note?: string;
}

export const CARD_PAPER_FIELD_LABELS: Record<CardPaperField, string> = {
  "card-head": "卡頭",
  "inquiry-situation": "情境",
  "inquiry-reasoning": "推演與思路",
  "inquiry-organization": "整理（選填）",
  "inquiry-recovery": "回收",
  "inquiry-output": "輸出",
  what: "WHAT",
  apply: "APPLY",
  relations: "關係邊",
  "process-log": "過程日誌",
  diagnostic: "診斷標籤",
};

export function createEmptyInquiry(index: number, id = `inquiry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`): InquiryGroup {
  return {
    id,
    title: `探究 ${index}`,
    situation: "",
    steps: [{ id: `${id}-step-1`, kind: "thinking", content: "" }],
    organization: "",
    recovery: "",
    output: "",
  };
}

/**
 * Preserve all v8 text while moving its main narrative into the first v9 inquiry.
 * The old fields themselves are deliberately retained as a compatibility/archive
 * copy: other existing readers, exports, and old JSON tooling continue to work.
 */
export function inquiryFromLegacyCard(card: Record<string, any>, index = 1): InquiryGroup {
  const inquiryId = `legacy-${encodeURIComponent(typeof card.id === "string" ? card.id : "card")}-inquiry-${index}`;
  const background = card.backgroundData || {};
  const situationParts = [
    card.backgroundDescription ? `背景脈絡（v8）：\n${card.backgroundDescription}` : "",
    background.situation ? `情境：\n${background.situation}` : "",
    background.preciseObject ? `精確對象：\n${background.preciseObject}` : "",
    background.preciseQuestion ? `精確問題：\n${background.preciseQuestion}` : "",
  ].filter(Boolean);

  const thinkingParts = [
    card.constructionThinking ? `構造思路（v8）：\n${card.constructionThinking}` : "",
    formatPlan(card.plan),
    formatCandidate(card.candidate),
  ].filter(Boolean);
  const why = card.whyData || {};
  const derivationParts = [
    why.closedBookDraft ? `閉卷草稿（v8）：\n${why.closedBookDraft}` : "",
    why.fullReasoning ? `原 WHY 推導（v8）：\n${why.fullReasoning}` : "",
  ].filter(Boolean);

  const steps: InquiryStep[] = [];
  if (thinkingParts.length || derivationParts.length) {
    steps.push({
      id: `${inquiryId}-step-1`,
      kind: "thinking",
      content: thinkingParts.join("\n\n"),
    });
    if (derivationParts.length) {
      steps.push({
        id: `${inquiryId}-step-2`,
        kind: "derivation",
        content: derivationParts.join("\n\n"),
        connectionToPrevious: "承接原 v8 構造思路，原文保留；請依新的探究脈絡校訂。",
      });
    }
  } else {
    steps.push({ id: `${inquiryId}-step-1`, kind: "thinking", content: "" });
  }

  return {
    id: inquiryId,
    title: `探究 ${index}`,
    situation: situationParts.join("\n\n"),
    steps,
    organization: "",
    recovery: "",
    output: "",
  };
}

function formatPlan(plan: any): string {
  if (!plan) return "";
  const parts: string[] = [];
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  if (steps.length) {
    parts.push(`舊版計畫（v8）：\n${steps.map((step: any, i: number) =>
      `${i + 1}. ${step?.label || "步驟"}${step?.rationale ? `：${step.rationale}` : ""}`
    ).join("\n")}`);
  }
  if (plan.ranges) parts.push(`舊版範圍註記：\n${plan.ranges}`);
  return parts.join("\n\n");
}

function formatCandidate(candidate: any): string {
  if (!candidate) return "";
  const labels: Array<[string, unknown]> = [
    ["要求", candidate.requirement],
    ["候選形式", candidate.candidateForm],
    ["選擇動機", candidate.motivation],
    ["擴展方案", candidate.expansion],
    ["超出範圍", candidate.expansionOutOfScope],
  ];
  const parts = labels
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([label, value]) => `${label}：\n${String(value)}`);
  return parts.length ? `舊版候選與構造記錄（v8）：\n${parts.join("\n\n")}` : "";
}

/** Ensure the stored inquiry sequence alternates and every step has a stable ID. */
export function normalizeInquirySteps(rawSteps: unknown, inquiryId: string): InquiryStep[] {
  const source = Array.isArray(rawSteps) ? rawSteps : [];
  const alreadyNormalized = source.length > 0 && source.every((raw, index) => {
    if (!raw || typeof raw !== "object") return false;
    const step = raw as Record<string, any>;
    return typeof step.id === "string" && !!step.id &&
      step.kind === (index % 2 === 0 ? "thinking" : "derivation") &&
      typeof step.content === "string" &&
      (index === 0 ? !Object.prototype.hasOwnProperty.call(step, "connectionToPrevious") : typeof step.connectionToPrevious === "string");
  });
  if (alreadyNormalized) return source as InquiryStep[];

  const steps: InquiryStep[] = source.map((raw, index) => {
    const step = raw && typeof raw === "object" ? raw as Record<string, any> : {};
    const kind = index % 2 === 0 ? "thinking" : "derivation";
    return {
      id: typeof step.id === "string" && step.id ? step.id : `${inquiryId}-step-${index + 1}`,
      kind,
      content: typeof step.content === "string" ? step.content : typeof step.text === "string" ? step.text : "",
      ...(index > 0 ? {
        connectionToPrevious: typeof step.connectionToPrevious === "string" ? step.connectionToPrevious : "",
      } : {}),
    };
  });
  if (!steps.length) steps.push({ id: `${inquiryId}-step-1`, kind: "thinking", content: "" });
  return steps;
}

function normalizeInquiry(raw: unknown, index: number): InquiryGroup {
  const inquiry = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  const id = typeof inquiry.id === "string" && inquiry.id ? inquiry.id : `inquiry-${index + 1}`;
  const title = typeof inquiry.title === "string" && inquiry.title.trim() ? inquiry.title : `探究 ${index + 1}`;
  const steps = normalizeInquirySteps(inquiry.steps, id);
  const situation = typeof inquiry.situation === "string" ? inquiry.situation : "";
  const organization = typeof inquiry.organization === "string" ? inquiry.organization : "";
  const recovery = typeof inquiry.recovery === "string" ? inquiry.recovery : "";
  const output = typeof inquiry.output === "string" ? inquiry.output : "";
  if (raw && typeof raw === "object" &&
    inquiry.id === id && inquiry.title === title && inquiry.situation === situation &&
    inquiry.steps === steps && inquiry.organization === organization &&
    inquiry.recovery === recovery && inquiry.output === output) {
    return raw as InquiryGroup;
  }
  return { id, title, situation, steps, organization, recovery, output };
}

function paperIdentity(cardId: string, field: CardPaperField, inquiryId?: string): string {
  return `paper:${encodeURIComponent(cardId)}:${encodeURIComponent(inquiryId || "card")}:${field}`;
}

function paperContentReference(cardId: string, field: CardPaperField, inquiryId?: string): string {
  const inquiryFields: Partial<Record<CardPaperField, string>> = {
    "inquiry-situation": "situation",
    "inquiry-reasoning": "steps",
    "inquiry-organization": "organization",
    "inquiry-recovery": "recovery",
    "inquiry-output": "output",
  };
  if (field.startsWith("inquiry-") && inquiryId) {
    return `inquiries/${encodeURIComponent(inquiryId)}/${inquiryFields[field] || ""}`;
  }
  if (field === "relations" || field === "process-log") {
    const collection = field === "relations" ? "relations" : "processLogs";
    return `workspace.${collection}?cardId=${encodeURIComponent(cardId)}`;
  }
  const cardField: Record<"card-head" | "what" | "apply" | "diagnostic", string> = {
    "card-head": "card",
    what: "whatData",
    apply: "howData",
    diagnostic: "diagnostics",
  };
  return cardField[field as keyof typeof cardField] || "card";
}

/** Rebuild ordered paper records while retaining stable IDs and user-authored notes. */
export function buildCardPaperIndex(card: Record<string, any>): CardPaperRecord[] {
  const cardId = typeof card.id === "string" && card.id ? card.id : "card";
  const inquiries = Array.isArray(card.inquiries) ? card.inquiries as InquiryGroup[] : [];
  const oldRecords = Array.isArray(card.papers) ? card.papers as CardPaperRecord[] : [];
  const oldByKey = new Map<string, CardPaperRecord>();
  for (const record of oldRecords) {
    if (!record || typeof record.field !== "string") continue;
    const key = `${record.field}\u0000${record.inquiryId || ""}`;
    if (!oldByKey.has(key)) oldByKey.set(key, record);
  }

  const specs: Array<{ field: CardPaperField; inquiryId?: string }> = [
    { field: "card-head" },
    ...inquiries.flatMap((inquiry) => ([
      { field: "inquiry-situation" as const, inquiryId: inquiry.id },
      { field: "inquiry-reasoning" as const, inquiryId: inquiry.id },
      { field: "inquiry-organization" as const, inquiryId: inquiry.id },
      { field: "inquiry-recovery" as const, inquiryId: inquiry.id },
      { field: "inquiry-output" as const, inquiryId: inquiry.id },
    ])),
    { field: "what" },
    { field: "apply" },
    { field: "relations" },
    { field: "process-log" },
    { field: "diagnostic" },
  ];

  const records = specs.map((spec, index) => {
    const key = `${spec.field}\u0000${spec.inquiryId || ""}`;
    const existing = oldByKey.get(key);
    return {
      id: typeof existing?.id === "string" && existing.id
        ? existing.id
        : paperIdentity(cardId, spec.field, spec.inquiryId),
      number: index + 1,
      field: spec.field,
      ...(spec.inquiryId ? { inquiryId: spec.inquiryId } : {}),
      contentRef: paperContentReference(cardId, spec.field, spec.inquiryId),
      ...(typeof existing?.note === "string" && existing.note ? { note: existing.note } : {}),
    };
  });
  return JSON.stringify(oldRecords) === JSON.stringify(records) ? oldRecords : records;
}

/** Idempotent v9 normalization for seed data, local storage, imports, and live edits. */
export function ensureCardPaperModel<T extends Record<string, any>>(card: T): T & {
  paperModelVersion: 9;
  inquiries: InquiryGroup[];
  papers: CardPaperRecord[];
} {
  const rawInquiries = Array.isArray(card.inquiries)
    ? card.inquiries
    : [inquiryFromLegacyCard(card, 1)];
  const inquiries = rawInquiries.length
    ? rawInquiries.map((inquiry, index) => normalizeInquiry(inquiry, index))
    : [inquiryFromLegacyCard(card, 1)];
  const normalized = {
    ...card,
    paperModelVersion: 9 as const,
    inquiries,
  };
  const papers = buildCardPaperIndex(normalized);
  if (card.paperModelVersion === 9 &&
    JSON.stringify(card.inquiries) === JSON.stringify(inquiries) &&
    JSON.stringify(card.papers) === JSON.stringify(papers)) {
    return card as T & { paperModelVersion: 9; inquiries: InquiryGroup[]; papers: CardPaperRecord[] };
  }
  return { ...normalized, papers };
}

export function migrateCardToV9(card: any): any {
  if (!card || typeof card !== "object" || Array.isArray(card)) return card;
  return ensureCardPaperModel(card);
}

export function formatPaperNumber(number: number): string {
  return `P${String(number).padStart(2, "0")}`;
}
