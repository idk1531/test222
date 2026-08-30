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
  logType: string; // ⟲ | ⚡ | ⇹ | ⋯
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

export const SCHEMA_VERSION = 4;

export interface ExportFilePayload {
  schemaVersion: number;
  appName: string;
  exportedAt: string;
  state: WorkspaceState;
}
