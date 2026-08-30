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
import { SCHEMA_VERSION, WorkspaceState, ExportFilePayload } from "./types";

const STORAGE_KEY = "scinotes-workspace-v4";

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function buildSeedState(): WorkspaceState {
  return {
    workspace: clone(SEED_WORKSPACE),
    cards: clone(SEED_CARDS),
    canvasObjects: clone(SEED_CANVAS_OBJECTS),
    relations: clone(SEED_RELATIONS),
    processLogs: clone(SEED_PROCESS_LOGS),
    blindSpots: clone(SEED_BLIND_SPOTS),
    motherTopics: clone(SEED_MOTHER_TOPICS),
    versions: [],
    savedAt: new Date().toISOString(),
  };
}

function loadInitialState(): WorkspaceState {
  if (typeof window === "undefined") return buildSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExportFilePayload;
      if (parsed?.state?.workspace?.id) {
        return { ...parsed.state, savedAt: new Date().toISOString() };
      }
    }
  } catch (e) {
    console.warn("本機快取讀取失敗，改用種子資料", e);
  }
  return buildSeedState();
}

let state: WorkspaceState = loadInitialState();
const listeners = new Set<() => void>();

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

function setState(recipe: (s: WorkspaceState) => WorkspaceState) {
  state = recipe(state);
  state = { ...state, savedAt: new Date().toISOString() };
  persist(state);
  listeners.forEach((l) => l());
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

export function useWorkspaceState(): WorkspaceState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ================= CRUD Actions（全部在前端執行） =================

function genId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

export const actions = {
  /** 更新一或多個畫布物件 */
  updateCanvasObjects(updates: Partial<any>[]) {
    setState((s) => ({
      ...s,
      canvasObjects: s.canvasObjects.map((o) => {
        const u = updates.find((x) => x.id === o.id);
        return u ? { ...o, ...u, updatedAt: new Date().toISOString() } : o;
      }),
    }));
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
            perspectives: [],
            distinctionFromHow: "",
          },
          whyData: {
            confidenceBefore: 3,
            closedBookDraft: "",
            fullReasoning: "",
            confidenceAfter: 3,
            subGoals: [],
          },
          howData: { steps: [], status: "uncompiled" },
          whenData: { triggers: [], enables: [] },
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
          },
          isLocked: false,
          isHidden: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }));
    return id;
  },

  updateCard(id: string, updates: Partial<any>) {
    setState((s) => ({
      ...s,
      cards: s.cards.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    }));
  },

  deleteCard(id: string) {
    setState((s) => ({
      ...s,
      cards: s.cards.filter((c) => c.id !== id),
      canvasObjects: s.canvasObjects.filter((o) => o.cardId !== id),
      relations: s.relations.filter((r) => r.fromCardId !== id && r.toCardId !== id),
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

  addProcessLog(data: Partial<any>) {
    const id = genId("log");
    setState((s) => ({
      ...s,
      processLogs: [
        { ...data, id, createdAt: new Date().toISOString() } as any,
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

/** 匯出全部資料為 JSON 檔案（瀏覽器下載） */
export function exportFile() {
  if (typeof window === "undefined") return;
  const payload: ExportFilePayload = {
    schemaVersion: SCHEMA_VERSION,
    appName: "SciNotes Workbench",
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `scinotes-workspace-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
        setState(() => ({
          workspace: parsed.state!.workspace,
          cards: parsed.state!.cards || [],
          canvasObjects: parsed.state!.canvasObjects || [],
          relations: parsed.state!.relations || [],
          processLogs: parsed.state!.processLogs || [],
          blindSpots: parsed.state!.blindSpots || [],
          motherTopics: parsed.state!.motherTopics || [],
          versions: parsed.state!.versions || [],
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
