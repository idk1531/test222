import { stripCollaborativeTextFields } from "./collaborationEditing";

export type SharedCollection = "cards" | "canvasObjects" | "studyCategories" | "studyBooks";
export type SharedContentAction = "upsert" | "delete";
export type SharedContentSyncStatus = "idle" | "syncing" | "synced" | "error";
export type SharedLocalRole = "owner" | "editor" | "reader" | "pending";

export interface SharedContentVersion {
  clock: number;
  actorId: string;
}

export interface SharedContentOperation extends SharedContentVersion {
  collection: SharedCollection;
  id: string;
  action: SharedContentAction;
  value?: Record<string, unknown>;
}

export interface SharedContentRecord extends SharedContentVersion {
  collection: SharedCollection;
  id: string;
  value: Record<string, unknown>;
}

export interface SharedContentTombstone extends SharedContentVersion {
  collection: SharedCollection;
  id: string;
}

export interface SharedContentSnapshotMessage {
  v: 1;
  type: "shared-snapshot";
  actorId: string;
  records: SharedContentRecord[];
  tombstones: SharedContentTombstone[];
}

export interface SharedContentOperationsMessage {
  v: 1;
  type: "shared-operations";
  actorId: string;
  operations: SharedContentOperation[];
}

export interface SharedContentReadyMessage {
  v: 1;
  type: "shared-ready";
  actorId: string;
  acknowledgement: boolean;
}

export type SharedContentMessage =
  | SharedContentSnapshotMessage
  | SharedContentOperationsMessage
  | SharedContentReadyMessage;

export interface SharedContentStateLike {
  cards: any[];
  canvasObjects: any[];
  studyCategories: any[];
  studyBooks: any[];
  workspace?: { id?: string };
  relations?: any[];
}

interface SharedContentSyncOptions {
  actorId: string;
  getState: () => SharedContentStateLike;
  subscribe: (listener: () => void) => () => void;
  applyOperations: (operations: SharedContentOperation[]) => void;
  send: (message: SharedContentMessage) => boolean;
  getLocalRole: () => SharedLocalRole;
  getRemoteRole: () => SharedLocalRole | null;
  getRemoteActorId?: () => string | null;
  onStatus?: (status: SharedContentSyncStatus) => void;
}

const MAX_WIRE_MESSAGE_LENGTH = 5_000_000;
const MAX_DIRECT_MESSAGE_LENGTH = 8_192;
const MAX_CHUNK_DATA_LENGTH = 5_400;
const MAX_CHUNK_FRAMES = 1_500;
const MAX_CHUNK_TRANSFERS = 4;
const CHUNK_EXPIRY_MS = 20_000;
const MAX_RECORDS = 10_000;
const LOCAL_CHANGE_COALESCE_MS = 45;
const COLLECTIONS: SharedCollection[] = ["cards", "canvasObjects", "studyCategories", "studyBooks"];

const COLLECTION_KEYS: Record<SharedCollection, (value: Record<string, unknown>) => unknown> = {
  cards: (value) => value.id,
  canvasObjects: (value) => value.id,
  studyCategories: (value) => value.id,
  studyBooks: (value) => value.cardId,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeString(value: unknown, maxLength = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isVersion(value: unknown, allowZero: boolean): value is SharedContentVersion {
  if (!isRecord(value)) return false;
  return Number.isSafeInteger(value.clock)
    && (value.clock as number) >= (allowZero ? 0 : 1)
    && isSafeString(value.actorId, 128);
}

function isCollection(value: unknown): value is SharedCollection {
  return COLLECTIONS.includes(value as SharedCollection);
}

function recordIdMatches(collection: SharedCollection, id: string, value: Record<string, unknown>): boolean {
  const key = COLLECTION_KEYS[collection](value);
  return typeof key === "string" && key === id;
}

function isValidSharedEntity(collection: SharedCollection, id: string, value: Record<string, unknown>): boolean {
  if (!recordIdMatches(collection, id, value)) return false;
  if (collection === "canvasObjects") {
    return value.type === "card_node"
      && isSafeString(value.cardId)
      && typeof value.x === "number" && Number.isFinite(value.x)
      && typeof value.y === "number" && Number.isFinite(value.y);
  }
  if (collection === "studyCategories") {
    return typeof value.name === "string" && value.name.length <= 128
      && typeof value.order === "number" && Number.isFinite(value.order)
      && (value.color === undefined || typeof value.color === "string");
  }
  if (collection === "studyBooks") {
    if (value.categoryId !== null && !isSafeString(value.categoryId)) return false;
    if (typeof value.orderInShelf !== "number" || !Number.isFinite(value.orderInShelf)) return false;
    if (value.place !== undefined && value.place !== "shelf" && value.place !== "desk") return false;
    if (value.spineColor !== undefined && typeof value.spineColor !== "string") return false;
    if (value.decorColor !== undefined && (
      typeof value.decorColor !== "string" || !/^#?[0-9a-f]{6}$/i.test(value.decorColor)
    )) return false;
    if (value.decorSourceId !== undefined && !isSafeString(value.decorSourceId)) return false;
    if (value.desk !== undefined) {
      if (!isRecord(value.desk)
        || typeof value.desk.x !== "number" || !Number.isFinite(value.desk.x)
        || typeof value.desk.z !== "number" || !Number.isFinite(value.desk.z)
        || typeof value.desk.yawDeg !== "number" || !Number.isFinite(value.desk.yawDeg)) return false;
    }
    if (value.place === "desk" && value.desk === undefined) return false;
  }
  return true;
}

function makeRecordKey(collection: SharedCollection, id: string): string {
  return `${collection}\u0000${id}`;
}

function parseRecord(value: unknown, versionMayBeZero: boolean): SharedContentRecord | null {
  if (!isRecord(value) || !isCollection(value.collection) || !isSafeString(value.id)) return null;
  if (!isVersion(value, versionMayBeZero) || !isRecord(value.value)) return null;
  if (!isValidSharedEntity(value.collection, value.id, value.value)) return null;
  return {
    collection: value.collection,
    id: value.id,
    value: value.value,
    clock: value.clock,
    actorId: value.actorId,
  };
}

function parseTombstone(value: unknown): SharedContentTombstone | null {
  if (!isRecord(value) || !isCollection(value.collection) || !isSafeString(value.id)) return null;
  if (!isVersion(value, true)) return null;
  return {
    collection: value.collection,
    id: value.id,
    clock: value.clock,
    actorId: value.actorId,
  };
}

function parseOperation(value: unknown, messageActorId: string): SharedContentOperation | null {
  if (!isRecord(value) || !isCollection(value.collection) || !isSafeString(value.id)) return null;
  if (!isVersion(value, false) || value.actorId !== messageActorId) return null;
  if (value.action !== "upsert" && value.action !== "delete") return null;
  if (value.action === "delete") {
    if (value.value !== undefined) return null;
    return {
      collection: value.collection,
      id: value.id,
      action: "delete",
      clock: value.clock,
      actorId: value.actorId,
    };
  }
  if (!isRecord(value.value) || !isValidSharedEntity(value.collection, value.id, value.value)) return null;
  return {
    collection: value.collection,
    id: value.id,
    action: "upsert",
    value: value.value,
    clock: value.clock,
    actorId: value.actorId,
  };
}

export function parseSharedContentMessage(raw: unknown): SharedContentMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_WIRE_MESSAGE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== 1 || !isSafeString(parsed.actorId, 128)) return null;

  if (parsed.type === "shared-snapshot") {
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.tombstones)) return null;
    if (parsed.records.length + parsed.tombstones.length > MAX_RECORDS) return null;
    const records = parsed.records.map((record) => parseRecord(record, true));
    const tombstones = parsed.tombstones.map(parseTombstone);
    if (records.some((record) => !record) || tombstones.some((record) => !record)) return null;
    if ([...(records as SharedContentRecord[]), ...(tombstones as SharedContentTombstone[])]
      .some((record) => record.actorId !== parsed.actorId)) return null;
    const recordKeys = new Set<string>();
    for (const record of records as SharedContentRecord[]) {
      const key = makeRecordKey(record.collection, record.id);
      if (recordKeys.has(key)) return null;
      recordKeys.add(key);
    }
    for (const tombstone of tombstones as SharedContentTombstone[]) {
      const key = makeRecordKey(tombstone.collection, tombstone.id);
      if (recordKeys.has(key)) return null;
      recordKeys.add(key);
    }
    return {
      v: 1,
      type: "shared-snapshot",
      actorId: parsed.actorId,
      records: records as SharedContentRecord[],
      tombstones: tombstones as SharedContentTombstone[],
    };
  }

  if (parsed.type === "shared-operations") {
    if (!Array.isArray(parsed.operations) || parsed.operations.length === 0 || parsed.operations.length > 1_000) return null;
    const operations = parsed.operations.map((operation) => parseOperation(operation, parsed.actorId as string));
    if (operations.some((operation) => !operation)) return null;
    const keys = new Set<string>();
    for (const operation of operations as SharedContentOperation[]) {
      const key = makeRecordKey(operation.collection, operation.id);
      if (keys.has(key)) return null;
      keys.add(key);
    }
    return {
      v: 1,
      type: "shared-operations",
      actorId: parsed.actorId,
      operations: operations as SharedContentOperation[],
    };
  }

  if (parsed.type === "shared-ready" && typeof parsed.acknowledgement === "boolean") {
    return {
      v: 1,
      type: "shared-ready",
      actorId: parsed.actorId,
      acknowledgement: parsed.acknowledgement,
    };
  }

  return null;
}

export function extractSharedContentRecords(state: SharedContentStateLike): Map<string, Omit<SharedContentRecord, keyof SharedContentVersion>> {
  const records = new Map<string, Omit<SharedContentRecord, keyof SharedContentVersion>>();
  const cardIds = new Set((state.cards || []).map((card) => card?.id).filter((id): id is string => typeof id === "string"));
  const sources: Record<SharedCollection, Array<Record<string, unknown>>> = {
    cards: state.cards || [],
    canvasObjects: (state.canvasObjects || []).filter((object) =>
      object?.type === "card_node" && typeof object.cardId === "string" && cardIds.has(object.cardId)
    ),
    studyCategories: state.studyCategories || [],
    studyBooks: (state.studyBooks || []).filter((book) =>
      typeof book?.cardId === "string" && cardIds.has(book.cardId)
    ),
  };

  for (const collection of COLLECTIONS) {
    for (const value of sources[collection]) {
      if (!isRecord(value)) continue;
      const id = COLLECTION_KEYS[collection](value);
      if (typeof id !== "string" || !id || !isValidSharedEntity(collection, id, value)) continue;
      records.set(makeRecordKey(collection, id), { collection, id, value });
    }
  }
  return records;
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

export function compareSharedContentVersions(left: SharedContentVersion, right: SharedContentVersion): number {
  if (left.clock !== right.clock) return left.clock > right.clock ? 1 : -1;
  return left.actorId === right.actorId ? 0 : left.actorId > right.actorId ? 1 : -1;
}

function copyValue(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function upsertByKey(
  values: Array<Record<string, unknown>>,
  keyField: string,
  id: string,
  value: Record<string, unknown>,
  workspaceId?: string
): Array<Record<string, unknown>> {
  const normalized = copyValue(value);
  if (workspaceId && typeof normalized.workspaceId === "string") normalized.workspaceId = workspaceId;
  const nextValue = normalized;
  const index = values.findIndex((item) => item?.[keyField] === id);
  if (index < 0) return [...values, nextValue];
  return values.map((item, currentIndex) => currentIndex === index ? nextValue : item);
}

export function applySharedContentOperationsToState<T extends SharedContentStateLike>(
  state: T,
  operations: SharedContentOperation[]
): T {
  const valid = operations.filter((operation) =>
    isCollection(operation.collection)
      && isSafeString(operation.id)
      && (operation.action === "delete" || (
        operation.action === "upsert"
        && isRecord(operation.value)
        && isValidSharedEntity(operation.collection, operation.id, operation.value)
      ))
  );
  if (!valid.length) return state;

  let cards = state.cards;
  let canvasObjects = state.canvasObjects;
  let studyCategories = state.studyCategories;
  let studyBooks = state.studyBooks;
  let relations = state.relations || [];
  const workspaceId = state.workspace?.id;

  // Apply card operations first so matching node and book records in this batch can be validated.
  for (const operation of valid.filter((item) => item.collection === "cards")) {
    if (operation.action === "delete") {
      cards = cards.filter((card) => card?.id !== operation.id);
      canvasObjects = canvasObjects.filter((object) => object?.cardId !== operation.id);
      studyBooks = studyBooks.filter((book) => book?.cardId !== operation.id);
      relations = relations.filter((relation) => relation?.fromCardId !== operation.id && relation?.toCardId !== operation.id);
    } else if (operation.value) {
      cards = upsertByKey(cards, "id", operation.id, operation.value, workspaceId);
    }
  }

  for (const operation of valid.filter((item) => item.collection === "studyCategories")) {
    if (operation.action === "delete") {
      studyCategories = studyCategories.filter((category) => category?.id !== operation.id);
    } else if (operation.value) {
      studyCategories = upsertByKey(studyCategories, "id", operation.id, operation.value);
    }
  }

  for (const operation of valid.filter((item) => item.collection === "canvasObjects")) {
    if (operation.action === "delete") {
      canvasObjects = canvasObjects.filter((object) => object?.id !== operation.id);
    } else if (operation.value && typeof operation.value.cardId === "string" && cards.some((card) => card?.id === operation.value?.cardId)) {
      canvasObjects = upsertByKey(canvasObjects, "id", operation.id, operation.value, workspaceId);
    }
  }

  for (const operation of valid.filter((item) => item.collection === "studyBooks")) {
    if (operation.action === "delete") {
      studyBooks = studyBooks.filter((book) => book?.cardId !== operation.id);
    } else if (operation.value && cards.some((card) => card?.id === operation.id)) {
      studyBooks = upsertByKey(studyBooks, "cardId", operation.id, operation.value);
    }
  }

  return {
    ...state,
    cards,
    canvasObjects,
    studyCategories,
    studyBooks,
    ...(state.relations ? { relations } : {}),
  } as T;
}

interface ChunkFrame {
  v: 1;
  type: "shared-chunk";
  transferId: string;
  index: number;
  total: number;
  data: string;
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
  if (!isSafeString(parsed.transferId, 96)) return null;
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

export function serializeSharedContentMessage(message: SharedContentMessage): string[] | null {
  let raw: string;
  try {
    raw = JSON.stringify(message);
  } catch {
    return null;
  }
  if (raw.length > MAX_WIRE_MESSAGE_LENGTH) return null;
  if (raw.length <= MAX_DIRECT_MESSAGE_LENGTH) return [raw];
  const transferId = `x${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const chunks: string[] = [];
  for (let offset = 0; offset < raw.length; offset += MAX_CHUNK_DATA_LENGTH) {
    chunks.push(raw.slice(offset, offset + MAX_CHUNK_DATA_LENGTH));
  }
  if (chunks.length > MAX_CHUNK_FRAMES) return null;
  return chunks.map((data, index) => JSON.stringify({
    v: 1,
    type: "shared-chunk",
    transferId,
    index,
    total: chunks.length,
    data,
  } satisfies ChunkFrame));
}

export class SharedContentChunkAssembler {
  private pending = new Map<string, PendingChunkTransfer>();

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
      transfer = {
        total: frame.total,
        chunks: new Array<string | undefined>(frame.total),
        received: 0,
        length: 0,
        updatedAt: now,
      };
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
    if (transfer.length > MAX_WIRE_MESSAGE_LENGTH) {
      this.pending.delete(frame.transferId);
      return { handled: true };
    }
    if (transfer.received !== transfer.total) return { handled: true };

    const message = transfer.chunks.join("");
    this.pending.delete(frame.transferId);
    return message.length <= MAX_WIRE_MESSAGE_LENGTH ? { handled: true, message } : { handled: true };
  }

  clear(): void {
    this.pending.clear();
  }
}

function cloneVersion(version: SharedContentVersion): SharedContentVersion {
  return { clock: version.clock, actorId: version.actorId };
}

export class SharedContentReplicator {
  private readonly options: SharedContentSyncOptions;
  private previous: Map<string, Omit<SharedContentRecord, keyof SharedContentVersion>>;
  private versions = new Map<string, SharedContentVersion>();
  private tombstones = new Map<string, SharedContentVersion>();
  private pendingOperations: SharedContentOperation[] = [];
  private clock = 0;
  private mode: "owner" | "joiner" | null = null;
  private initialized = false;
  private snapshotReceived = false;
  private readySent = false;
  private stopped = false;
  private applyingRemote = false;
  private remoteActorId: string | null;
  private snapshotSentToActorId: string | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private status: SharedContentSyncStatus = "idle";
  private unsubscribe: (() => void) | null = null;

  constructor(options: SharedContentSyncOptions) {
    this.options = options;
    this.remoteActorId = options.getRemoteActorId?.() ?? null;
    this.previous = extractSharedContentRecords(options.getState());
    for (const key of this.previous.keys()) {
      this.versions.set(key, { clock: 0, actorId: options.actorId });
    }
    this.unsubscribe = options.subscribe(() => this.onLocalStoreChange());
  }

  start(mode: "owner" | "joiner"): void {
    if (this.stopped || this.mode) return;
    this.mode = mode;
    this.setStatus("syncing");
    if (mode === "joiner") this.startSyncTimer();
    if (mode === "owner") {
      this.initialized = true;
      this.sendSnapshotToKnownRemote();
    }
  }

  /** Send one snapshot after hello identifies a remote participant; duplicate hellos are harmless. */
  resendSnapshot(): boolean {
    if (this.stopped || this.mode !== "owner" || !this.initialized) return false;
    return this.sendSnapshotToKnownRemote();
  }

  permissionsChanged(): void {
    if (this.stopped) return;
    if (this.mode === "joiner" && this.snapshotReceived) {
      const role = this.options.getLocalRole();
      if (role === "reader") {
        this.pendingOperations = [];
        this.sendReady();
      } else if (role === "editor") {
        this.flushPendingOperations();
        this.sendReady();
      }
    } else {
      this.flushPendingOperations();
    }
  }

  private sendSnapshot(): boolean {
    const records = Array.from(this.previous.entries()).map(([key, record]) => {
      const version = this.versions.get(key) ?? { clock: 0, actorId: this.options.actorId };
      return { ...record, ...cloneVersion(version) };
    });
    const tombstones = Array.from(this.tombstones.entries()).map(([key, version]) => {
      const separator = key.indexOf("\u0000");
      return {
        collection: key.slice(0, separator) as SharedCollection,
        id: key.slice(separator + 1),
        ...cloneVersion(version),
      };
    });
    return this.sendMessage({
      v: 1,
      type: "shared-snapshot",
      actorId: this.options.actorId,
      records,
      tombstones,
    });
  }

  private sendSnapshotToKnownRemote(): boolean {
    const remoteActorId = this.getCurrentRemoteActorId();
    if (!remoteActorId || this.snapshotSentToActorId === remoteActorId) return false;
    if (!this.sendSnapshot()) return false;
    this.snapshotSentToActorId = remoteActorId;
    this.pendingOperations = [];
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.setStatus("syncing");
    this.startSyncTimer();
    return true;
  }

  private getCurrentRemoteActorId(): string | null {
    return this.options.getRemoteActorId?.() ?? this.remoteActorId;
  }

  private startSyncTimer(): void {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      if (this.status === "syncing") this.setStatus("error");
    }, 30_000);
  }

  handleRaw(raw: unknown): boolean {
    if (this.stopped || !this.mode) return false;
    const message = parseSharedContentMessage(raw);
    if (!message) return false;
    if (message.actorId === this.options.actorId || !this.isExpectedRemote(message.actorId)) return true;

    if (message.type === "shared-snapshot") {
      if (this.mode === "joiner" && !this.snapshotReceived) this.receiveInitialSnapshot(message);
      return true;
    }
    if (message.type === "shared-operations") {
      if (!this.initialized || !this.remoteMayEdit()) return true;
      this.receiveOperations(message.operations);
      return true;
    }
    if (message.type === "shared-ready") {
      if (this.mode === "owner" && !message.acknowledgement) {
        const role = this.options.getRemoteRole();
        if (role !== "editor" && role !== "reader") return true;
        const sent = this.sendMessage({
          v: 1,
          type: "shared-ready",
          actorId: this.options.actorId,
          acknowledgement: true,
        });
        if (sent) this.setStatus("synced");
      } else if (this.mode === "joiner" && message.acknowledgement) {
        this.setStatus("synced");
      }
      return true;
    }
    return true;
  }

  flushPendingOperations(): boolean {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.stopped) return false;
    if (!this.initialized || !this.pendingOperations.length) return true;
    if (this.mode === "owner") {
      const remoteActorId = this.getCurrentRemoteActorId();
      if (!remoteActorId || this.snapshotSentToActorId !== remoteActorId) return true;
    }
    const role = this.options.getLocalRole();
    if (role === "reader") {
      this.pendingOperations = [];
      return true;
    }
    if (role !== "owner" && role !== "editor") return false;
    const operations = this.pendingOperations.splice(0);
    for (let offset = 0; offset < operations.length; offset += 1_000) {
      const batch = operations.slice(offset, offset + 1_000);
      if (!this.sendMessage({
        v: 1,
        type: "shared-operations",
        actorId: this.options.actorId,
        operations: batch,
      })) {
        this.pendingOperations = [...operations.slice(offset), ...this.pendingOperations];
        this.setStatus("error");
        return false;
      }
    }
    return true;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.flushTimer = null;
    this.syncTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.pendingOperations = [];
  }

  private onLocalStoreChange(): void {
    if (this.stopped) return;
    const current = extractSharedContentRecords(this.options.getState());
    if (this.applyingRemote) {
      this.previous = current;
      return;
    }
    const changes: Array<{
      collection: SharedCollection;
      id: string;
      action: SharedContentAction;
      value?: Record<string, unknown>;
    }> = [];
    for (const [key, record] of current) {
      const previous = this.previous.get(key);
      if (previous && (previous.value === record.value || stableJson(previous.value) === stableJson(record.value))) continue;
      if (previous && record.collection === "cards"
        && stableJson(stripCollaborativeTextFields(previous.value)) === stableJson(stripCollaborativeTextFields(record.value))) {
        // Character-level CRDT operations own text-only changes; do not race them with whole-card LWW upserts.
        continue;
      }
      changes.push({ ...record, action: "upsert" });
    }
    for (const [key, previous] of this.previous) {
      if (!current.has(key)) changes.push({ collection: previous.collection, id: previous.id, action: "delete" });
    }
    this.previous = current;
    if (!changes.length) return;
    const version = this.nextLocalVersion();
    for (const change of changes) {
      const key = makeRecordKey(change.collection, change.id);
      this.versions.set(key, version);
      if (change.action === "delete") this.tombstones.set(key, version);
      else this.tombstones.delete(key);
      this.queuePendingOperation({ ...change, ...cloneVersion(version) });
    }
    if (this.initialized && this.options.getLocalRole() !== "pending") this.scheduleFlush();
  }

  private receiveInitialSnapshot(message: SharedContentSnapshotMessage): void {
    this.snapshotReceived = true;
    const remoteRecords = new Map<string, SharedContentRecord>();
    const remoteTombstones = new Map<string, SharedContentTombstone>();
    for (const record of message.records) {
      remoteRecords.set(makeRecordKey(record.collection, record.id), record);
      this.clock = Math.max(this.clock, record.clock);
    }
    for (const tombstone of message.tombstones) {
      remoteTombstones.set(makeRecordKey(tombstone.collection, tombstone.id), tombstone);
      this.clock = Math.max(this.clock, tombstone.clock);
    }

    const operationsToApply: SharedContentOperation[] = [];
    const allRemoteKeys = new Set([...remoteRecords.keys(), ...remoteTombstones.keys()]);
    for (const key of allRemoteKeys) {
      const remoteRecord = remoteRecords.get(key);
      const remoteTombstone = remoteTombstones.get(key);
      const remoteVersion = remoteRecord ?? remoteTombstone;
      if (!remoteVersion) continue;
      const localVersion = this.versions.get(key);
      if (localVersion && compareSharedContentVersions(remoteVersion, localVersion) <= 0) continue;
      this.versions.set(key, cloneVersion(remoteVersion));
      if (remoteRecord) {
        this.tombstones.delete(key);
        operationsToApply.push({ ...remoteRecord, action: "upsert" });
      } else {
        this.tombstones.set(key, cloneVersion(remoteTombstone!));
        const separator = key.indexOf("\u0000");
        operationsToApply.push({
          collection: key.slice(0, separator) as SharedCollection,
          id: key.slice(separator + 1),
          action: "delete",
          ...cloneVersion(remoteTombstone!),
        });
      }
    }

    this.pendingOperations = [];
    this.applyRemote(operationsToApply);
    this.initialized = true;

    // The joining editor contributes local-only records and deterministic conflict winners.
    const current = extractSharedContentRecords(this.options.getState());
    const contributionKeys = new Set([...current.keys(), ...this.tombstones.keys()]);
    for (const key of contributionKeys) {
      const localRecord = current.get(key);
      const remoteRecord = remoteRecords.get(key);
      const remoteTombstone = remoteTombstones.get(key);
      const remoteVersion = remoteRecord ?? remoteTombstone;
      const localVersion = this.versions.get(key);
      if (!localVersion || localVersion.actorId !== this.options.actorId) continue;
      if (localRecord) {
        if (remoteRecord && stableJson(remoteRecord.value) === stableJson(localRecord.value)) continue;
        if (remoteVersion && compareSharedContentVersions(localVersion, remoteVersion) <= 0) continue;
        const version = this.nextLocalVersion();
        this.versions.set(key, version);
        this.tombstones.delete(key);
        this.queuePendingOperation({ ...localRecord, action: "upsert", ...version });
      } else if (remoteRecord && this.tombstones.has(key) && remoteVersion && compareSharedContentVersions(localVersion, remoteVersion) > 0) {
        const version = this.nextLocalVersion();
        this.versions.set(key, version);
        this.tombstones.set(key, version);
        const separator = key.indexOf("\u0000");
        this.queuePendingOperation({
          collection: key.slice(0, separator) as SharedCollection,
          id: key.slice(separator + 1),
          action: "delete",
          ...version,
        });
      }
    }

    this.previous = current;
    this.permissionsChanged();
  }

  private receiveOperations(operations: SharedContentOperation[]): void {
    const accepted: SharedContentOperation[] = [];
    for (const operation of operations) {
      const key = makeRecordKey(operation.collection, operation.id);
      const currentVersion = this.versions.get(key);
      if (currentVersion && compareSharedContentVersions(operation, currentVersion) <= 0) continue;
      this.clock = Math.max(this.clock, operation.clock);
      this.versions.set(key, cloneVersion(operation));
      if (operation.action === "delete") this.tombstones.set(key, cloneVersion(operation));
      else this.tombstones.delete(key);
      accepted.push(operation);
    }
    this.applyRemote(accepted);
  }

  private applyRemote(operations: SharedContentOperation[]): void {
    if (!operations.length) return;
    this.applyingRemote = true;
    try {
      this.options.applyOperations(operations);
      this.previous = extractSharedContentRecords(this.options.getState());
    } finally {
      this.applyingRemote = false;
    }
  }

  private nextLocalVersion(): SharedContentVersion {
    this.clock += 1;
    if (!Number.isSafeInteger(this.clock)) this.clock = 1;
    return { clock: this.clock, actorId: this.options.actorId };
  }

  private queuePendingOperation(operation: SharedContentOperation): void {
    const existingIndex = this.pendingOperations.findIndex((pending) =>
      pending.collection === operation.collection && pending.id === operation.id
    );
    if (existingIndex < 0) this.pendingOperations.push(operation);
    else this.pendingOperations[existingIndex] = operation;
  }

  private scheduleFlush(): void {
    if (this.flushTimer || this.stopped) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushPendingOperations();
    }, LOCAL_CHANGE_COALESCE_MS);
  }

  private sendReady(): void {
    if (this.readySent || this.stopped || this.mode !== "joiner" || !this.initialized) return;
    const role = this.options.getLocalRole();
    if (role !== "editor" && role !== "reader") return;
    if (role === "reader") this.pendingOperations = [];
    else if (!this.flushPendingOperations()) return;
    if (this.pendingOperations.length) return;
    if (this.sendMessage({
      v: 1,
      type: "shared-ready",
      actorId: this.options.actorId,
      acknowledgement: false,
    })) this.readySent = true;
  }

  private isExpectedRemote(actorId: string): boolean {
    const knownActorId = this.options.getRemoteActorId?.() ?? this.remoteActorId;
    if (knownActorId && knownActorId !== actorId) return false;
    if (!this.remoteActorId) this.remoteActorId = actorId;
    return this.remoteActorId === actorId;
  }

  private remoteMayEdit(): boolean {
    const role = this.options.getRemoteRole();
    return this.mode === "owner" ? role === "editor" : role === "owner";
  }

  private sendMessage(message: SharedContentMessage): boolean {
    if (this.stopped) return false;
    let sent = false;
    try {
      sent = this.options.send(message);
    } catch {
      sent = false;
    }
    if (!sent) this.setStatus("error");
    return sent;
  }

  private setStatus(status: SharedContentSyncStatus): void {
    this.status = status;
    if ((status === "synced" || status === "error" || status === "idle") && this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.options.onStatus?.(status);
  }
}

export { MAX_DIRECT_MESSAGE_LENGTH as MAX_SHARED_CONTENT_CHUNK_LENGTH };
