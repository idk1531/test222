"use client";

import { useSyncExternalStore } from "react";
import {
  SEED_WORKSPACE,
  SEED_CARDS,
  SEED_CANVAS_OBJECTS,
  SEED_RELATIONS,
  SEED_PROCESS_LOGS,
  SEED_BLIND_SPOTS,
  SEED_MOTHER_TOPICS,
} from "./seedData";
import { normalizeLogType } from "./inspect";
import {
  ensureStudyState,
  makeBookForCard,
  makeCategory,
  genStudyId,
  UNCATEGORIZED_ID,
  type StudyCamera,
  type StudyDeskPosition,
} from "./study";
import { SCHEMA_VERSION, WorkspaceState, ExportFilePayload } from "./types";
import { applySharedContentOperationsToState, type SharedContentOperation } from "./sharedContent";
import { getCollaborativeTextAtPath, setCollaborativeTextAtPath } from "./collaborationEditing";

// v8.0：虛擬書房資料結構（分類/書本/視角）隨工作區一起保存。
// 讀取時先找新 key，找不到再讀舊 key 遷移；舊 key 保留不刪（舊資料不能掉）。
const STORAGE_KEY = "scinotes-workspace-v8.0";
const LEGACY_STORAGE_KEYS = ["scinotes-workspace-v7.1"];

/** v7.2：各推理形狀的預設節點主色（與 SHAPE_DEFS.hex 一致；避免 lib → component 相依） */
const SHAPE_ACCENT_HEX: Record<string, string> = {
  A: "#3b82f6",
  B: "#10b981",
  C: "#f59e0b",
  D: "#a855f7",
  E: "#f43f5e",
  COMPOSITE: "#1e293b",
};

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function buildSeedState(): WorkspaceState {
  return ensureStudyState({
    workspace: clone(SEED_WORKSPACE),
    cards: clone(SEED_CARDS),
    canvasObjects: clone(SEED_CANVAS_OBJECTS),
    relations: clone(SEED_RELATIONS),
    processLogs: clone(SEED_PROCESS_LOGS),
    blindSpots: clone(SEED_BLIND_SPOTS),
    motherTopics: clone(SEED_MOTHER_TOPICS),
    versions: [],
    savedAt: new Date().toISOString(),
  } as unknown as WorkspaceState);
}

/** v4：舊本機資料的過程日誌符號（⟲⚡⇹⋯）轉為文字標籤 */
function normalizeState(s: WorkspaceState): WorkspaceState {
  const logs = (s.processLogs || []).map((l: any) => ({
    ...l,
    logType: normalizeLogType(String(l.logType || "")),
  }));
  return { ...s, processLogs: logs };
}

/**
 * v5：單張卡片 WHEN → HOW 遷移。
 * WHEN 併入 HOW：triggers → checks（橫跨性前置關卡）、steps → branches（可巢狀）、
 * enables → can（下游解鎖）、boundaryNotes → howData.boundaryNotes。
 * 已是 v5 結構（howData.branches 為陣列且無 whenData）則只做相容補全。
 */
function migrateCardToV5(card: any): any {
  let c = { ...card };
  const how: any = { ...(c.howData || {}) };
  const when: any = c.whenData;
  if (when || !Array.isArray(how.branches)) {
    const toBranch = (s: any) => ({
      id: s?.id,
      title: s?.title || "",
      action: s?.action || "",
      isCompiled: !!s?.isCompiled,
      ...(s?.checks?.length ? { checks: s.checks } : {}),
      ...(s?.branches?.length ? { branches: s.branches } : {}),
    });
    if (!Array.isArray(how.checks)) how.checks = when?.triggers || [];
    how.branches = Array.isArray(how.branches) ? how.branches : (how.steps || []).map(toBranch);
    if (!Array.isArray(how.can)) how.can = when?.enables || [];
    if (how.boundaryNotes === undefined && when?.boundaryNotes !== undefined) {
      how.boundaryNotes = when.boundaryNotes;
    }
    if (!how.status) how.status = "uncompiled";
    delete how.steps;
    const { whenData: _dropped, ...rest } = c;
    c = { ...rest, howData: how };
  }
  // v5 起沒有 WHEN 格：省略聲明裡的「WHEN」一併移除（併入後不再是可省略的獨立格）
  if (Array.isArray(c.omittedSlots) && c.omittedSlots.length > 0) {
    const kept = c.omittedSlots.filter((o: any) => o?.slot !== "WHEN");
    if (kept.length !== c.omittedSlots.length) c = { ...c, omittedSlots: kept };
  }
  return c;
}

/** v5：整套 state 的結構遷移（本機載入與 JSON 匯入共用；export 供測試與外部工具使用） */
export function applySchemaMigrations(s: WorkspaceState): WorkspaceState {
  const next = normalizeState(s);
  // v5：WHEN 併入 HOW；v8：補齊書房分類/書本/視角（舊檔匯入自動補齊，舊資料不掉）
  return ensureStudyState({ ...next, cards: (next.cards || []).map(migrateCardToV5) });
}

function loadInitialState(): WorkspaceState {
  if (typeof window === "undefined") return buildSeedState();
  try {
    // 先讀 v8.0 key；沒有再讀舊 key（讀到後會寫入新 key，舊 key 保留備份）
    for (const key of [STORAGE_KEY, ...LEGACY_STORAGE_KEYS]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as ExportFilePayload;
      if (parsed?.state?.workspace?.id) {
        return applySchemaMigrations({ ...parsed.state, savedAt: new Date().toISOString() });
      }
    }
  } catch (e) {
    console.warn("本機快取讀取失敗，改用種子資料", e);
  }
  return buildSeedState();
}

let state: WorkspaceState = loadInitialState();
const listeners = new Set<() => void>();
let collaborationReadOnly = false;

function persist(next: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const payload: ExportFilePayload = {
      schemaVersion: SCHEMA_VERSION,
      appName: "SciNotes Workbench",
      exportedAt: new Date().toISOString(),
      state: next,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("本機快取寫入失敗（可能超出容量）", e);
  }
}

let persistTimer: number | null = null;

function schedulePersist() {
  if (typeof window === "undefined") return;
  if (persistTimer) window.clearTimeout(persistTimer);
  // 畫布拖曳可每秒觸發數十次更新：畫面立即更新，磁碟保存稍後合併。
  persistTimer = window.setTimeout(() => {
    persist(state);
    persistTimer = null;
  }, 250);
}

function setState(recipe: (s: WorkspaceState) => WorkspaceState, options: { deferPersist?: boolean; allowReadOnly?: boolean } = {}) {
  if (collaborationReadOnly && !options.allowReadOnly) return;
  state = recipe(state);
  state = { ...state, savedAt: new Date().toISOString() };
  if (options.deferPersist) schedulePersist();
  else {
    if (persistTimer) {
      window.clearTimeout(persistTimer);
      persistTimer = null;
    }
    persist(state);
  }
  listeners.forEach((l) => l());
}

/**
 * v8.0：純函式的狀態更新入口（不碰 I/O、不碰時間戳）。
 * 下一輪接傳輸層（op log / WebRTC）時，遠端操作可統一以 patch 形式套用：
 *   state = applyPatch(state, patch)
 * 內容變更（cards 等）與空間/佈置變更（canvasObjects、studyBooks 等）分欄存放，
 * patch 可依欄位分流。
 */
export function applyPatch(state: WorkspaceState, patch: Partial<WorkspaceState>): WorkspaceState {
  return { ...state, ...patch };
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getState(): WorkspaceState {
  return state;
}

/** Keep shared workspace mutations read-only for guests assigned the viewer role. */
export function setCollaborationReadOnly(readOnly: boolean): void {
  collaborationReadOnly = readOnly;
}

/** Apply a validated state received from the P2P document layer, even for a viewer. */
export function replaceWorkspaceStateFromRemote(next: WorkspaceState): void {
  const migrated = applySchemaMigrations(next);
  setState(() => migrated, { allowReadOnly: true });
}

/** Apply only card/book records from a validated P2P message; unrelated local data stays local. */
export function applySharedContentOperations(operations: SharedContentOperation[]): void {
  if (!operations.length) return;
  setState((current) => applySharedContentOperationsToState(current, operations), { allowReadOnly: true });
}

/** Apply a validated live text CRDT value locally without producing a record-level LWW edit. */
export function applyCollaborativeTextUpdate(cardId: string, path: string, value: string): void {
  setState((current) => {
    const card = current.cards.find((item) => item.id === cardId);
    if (!card || getCollaborativeTextAtPath(card, path) === value) return current;
    return {
      ...current,
      cards: current.cards.map((item) => item.id === cardId ? setCollaborativeTextAtPath(item, path, value) : item),
    };
  }, { deferPersist: true, allowReadOnly: true });
}

export function useWorkspaceState(): WorkspaceState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ================= CRUD Actions（全部在前端執行） =================

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export const actions = {
  /** 更新一或多個畫布物件 */
  updateCanvasObjects(updates: Partial<any>[], options: { final?: boolean } = {}) {
    setState(
      (s) => ({
        ...s,
        canvasObjects: s.canvasObjects.map((o) => {
          const u = updates.find((x) => x.id === o.id);
          return u ? { ...o, ...u, updatedAt: new Date().toISOString() } : o;
        }),
      }),
      { deferPersist: options.final === false }
    );
  },

  createCanvasObject(data: Partial<any>) {
    const id = genId("obj");
    setState((s) => ({
      ...s,
      canvasObjects: [
        ...s.canvasObjects,
        {
          rotation: 0,
          zIndex: 5,
          isLocked: false,
          isHidden: false,
          style: {},
          content: {},
          semanticType: "AUXILIARY",
          ...data,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },

  deleteCanvasObject(id: string) {
    setState((s) => ({
      ...s,
      canvasObjects: s.canvasObjects.filter((o) => o.id !== id),
    }));
  },

  createCard(data: Partial<any>, position = { x: 100, y: 100 }) {
    const id = genId("card");
    const objId = genId("obj");
    setState((s) => ({
      ...s,
      cards: [
        ...s.cards,
        {
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
          ...data,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      canvasObjects: [
        ...s.canvasObjects,
        {
          id: objId,
          workspaceId: data.workspaceId || s.workspace.id,
          cardId: id,
          type: "card_node",
          x: position.x,
          y: position.y,
          width: 360,
          height: 300,
          rotation: 0,
          zIndex: 10,
          semanticType: "WHAT",
          content: { cardId: id },
          style: {
            backgroundColor: "#ffffff",
            borderColor: "#3b82f6",
            borderWidth: 2,
            borderRadius: 12,
            // v7.2：節點主色，預設跟著推理形狀；使用者可於畫布上自訂
            accentColor: SHAPE_ACCENT_HEX[data.reasoningShape || "A"] || "#3b82f6",
          },
          isLocked: false,
          isHidden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      // v8.0：新卡同時建立對應書本（1:1），預設進未分類櫃板
      studyBooks: [...s.studyBooks, makeBookForCard(id)],
    }));
    return id;
  },

  updateCard(id: string, updates: Partial<any>) {
    setState((s) => {
      const prev = s.cards.find((c) => c.id === id);
      const shapeChanged =
        typeof updates.reasoningShape === "string" &&
        updates.reasoningShape !== prev?.reasoningShape;
      const oldHex = SHAPE_ACCENT_HEX[prev?.reasoningShape || "A"] || "#3b82f6";
      const newHex = SHAPE_ACCENT_HEX[updates.reasoningShape || "A"] || "#3b82f6";
      return {
        ...s,
        cards: s.cards.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
        ),
        // 形狀改了、而節點仍停在舊形狀的「預設色」時，跟著換成新形狀預設色；
        // 已被使用者自訂過的顏色不動。
        canvasObjects: shapeChanged
          ? s.canvasObjects.map((o) =>
              o.cardId === id && o.style?.accentColor === oldHex
                ? { ...o, style: { ...o.style, accentColor: newHex }, updatedAt: new Date().toISOString() }
                : o
            )
          : s.canvasObjects,
      };
    });
  },

  deleteCard(id: string) {
    setState((s) => ({
      ...s,
      cards: s.cards.filter((c) => c.id !== id),
      canvasObjects: s.canvasObjects.filter((o) => o.cardId !== id),
      relations: s.relations.filter((r) => r.fromCardId !== id && r.toCardId !== id),
      // v8.0：刪卡時書本一起移除（卡↔書 1:1）
      studyBooks: s.studyBooks.filter((b) => b.cardId !== id),
    }));
  },

  upsertRelation(data: Partial<any>) {
    if (!data.id) {
      const id = genId("rel");
      setState((s) => ({
        ...s,
        relations: [
          ...s.relations,
          {
            distance: 1,
            status: "active",
            ...data,
            id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }));
      return id;
    }
    setState((s) => ({
      ...s,
      relations: s.relations.map((r) =>
        r.id === data.id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r
      ),
    }));
    return data.id;
  },

  deleteRelation(id: string) {
    setState((s) => ({
      ...s,
      relations: s.relations.filter((r) => r.id !== id),
    }));
  },

  // ================= v8.0 書房：分類 / 書本 / 佈局 =================
  // 注意：書本與畫布座標是兩套獨立資料——以下 action 只改 studyBooks/studyCategories，
  // 絕不改 canvasObjects.x/y（移動書本不得移動卡片；移動卡片也不得改 orderInShelf）。

  /** 新增分類櫃板（插在保留「未分類」之前） */
  addCategory(data: { name: string; color?: string }) {
    const id = genStudyId("cat");
    setState((s) => {
      const userCats = s.studyCategories.filter((c) => c.id !== UNCATEGORIZED_ID);
      const cat = makeCategory(data.name, userCats.length, data.color);
      return {
        ...s,
        studyCategories: [...userCats, { ...cat, id }],
      };
    });
    return id;
  },

  /** 改名／改色（關聯以 id 為準，改名不影響任何書本） */
  updateCategory(id: string, updates: { name?: string; color?: string }) {
    setState((s) => ({
      ...s,
      studyCategories: s.studyCategories.map((c) => {
        if (c.id !== id) return c;
        // 保留分類不可改名為空
        const name =
          updates.name !== undefined
            ? updates.name.trim() || (id === UNCATEGORIZED_ID ? c.name : "新分類")
            : c.name;
        return { ...c, name, color: updates.color ?? c.color, updatedAt: new Date().toISOString() };
      }),
    }));
  },

  /** 刪除分類（保留分類不可刪）；該櫃板的書全部回未分類，不刪卡 */
  deleteCategory(id: string) {
    if (id === UNCATEGORIZED_ID) return;
    setState((s) => ({
      ...s,
      studyCategories: s.studyCategories
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, order: i, updatedAt: new Date().toISOString() })),
      studyBooks: s.studyBooks.map((b) =>
        b.categoryId === id
          ? { ...b, categoryId: null, updatedAt: new Date().toISOString() }
          : b
      ),
    }));
  },

  /** 櫃板上下移動（保留分類恆在最後、不可移動） */
  moveCategory(id: string, dir: -1 | 1) {
    setState((s) => {
      const userCats = s.studyCategories
        .filter((c) => c.id !== UNCATEGORIZED_ID)
        .sort((a, b) => a.order - b.order);
      const idx = userCats.findIndex((c) => c.id === id);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= userCats.length) return s;
      const next = [...userCats];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      const renumbered = next.map((c, i) => ({ ...c, order: i, updatedAt: new Date().toISOString() }));
      const reserved = s.studyCategories.find((c) => c.id === UNCATEGORIZED_ID);
      return {
        ...s,
        studyCategories: reserved
          ? [...renumbered, { ...reserved, order: renumbered.length }]
          : renumbered,
      };
    });
  },

  /** 指派卡片到分類（null = 未分類）；移到櫃板尾端 */
  assignCardCategory(cardId: string, categoryId: string | null) {
    setState((s) => {
      const targetKey = categoryId ?? UNCATEGORIZED_ID;
      const targetBooks = s.studyBooks
        .filter((b) => (b.categoryId ?? UNCATEGORIZED_ID) === targetKey && b.cardId !== cardId)
        .sort((a, b) => a.orderInShelf - b.orderInShelf);
      return {
        ...s,
        studyBooks: s.studyBooks.map((b) =>
          b.cardId === cardId
            ? {
                ...b,
                categoryId,
                orderInShelf: targetBooks.length,
                updatedAt: new Date().toISOString(),
              }
            : b
        ),
      };
    });
  },

  /**
   * 書本重新排列：移到指定櫃板（categoryId；null = 未分類）的第 index 個位置。
   * 櫃板內排序與跨櫃板移動共用此入口；只動 orderInShelf / categoryId，不動畫布座標。
   */
  reorderBook(cardId: string, categoryId: string | null, index: number) {
    setState((s) => {
      const moving = s.studyBooks.find((b) => b.cardId === cardId);
      if (!moving) return s;
      const fromKey = moving.categoryId ?? UNCATEGORIZED_ID;
      const toKey = categoryId ?? UNCATEGORIZED_ID;
      const now = new Date().toISOString();

      // 來源櫃板（不含移動中的書）重新編號
      const fromBooks = s.studyBooks
        .filter((b) => b.cardId !== cardId && (b.categoryId ?? UNCATEGORIZED_ID) === fromKey)
        .sort((a, b) => a.orderInShelf - b.orderInShelf);
      // 目標櫃板（不含移動中的書）插入指定位置
      const toBooks =
        fromKey === toKey
          ? fromBooks
          : s.studyBooks
              .filter((b) => b.cardId !== cardId && (b.categoryId ?? UNCATEGORIZED_ID) === toKey)
              .sort((a, b) => a.orderInShelf - b.orderInShelf);
      const clamped = Math.max(0, Math.min(toBooks.length, Math.round(index)));
      toBooks.splice(clamped, 0, { ...moving, categoryId, updatedAt: now });

      const orderMap = new Map<string, { categoryId: string | null; orderInShelf: number }>();
      fromBooks.forEach((b, i) => orderMap.set(b.cardId, { categoryId: b.categoryId, orderInShelf: i }));
      if (fromKey !== toKey) {
        toBooks.forEach((b, i) => orderMap.set(b.cardId, { categoryId, orderInShelf: i }));
      } else {
        toBooks.forEach((b, i) => orderMap.set(b.cardId, { categoryId, orderInShelf: i }));
      }
      return {
        ...s,
        studyBooks: s.studyBooks.map((b) => {
          const next = orderMap.get(b.cardId);
          return next ? { ...b, ...next, updatedAt: now } : b;
        }),
      };
    });
  },

  /** 書本落點（瞬態拿起不寫入；只在放下/回架時持久化，不改原櫃板排序）。 */
  setBookPlace(cardId: string, place: "shelf" | "desk", desk?: StudyDeskPosition) {
    const validDesk = !!desk &&
      Number.isFinite(desk.x) &&
      Number.isFinite(desk.z) &&
      Number.isFinite(desk.yawDeg);
    setState((s) => ({
      ...s,
      studyBooks: s.studyBooks.map((book) => {
        if (book.cardId !== cardId) return book;
        const next = { ...book, updatedAt: new Date().toISOString() };
        if (place === "desk" && validDesk) {
          next.place = "desk";
          next.desk = { ...desk! };
        } else {
          next.place = "shelf";
          delete next.desk;
        }
        return next;
      }),
    }));
  },

  /** 確保每張卡都有對應書本（缺則補建；1:1 檢查的安全網） */
  ensureBookForCard(cardId: string) {
    setState((s) => {
      if (s.studyBooks.some((b) => b.cardId === cardId)) return s;
      const card = s.cards.find((c) => c.id === cardId);
      if (!card) return s;
      const books = [...s.studyBooks, makeBookForCard(cardId)];
      const targetKey = UNCATEGORIZED_ID;
      const targetBooks = books
        .filter((b) => (b.categoryId ?? UNCATEGORIZED_ID) === targetKey)
        .sort((a, b) => a.orderInShelf - b.orderInShelf);
      return {
        ...s,
        studyBooks: books.map((b) =>
          b.cardId === cardId ? { ...b, orderInShelf: targetBooks.length } : b
        ),
      };
    });
  },

  /**
   * 書房佈局（視角記憶含走動位置 x/z/height、書架層數）；與卡片內容無關。
   * camera 採合併更新：部分欄位（如拖曳結束只帶 yaw/pitch）不會洗掉 x/z/height。
   */
  updateStudyLayout(updates: Partial<{ camera: Partial<StudyCamera>; shelfRows: number }>) {
    setState((s) => ({
      ...s,
      studyLayout: {
        camera: updates.camera
          ? { ...s.studyLayout.camera, ...updates.camera }
          : s.studyLayout.camera,
        shelfRows: updates.shelfRows ?? s.studyLayout.shelfRows,
      },
    }));
  },

  addProcessLog(data: Partial<any>) {
    const id = genId("log");
    // v4：統一儲存為文字標籤（舊符號 ⟲⚡⇹⋯ → [增量][框架衝突][同session矛盾][未編譯]）
    const logType = normalizeLogType(String(data.logType || ""));
    setState((s) => ({
      ...s,
      processLogs: [
        { ...data, logType, id, createdAt: new Date().toISOString() } as any,
        ...s.processLogs,
      ],
    }));
    return id;
  },

  addBlindSpot(data: Partial<any>) {
    const id = genId("blindspot");
    setState((s) => ({
      ...s,
      blindSpots: [
        {
          severity: "medium",
          status: "open",
          ...data,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        ...s.blindSpots,
      ],
    }));
    return id;
  },

  updateBlindSpot(id: string, updates: Partial<any>) {
    setState((s) => ({
      ...s,
      blindSpots: s.blindSpots.map((b) =>
        b.id === id ? { ...b, ...updates, updatedAt: new Date().toISOString() } : b
      ),
    }));
  },

  addMotherTopic(data: Partial<any>) {
    const id = genId("motif");
    setState((s) => ({
      ...s,
      motherTopics: [
        ...s.motherTopics,
        {
          instanceCardIds: [],
          isVerified: false,
          ...data,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
      ],
    }));
    return id;
  },

  updateMotherTopic(id: string, updates: Partial<any>) {
    setState((s) => ({
      ...s,
      motherTopics: s.motherTopics.map((m) => {
        let next = { ...m, ...updates, updatedAt: new Date().toISOString() };
        // 母題規則：實例不足 3 個不可為已驗證
        if (next.instanceCardIds && next.instanceCardIds.length < 3) {
          next.isVerified = false;
        }
        return next.id === id ? next : m;
      }),
    }));
  },

  updateWorkspaceMeta(updates: Partial<any>) {
    setState((s) => ({
      ...s,
      workspace: { ...s.workspace, ...updates, updatedAt: new Date().toISOString() },
    }));
  },

  /** 新建版本快照 */
  addVersion(name: string) {
    const id = genId("ver");
    setState((s) => ({
      ...s,
      versions: [
        {
          id,
          workspaceId: s.workspace.id,
          name,
          snapshotData: {
            workspace: s.workspace,
            cards: s.cards,
            canvasObjects: s.canvasObjects,
            relations: s.relations,
            processLogs: s.processLogs,
            blindSpots: s.blindSpots,
            motherTopics: s.motherTopics,
          },
          createdAt: new Date().toISOString(),
        },
        ...s.versions,
      ],
    }));
    return id;
  },
};

// ================= 匯出 / 匯入 / 重置 =================

export type ExportMethod = "share" | "download" | "view" | "clipboard" | "failed";
export interface ExportResult {
  ok: boolean;
  method: ExportMethod;
  filename: string;
  /** 方便 UI 告知使用者實際採用的保存方式 */
  message: string;
}

/** 建立標準匯出 payload；所有匯出入口共用相同格式。 */
export function getExportPayload(): ExportFilePayload {
  return {
    schemaVersion: SCHEMA_VERSION,
    appName: "SciNotes Workbench",
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function getExportJson(): string {
  return JSON.stringify(getExportPayload(), null, 2);
}

function exportFilename() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `scinotes-workspace-${stamp}.json`;
}

/**
 * 匯出工作區（跨裝置 fallback）：
 * 1. Web Share API with File（iOS/iPadOS/Android 最穩：可「儲存到檔案」/傳送）
 * 2. Blob URL + anchor download（桌機、Chromium）
 * 3. 新分頁開啟 JSON（嵌入式 WebView/Safari 忽略 download 時，仍可手動分享/另存）
 *
 * 不在完成前 revoke Blob URL，避免慢速手機在 click 後找不到資源。
 */
export async function exportFile(): Promise<ExportResult> {
  const filename = exportFilename();
  if (typeof window === "undefined") {
    return { ok: false, method: "failed", filename, message: "目前不在瀏覽器環境，無法匯出。" };
  }

  const json = getExportJson();
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  // 舊版 Safari／內嵌 WebView 可能缺少 File constructor；不可因此阻斷後續下載備援。
  let file: File | null = null;
  try {
    file = new File([blob], filename, { type: "application/json;charset=utf-8" });
  } catch {
    file = null;
  }
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  const ua = navigator.userAgent || "";
  // iOS Safari/舊版 WebView 常忽略 anchor.download；它們應優先走「開啟 JSON → 系統分享」路徑。
  const likelyNoDirectDownload =
    /iP(hone|ad|od)/i.test(ua) ||
    /;\s*wv\)/i.test(ua) ||
    (/Version\/\d+.*Chrome/i.test(ua) && /Android/i.test(ua));

  // Mobile first: 原生分享可處理 iOS Safari、Android Chrome、平板 PWA。
  // 若使用者取消分享，繼續走下載 fallback，不把「取消」當成失敗。
  try {
    if (file && typeof nav.share === "function" && (!nav.canShare || nav.canShare({ files: [file] }))) {
      await nav.share({
        title: "SciNotes 工作區備份",
        text: "理科知識筆記工作台 JSON 備份",
        files: [file],
      });
      return { ok: true, method: "share", filename, message: "已開啟系統分享面板；請選擇「儲存到檔案」或分享目的地。" };
    }
  } catch (error) {
    // AbortError = 使用者關掉分享面板；仍給常規下載選項
    console.info("系統分享未完成，改用下載備援", error);
  }

  const url = URL.createObjectURL(blob);

  // 不支援原生分享、又可能忽略 download 的裝置：直接顯示原始 JSON。
  // 這仍保留使用者當下的手勢授權，能在 Safari / WebView 內使用分享或另存。
  if (likelyNoDirectDownload) {
    try {
      const opened = window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      if (opened) {
        return {
          ok: true,
          method: "view",
          filename,
          message: "此裝置已開啟 JSON 備份頁面；請使用瀏覽器的分享／儲存功能保存檔案。",
        };
      }
    } catch { /* move to standard anchor then copy fallback */ }
  }

  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // 延後釋放，兼容 Safari／慢裝置的非同步下載。
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, method: "download", filename, message: `已開始下載 ${filename}` };
  } catch (error) {
    // WebView 可能禁止 programmatic download；最後把 JSON 開在新頁供使用者長按/分享。
    try {
      const opened = window.open(url, "_blank");
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
      if (opened) {
        return {
          ok: true,
          method: "view",
          filename,
          message: "裝置不支援直接下載，已開啟 JSON 備份頁面；請使用瀏覽器的分享／儲存功能。",
        };
      }
    } catch { /* will use final failure below */ }
    URL.revokeObjectURL(url);
    return { ok: false, method: "failed", filename, message: "此瀏覽器阻擋了檔案下載。請改用「複製 JSON 備份」。" };
  }
}

/**
 * 最終純文字備援：Clipboard API 不可用時，採用選取 textarea + execCommand。
 * 可用於部分 iOS WebView、校園／企業內嵌瀏覽器。
 */
export async function copyExportJson(): Promise<ExportResult> {
  const filename = exportFilename();
  if (typeof window === "undefined") {
    return { ok: false, method: "failed", filename, message: "目前不在瀏覽器環境，無法複製。" };
  }
  const json = getExportJson();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(json);
      return { ok: true, method: "clipboard", filename, message: "JSON 已複製到剪貼簿；可貼到文字檔並另存為 .json。" };
    }
  } catch { /* use textarea fallback */ }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = json;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (ok) {
      return { ok: true, method: "clipboard", filename, message: "JSON 已複製到剪貼簿；可貼到文字檔並另存為 .json。" };
    }
  } catch { /* final failure */ }
  return { ok: false, method: "failed", filename, message: "裝置不允許存檔或剪貼簿。請改在標準瀏覽器開啟此網站。" };
}

/** 從 JSON 檔案匯入資料回應用 */
export function importFile(file: File): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<ExportFilePayload>;
        if (!parsed.state || !parsed.state.workspace?.id) {
          resolve({ ok: false, error: "檔案格式不符：缺少 state.workspace" });
          return;
        }
        setState(() => applySchemaMigrations({
          workspace: parsed.state!.workspace,
          cards: parsed.state!.cards || [],
          canvasObjects: parsed.state!.canvasObjects || [],
          relations: parsed.state!.relations || [],
          processLogs: parsed.state!.processLogs || [],
          blindSpots: parsed.state!.blindSpots || [],
          motherTopics: parsed.state!.motherTopics || [],
          versions: parsed.state!.versions || [],
          // v8.0：書房資料；舊檔沒有這三欄時由 applySchemaMigrations → ensureStudyState 補齊
          studyCategories: parsed.state!.studyCategories || [],
          studyBooks: parsed.state!.studyBooks || [],
          studyLayout: parsed.state!.studyLayout || { camera: { yaw: 0, pitch: 0 }, shelfRows: 1 },
          savedAt: new Date().toISOString(),
        }));
        resolve({ ok: true });
      } catch (e: any) {
        resolve({ ok: false, error: `解析失敗：${e?.message || e}` });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: "無法讀取檔案" });
    reader.readAsText(file);
  });
}

/** 重置為初始種子資料（清除本機快取） */
export function resetToSeed() {
  const fresh = buildSeedState();
  setState(() => fresh);
}
