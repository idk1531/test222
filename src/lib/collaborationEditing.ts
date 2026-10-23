export interface CollaborativeTextChange {
  cardId: string;
  path: string;
  value: string;
  actorId: string;
}

export interface CollaborativeTextSnapshotEntry {
  path: string;
  value: string;
}

export interface RemoteEditingPresence {
  participantId: string;
  name: string;
  cardId: string;
  path: string;
  position: number;
  selectionEnd: number;
  anchorId: string | null;
  typing: boolean;
  active: boolean;
  updatedAt: number;
}

export interface CollaborativeTextInsertOperation {
  kind: "insert";
  id: string;
  after: string | null;
  value: string;
  counter: number;
}

export interface CollaborativeTextDeleteOperation {
  kind: "delete";
  id: string;
}

export type CollaborativeTextOperation = CollaborativeTextInsertOperation | CollaborativeTextDeleteOperation;

export interface CollaborativeTextOperationsMessage {
  v: 1;
  type: "text-operations";
  actorId: string;
  cardId: string;
  path: string;
  baseline?: string;
  operations: CollaborativeTextOperation[];
}

export interface CollaborativeEditingPresenceMessage {
  v: 1;
  type: "editing-presence";
  actorId: string;
  cardId: string;
  path: string;
  position: number;
  selectionEnd: number;
  anchorId: string | null;
  typing: boolean;
  active: boolean;
}

export type CollaborativeEditingMessage = CollaborativeTextOperationsMessage | CollaborativeEditingPresenceMessage;

const MAX_ACTOR_ID_LENGTH = 128;
const MAX_CARD_ID_LENGTH = 256;
const MAX_PATH_LENGTH = 1_024;
const MAX_TEXT_LENGTH = 128_000;
const MAX_WIRE_LENGTH = 5_000_000;
const MAX_DIRECT_MESSAGE_LENGTH = 8_192;
const MAX_CHUNK_DATA_LENGTH = 5_400;
const MAX_CHUNK_FRAMES = 1_500;
const MAX_CHUNK_TRANSFERS = 4;
const CHUNK_EXPIRY_MS = 20_000;
const MAX_OPERATIONS_PER_MESSAGE = 128;
const MAX_OPERATIONS_PER_FRAME = 32;
const MAX_TRACKED_SNAPSHOTS = 12;
const NON_TEXT_KEYS = new Set([
  "id", "workspaceId", "createdAt", "updatedAt", "lastTestedAt", "fromReadingId", "toReadingId",
  "linkedReadingId", "pointsToReadingId", "participantId", "cardId", "sourceCardIds", "instanceCardIds",
  "reasoningShape", "granularity", "pageMode", "cardFont", "bloomLevel", "soloLevel", "declaredLevel",
  "autoSuggestedLevel", "fieldShape", "skillType", "status", "type", "kind", "placement", "epistemicMark",
  "blockedMark", "isCompiled", "passed", "isVerified", "isCheapest", "isInvisible", "accepted", "visible",
  "color", "spineColor", "place", "categoryId", "semanticType", "role", "severity", "cardTags", "compositeShapes",
  "confidenceBefore", "confidenceAfter", "confidence", "shapeConfidence", "occurrenceCount", "order", "orderInShelf", "x", "y",
  "z", "yaw", "yawDeg", "width", "height", "rotation", "zIndex", "locked", "isLocked", "isHidden",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapePathSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapePathSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function pathString(segments: string[]): string {
  return `/${segments.map(escapePathSegment).join("/")}`;
}

function parsePath(path: string): string[] | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.length > MAX_PATH_LENGTH) return null;
  const segments = path.slice(1).split("/").map(unescapePathSegment);
  if (!segments.length || segments.length > 64 || segments.some((segment) => !segment || /[\u0000-\u001f\u007f]/.test(segment))) return null;
  return segments;
}

function isTextLeaf(segments: string[]): boolean {
  if (!segments.length) return false;
  let leaf = segments[segments.length - 1];
  if (leaf.startsWith("@")) leaf = segments.length > 1 ? segments[segments.length - 2] : leaf;
  if (/^\d+$/.test(leaf)) leaf = segments.length > 1 ? segments[segments.length - 2] : leaf;
  if (NON_TEXT_KEYS.has(leaf) || /(?:Id|At)$/.test(leaf)) return false;
  return true;
}

function isTextPath(path: string): boolean {
  const segments = parsePath(path);
  return !!segments && isTextLeaf(segments);
}

export function isCollaborativeTextPath(path: string): boolean {
  return isTextPath(path);
}

export interface CollaborativeTextFieldChange {
  path: string;
  previousValue: string;
  value: string;
}

/** Collect only editable string leaves; identity, enum, layout and status fields stay on record sync. */
export function collectCollaborativeTextChanges(previous: unknown, next: unknown): CollaborativeTextFieldChange[] {
  const changes: CollaborativeTextFieldChange[] = [];
  const visit = (before: unknown, after: unknown, segments: string[]) => {
    if (typeof after === "string") {
      if (isTextLeaf(segments) && before !== after) {
        changes.push({ path: pathString(segments), previousValue: typeof before === "string" ? before : "", value: after });
      }
      return;
    }
    if (Array.isArray(after)) {
      if (!Array.isArray(before)) {
        after.forEach((item, index) => visit(undefined, item, [...segments, String(index)]));
        return;
      }
      const beforeById = new Map<string, unknown>();
      const afterById = new Map<string, unknown>();
      const stableIds = before.every((item) => isRecord(item) && typeof item.id === "string")
        && after.every((item) => isRecord(item) && typeof item.id === "string");
      if (stableIds) {
        for (const item of before as Array<Record<string, unknown>>) beforeById.set(item.id as string, item);
        for (const item of after as Array<Record<string, unknown>>) afterById.set(item.id as string, item);
        for (const id of new Set([...beforeById.keys(), ...afterById.keys()])) {
          visit(beforeById.get(id), afterById.get(id), [...segments, `@${id}`]);
        }
      } else if (before.length === after.length) {
        after.forEach((item, index) => visit(before[index], item, [...segments, String(index)]));
      }
      return;
    }
    if (!isRecord(after)) return;
    const beforeRecord = isRecord(before) ? before : {};
    const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(after)]);
    for (const key of keys) visit(beforeRecord[key], after[key], [...segments, key]);
  };
  visit(previous, next, []);
  return changes;
}

function stripTextLeaves(value: unknown, segments: string[], isRoot = false): unknown {
  if (typeof value === "string") return isTextLeaf(segments) ? undefined : value;
  if (Array.isArray(value)) {
    const stableIds = value.every((item) => isRecord(item) && typeof item.id === "string");
    const stripped = value.map((item, index) => stripTextLeaves(item, [...segments, stableIds ? `@${(item as Record<string, unknown>).id as string}` : String(index)]));
    return stripped.map((item) => item === undefined ? null : item);
  }
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...segments, key];
    const stripped = stripTextLeaves(child, childPath);
    if (stripped !== undefined) result[key] = stripped;
  }
  return !isRoot && Object.keys(result).length === 0 ? undefined : result;
}

/** Text-free projection used by record sync to avoid LWW updates for CRDT-only keystrokes. */
export function stripCollaborativeTextFields(value: unknown): unknown {
  return stripTextLeaves(value, [], true);
}

export function hasCollaborativeTextPathStructure(value: unknown, path: string): boolean {
  const segments = parsePath(path);
  if (!segments || !isTextLeaf(segments)) return false;
  let current: unknown = value;
  for (const segment of segments) {
    if (segment.startsWith("@")) {
      if (!Array.isArray(current)) return false;
      current = current.find((item) => isRecord(item) && item.id === segment.slice(1));
      if (current === undefined) return false;
    } else if (/^\d+$/.test(segment)) {
      if (!Array.isArray(current) || Number(segment) >= current.length) return false;
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else if (current === undefined || current === null) {
      // Optional object branches can be created safely; list identity segments cannot.
      continue;
    } else {
      return false;
    }
  }
  return true;
}

export function getCollaborativeTextAtPath(value: unknown, path: string): string | undefined {
  const segments = parsePath(path);
  if (!segments || !isTextLeaf(segments)) return undefined;
  let current: unknown = value;
  for (const segment of segments) {
    if (segment.startsWith("@")) {
      if (!Array.isArray(current)) return undefined;
      const id = segment.slice(1);
      current = current.find((item) => isRecord(item) && item.id === id);
    } else if (/^\d+$/.test(segment) && Array.isArray(current)) {
      current = current[Number(segment)];
    } else if (isRecord(current)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function setCollaborativeTextAtPath<T>(value: T, path: string, text: string): T {
  const segments = parsePath(path);
  if (!segments || !isTextLeaf(segments) || typeof text !== "string" || text.length > MAX_TEXT_LENGTH) return value;

  const update = (current: unknown, index: number): unknown => {
    if (index >= segments.length) return text;
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    if (segment.startsWith("@")) {
      const id = segment.slice(1);
      const list = Array.isArray(current) ? current : [];
      const found = list.findIndex((item) => isRecord(item) && item.id === id);
      const child = found >= 0 ? list[found] : { id };
      const nextChild = update(child, index + 1);
      if (found >= 0) return list.map((item, itemIndex) => itemIndex === found ? nextChild : item);
      return [...list, nextChild];
    }
    if (/^\d+$/.test(segment) && Array.isArray(current)) {
      const position = Number(segment);
      const list = [...current];
      while (list.length <= position) list.push(undefined);
      list[position] = update(list[position], index + 1);
      return list;
    }
    if (Array.isArray(current)) return current;
    const record = isRecord(current) ? current : {};
    const child = record[segment];
    const initialChild = child === undefined && nextSegment
      ? (nextSegment.startsWith("@") || /^\d+$/.test(nextSegment) ? [] : {})
      : child;
    return { ...record, [segment]: update(initialChild, index + 1) };
  };

  return update(value, 0) as T;
}

export function findCollaborativeTextPathByValue(value: unknown, wanted: string): string | null {
  const matches: string[] = [];
  const visit = (current: unknown, segments: string[]) => {
    if (typeof current === "string") {
      if (current === wanted && isTextLeaf(segments)) matches.push(pathString(segments));
      return;
    }
    if (Array.isArray(current)) {
      const stableIds = current.every((item) => isRecord(item) && typeof item.id === "string");
      current.forEach((item, index) => visit(item, [...segments, stableIds ? `@${(item as Record<string, unknown>).id as string}` : String(index)]));
      return;
    }
    if (isRecord(current)) {
      for (const [key, child] of Object.entries(current)) visit(child, [...segments, key]);
    }
  };
  visit(value, []);
  return matches.length === 1 ? matches[0] : null;
}

function hashText(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${value.length.toString(36)}-${first.toString(36)}-${second.toString(36)}`;
}

function makeBaseAtomId(cardId: string, path: string, baseline: string, index: number): string {
  return `base:${hashText(`${cardId}\u0000${path}\u0000${baseline}`)}:${index.toString(36)}`;
}

function makeTextAtomId(actorId: string, counter: number): string {
  return `text:${encodeURIComponent(actorId)}:${counter.toString(36)}`;
}

function safeString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafePath(value: unknown): value is string {
  return typeof value === "string" && !!parsePath(value) && isTextPath(value);
}

function parseTextOperation(value: unknown, actorId: string): CollaborativeTextOperation | null {
  if (!isRecord(value)) return null;
  if (value.kind === "delete") {
    if (!safeString(value.id, 512)) return null;
    return { kind: "delete", id: value.id };
  }
  if (value.kind !== "insert" || !safeString(value.id, 512)) return null;
  if (value.after !== null && !safeString(value.after, 512)) return null;
  if (typeof value.value !== "string" || Array.from(value.value).length !== 1 || value.value.length > 4) return null;
  if (!Number.isSafeInteger(value.counter) || (value.counter as number) < 1) return null;
  const counter = value.counter as number;
  if (value.id !== makeTextAtomId(actorId, counter)) return null;
  return {
    kind: "insert",
    id: value.id,
    after: value.after as string | null,
    value: value.value,
    counter,
  };
}

export function parseCollaborativeEditingMessage(raw: unknown): CollaborativeEditingMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_WIRE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1 || !safeString(parsed.actorId, MAX_ACTOR_ID_LENGTH)) return null;

  if (parsed.type === "text-operations") {
    if (!safeString(parsed.cardId, MAX_CARD_ID_LENGTH) || !isSafePath(parsed.path)) return null;
    if (parsed.baseline !== undefined && (typeof parsed.baseline !== "string" || parsed.baseline.length > MAX_TEXT_LENGTH)) return null;
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0 || parsed.operations.length > MAX_OPERATIONS_PER_MESSAGE) return null;
    const operations = parsed.operations.map((operation) => parseTextOperation(operation, parsed.actorId as string));
    if (operations.some((operation) => !operation)) return null;
    return {
      v: 1,
      type: "text-operations",
      actorId: parsed.actorId,
      cardId: parsed.cardId,
      path: parsed.path,
      ...(typeof parsed.baseline === "string" ? { baseline: parsed.baseline } : {}),
      operations: operations as CollaborativeTextOperation[],
    };
  }

  if (parsed.type === "editing-presence") {
    if (!safeString(parsed.cardId, MAX_CARD_ID_LENGTH) || !isSafePath(parsed.path)) return null;
    if (!Number.isSafeInteger(parsed.position) || (parsed.position as number) < 0 || (parsed.position as number) > MAX_TEXT_LENGTH) return null;
    if (!Number.isSafeInteger(parsed.selectionEnd) || (parsed.selectionEnd as number) < 0 || (parsed.selectionEnd as number) > MAX_TEXT_LENGTH) return null;
    if (parsed.anchorId !== null && !safeString(parsed.anchorId, 512)) return null;
    if (typeof parsed.typing !== "boolean" || typeof parsed.active !== "boolean") return null;
    return {
      v: 1,
      type: "editing-presence",
      actorId: parsed.actorId,
      cardId: parsed.cardId,
      path: parsed.path,
      position: parsed.position as number,
      selectionEnd: parsed.selectionEnd as number,
      anchorId: parsed.anchorId as string | null,
      typing: parsed.typing,
      active: parsed.active,
    };
  }
  return null;
}

interface ChunkFrame {
  v: 1;
  type: "shared-chunk";
  transferId: string;
  index: number;
  total: number;
  data: string;
}

function createTransferId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `edit-${crypto.randomUUID()}`;
  } catch {
    // A random, non-sensitive transfer label is sufficient for a DataChannel chunk envelope.
  }
  return `edit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function serializeCollaborativeEditingMessage(message: CollaborativeEditingMessage): string[] | null {
  let raw: string;
  try {
    raw = JSON.stringify(message);
  } catch {
    return null;
  }
  if (raw.length > MAX_WIRE_LENGTH) return null;
  if (raw.length <= MAX_DIRECT_MESSAGE_LENGTH) return [raw];
  const chunks: string[] = [];
  for (let offset = 0; offset < raw.length; offset += MAX_CHUNK_DATA_LENGTH) {
    chunks.push(raw.slice(offset, offset + MAX_CHUNK_DATA_LENGTH));
  }
  if (chunks.length > MAX_CHUNK_FRAMES) return null;
  const transferId = createTransferId();
  return chunks.map((data, index) => JSON.stringify({
    v: 1,
    type: "shared-chunk",
    transferId,
    index,
    total: chunks.length,
    data,
  } satisfies ChunkFrame));
}

interface TextNode {
  id: string;
  after: string | null;
  value: string;
  counter: number;
  actorId: string;
  deleted: boolean;
}

function compareTextNodes(left: TextNode, right: TextNode): number {
  if (left.counter !== right.counter) return left.counter > right.counter ? -1 : 1;
  if (left.actorId === right.actorId) return left.id.localeCompare(right.id);
  return left.actorId.localeCompare(right.actorId);
}

class TextCrdtDocument {
  private readonly nodes = new Map<string, TextNode>();
  private readonly tombstones = new Set<string>();
  private snapshots: Array<{ value: string; ids: string[] }> = [];

  constructor(private readonly cardId: string, private readonly path: string, baseline: string) {
    let previousId: string | null = null;
    Array.from(baseline).forEach((value, index) => {
      const id = makeBaseAtomId(cardId, path, baseline, index);
      this.nodes.set(id, { id, after: previousId, value, counter: 0, actorId: "", deleted: false });
      previousId = id;
    });
    this.rememberSnapshot();
  }

  getText(): string {
    return this.getVisibleNodes().map((node) => node.value).join("");
  }

  getCursorAnchor(position: number): string | null {
    const nodes = this.getVisibleNodes();
    const offset = Math.max(0, Math.min(nodes.length, Math.floor(position)));
    return offset === 0 ? null : nodes[offset - 1]?.id ?? null;
  }

  getPositionAfterAnchor(anchorId: string | null): number | null {
    if (anchorId === null) return 0;
    const index = this.getVisibleNodes().findIndex((node) => node.id === anchorId);
    return index < 0 ? null : index + 1;
  }

  replace(previousValue: string, nextValue: string, actorId: string, nextCounter: () => number): CollaborativeTextOperation[] {
    if (nextValue.length > MAX_TEXT_LENGTH) return [];
    const snapshot = this.findSnapshot(previousValue);
    const beforeValue = snapshot?.value ?? this.getText();
    const before = Array.from(beforeValue);
    const after = Array.from(nextValue);
    const oldIds = snapshot?.ids ?? this.getVisibleNodes().map((node) => node.id);
    if (oldIds.length !== before.length) return [];

    let prefix = 0;
    const maxPrefix = Math.min(before.length, after.length);
    while (prefix < maxPrefix && before[prefix] === after[prefix]) prefix += 1;
    let suffix = 0;
    while (
      suffix < before.length - prefix
      && suffix < after.length - prefix
      && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
    ) suffix += 1;

    if (prefix === before.length && prefix === after.length) return [];
    const operations: CollaborativeTextOperation[] = [];
    const oldEnd = before.length - suffix;
    for (let index = prefix; index < oldEnd; index += 1) {
      const id = oldIds[index];
      if (!id) continue;
      const operation: CollaborativeTextDeleteOperation = { kind: "delete", id };
      this.apply(operation, actorId);
      operations.push(operation);
    }

    let parentId = prefix > 0 ? oldIds[prefix - 1] ?? null : null;
    const newEnd = after.length - suffix;
    for (let index = prefix; index < newEnd; index += 1) {
      const counter = nextCounter();
      const id = makeTextAtomId(actorId, counter);
      const operation: CollaborativeTextInsertOperation = {
        kind: "insert",
        id,
        after: parentId,
        value: after[index],
        counter,
      };
      this.apply(operation, actorId);
      operations.push(operation);
      parentId = id;
    }
    this.rememberSnapshot();
    return operations;
  }

  apply(operation: CollaborativeTextOperation, actorId: string): boolean {
    if (operation.kind === "delete") {
      const node = this.nodes.get(operation.id);
      if (node) {
        if (node.deleted) return false;
        node.deleted = true;
      } else {
        this.tombstones.add(operation.id);
      }
      return true;
    }
    const existing = this.nodes.get(operation.id);
    if (existing) {
      return existing.value === operation.value && existing.after === operation.after;
    }
    this.nodes.set(operation.id, {
      id: operation.id,
      after: operation.after,
      value: operation.value,
      counter: operation.counter,
      actorId,
      deleted: this.tombstones.has(operation.id),
    });
    return true;
  }

  rememberCurrentValue(): void {
    this.rememberSnapshot();
  }

  private findSnapshot(value: string): { value: string; ids: string[] } | null {
    for (let index = this.snapshots.length - 1; index >= 0; index -= 1) {
      if (this.snapshots[index].value === value) return this.snapshots[index];
    }
    return null;
  }

  private rememberSnapshot(): void {
    const nodes = this.getVisibleNodes();
    const value = nodes.map((node) => node.value).join("");
    const existingIndex = this.snapshots.findIndex((snapshot) => snapshot.value === value);
    if (existingIndex >= 0) this.snapshots.splice(existingIndex, 1);
    this.snapshots.push({ value, ids: nodes.map((node) => node.id) });
    if (this.snapshots.length > MAX_TRACKED_SNAPSHOTS) this.snapshots.splice(0, this.snapshots.length - MAX_TRACKED_SNAPSHOTS);
  }

  private getVisibleNodes(): TextNode[] {
    const children = new Map<string | null, TextNode[]>();
    for (const node of this.nodes.values()) {
      const siblings = children.get(node.after) ?? [];
      siblings.push(node);
      children.set(node.after, siblings);
    }
    for (const siblings of children.values()) siblings.sort(compareTextNodes);

    const result: TextNode[] = [];
    const visited = new Set<string>();
    const roots = children.get(null) ?? [];
    const stack = roots.slice().reverse();
    while (stack.length) {
      const node = stack.pop()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      if (!node.deleted) result.push(node);
      const descendants = children.get(node.id) ?? [];
      for (let index = descendants.length - 1; index >= 0; index -= 1) stack.push(descendants[index]);
    }
    return result;
  }
}

interface CollaborativeTextEngineOptions {
  actorId: string;
  getBaseline: (cardId: string, path: string) => string;
  send: (message: CollaborativeEditingMessage) => boolean;
  onUpdate: (update: CollaborativeTextChange) => void;
  onSendError?: () => void;
}

interface TextDocumentEntry {
  key: string;
  cardId: string;
  path: string;
  baseline: string;
  document: TextCrdtDocument;
  baselineSent: boolean;
  outbox: CollaborativeTextOperation[];
}

export class CollaborativeTextEngine {
  private readonly documents = new Map<string, TextDocumentEntry>();
  private localCounter = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly options: CollaborativeTextEngineOptions) {}

  applyLocalChange(cardId: string, path: string, previousValue: string, nextValue: string): string {
    if (this.stopped || !safeString(cardId, MAX_CARD_ID_LENGTH) || !isSafePath(path) || nextValue.length > MAX_TEXT_LENGTH) return nextValue;
    const entry = this.ensureDocument(cardId, path, this.options.getBaseline(cardId, path));
    const operations = entry.document.replace(previousValue, nextValue, this.options.actorId, () => {
      this.localCounter += 1;
      return this.localCounter;
    });
    if (operations.length) {
      entry.outbox.push(...operations);
      this.flushEntry(entry);
    }
    return entry.document.getText();
  }

  receive(message: CollaborativeTextOperationsMessage, expectedActorId: string): boolean {
    if (this.stopped || message.actorId !== expectedActorId || message.actorId === this.options.actorId) return false;
    const key = this.documentKey(message.cardId, message.path);
    let entry = this.documents.get(key);
    if (!entry) {
      const baseline = message.baseline ?? this.options.getBaseline(message.cardId, message.path);
      if (baseline.length > MAX_TEXT_LENGTH) return false;
      entry = this.createEntry(message.cardId, message.path, baseline);
    }
    const previousText = entry.document.getText();
    for (const operation of message.operations) {
      if (operation.kind === "insert") this.localCounter = Math.max(this.localCounter, operation.counter);
      entry.document.apply(operation, message.actorId);
    }
    const nextText = entry.document.getText();
    if (previousText !== nextText) {
      entry.document.rememberCurrentValue();
      this.options.onUpdate({
        cardId: message.cardId,
        path: message.path,
        value: nextText,
        actorId: message.actorId,
      });
    }
    return true;
  }

  getSnapshot(cardId: string): CollaborativeTextSnapshotEntry[] {
    return Array.from(this.documents.values())
      .filter((entry) => entry.cardId === cardId)
      .map((entry) => ({ path: entry.path, value: entry.document.getText() }));
  }

  getCursorAnchor(cardId: string, path: string, position: number): string | null {
    return this.documents.get(this.documentKey(cardId, path))?.document.getCursorAnchor(position) ?? null;
  }

  resolveCursorPosition(cardId: string, path: string, anchorId: string | null, fallback: number): number {
    const anchored = this.documents.get(this.documentKey(cardId, path))?.document.getPositionAfterAnchor(anchorId);
    return anchored ?? Math.max(0, Math.floor(fallback));
  }

  stop(): void {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.documents.clear();
  }

  private ensureDocument(cardId: string, path: string, requestedBaseline: string): TextDocumentEntry {
    const key = this.documentKey(cardId, path);
    const existing = this.documents.get(key);
    if (existing) return existing;
    const baseline = requestedBaseline.slice(0, MAX_TEXT_LENGTH);
    return this.createEntry(cardId, path, baseline);
  }

  private createEntry(cardId: string, path: string, baseline: string): TextDocumentEntry {
    const key = this.documentKey(cardId, path);
    const entry: TextDocumentEntry = {
      key,
      cardId,
      path,
      baseline,
      document: new TextCrdtDocument(cardId, path, baseline),
      baselineSent: false,
      outbox: [],
    };
    this.documents.set(key, entry);
    return entry;
  }

  private documentKey(cardId: string, path: string): string {
    return `${cardId}\u0000${path}`;
  }

  private flushEntry(entry: TextDocumentEntry): void {
    if (this.stopped || !entry.outbox.length) return;
    while (entry.outbox.length) {
      const operations = entry.outbox.slice(0, MAX_OPERATIONS_PER_FRAME);
      const message: CollaborativeTextOperationsMessage = {
        v: 1,
        type: "text-operations",
        actorId: this.options.actorId,
        cardId: entry.cardId,
        path: entry.path,
        ...(entry.baselineSent ? {} : { baseline: entry.baseline }),
        operations,
      };
      let sent = false;
      try {
        sent = this.options.send(message);
      } catch {
        sent = false;
      }
      if (!sent) {
        this.options.onSendError?.();
        this.scheduleRetry();
        return;
      }
      entry.baselineSent = true;
      entry.outbox.splice(0, operations.length);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || this.stopped) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      for (const entry of this.documents.values()) this.flushEntry(entry);
    }, 250);
  }
}

interface PendingChunkTransfer {
  total: number;
  chunks: Array<string | undefined>;
  received: number;
  length: number;
  updatedAt: number;
}

function parseChunkFrame(raw: unknown): ChunkFrame | null {
  if (typeof raw !== "string" || raw.length > MAX_DIRECT_MESSAGE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1 || parsed.type !== "shared-chunk") return null;
  if (!safeString(parsed.transferId, 96)) return null;
  if (!Number.isSafeInteger(parsed.index) || !Number.isSafeInteger(parsed.total)) return null;
  if ((parsed.index as number) < 0 || (parsed.total as number) < 2 || (parsed.total as number) > MAX_CHUNK_FRAMES) return null;
  if ((parsed.index as number) >= (parsed.total as number)) return null;
  if (typeof parsed.data !== "string" || parsed.data.length === 0 || parsed.data.length > MAX_CHUNK_DATA_LENGTH) return null;
  return {
    v: 1,
    type: "shared-chunk",
    transferId: parsed.transferId,
    index: parsed.index as number,
    total: parsed.total as number,
    data: parsed.data,
  };
}

export class CollaborativeEditingChunkAssembler {
  private readonly pending = new Map<string, PendingChunkTransfer>();

  accept(raw: unknown, now = Date.now()): { handled: boolean; message?: string } {
    for (const [id, transfer] of this.pending) {
      if (now - transfer.updatedAt > CHUNK_EXPIRY_MS) this.pending.delete(id);
    }
    const frame = parseChunkFrame(raw);
    if (!frame) {
      const looksLikeChunk = typeof raw === "string" && raw.length <= MAX_DIRECT_MESSAGE_LENGTH && raw.includes("shared-chunk");
      return { handled: looksLikeChunk };
    }
    let transfer = this.pending.get(frame.transferId);
    if (!transfer) {
      if (this.pending.size >= MAX_CHUNK_TRANSFERS) return { handled: true };
      transfer = { total: frame.total, chunks: new Array<string | undefined>(frame.total), received: 0, length: 0, updatedAt: now };
      this.pending.set(frame.transferId, transfer);
    }
    if (transfer.total !== frame.total) {
      this.pending.delete(frame.transferId);
      return { handled: true };
    }
    transfer.updatedAt = now;
    const previous = transfer.chunks[frame.index];
    if (previous !== undefined) {
      if (previous !== frame.data) this.pending.delete(frame.transferId);
      return { handled: true };
    }
    transfer.chunks[frame.index] = frame.data;
    transfer.received += 1;
    transfer.length += frame.data.length;
    if (transfer.length > MAX_WIRE_LENGTH) {
      this.pending.delete(frame.transferId);
      return { handled: true };
    }
    if (transfer.received !== transfer.total) return { handled: true };
    const message = transfer.chunks.join("");
    this.pending.delete(frame.transferId);
    return message.length <= MAX_WIRE_LENGTH ? { handled: true, message } : { handled: true };
  }

  clear(): void {
    this.pending.clear();
  }
}

export function toCodePointOffset(text: string, utf16Offset: number): number {
  const offset = Math.max(0, Math.min(text.length, Math.floor(utf16Offset)));
  return Array.from(text.slice(0, offset)).length;
}

export function humanizeCollaborativeTextPath(path: string): string {
  const segments = parsePath(path) ?? [];
  const field = segments.slice().reverse().find((segment) => !segment.startsWith("@") && !/^\d+$/.test(segment)) ?? "內容";
  const labels: Record<string, string> = {
    title: "名稱", domain: "領域", backgroundDescription: "背景描述", constructionThinking: "構造思路",
    situation: "情境", preciseObject: "精確對象", preciseQuestion: "精確問題", requirement: "要求",
    candidateForm: "候選形式", motivation: "動機", summary: "摘要", content: "內容", fullReasoning: "完整推導",
    closedBookDraft: "閉卷草稿", question: "問題", answer: "回答", description: "描述", rationale: "理由",
    label: "標籤", action: "動作", source: "來源", cue: "提示", check: "檢查", conflict: "衝突",
    explanation: "說明", note: "備註", text: "文字", name: "名稱", trigger: "觸發條件", capability: "能力",
  };
  return labels[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function makeTextOperationsMessage(
  actorId: string,
  cardId: string,
  path: string,
  baseline: string | undefined,
  operations: CollaborativeTextOperation[]
): CollaborativeTextOperationsMessage | null {
  if (!safeString(actorId, MAX_ACTOR_ID_LENGTH) || !safeString(cardId, MAX_CARD_ID_LENGTH) || !isSafePath(path)) return null;
  if (baseline !== undefined && baseline.length > MAX_TEXT_LENGTH) return null;
  if (!operations.length || operations.length > MAX_OPERATIONS_PER_MESSAGE) return null;
  return { v: 1, type: "text-operations", actorId, cardId, path, ...(baseline !== undefined ? { baseline } : {}), operations };
}
