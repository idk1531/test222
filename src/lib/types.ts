// 純前端型別定義（不依賴資料庫/伺服器）
export interface WorkspaceMeta {
  id: string;
  name: string;
  description?: string;
  settings?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcessLogItem {
  id: string;
  workspaceId: string;
  cardId?: string;
  logType: string; // [增量] | [框架衝突] | [同session矛盾] | [未編譯]
  title: string;
  oldContent?: string;
  newContent?: string;
  explanation?: string;
  sessionNote?: string;
  createdAt: string;
}

export interface BlindSpotItem {
  id: string;
  workspaceId: string;
  cardId?: string;
  title: string;
  description: string;
  domain?: string;
  severity: string; // low | medium | high | critical
  status: string; // open | resolved
  resolutionNotes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MotherTopicItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  instanceCardIds?: string[];
  hypothesisTest?: string;
  predictionVerification?: string;
  isVerified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VersionItem {
  id: string;
  workspaceId: string;
  name: string;
  snapshotData?: Record<string, any>;
  createdAt: string;
}

export interface WorkspaceState {
  workspace: WorkspaceMeta;
  cards: any[];
  canvasObjects: any[];
  relations: any[];
  processLogs: ProcessLogItem[];
  blindSpots: BlindSpotItem[];
  motherTopics: MotherTopicItem[];
  versions: VersionItem[];
  savedAt?: string;
}

// v7：寫入《取用的設計：讀法、視角與六向延伸》（2026-10-13）
// ① WHAT 新增「讀法」（問題×讀法表、橋的 4 種關係、機械檢查）
// ② 視角與讀法為兩條獨立軸（4 種組合）＋ v6 借鏡視角與對應表/可核對事實寫作規則
// ③ 五向延伸改為六向延伸，新增「造」（選了什麼/換選擇會怎樣/連回對象）與關係邊 [衍生]
// ④ 洞見檢查改為功能判準（每句延伸附一道「拿掉這句就會答錯或做不出來」的題）
// ⑤ APPLY 來源標籤 [源:___] 併入 [源:WHAT-讀法n] ＋ 兩段式（識別/構造）
// ⑥ 新增附錄 B（讀法原則 12 條）、附錄 C（橋與平均數示範）、附錄 D（狀態與未解問題）
export const SCHEMA_VERSION = 7;

export interface ExportFilePayload {
  schemaVersion: number;
  appName: string;
  exportedAt: string;
  state: WorkspaceState;
}
