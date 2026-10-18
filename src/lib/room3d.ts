// v8.1 全景書房：房間參數純資料＋純函式。
// 集中管理：房間尺寸、窗／桌／書架位置、光源參數（預留未來晝夜切換，本輪不做切換 UI）、
// 相機限制、畫質分級、3D→CSS 投影幫助函式、書架佈局計算。
// three.js 元件（StudyScene/RoomGeometry/WindowLight/CameraRig）皆由此取參數。
import * as THREE from "three";
import {
  bookHeightFor,
  bookThicknessFor,
  packBoards,
  UNCATEGORIZED_ID,
  type StudyBookLayout,
  type StudyCategory,
} from "./study";

// ================= 房間尺寸（公尺） =================
export const ROOM = {
  width: 6, // X：東西向（−3 … +3）
  depth: 5, // Z：南北向（−2.5 … +2.5）
  height: 3.1, // Y
  wall: 0.12, // 牆厚
};

// 大窗（北牆 z = −depth/2；窗台略高於桌面，溫和日光由窗外左上方射入）
export const WINDOW = {
  cx: -0.55, // 窗中心 X（略偏西）
  width: 3.4,
  sill: 1.02, // 窗台高（高於桌面 0.78）
  top: 2.72,
  frame: 0.085, // 窗框寬
  depth: 0.16,
  mullions: 2, // 直向窗櫺（窗分 3 格）
  bars: 1, // 橫向窗櫺
};

// 壁掛書桌（貼窗下牆面、無桌腿、桌板有厚度）
export const DESK = {
  cx: -0.55,
  width: 3.0,
  depth: 1.55,
  top: 0.78, // 桌面高度
  thickness: 0.05,
};

// 書架（東牆 x = +width/2，面向房間 −X）
export const SHELF = {
  z: 0.15, // 中心 Z
  width: 2.5, // 沿 Z 軸寬度
  height: 2.05,
  depth: 0.3,
  xBack: ROOM.width / 2 - 0.16, // 背板 X（貼牆）
  baseY: 0.07,
  side: 0.03, // 側板厚
  bookDepth: 0.19, // 書本深度（X 向）
  bookGap: 0.006,
  boardGap: 0.05,
  labelWidth: 0.15, // 櫃板標籤佔寬
  maxRowHeight: 0.52,
  pullOut: 0.055, // 書本抽出距離（預覽）
};

// ================= 光源（參數集中於此，預留晝夜切換） =================
export const SUN = {
  color: "#fff3d6", // 淡金（色溫約 4000K）
  intensity: 3.0,
  position: new THREE.Vector3(-2.35, 2.6, -ROOM.depth / 2 - 1.1), // 窗外左上方
  target: new THREE.Vector3(0.85, 0.12, 1.35),
  shadowMap: { desktop: 2048, mobile: 1024 },
};
export const AMBIENT = {
  hemisphereSky: "#e8f0f7",
  hemisphereGround: "#caa87a",
  hemisphereIntensity: 0.55,
  ambientColor: "#ffe9c8",
  ambientIntensity: 0.3,
};

// ================= 相機 =================
export const CAMERA = {
  fov: 62,
  near: 0.05,
  far: 80,
  pitchMin: THREE.MathUtils.degToRad(-70),
  pitchMax: THREE.MathUtils.degToRad(40),
  heightMin: 1.0,
  heightMax: 2.3,
  wallMargin: 0.35, // 離牆最小距離（不可穿牆）
  walkSpeed: 2.2, // m/s
  sprintMultiplier: 2,
  lookSensitivity: 0.0042, // rad/px
  wheelHeightStep: 0.07,
};

// ================= 照片級貼圖（v8.2，對應參考圖拍板的材質） =================
// 資產位置：`public/textures/study-room/`（由 scripts/make-room-textures.sh 產製）。
// `enabled: false` 或圖片載入失敗 → 自動退回 RoomGeometry／WindowLight 的程序化紋理，
// 所以關掉此開關即可回到 v8.1 的純程序化視覺。
export type TextureKey =
  | "walnut"
  | "oak"
  | "marble"
  | "plaster"
  | "garden"
  | "spines";
/** 地板材質：oak＝v8.1 暖橡木拼板；marble＝圖一的淺灰大理石地坪 */
export type RoomFloorMaterial = "oak" | "marble";

export const TEXTURES: {
  enabled: boolean;
  /** 相對 basePath 的資料夾（`roomTextures.assetUrl` 負責補部署前綴） */
  dir: string;
  floor: RoomFloorMaterial;
  files: Record<TextureKey, string>;
  /** 平貼密度（次數）；spines／garden 為單張非平貼 */
  repeat: Record<
    "wall" | "floorOak" | "floorMarble" | "desk" | "shelf" | "spines",
    [number, number]
  >;
} = {
  enabled: true,
  dir: "textures/study-room",
  floor: "oak",
  files: {
    walnut: "walnut.jpg", // 書牆胡桃木（圖一深胡桃書架）
    oak: "oak-floor.jpg", // 暖橡木拼板地板
    marble: "marble.jpg", // 淺灰大理石（沿窗桌板／可選地坪）
    plaster: "plaster.jpg", // 米白細顆粒牆面
    garden: "garden-view.jpg", // 窗外綠意庭園（保留的「布景」）
    spines: "book-spines.jpg", // 書脊色票（書架背板暗景）
  },
  repeat: {
    wall: [3, 2],
    floorOak: [2.2, 1.8],
    floorMarble: [1.5, 1.25],
    desk: [1.6, 0.9],
    shelf: [1.4, 1],
    spines: [1, 1],
  },
};

// 色票（沿用 v8.0／v7.2）
export const PALETTE = {
  oak: "#d9b98a",
  honey: "#c79a5b",
  brown: "#8a6440",
  wall: "#f3ece0",
  wallWarm: "#e6ded2",
  cream: "#faf5ea",
  sun: "#fff3d6",
  paper: "#faf7ee",
};

// 畫質分級（手機自動降級）
export interface SceneQuality {
  mobile: boolean;
  pixelRatio: number;
  shadowMap: number;
  lightShafts: boolean;
  dust: boolean;
}

export function detectQuality(): SceneQuality {
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;
  const small =
    typeof window !== "undefined" &&
    Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse || small;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return {
    mobile,
    pixelRatio: Math.min(dpr, mobile ? 1.5 : 2),
    shadowMap: mobile ? SUN.shadowMap.mobile : SUN.shadowMap.desktop,
    lightShafts: !mobile,
    dust: !mobile,
  };
}

// ================= 純函式 helper =================

export function clampRoomPosition(x: number, z: number): { x: number; z: number } {
  const mx = ROOM.width / 2 - CAMERA.wallMargin;
  const mz = ROOM.depth / 2 - CAMERA.wallMargin;
  return {
    x: Math.min(mx, Math.max(-mx, x)),
    z: Math.min(mz, Math.max(-mz, z)),
  };
}

export function clampPitchRad(pitch: number): number {
  return Math.min(CAMERA.pitchMax, Math.max(CAMERA.pitchMin, pitch));
}

export function clampHeight(h: number): number {
  return Math.min(CAMERA.heightMax, Math.max(CAMERA.heightMin, h));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** 由 yaw/pitch（弧度）求視線方向。yaw 0 = 望北（−Z），正值轉向東；pitch 正 = 仰視 */
export function forwardFromYawPitch(yaw: number, pitch: number): THREE.Vector3 {
  const cp = Math.cos(pitch);
  return new THREE.Vector3(Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
}

/**
 * 3D 錨點 → 螢幕 CSS 座標（HTML 浮層定位用）。
 * 背後或螢幕外回傳 visible:false（浮層隱藏，不會亂跳）。
 */
export function projectToScreen(
  v: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement
): { x: number; y: number; visible: boolean } {
  // 先判斷是否在相機前方（camera space z < 0）
  const camSpace = v.clone().applyMatrix4(camera.matrixWorldInverse);
  const inFront = camSpace.z < 0;
  const p = v.clone().project(camera);
  const w = dom.clientWidth;
  const h = dom.clientHeight;
  return {
    x: (p.x * 0.5 + 0.5) * w,
    y: (-p.y * 0.5 + 0.5) * h,
    visible: inFront && p.x >= -1.05 && p.x <= 1.05 && p.y >= -1.05 && p.y <= 1.05,
  };
}

// ================= 書架佈局（純計算；幾何與書本共用同一真相） =================

/** 層板行高（依層數均分，上限 maxRowHeight） */
export function shelfRowHeight(rowCount: number): number {
  return Math.min(
    SHELF.maxRowHeight,
    (SHELF.height - 0.14 - 0.06 * (rowCount - 1)) / Math.max(1, rowCount)
  );
}

/** 第 row 列層板頂面 Y（與 computeShelfLayout 同一公式） */
export function shelfPlankY(row: number, rowCount: number): number {
  return SHELF.baseY + 0.05 + row * (shelfRowHeight(rowCount) + 0.06);
}

export interface ShelfBookItem {
  cardId: string;
  categoryId: string | null;
  spineHex: string;
  categoryHex: string | null;
  shapeHex: string;
  thickness: number; // 公尺
  height: number; // 公尺
}

export interface ShelfBookPlacement extends ShelfBookItem {
  x: number; // 書本中心世界座標
  y: number;
  z: number;
}

export interface ShelfBoardLayout {
  category: StudyCategory;
  z0: number; // 沿 Z 軸起點
  z1: number;
  books: ShelfBookPlacement[];
  empty: boolean;
}

export interface ShelfRowLayout {
  row: number;
  plankY: number; // 層板頂面 Y
  boards: ShelfBoardLayout[];
}

export interface ShelfLayout {
  rows: ShelfRowLayout[];
  rowHeight: number;
  innerWidth: number;
  innerHeight: number;
  frontX: number; // 櫃板前面 X（書脊貼齊處）
}

/** 書本外觀尺寸（公尺）：厚度／高度沿用 v8.0 helper 並換算；深度微差異 */
export function shelfBookDims(card: any): {
  thickness: number;
  height: number;
  depth: number;
} {
  const thickness = bookThicknessFor(card) * 0.0008; // 32–42px → 2.6–3.4cm
  const height = bookHeightFor(card.id ?? "") * 0.0019; // 96–112px → 18–21cm
  let h = 0;
  const id = String(card?.id || "");
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const depth = SHELF.bookDepth * (0.86 + ((h % 13) / 13) * 0.2); // 16–22cm
  return { thickness, height, depth };
}

/**
 * 書架佈局：分類 → 板材打包（公尺為單位）→ 世界座標。
 * 書架本體（層板／隔板）與書本位置都由此計算，兩者永不脫節。
 */
export function computeShelfLayout(
  categories: StudyCategory[],
  books: StudyBookLayout[],
  cards: any[],
  spineHexOf: (book: StudyBookLayout, card: any) => string
): ShelfLayout {
  const innerWidth = SHELF.width - SHELF.side * 2 - 0.04;
  const innerHeight = SHELF.height - 0.14;
  const frontX = SHELF.xBack - SHELF.depth + 0.012;

  const sortedCats = [...categories].sort((a, b) => a.order - b.order);
  const known = new Set(cards.map((c) => c.id));
  const boards = sortedCats.map((cat) => {
    const items = books
      .filter(
        (b) =>
          b.cardId &&
          known.has(b.cardId) &&
          (b.categoryId ?? UNCATEGORIZED_ID) === cat.id
      )
      .sort((a, b) => a.orderInShelf - b.orderInShelf)
      .map((book) => {
        const card = cards.find((c) => c.id === book.cardId)!;
        return { book, card };
      });
    return { cat, items };
  });

  const widthOf = (b: { items: Array<{ card: any }> }) =>
    SHELF.labelWidth +
    b.items.reduce(
      (n, it) => n + shelfBookDims(it.card).thickness + SHELF.bookGap,
      0
    );
  const packed = packBoards(boards, widthOf, innerWidth);

  const rows = Math.max(1, packed.length);
  const rowHeight = shelfRowHeight(rows);

  const layoutRows: ShelfRowLayout[] = packed.map((rowBoards, ri) => {
    const plankY = shelfPlankY(ri, rows);
    let zCursor = SHELF.z - innerWidth / 2 + 0.02;
    const rowBoardsOut: ShelfBoardLayout[] = rowBoards.map((board) => {
      const z0 = zCursor;
      const placements: ShelfBookPlacement[] = [];
      let bz = z0 + SHELF.labelWidth;
      for (const { book, card } of board.items) {
        const dims = shelfBookDims(card);
        const spineHex = spineHexOf(book, card);
        placements.push({
          cardId: card.id,
          categoryId: book.categoryId ?? null,
          spineHex,
          categoryHex: board.cat.id === UNCATEGORIZED_ID ? null : board.cat.color,
          shapeHex: card.reasoningShape ? shapeHexOf(card.reasoningShape) : "#3b82f6",
          thickness: dims.thickness,
          height: dims.height,
          x: frontX - dims.depth / 2,
          y: plankY + 0.013 + dims.height / 2,
          z: bz + dims.thickness / 2,
        });
        bz += dims.thickness + SHELF.bookGap;
      }
      zCursor += widthOf(board) + SHELF.boardGap;
      return {
        category: board.cat,
        z0,
        z1: zCursor - SHELF.boardGap,
        books: placements,
        empty: board.items.length === 0,
      };
    });
    return { row: ri, plankY, boards: rowBoardsOut };
  });

  return { rows: layoutRows, rowHeight, innerWidth, innerHeight, frontX };
}

/** 形狀預設色（與 study.ts SHAPE_SPINE_HEX 同步；避免 lib → component 相依） */
const SHAPE_HEX: Record<string, string> = {
  A: "#3b82f6",
  B: "#10b981",
  C: "#f59e0b",
  D: "#a855f7",
  E: "#f43f5e",
  COMPOSITE: "#1e293b",
};
function shapeHexOf(shape: string): string {
  return SHAPE_HEX[String(shape || "A")] || "#3b82f6";
}
