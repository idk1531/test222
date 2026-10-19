// v8.0 虛擬書房：分類、書本佈置、視角的型別與純函式 helper（不依賴 React / component）。
//
// 設計重點（詳見 docs/v8.0-study-room.md）：
// - 一張筆記卡 ↔ 一本書（1:1，以 cardId 為 key）；一本書只會出現在一個櫃板。
// - 「書本外觀／櫃板佈置」與「卡片正文／畫布座標」完全分離：
//   移動書本不得改 CanvasObjectData.x/y；移動畫布卡片也不得改 orderInShelf。
// - 分類關聯以 categoryId 為準，不用分類名稱當 key。
// - 本檔只放資料結構、預設值、顏色/排列 helper 與遷移；狀態與持久化仍在 store.ts。

// ================= 型別 =================

export interface StudyCategory {
  id: string; // "cat-<timestamp>-<rand>"；系統保留分類固定為 UNCATEGORIZED_ID
  name: string; // 顯示名稱，改名不影響關聯（關聯以 id 為準）
  order: number; // 書架上的櫃板順序（0 起，保留分類恆在最後）
  color: string; // 標籤與書脊分類色（hex）
  createdAt: string;
  updatedAt: string;
}

export interface StudyDeskPosition {
  x: number;
  z: number;
  yawDeg: number;
}

export interface StudyBookLayout {
  cardId: string; // 必須等於 CardData.id（1:1）
  categoryId: string | null; // null = 未分類
  orderInShelf: number; // 同櫃板內的排列序（0 起）
  spineColor?: string; // 未設定時依序回退：畫布節點 style.accentColor → 形狀預設色
  /** v8.4 選填：缺省＝在書架上（舊資料完全不變） */
  place?: "shelf" | "desk";
  /** 僅 place === "desk" 有意義；房間座標系，公尺 */
  desk?: StudyDeskPosition;
  updatedAt: string;
}

/**
 * v8.1：書房相機狀態（可序列化，預留同步介面）。
 * yaw/pitch 為「角度」（與 v8.0 儲存格式相容；three.js 用時再轉弧度）。
 * yaw：360° 連續（水平任意轉）；pitch：−70°～+40°。
 * x/z：房間中的走動位置（公尺，缺省＝房間中央偏後）；height：視高（缺省 1.5）。
 */
export interface StudyCamera {
  yaw: number; // 角度，連續（不夾限，寫入前正規化至 (−180, 180]）
  pitch: number; // 角度，夾限 −70～+40
  x?: number; // 公尺
  z?: number; // 公尺
  height?: number; // 公尺
}

export interface StudyLayout {
  camera: StudyCamera; // 記住上次書房視角（含走動位置）
  shelfRows: number; // 書架層數（可隨書量增加）
}

/** 遷移時接受的最小結構（避免 lib 迴圈依賴；實際型別見 types.ts WorkspaceState） */
export interface StudyMigratable {
  cards: any[];
  studyCategories?: StudyCategory[] | null;
  studyBooks?: StudyBookLayout[] | null;
  studyLayout?: StudyLayout | null;
}

export type StudyStateFields = Pick<StudyMigratable, never> & {
  studyCategories: StudyCategory[];
  studyBooks: StudyBookLayout[];
  studyLayout: StudyLayout;
};

// ================= 常數 =================

/** 系統保留分類「未分類」：不可刪除、不可改名為空；新卡預設進未分類 */
export const UNCATEGORIZED_ID = "cat-uncategorized";
export const UNCATEGORIZED_NAME = "未分類";
export const UNCATEGORIZED_COLOR = "#a8a29e";

/**
 * v8.1：房間為 360° 可走動空間——yaw 不再夾限（連續旋轉），
 * pitch 夾限 −70°～+40°（避免穿地／穿天花）。
 */
export const CAMERA_LIMITS = { pitchMin: -70, pitchMax: 40 };
export const DEFAULT_CAMERA: StudyCamera = {
  yaw: -20, // 望向窗景（略偏西）
  pitch: -2,
  x: 0.9,
  z: 1.55,
  height: 1.5,
};

/** 分類預設色票（低飽和暖色系） */
export const CATEGORY_PALETTE = [
  "#b45309", "#0f766e", "#7c3aed", "#be123c",
  "#1d4ed8", "#a16207", "#4d7c0f", "#9d174d",
];

/**
 * 形狀預設色（與 SHAPE_DEFS.hex / store 的 SHAPE_ACCENT_HEX 一致）。
 * 刻意不從 component 匯入，避免 lib → component 相依。
 */
export const SHAPE_SPINE_HEX: Record<string, string> = {
  A: "#3b82f6",
  B: "#10b981",
  C: "#f59e0b",
  D: "#a855f7",
  E: "#f43f5e",
  COMPOSITE: "#1e293b",
};

// ================= 基礎 helper =================

export function genStudyId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

/** yaw 正規化至 (−180, 180]（360° 連續旋轉的儲存形式） */
export function normalizeYawDeg(yaw: number): number {
  let y = yaw % 360;
  if (y > 180) y -= 360;
  if (y <= -180) y += 360;
  return y;
}

export function clampCamera(yaw: number, pitch: number): { yaw: number; pitch: number } {
  return {
    yaw: normalizeYawDeg(yaw),
    pitch: Math.min(CAMERA_LIMITS.pitchMax, Math.max(CAMERA_LIMITS.pitchMin, pitch)),
  };
}

export function defaultStudyLayout(): StudyLayout {
  return { camera: { ...DEFAULT_CAMERA }, shelfRows: 1 };
}

export function makeCategory(name: string, order: number, color?: string): StudyCategory {
  const now = new Date().toISOString();
  return {
    id: genStudyId("cat"),
    name: name.trim() || "新分類",
    order,
    color: color || CATEGORY_PALETTE[order % CATEGORY_PALETTE.length],
    createdAt: now,
    updatedAt: now,
  };
}

export function makeBookForCard(cardId: string): StudyBookLayout {
  return {
    cardId,
    categoryId: null, // 新卡預設進未分類
    orderInShelf: 0,
    updatedAt: new Date().toISOString(),
  };
}

// ================= 顏色 / 書脊外觀 helper =================

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** hex → HSL（h 0-360, s/l 0-1） */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
  else if (max === gg) h = ((bb - rr) / d + 2) / 6;
  else h = ((rr - gg) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: [number, number, number] = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  const to255 = (v: number) => Math.round(Math.min(255, Math.max(0, (v + m) * 255)));
  return `#${[to255(rgb[0]), to255(rgb[1]), to255(rgb[2])]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * 降低飽和度（書本採低飽和色，避免高彩度色塊搶戲）。
 * amount 0（不變）～ 1（全灰）；同時把亮度夾到適合木色房間的區間。
 */
export function desaturateColor(hex: string, amount = 0.42): string {
  const rgb = parseHex(hex);
  if (!rgb) return "#8a6440";
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const ns = Math.max(0, Math.min(1, s * (1 - amount)));
  const nl = Math.max(0.38, Math.min(0.66, l));
  return hslToHex(h, ns, nl);
}

/**
 * 書脊顏色優先序（§4）：
 * StudyBookLayout.spineColor → 對應畫布物件 style.accentColor → SHAPE_SPINE_HEX[reasoningShape]
 */
export function resolveSpineColor(
  layout: Pick<StudyBookLayout, "spineColor"> | undefined,
  accentColor: string | undefined,
  reasoningShape: string | undefined
): string {
  return (
    layout?.spineColor ||
    accentColor ||
    SHAPE_SPINE_HEX[String(reasoningShape || "A")] ||
    "#3b82f6"
  );
}

/** 書本厚度：依內容長度微調（18–42px，含最小可點擊寬度 32px 需求 → 下限實際套用 32） */
export function bookThicknessFor(card: any): number {
  const len =
    String(card?.title || "").length +
    String(card?.whatData?.summary || "").length / 2 +
    String(card?.whyData?.fullReasoning || "").length / 8 +
    (card?.claims?.length || 0) * 2 +
    (card?.thoughtPoints?.length || 0) * 2;
  return Math.round(Math.min(42, Math.max(32, 32 + len / 24)));
}

/** 書本高度微差異（96–112px），以 cardId 穩定雜湊，重繪不會跳動 */
export function bookHeightFor(cardId: string): number {
  let h = 0;
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) >>> 0;
  return 96 + (h % 17);
}

/** 書封預覽的「摘要首行」 */
export function firstSummaryLine(card: any): string {
  const raw = String(card?.whatData?.summary || card?.backgroundDescription || "").trim();
  const line = raw.split(/\r?\n/).find((l: string) => l.trim()) || "";
  return line.trim().slice(0, 48) || "（尚未撰寫摘要）";
}

/**
 * 櫃板 → 書架層板的打包：依估計寬度順序放入列（先滿先放，順序不跳動）。
 * 書架層數隨書量增加（shelfRows）；不改任何卡片/書本內容。
 */
export function packBoards<T>(
  boards: T[],
  widthOf: (b: T) => number,
  capacity: number
): T[][] {
  const cap = Math.max(240, capacity);
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  for (const b of boards) {
    const w = widthOf(b);
    if (row.length > 0 && used + w > cap) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push(b);
    used += w;
  }
  if (row.length > 0) rows.push(row);
  return rows.length ? rows : [[]];
}

// ================= 遷移 =================

/**
 * v8.0：書房資料遷移／補齊（本機載入與 JSON 匯入共用；export 供測試與外部工具使用）。
 * - studyCategories：缺則補；至少保證一筆系統「未分類」；保留分類不可更名為空、恆排最後。
 * - studyBooks：每張卡一筆（1:1），缺則補建、孤兒（無對應卡）則移除；無效 categoryId 歸未分類。
 * - orderInShelf：同櫃板內重新編號 0..n-1（依既有順序，穩定不跳動）。
 * - studyLayout：補齊視角（夾限）與層數。
 * 舊資料不能掉：此函式只補齊、不刪除卡片內容。
 */
function normalizeBookPlace(book: StudyBookLayout): StudyBookLayout {
  if (book.place !== "desk") return book;
  const desk = book.desk as StudyDeskPosition | undefined;
  if (
    desk &&
    Number.isFinite(desk.x) &&
    Number.isFinite(desk.z) &&
    Number.isFinite(desk.yawDeg)
  ) return book;

  // Do not synthesize a desk coordinate: malformed/incomplete placement safely returns to the shelf.
  const shelfBook = { ...book, place: "shelf" as const };
  delete shelfBook.desk;
  return shelfBook;
}

export function ensureStudyState<T extends StudyMigratable>(s: T): T & StudyStateFields {
  const now = new Date().toISOString();

  // ---- 分類 ----
  const rawCats = Array.isArray(s.studyCategories) ? s.studyCategories.filter(Boolean) : [];
  let reserved = rawCats.find((c) => c.id === UNCATEGORIZED_ID);
  const userCats = rawCats
    .filter((c) => c.id !== UNCATEGORIZED_ID)
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
    )
    .map((c, i) => ({
      ...c,
      order: i,
      name: String(c.name || "").trim() || `分類 ${i + 1}`,
      color: parseHex(c.color) ? c.color : CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now,
    }));
  reserved = {
    id: UNCATEGORIZED_ID,
    name: String(reserved?.name || "").trim() || UNCATEGORIZED_NAME,
    order: userCats.length,
    color: reserved?.color || UNCATEGORIZED_COLOR,
    createdAt: reserved?.createdAt || now,
    updatedAt: reserved?.updatedAt || now,
  };
  const categories: StudyCategory[] = [...userCats, reserved];
  const catIds = new Set(categories.map((c) => c.id));

  // ---- 書本（每張卡一筆，1:1） ----
  const rawBooks = Array.isArray(s.studyBooks) ? s.studyBooks.filter((b: any) => b && b.cardId) : [];
  const byCard = new Map<string, StudyBookLayout>();
  for (const b of rawBooks) {
    if (!byCard.has(b.cardId)) byCard.set(b.cardId, normalizeBookPlace(b as StudyBookLayout));
  }
  const cards = Array.isArray(s.cards) ? s.cards.filter((c: any) => c && c.id) : [];
  const grouped = new Map<string, StudyBookLayout[]>();
  for (const card of cards) {
    const prev = byCard.get(card.id) || makeBookForCard(card.id);
    const categoryId = prev.categoryId != null && catIds.has(prev.categoryId) ? prev.categoryId : null;
    const bucketKey = categoryId ?? UNCATEGORIZED_ID;
    const bucket = grouped.get(bucketKey) || [];
    bucket.push({ ...prev, cardId: card.id, categoryId, updatedAt: prev.updatedAt || now });
    grouped.set(bucketKey, bucket);
  }
  const books: StudyBookLayout[] = [];
  for (const cat of categories) {
    const bucket = (grouped.get(cat.id) || []).sort(
      (a, b) => (a.orderInShelf ?? 0) - (b.orderInShelf ?? 0) || a.cardId.localeCompare(b.cardId)
    );
    bucket.forEach((b, i) => books.push({ ...b, orderInShelf: i }));
  }

  // ---- 書房佈局 ----
  // v8.1：camera 新增選填 x/z/height（舊資料自動補齊，STORAGE_KEY 不變）
  const rawCam = s.studyLayout?.camera;
  const num = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) ? Number(v) : fallback;
  const camera = {
    ...clampCamera(num(rawCam?.yaw, 0), num(rawCam?.pitch, 0)),
    x: num(rawCam?.x, DEFAULT_CAMERA.x ?? 0.9),
    z: num(rawCam?.z, DEFAULT_CAMERA.z ?? 1.55),
    height: num(rawCam?.height, DEFAULT_CAMERA.height ?? 1.5),
  };
  const studyLayout: StudyLayout = {
    camera,
    shelfRows: Math.max(1, Math.floor(Number(s.studyLayout?.shelfRows) || 1)),
  };

  return { ...s, studyCategories: categories, studyBooks: books, studyLayout };
}
