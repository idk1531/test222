// v8.1 全景書房：房間參數純資料＋純函式。
// 集中管理：房間尺寸、窗／桌／書架位置、光源參數（預留未來晝夜切換，本輪不做切換 UI）、
// 相機限制、畫質分級、3D→CSS 投影幫助函式、書架佈局計算。
// three.js 元件（StudyScene/RoomGeometry/WindowLight/CameraRig）皆由此取參數。
import * as THREE from "three";
import { CHARACTER } from "./character";
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
  height: 2.75, // v8.3：圖一量測值（原 3.1）
  wall: 0.12, // 牆厚
};

// 大窗（北牆 z = −depth/2；窗台略高於桌面，溫和日光由窗外右上方射入）
// v8.3：框變細、單中挺、無橫櫺（圖一＝大玻璃＋一條直中挺）
export const WINDOW = {
  cx: -0.3, // 窗中心 X（v8.6：依附圖北牆幾乎整面開窗，西側只留 9 cm 牆墩）
  width: 4.9,
  sill: 0.9, // 窗台高（大理石檯面頂）
  top: 2.58,
  frame: 0.055, // 窗框寬（原 0.085）
  depth: 0.16,
  mullions: 2, // 直向窗櫺（附圖：大面窗分成三格）
  bars: 0, // 無橫向窗櫺
  sillDepth: 0.3, // 窗台大理石深（與桌板同材質）
  sillThickness: 0.12, // 窗台石塊厚（自桌面 0.78 墊到 0.90）
};

// L 形大理石檯面：沿窗 3.4 m ＋ 沿西牆回折 1.7 m ＋ 東側延伸（盆栽）
// 桌板頂 0.78、厚 0.05、深 0.68；CameraRig 的飛行公式 deskZ = −D/2 + wall + depth/2
// 必須落在板中央，因此 depth 與桌板位置以此為錨（桌板後緣離牆 0.12，由窗台石與櫃體填滿）。
export const DESK = {
  cx: -0.55, // 沿窗段中心 X（＝窗中心；飛行目標沿用）
  width: 3.4, // 沿窗段寬（＝窗寬）
  depth: 0.68, // 檯面深
  top: 0.78, // 桌面高度
  thickness: 0.05,
  sideDepth: 1.7, // 沿西牆回折段長（Z）
  wingWidth: 0.8, // 東側延伸（龜背竹座）
  sideX: 0.68, // 西牆回折段深（X）
};

// 桌下落地的深炭櫃（圖一：櫃高 0.73、深 0.60、4 片門、縫 0.008）
export const CABINET = {
  height: 0.73,
  depth: 0.6,
  gap: 0.008,
  doors: 4,
};

/** v8.3 椅子的世界座標與外形 footprint；幾何/碰撞不在元件內重抄位置。 */
export const CHAIR = {
  x: -0.82,
  y: 0,
  z: -1.02,
  yaw: 2.62,
  width: 0.67,
  depth: 0.67,
  seatWidth: 0.6,
  seatDepth: 0.52,
  seatHeight: 0.42,
};

export const SIT = {
  triggerRadius: 0.34,
  seatY: 0.42,
  eyeY: 1.18,
  walkSpeed: 1.15,
  fov: 58,
  fadeOpacity: 0.25,
};

export function isWithinSitTrigger(x: number, z: number, chairX = CHAIR.x, chairZ = CHAIR.z): boolean {
  return Math.hypot(x - chairX, z - chairZ) < SIT.triggerRadius;
}

/** 逐項可退步開關（v8.3）：任一 false 只影響該項，其餘照舊。 */
export const FIDELITY = {
  shelfWallSign: -1 as -1 | 1, // 書牆所在牆（-1 西牆＝圖一；+1 回 v8.2 東牆）
  ledge: true, // 腰高長檯面＋矮擱板＋落地書堆
  blind: "screen" as "screen" | "cloth", // 透光橫紋簾 / v8.2 不透明布簾
  furniture: true, // 皮革單椅／筆電／小物／龜背竹／相框
  envMap: true, // 大理石柔反射（手機自動跳過）
  decor: true, // 層板間裝飾書／相框／書堆
};

/**
 * v8.5 視覺參考（附圖）用的材質／色票。
 * 照片可調材質（albedo）與此處 tint 相乘；改這裡就能整間換色，不必翻材質建立程式。
 */
export const LOOK = {
  wall: "#d3cbbf", // 南／東牆：暖灰泥（附圖的灰米色，不用奶油黃）
  wallTint: "#e9e2d6", // 照片 albedo 本身已是米灰；乘法 tint 必須近白，否則會變成土黃
  ceiling: "#efeae1",
  floorTint: "#b0a698", // 附圖的暖灰褐石材地坪（照片大理石 × 中灰 tint）
  deskTint: "#c6beb3", // 淺灰大理石檯面（albedo 已是灰白，tint 只需壓掉過曝）
  shelfWood: "#241b14", // 書牆木作：近黑胡桃（附圖層板幾乎不反光）
  shelfWoodTint: "#8a6c52",
  shelfBack: "#6f5b47", // 背板：打光的古銅色石材
  shelfBackTint: "#e8d4ba",
  ledge: "#3a2e23",
  valance: "#3a322a", // 窗上深色木簾盒
  bronze: "#2b2520",
  led: "#ffb46b", // 層板燈帶（暖）
  ledSoft: "#ffd9ad",
  chairFabric: "#b0a390",
  chairSteel: "#9a948b",
  rug: "#7f7567", // 暖灰地毯（附圖地毯比地坪再深一階）
  cabinet: "#4a4136",
  cabinetDoor: "#544a3e",
  deskEdge: "#9a9083",
  picFrame: "#141210",
  picMat: "#e3dacb",
};

// 懸浮薄層板書牆（v8.3：西牆 wallSign=-1；-1＝西牆、+1＝東牆，保留可切換）
// xBack 為背牆面 X；板材自背牆往室內長 depth；層板沿 Z 長 width。
export const SHELF = {
  wallSign: FIDELITY.shelfWallSign,
  z: -0.45, // 中心 Z（北端貼齊北牆內面，往南到 +1.55）
  width: 3.95, // 沿 Z 軸寬度（v8.5：附圖的書牆幾乎整面西牆）
  height: 2.46, // 最上層板「頂面」Y（附圖量測）
  depth: 0.28, // 層板深
  plank: 0.035, // 板厚
  pitch: 0.335, // 層板間距（v8.5：附圖 5 排，原 4 排 0.40）
  minRows: 5, // 至少 5 排懸浮層板（資料列不足時以空板＋裝飾書補滿）
  xBack: (ROOM.width / 2 - 0.16) * FIDELITY.shelfWallSign, // 背牆 X（西牆 −2.84）
  baseY: 0,
  bookDepth: 0.19, // 書本深度（X 向）
  bookGap: 0.006,
  boardGap: 0.05,
  labelWidth: 0.15, // 櫃板標籤佔寬
  maxRowHeight: 0.52,
  pullOut: 0.055, // 書本抽出距離（預覽）
  // 腰高長檯面（板頂 0.92、厚 0.045、深 0.30）
  ledge: { top: 0.92, thickness: 0.045, depth: 0.3, z0: -0.7, z1: 1.48 },
  /** 背板燈槽：每層板後方洗牆光的亮度（0–1） */
  backGlow: 0.85,
  // 檯面下矮擱板（板頂 0.40、厚 0.035、深 0.28）
  lowShelf: { top: 0.4, thickness: 0.035, depth: 0.28, z0: -0.7, z1: 1.48 },
};

/** 桌上書的位置網格，公尺；保持落點可重現。 */
export const DESK_SNAP = 0.04;

export interface RoomRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** L 形桌板實際 footprint，與 RoomGeometry 的桌板段共用 DESK/SHELF/WINDOW 真相。 */
export const DESK_FOOTPRINT: readonly RoomRect[] = (() => {
  const wallInnerZ = -ROOM.depth / 2 + ROOM.wall;
  const mainMinX = SHELF.xBack;
  const mainMaxX = WINDOW.cx + WINDOW.width / 2 + DESK.wingWidth;
  const mainMinZ = wallInnerZ;
  const mainMaxZ = wallInnerZ + DESK.depth;
  return [
    { minX: mainMinX, maxX: mainMaxX, minZ: mainMinZ, maxZ: mainMaxZ },
    {
      minX: SHELF.xBack,
      maxX: SHELF.xBack + DESK.sideX,
      minZ: mainMaxZ,
      maxZ: wallInnerZ + DESK.sideDepth,
    },
  ];
})();

/** 桌下深炭櫃 footprint；RoomGeometry 的櫃體/門片與玩家碰撞共用此座標真相。 */
export const CABINET_FOOTPRINT: readonly RoomRect[] = (() => {
  const wallZ = -ROOM.depth / 2;
  const wallInnerZ = wallZ + ROOM.wall;
  const deskX1 = WINDOW.cx + WINDOW.width / 2 + DESK.wingWidth;
  const cabinetZ0 = wallZ;
  const cabinetZ1 = cabinetZ0 + CABINET.depth;
  const sideCabinetX0 = SHELF.xBack;
  const sideCabinetX1 = SHELF.xBack + DESK.sideX - 0.08;
  return [
    { minX: sideCabinetX1, maxX: deskX1 - 0.12, minZ: cabinetZ0, maxZ: cabinetZ1 },
    { minX: sideCabinetX0, maxX: sideCabinetX1, minZ: wallInnerZ + 0.02, maxZ: cabinetZ1 },
  ];
})();

/**
 * 將桌上書中心夾回 L 形桌板內，並吸附 4 cm 網格。
 * 每段預留 10 cm 給書本邊緣；轉角以到合法區域的最短距離選段。
 */
export function clampToDesk(x: number, z: number): { x: number; z: number } {
  const edge = 0.1;
  const candidates = DESK_FOOTPRINT.map((rect) => {
    const minX = Math.ceil((rect.minX + edge) / DESK_SNAP - 1e-9) * DESK_SNAP;
    const maxX = Math.floor((rect.maxX - edge) / DESK_SNAP + 1e-9) * DESK_SNAP;
    const minZ = Math.ceil((rect.minZ + edge) / DESK_SNAP - 1e-9) * DESK_SNAP;
    const maxZ = Math.floor((rect.maxZ - edge) / DESK_SNAP + 1e-9) * DESK_SNAP;
    return {
      x: Math.max(minX, Math.min(maxX, Math.round(x / DESK_SNAP) * DESK_SNAP)),
      z: Math.max(minZ, Math.min(maxZ, Math.round(z / DESK_SNAP) * DESK_SNAP)),
    };
  });
  return candidates.reduce((best, candidate) =>
    Math.hypot(candidate.x - x, candidate.z - z) < Math.hypot(best.x - x, best.z - z)
      ? candidate
      : best
  );
}

// ================= 光源（參數集中於此，預留晝夜切換） =================
export const SUN = {
  color: "#fff2dc", // 暖白斜陽（比 v8.5 更中性，避免整間變橘）
  // 附圖是「亮窗＋霧感庭園」的柔光：方向光負責可讀陰影，其餘交給窗光與環境光。
  intensity: 2.45,
  position: new THREE.Vector3(2.1, 3.0, -ROOM.depth / 2 - 1.8),
  target: new THREE.Vector3(-0.75, 0.2, 1.25),
  shadowMap: { desktop: 2048, mobile: 1024 },
  /** PCFSoft 陰影模糊半徑（桌機較柔） */
  shadowRadius: { desktop: 7, mobile: 4 },
};
export const AMBIENT = {
  // 中性偏暖的環境光：降低整體填充，保留窗光與層板燈的明暗對比。
  hemisphereSky: "#e4e6e4",
  hemisphereGround: "#cfc9be",
  hemisphereIntensity: 0.42,
  ambientColor: "#f6eee2",
  ambientIntensity: 0.17,
};

/** 窗外柔光（無陰影補光；手機只留一盞）——讓窗邊與桌面有附圖的柔亮漸層。 */
export const WINDOW_FILL = {
  color: "#eef4ff",
  intensityDesktop: 1.0,
  intensityMobile: 0.65,
  position: new THREE.Vector3(-0.4, 1.9, -1.3),
  target: new THREE.Vector3(-0.6, 0.75, 1.7),
};

/** 書牆暖光洗牆燈（v8.5）：三盞低強度點光源，模擬附圖層板下 LED 的暖色溢光。 */
export const SHELF_WASH = {
  color: "#ffb877",
  intensityDesktop: 0.55,
  intensityMobile: 0.4,
  distance: 2.7,
  z: [-1.7, -0.4, 0.9],
  y: 1.9,
  xOffset: 0.42,
};

/** 附圖的橫向百葉：上段遮蔽、下段透空，深色底桿。 */
export const BLINDS = {
  /** 簾片覆蓋窗洞高度比例（附圖約 45%） */
  cover: 0.38,
  slatPitch: 0.05,
  slatThickness: 0.017,
  slatDepth: 0.07,
  tiltDeg: 34,
  railHeight: 0.05,
  color: "#f0e8da", // 灰米色，避免過曝成純白
  /** 簾片上每 6 片一條細橫線（附圖百葉的節奏），以及 3 段垂直拉繩 */
  cordEvery: 6,
  cordColor: "#8a8274",
};

/** 大理石柔反射參數（v8.3 §P4） */
export const MARBLE_ROUGH = {
  desk: 0.34,
  floor: 0.58,
  metalness: 0.05,
  envIntensityDesk: 0.42,
  envIntensityFloor: 0.12,
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
  lockSensitivity: 0.0022, // rad/px without system pointer acceleration
  wheelHeightStep: 0.07,
};

/**
 * 房間視野：直式手機的 vertical FOV 拉寬，否則水平視角只有約 30°，看不到書牆＋窗。
 * 回傳值只用於房間模式；工作視角仍由 beginFlight 固定 49°。
 */
export function roomFovFor(aspect: number): number {
  if (!(aspect > 0)) return CAMERA.fov;
  if (aspect >= 0.85) return CAMERA.fov;
  const widen = THREE.MathUtils.clamp((0.85 - aspect) / 0.4, 0, 1);
  return CAMERA.fov + widen * 18; // 直式最寬 80°
}

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
  | "spines"
  | "microcement"
  | "blind"
  | "leaf";
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
    "wall" | "microcement" | "floorOak" | "floorMarble" | "desk" | "shelf" | "spines",
    [number, number]
  >;
} = {
  enabled: true,
  dir: "textures/study-room",
  floor: "marble", // v8.3：圖一的淺灰大理石地坪（原 oak）
  files: {
    walnut: "walnut.jpg", // 層板木紋底（壓暗成深褐）
    oak: "oak-floor.jpg", // 暖橡木拼板地板（保留，可切回 floor="oak"）
    marble: "marble-veined.jpg", // 中灰大理石（桌板／窗台／地坪；v8.6 自行產製的褐色紋理）
    plaster: "plaster.jpg", // 米白細顆粒牆面（南／東牆）
    garden: "garden-view-misty.jpg", // 窗外綠意庭園（降飽和＋晨霧處理版）
    spines: "book-spines.jpg", // 書脊色票（保留；不再當背板）
    microcement: "microcement.jpg", // 書牆背牆：深褐微水泥
    blind: "blind-slats.jpg", // 透光橫紋簾 alphaMap（3px 亮 / 6px 暗）
    leaf: "monstera-leaf.jpg", // 龜背竹葉片 alphaMap（白底黑葉）
  },
  repeat: {
    wall: [3, 2],
    microcement: [2.2, 1.6],
    floorOak: [2.2, 1.8],
    floorMarble: [1.25, 1.05],
    desk: [2.4, 1.2],
    shelf: [3.6, 1],
    spines: [1, 1],
  },
};

/**
 * 對照視角（P6）：站東南角、面向西北，左書牆右窗＝圖一機位。
 * 僅供預覽／驗收截圖使用，不寫入 localStorage、不影響使用者相機。
 */
export const MATCH_VIEW = {
  // v8.6：窗寬 4.6 m 後，驗收機位再退到東南角並稍微加寬視野，
  // 讓「左書牆、中轉角、右窗」三個關鍵點都完整入鏡。
  x: 2.58,
  z: 2.08,
  height: 1.52,
  yaw: THREE.MathUtils.degToRad(-48),
  pitch: THREE.MathUtils.degToRad(-2),
  fov: 60,
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

export function clampPitchRad(pitch: number, seated = false): number {
  const min = seated ? THREE.MathUtils.degToRad(-80) : CAMERA.pitchMin;
  return Math.min(CAMERA.pitchMax, Math.max(min, pitch));
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
 * 水平拖曳／Pointer Lock 位移 → 新 yaw。
 * 螢幕座標 dx 正值＝往右拖；往右拖時視線必須往右轉。
 * yaw 0 = 望北（−Z），正值 = 往東（+X）；畫面右方 = forward × up = (cos yaw, 0, sin yaw)。
 * 因此「往右」＝ yaw 增加，符號不可再反。
 */
export function yawFromLookDelta(yaw: number, dxPixels: number, sensitivity: number): number {
  return yaw + dxPixels * sensitivity;
}

/** 垂直拖曳／Pointer Lock 位移 → 新 pitch（dy 正值＝往下拖＝視線往下）。 */
export function pitchFromLookDelta(
  pitch: number,
  dyPixels: number,
  sensitivity: number,
  seated = false
): number {
  return clampPitchRad(pitch - dyPixels * sensitivity, seated);
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

/** 由牆面指向室內的水準方向（西牆 +1、東牆 −1；書本／標籤的法向一律乘此值） */
export const SHELF_INWARD = -SHELF.wallSign;

/** 層板前緣 X（書脊貼齊處，離板緣 12 mm） */
export function shelfFrontX(): number {
  return SHELF.xBack + SHELF_INWARD * (SHELF.depth - 0.012);
}

/** 層板行高：v8.3 改為固定 0.40 間距（圖一），不再依層數均分 */
export function shelfRowHeight(_rowCount: number): number {
  return Math.min(SHELF.maxRowHeight, SHELF.pitch - SHELF.plank);
}

/** 顯示用層板數：資料列不足 4 排時仍顯示 4 排（缺的排以裝飾書補滿） */
export function shelfPlankCount(rowCount: number): number {
  return Math.max(SHELF.minRows, rowCount);
}

/**
 * 第 row 列層板「頂面」Y：最上層板頂 2.42，往下每 0.40 一排。
 * 資料列由最上層往下排（row 0 最高），層板與書本位置共用同一公式。
 */
export function shelfPlankY(row: number, _rowCount: number): number {
  return SHELF.height - row * SHELF.pitch;
}

export type RoomColliderKind = "desk" | "cabinet" | "shelf" | "chair";
export interface Aabb extends RoomRect {
  kind: RoomColliderKind;
  top: number;
  standable: boolean;
}
export type RoomCollider = Aabb;

/** 2D 玩家碰撞採 XZ 平面 AABB；高度保留給地面/可站立物判定。 */
const chairCos = Math.abs(Math.cos(CHAIR.yaw));
const chairSin = Math.abs(Math.sin(CHAIR.yaw));
const chairHalfX = (CHAIR.width * chairCos + CHAIR.depth * chairSin) / 2;
const chairHalfZ = (CHAIR.width * chairSin + CHAIR.depth * chairCos) / 2;
export const COLLIDERS: readonly Aabb[] = [
  ...DESK_FOOTPRINT.map((rect) => ({ ...rect, kind: "desk" as const, top: DESK.top, standable: false })),
  ...CABINET_FOOTPRINT.map((rect) => ({ ...rect, kind: "cabinet" as const, top: CABINET.height, standable: false })),
  {
    minX: Math.min(SHELF.xBack, shelfFrontX()),
    maxX: Math.max(SHELF.xBack, shelfFrontX()),
    minZ: SHELF.z - SHELF.width / 2,
    maxZ: SHELF.z + SHELF.width / 2,
    kind: "shelf",
    top: SHELF.height,
    standable: false,
  },
  {
    minX: CHAIR.x - chairHalfX,
    maxX: CHAIR.x + chairHalfX,
    minZ: CHAIR.z - chairHalfZ,
    maxZ: CHAIR.z + chairHalfZ,
    kind: "chair",
    top: CHAIR.seatHeight,
    standable: false,
  },
];

export const PLAYER_RADIUS = 0.22;
/** Within this radius the player may pass the chair collider to reach its sit trigger. */
export const CHAIR_APPROACH_RADIUS = Math.hypot(chairHalfX + PLAYER_RADIUS, chairHalfZ + PLAYER_RADIUS);

/**
 * 將玩家圓形近似成半徑擴張的 AABB，依最短分離軸推出障礙；距離相同時優先 X。
 * 多輪處理桌櫃轉角的重疊 footprint；坐姿可選擇略過椅子與桌櫃以實現滑行，牆界仍由 clampRoomPosition 負責。
 */
export function resolveCollision(
  x: number,
  z: number,
  radius = PLAYER_RADIUS,
  ignoreChair = false,
  ignoreDeskAndCabinet = false,
  chairPosition?: { x: number; z: number }
): { x: number; z: number } {
  const start = clampRoomPosition(x, z);
  let px = start.x;
  let pz = start.z;
  const colliders = COLLIDERS.filter((collider) =>
    !(ignoreChair && collider.kind === "chair") &&
    !(ignoreDeskAndCabinet && (collider.kind === "desk" || collider.kind === "cabinet"))
  );
  for (let pass = 0; pass < colliders.length; pass++) {
    let changed = false;
    for (const collider of colliders) {
      const chairOffsetX = collider.kind === "chair" && chairPosition ? chairPosition.x - CHAIR.x : 0;
      const chairOffsetZ = collider.kind === "chair" && chairPosition ? chairPosition.z - CHAIR.z : 0;
      const minX = collider.minX + chairOffsetX - radius;
      const maxX = collider.maxX + chairOffsetX + radius;
      const minZ = collider.minZ + chairOffsetZ - radius;
      const maxZ = collider.maxZ + chairOffsetZ + radius;
      if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;

      const candidates = [
        { axis: "x" as const, value: minX, distance: px - minX },
        { axis: "x" as const, value: maxX, distance: maxX - px },
        { axis: "z" as const, value: minZ, distance: pz - minZ },
        { axis: "z" as const, value: maxZ, distance: maxZ - pz },
      ].sort((a, b) => {
        const distance = a.distance - b.distance;
        if (distance !== 0) return distance;
        if (a.axis === b.axis) return 0;
        return a.axis === "x" ? -1 : 1;
      });
      for (const candidate of candidates) {
        const bounded = clampRoomPosition(
          candidate.axis === "x" ? candidate.value : px,
          candidate.axis === "z" ? candidate.value : pz
        );
        const stillOverlaps =
          bounded.x > minX && bounded.x < maxX && bounded.z > minZ && bounded.z < maxZ;
        if (stillOverlaps) continue;
        px = bounded.x;
        pz = bounded.z;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return { x: px, z: pz };
}

/** 目前房間只有單一地板；獨立 helper 讓起跳/安全起立共用地面真相。 */
export function groundHeightAt(_x: number, _z: number): number {
  return 0;
}

export const JUMP = {
  velocity: 3.6,
  gravity: 11.5,
};
export interface JumpState {
  offset: number;
  velocity: number;
  onGround: boolean;
}

/** 固定重力積分；回傳瞬態高度，不改相機的 base height。 */
export function stepJump(state: JumpState, dt: number): JumpState {
  if (state.onGround || dt <= 0) return state;
  const velocity = state.velocity - JUMP.gravity * dt;
  const offset = state.offset + state.velocity * dt - 0.5 * JUMP.gravity * dt * dt;
  if (offset <= 0 && velocity <= 0) return { offset: 0, velocity: 0, onGround: true };
  return { offset: Math.max(0, offset), velocity, onGround: false };
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
  /** 這排內容所在的層板索引（0＝最上層板；內容由最下層板往上排，眼睛高度即可拿書） */
  plankIndex: number;
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
  const thickness = bookThicknessFor(card) * 0.0009; // 32–42px → 2.9–3.8cm
  const height = bookHeightFor(card.id ?? "") * 0.0023; // 96–112px → 22–26cm（附圖的大開本）
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
  // v8.3：無側板／頂板／底座，板材全長即為可用寬度（兩端各留 2 cm）
  const innerWidth = SHELF.width - 0.04;
  const innerHeight = shelfRowHeight(1);
  const frontX = shelfFrontX();

  const sortedCats = [...categories].sort((a, b) => a.order - b.order);
  const known = new Set(cards.map((c) => c.id));
  const boards = sortedCats.map((cat) => {
    const items = books
      .filter(
        (b) =>
          b.cardId &&
          b.place !== "desk" &&
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
  // v8.5：內容由最下層板往上長（v8.4 之前所有資料書都擠在最上層板、貼近天花，
  // 玩家在第一人稱幾乎看不到也拿不到）。層板位置公式不變，只改內容落板。
  const plankCount = shelfPlankCount(rows);

  const startPlank = Math.max(0, plankCount - 2 - Math.max(0, packed.length - 1));
  const layoutRows: ShelfRowLayout[] = packed.map((rowBoards, ri) => {
    const plankIndex = Math.min(plankCount - 1, startPlank + ri);
    const plankY = shelfPlankY(plankIndex, plankCount);
    // v8.6：資料列在層板上置中，不再全部擠在書牆最北端。
    // （只有一個分類時，舊版資料書會落在窗邊角落，第一人稱幾乎拿不到。）
    const rowWidth = rowBoards.reduce((n, b) => n + widthOf(b) + SHELF.boardGap, 0) - SHELF.boardGap;
    let zCursor = SHELF.z - Math.max(0, rowWidth) / 2;
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
          // 書本自書脊面往牆面退，整本落在層板上（inward 由牆指向室內）
          x: frontX - SHELF_INWARD * (dims.depth / 2),
          y: plankY + 0.0015 + dims.height / 2,
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
    return { row: ri, plankIndex, plankY, boards: rowBoardsOut };
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

/**
 * 第一人稱手持書的相機座標錨點。獨立成純函式讓直／橫式與窄視野可回歸測試。
 * 直式手機把書放到畫面中央偏左，避開右側「放到桌上／放回書架」按鈕與左下搖桿。
 */
export function firstPersonHeldAnchor(
  aspect: number,
  fovDeg: number = CAMERA.fov
): { x: number; y: number; z: number; scale: number } {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const portrait = safeAspect < 0.85;
  const depth = portrait ? -0.78 : -0.82;
  const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * Math.abs(depth);
  const halfW = halfH * safeAspect;
  return {
    // 直式手機往左收（避開右下角的放置／回架按鈕），橫式放在右下但保留邊距。
    x: portrait ? -0.055 : Math.min(0.28, Math.max(halfW * 0.4, 0.14)),
    y: -halfH * (portrait ? 0.38 : 0.44),
    z: depth,
    scale: portrait ? 0.95 : 0.8,
  };
}

/**
 * 第三人稱手持書要放在角色右手掌心：以肩膀為樞軸、手臂下垂 0.58 m，
 * 依 characterAnim 的 holding 角度（右臂 -1.15 rad）推算手腕相對位置。
 * 頭部與軀幹的像素尺寸是固定的，因此這裡不需要讀 scene graph 也能單測。
 */
export function thirdPersonHandOffset(eyeY = 1.62): { x: number; y: number; z: number } {
  const shoulderY = CHARACTER.hipY + (CHARACTER.shoulderY - CHARACTER.hipY) * (eyeY / CHARACTER.eyeHeight);
  const armLen = CHARACTER.arm.height;
  const angle = 1.15;
  const side = CHARACTER.torso.width / 2 + CHARACTER.arm.width / 2;
  return {
    x: side,
    y: shoulderY - Math.cos(angle) * armLen,
    z: -Math.sin(angle) * armLen,
  };
}

// ================= v8.5：第一／第三人稱與像素人物 =================

/** 目前房間視角：第一人稱（預設）或第三人稱（V 切換）。此狀態不進 schema。 */
export type ViewMode = "first" | "third";

/** CameraRig 每幀寫入、VoxelCharacter 讀取的角色姿態（純瞬態，不持久化）。 */
export interface PlayerPose {
  x: number;
  z: number;
  eyeY: number;
  jumpOffset: number;
  yaw: number;
  pitch: number;
  moving: boolean;
  onGround: boolean;
  seated: boolean;
  visible: boolean;
  /** 手持書時把右臂抬到胸前（只影響角色姿勢，不進 schema）。 */
  holding?: boolean;
}

/**
 * 第一人稱 view model（掛在相機上，非角色本體）：
 * 只有低頭（pitch 低於門檻）才出現，避免站直時兩塊方塊佔住畫面下緣。
 * 座標皆為相機空間公尺；幾何與可見門檻集中在這裡，元件與測試共用。
 */
export const VIEW_MODEL = {
  /**
   * 前臂＋手掌：從畫面下緣左右兩側伸入。
   * 這是「相機空間」座標，所以必須落在視錐內才看得到——
   * v8.6 之前的 y −0.46 其實在 62° 視錐下緣（≈−0.30）之外，低頭時整組被裁掉。
   */
  arm: { x: 0.26, y: -0.27, z: -0.44, width: 0.062, length: 0.22 },
  /** 胸口：貼近下緣，只露出上緣一片，讀成「低頭看到自己的身體」 */
  chest: { y: -0.40, z: -0.5, width: 0.3, height: 0.28, depth: 0.18, tilt: 0.35 },
  /** 低於此 pitch（rad，負值＝往下看）才顯示前臂 */
  armsBelowPitch: -0.22,
  /** 低於此 pitch 才顯示胸口 */
  chestBelowPitch: -0.5,
};

/** 第一人稱身體 view model 的可見性（pitch 為 CameraRig 的視角 pitch）。 */
export function firstPersonViewVisibility(pitch: number, holding = false): { arms: boolean; chest: boolean } {
  return {
    arms: holding || pitch <= VIEW_MODEL.armsBelowPitch,
    chest: pitch <= VIEW_MODEL.chestBelowPitch,
  };
}

/**
 * 第三人稱相機：站在角色後上方、略偏右肩（over-the-shoulder）。
 * 相機會沿視線反方向往外找第一個不被牆／家具阻擋的位置；
 * 若整段都被擋住（玩家貼在牆角），改為抬高視點、保留最小距離，
 * 讓角色仍在畫面中，而不是把相機塞進角色後腦（實際預覽會整個人物消失）。
 */
export const THIRD_PERSON = {
  distance: 2.35,
  minDistance: 1.05,
  rise: 0.55,
  shoulder: 0.36,
  lookAhead: 1.4,
  wallMargin: 0.24,
  /** 直式手機（aspect < 0.85）拉遠：窄視野下角色才不會佔滿畫面 */
  portraitDistance: 2.95,
  portraitAspect: 0.85,
  /** 貼牆時的抬高階梯（公尺）：越高越能越過角色頭頂看前方 */
  jamLift: [0.42, 0.78, 1.12],
  /** 第三人稱額外視野（度）：角色與房間能同時入鏡，第一人稱不受影響 */
  fovBoost: 12,
  /** 直式手機的加寬幅度較小（房間視野本來就加寬到 80°） */
  fovBoostPortrait: 5,
  /** 準心對準角色右肩外側，角色因此落在畫面左側且不會擋住互動目標（公尺） */
  aimShoulder: 0.34,
  /** 視線目標比眼睛低多少（公尺）：讓全身與腿部動作入鏡 */
  lookDrop: 0.45,
};

/** 依畫面長寬比給第三人稱距離（手機直式退更遠）。 */
export function thirdPersonDistance(width: number, height: number): number {
  if (!(width > 0 && height > 0)) return THIRD_PERSON.distance;
  return width / height < THIRD_PERSON.portraitAspect ? THIRD_PERSON.portraitDistance : THIRD_PERSON.distance;
}

function thirdPersonBlocked(x: number, y: number, z: number): boolean {
  if (
    x < -ROOM.width / 2 + THIRD_PERSON.wallMargin ||
    x > ROOM.width / 2 - THIRD_PERSON.wallMargin ||
    z < -ROOM.depth / 2 + THIRD_PERSON.wallMargin ||
    z > ROOM.depth / 2 - THIRD_PERSON.wallMargin
  ) return true;
  return COLLIDERS.some((collider) =>
    y < collider.top + 0.12 &&
    x > collider.minX - 0.18 && x < collider.maxX + 0.18 &&
    z > collider.minZ - 0.18 && z < collider.maxZ + 0.18
  );
}

/**
 * 第三人稱相機位置（純函式）：由角色眼睛往視線反方向退開，遇到牆／家具自動縮短。
 * 只回傳位置；lookAt 由 CameraRig 依角色前方計算。
 */
export function resolveThirdPersonCamera(
  pose: Pick<PlayerPose, "x" | "z" | "eyeY" | "jumpOffset">,
  viewYaw: number,
  viewPitch: number,
  distance = THIRD_PERSON.distance
): { x: number; y: number; z: number } {
  const eyeY = groundHeightAt(pose.x, pose.z) + pose.eyeY + pose.jumpOffset;
  const dir = forwardFromYawPitch(viewYaw, viewPitch);
  const back = new THREE.Vector3(-dir.x, 0, -dir.z);
  if (back.lengthSq() < 1e-6) back.set(0, 0, 1);
  back.normalize();
  // 畫面右方 = forward × up；相機往右肩偏移，角色因此落在畫面左側。
  const right = new THREE.Vector3(Math.cos(viewYaw), 0, Math.sin(viewYaw));
  const baseY = Math.max(0.35, Math.min(ROOM.height - 0.16, eyeY + THIRD_PERSON.rise));
  const shoulderAt = (d: number) => THIRD_PERSON.shoulder * Math.min(1, d / THIRD_PERSON.distance);
  const candidateAt = (d: number, y: number, angle = 0) => {
    const shoulder = shoulderAt(d);
    const bx = back.x * Math.cos(angle) + back.z * Math.sin(angle);
    const bz = -back.x * Math.sin(angle) + back.z * Math.cos(angle);
    return {
      x: pose.x + bx * d + right.x * shoulder,
      y,
      z: pose.z + bz * d + right.z * shoulder,
    };
  };

  // 1) 理想：從最遠處往內找第一個沒被擋住的位置，保留最大距離。
  const steps = 18;
  for (let i = steps; i >= 0; i -= 1) {
    const d = THIRD_PERSON.minDistance + (distance - THIRD_PERSON.minDistance) * (i / steps);
    const candidate = candidateAt(d, baseY);
    if (!thirdPersonBlocked(candidate.x, candidate.y, candidate.z)) return candidate;
  }

  // 2) 貼牆／貼家具：抬高視點，讓角色仍在畫面內（不穿牆、也不消失在後腦）。
  for (const lift of THIRD_PERSON.jamLift) {
    const y = Math.min(ROOM.height - 0.14, baseY + lift);
    for (let i = steps; i >= 0; i -= 1) {
      const d = THIRD_PERSON.minDistance + (distance - THIRD_PERSON.minDistance) * (i / steps);
      const lifted = candidateAt(d, y);
      if (!thirdPersonBlocked(lifted.x, lifted.y, lifted.z)) return lifted;
    }
  }

  // 3) 牆角（正後方完全沒有空間）：往左右肩側前方找位置，寧可側拍也不要塞進角色。
  const sideAngles = [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
  for (const angle of sideAngles) {
    for (const d of [1.5, 1.25, THIRD_PERSON.minDistance, 0.82]) {
      const side = candidateAt(d, baseY, angle);
      if (!thirdPersonBlocked(side.x, side.y, side.z)) return side;
    }
    for (const lift of [0.55, 0.95]) {
      const y = Math.min(ROOM.height - 0.14, baseY + lift);
      for (const d of [1.4, 1.1, 0.82]) {
        const side = candidateAt(d, y, angle);
        if (!thirdPersonBlocked(side.x, side.y, side.z)) return side;
      }
    }
  }

  // 4) 最後手段：抬高到角色上方、水平只退 0.45 m；相機仍在房內且不會與頭部重疊。
  const overhead = candidateAt(0.45, Math.min(ROOM.height - 0.12, eyeY + 1.25));
  if (!thirdPersonBlocked(overhead.x, overhead.y, overhead.z)) return overhead;
  return candidateAt(0.45, Math.min(ROOM.height - 0.12, eyeY + 1.05));
}

/** 跳躍閘門：手機跳躍按鈕與桌面 Space 共用（與對準什麼物件無關）。 */
export interface JumpGate {
  mode: "room" | "work";
  flying: boolean;
  uiOpen: boolean;
  seated: boolean;
  onGround: boolean;
  typing: boolean;
}

export function canJump(g: JumpGate): boolean {
  return g.mode === "room" && !g.flying && !g.uiOpen && !g.seated && g.onGround && !g.typing;
}
