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
  height: 2.75, // v8.3：圖一量測值（原 3.1）
  wall: 0.12, // 牆厚
};

// 大窗（北牆 z = −depth/2；窗台略高於桌面，溫和日光由窗外右上方射入）
// v8.3：框變細、單中挺、無橫櫺（圖一＝大玻璃＋一條直中挺）
export const WINDOW = {
  cx: -0.55, // 窗中心 X（略偏西）
  width: 3.4,
  sill: 0.9, // 窗台高（大理石檯面頂）
  top: 2.58,
  frame: 0.055, // 窗框寬（原 0.085）
  depth: 0.16,
  mullions: 1, // 直向窗櫺（窗分 2 格：大玻璃＋單中挺）
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
  x: 0.55,
  y: 0,
  z: 0.62,
  yaw: 2.55,
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

// 懸浮薄層板書牆（v8.3：西牆 wallSign=-1；-1＝西牆、+1＝東牆，保留可切換）
// xBack 為背牆面 X；板材自背牆往室內長 depth；層板沿 Z 長 width。
export const SHELF = {
  wallSign: FIDELITY.shelfWallSign,
  z: -0.7, // 中心 Z（北端 −2.5 貼齊北牆內面，往南 3.6 m 到 +1.1）
  width: 3.6, // 沿 Z 軸寬度
  height: 2.42, // 最上層板「頂面」Y（圖一量測）
  depth: 0.28, // 層板深
  plank: 0.035, // 板厚
  pitch: 0.40, // 層板間距（板頂到板頂）
  minRows: 4, // 至少 4 排懸浮層板（資料列不足時以空板＋裝飾書補滿）
  xBack: (ROOM.width / 2 - 0.16) * FIDELITY.shelfWallSign, // 背牆 X（西牆 −2.84）
  baseY: 0,
  bookDepth: 0.19, // 書本深度（X 向）
  bookGap: 0.006,
  boardGap: 0.05,
  labelWidth: 0.15, // 櫃板標籤佔寬
  maxRowHeight: 0.52,
  pullOut: 0.055, // 書本抽出距離（預覽）
  // 腰高長檯面（板頂 0.92、厚 0.045、深 0.30）
  ledge: { top: 0.92, thickness: 0.045, depth: 0.3, z0: -0.68, z1: 1.1 },
  // 檯面下矮擱板（板頂 0.40、厚 0.035、深 0.28）
  lowShelf: { top: 0.4, thickness: 0.035, depth: 0.28, z0: -0.68, z1: 1.1 },
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
  color: "#fff3d6", // 淡金（色溫約 4000K）
  intensity: 4.6, // v8.3：圖一的高對比（原 3.0）
  // v8.3：仍在窗的左上方，但改由東側進光（x=+2.05），避免書牆搬到西牆後燈光穿牆。
  position: new THREE.Vector3(2.05, 2.45, -ROOM.depth / 2 - 1.4),
  target: new THREE.Vector3(-0.85, 0.12, 1.55),
  shadowMap: { desktop: 2048, mobile: 1024 },
  /** PCFSoft 陰影模糊半徑（桌機較柔） */
  shadowRadius: { desktop: 6, mobile: 3 },
};
export const AMBIENT = {
  hemisphereSky: "#e8f0f7",
  hemisphereGround: "#caa87a",
  hemisphereIntensity: 0.34,
  ambientColor: "#ffe9c8",
  ambientIntensity: 0.15,
};

/** 大理石柔反射參數（v8.3 §P4） */
export const MARBLE_ROUGH = {
  desk: 0.3,
  floor: 0.26,
  metalness: 0.06,
  envIntensityDesk: 0.5,
  envIntensityFloor: 0.35,
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
    marble: "marble.jpg", // 淺灰大理石（桌板／窗台／地坪）
    plaster: "plaster.jpg", // 米白細顆粒牆面（南／東牆）
    garden: "garden-view.jpg", // 窗外綠意庭園（保留的「布景」）
    spines: "book-spines.jpg", // 書脊色票（保留；不再當背板）
    microcement: "microcement.jpg", // 書牆背牆：深褐微水泥
    blind: "blind-slats.jpg", // 透光橫紋簾 alphaMap（3px 亮 / 6px 暗）
    leaf: "monstera-leaf.jpg", // 龜背竹葉片 alphaMap（白底黑葉）
  },
  repeat: {
    wall: [3, 2],
    microcement: [2.2, 1.6],
    floorOak: [2.2, 1.8],
    floorMarble: [1.6, 1.35],
    desk: [1.6, 0.9],
    shelf: [3.6, 1],
    spines: [1, 1],
  },
};

/**
 * 對照視角（P6）：站東南角、面向西北，左書牆右窗＝圖一機位。
 * 僅供預覽／驗收截圖使用，不寫入 localStorage、不影響使用者相機。
 */
export const MATCH_VIEW = {
  x: 2.3,
  z: 1.9,
  height: 1.52,
  yaw: -Math.PI / 4,
  pitch: -0.035,
  fov: 55,
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
