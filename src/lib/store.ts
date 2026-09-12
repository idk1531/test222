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

/** v4：舊本機資料的過程日誌符號（⟲⚡⇹⋯）轉為文字標籤 */
function normalizeState(s: WorkspaceState): WorkspaceState {
  const logs = (s.processLogs || []).map((l: any) => ({
    ...l,
    logType: normalizeLogType(String(l.logType || "")),
  }));
  return { ...s, processLogs: logs };
}

function loadInitialState(): WorkspaceState {
  if (typeof window === "undefined") return buildSeedState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExportFilePayload;
      if (parsed?.state?.workspace?.id) {
        return normalizeState({ ...parsed.state, savedAt: new Date().toISOString() });
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

function setState(recipe: (s: WorkspaceState) => WorkspaceState, options: { deferPersist?: boolean } = {}) {
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
