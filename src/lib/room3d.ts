// 嵌套之城 3D 書房：尺寸、建築層級、家具與相機／碰撞的純資料＋純函式。
// 集中管理：窗／桌／書架位置、光源參數、畫質分級、3D→CSS 投影幫助函式與書架佈局。
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
import { ROOM_DIMENSIONS, ROOM_EDGE_MARGIN } from "./roomDimensions";

export { ROOM_AREA_SCALE } from "./roomDimensions";

// ================= 建築尺寸與嵌套之城參考模型（公尺） =================
export const ROOM = ROOM_DIMENSIONS; // 參考板外部木框：48 × 24 × 16 m

export type CityMaterial = "timber" | "stone" | "core";
export interface CityPlatform {
  id: string;
  level: 1 | 2 | 3;
  x: number;
  z: number;
  width: number;
  depth: number;
  material: CityMaterial;
}
export interface CityStair {
  id: string;
  start: { x: number; z: number; y: number };
  end: { x: number; z: number; y: number };
  width: number;
  steps: number;
  material: CityMaterial;
}
export interface CityObstacle {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  bottom: number;
  top: number;
}
export interface CityFrameOpening {
  edge: "north" | "east" | "south" | "west";
  /** Interval along the named edge in frame-local plan coordinates. */
  start: number;
  end: number;
  bottom: number;
  top: number;
}
export interface CityFrame {
  id: string;
  plane: "x" | "z" | "box" | "horizontal";
  x: number;
  z: number;
  bottom: number;
  width: number;
  depth?: number;
  height: number;
  thickness: number;
  beamHeight: number;
  rotationY: number;
  material: CityMaterial;
  bands?: readonly number[];
  openings?: readonly CityFrameOpening[];
}
export interface CityFrameMember {
  x: number;
  z: number;
  width: number;
  depth: number;
  bottom: number;
  top: number;
}
export interface CityPlatformRail {
  id: string;
  platformId: string;
  level: CityPlatform["level"];
  axis: "x" | "z";
  edge: "west" | "east" | "north" | "south";
  fixed: number;
  inward: -1 | 1;
  start: number;
  end: number;
}

/**
 * Shared reference-board model for the complete walkable building.
 * X/Z on frame and module entries are confirmed centre positions; vertical extents are fitted to
 * the section drawing (four 4 m floor-to-floor intervals with 3.0–3.2 m clear height).
 */
export const NESTED_CITY = {
  levels: [0, 4, 8, 12] as const,
  // A continuous 16 × 11 m open shaft through 2F–4F; the ground floor stays fully walkable.
  atrium: { x: 12, z: 2.5, width: 16, depth: 11 },
  frames: [
    // Primary timber shell: 48 × 24 × 16 m; its horizontal bands mark the four-floor rhythm.
    { id: "outer-timber-shell", plane: "box", x: 0, z: 0, bottom: 0, width: 48, depth: 24, height: 16, thickness: 1.1, beamHeight: 1.2, rotationY: 0, material: "timber", bands: [4, 8, 12] },
    // Stone insert: 36 × 18 × 12 m, placed at the table's (6, 4) X/Z centre and fitted from 2–14 m.
    { id: "middle-horizontal-insert", plane: "horizontal", x: 6, z: 4, bottom: 2, width: 36, depth: 18, height: 12, thickness: 0.84, beamHeight: 0.9, rotationY: THREE.MathUtils.degToRad(15), material: "stone", bands: [6] },
    // Offset mixed core: 24 × 12 × 8 m at the table's (12, 8) X/Z centre; it spans 2F–4F (4–12 m).
    { id: "offset-rotated-core", plane: "box", x: 12, z: 8, bottom: 4, width: 24, depth: 12, height: 8, thickness: 0.64, beamHeight: 0.72, rotationY: THREE.MathUtils.degToRad(-10), material: "core", bands: [4] },
  ] satisfies readonly CityFrame[],
  // Secondary volumes are the table's main platform, 3F bridge corridor and double-height library zone.
  featureFrames: [
    { id: "main-library-platform-frame", plane: "box", x: 4, z: 8, bottom: 4, width: 30, depth: 16, height: 4, thickness: 0.52, beamHeight: 0.48, rotationY: 0, material: "timber" },
    { id: "bridge-corridor-frame", plane: "box", x: 10, z: 10, bottom: 8, width: 20, depth: 4, height: 3, thickness: 0.26, beamHeight: 0.24, rotationY: 0, material: "core" },
    { id: "library-zone-frame", plane: "box", x: 5, z: 12, bottom: 0, width: 40, depth: 3, height: 8, thickness: 0.24, beamHeight: 0.28, rotationY: 0, material: "timber" },
  ] satisfies readonly CityFrame[],
  platforms: [
    // 2F (50% deck coverage): library wing, east gallery and north-side connector frame a large open atrium.
    { id: "level-1-west-library-gallery", level: 1, x: -9.75, z: 0, width: 27.5, depth: 14, material: "timber" },
    { id: "level-1-east-gallery", level: 1, x: 21.5, z: 0, width: 3, depth: 22, material: "stone" },
    { id: "level-1-north-library-gallery", level: 1, x: 12, z: -8, width: 16, depth: 6, material: "core" },
    { id: "level-1-north-crossing-bridge", level: 1, x: 12, z: -4, width: 16, depth: 2, material: "core" },
    // 3F (55%): a 1.6 m east stairwell slot and landing interrupt the gallery; short connectors preserve access around the void.
    { id: "level-2-west-study-gallery", level: 2, x: -9.75, z: -0.25, width: 27.5, depth: 16.5, material: "stone" },
    { id: "level-2-east-edge-gallery", level: 2, x: 22.3, z: 0, width: 1.4, depth: 22, material: "stone" },
    { id: "level-2-stair-landing", level: 2, x: 20.8, z: -1, width: 1.6, depth: 2, material: "stone" },
    { id: "level-2-east-south-connector", level: 2, x: 20.8, z: 10, width: 1.6, depth: 4, material: "stone" },
    { id: "level-2-north-study-gallery", level: 2, x: 12, z: -9.25, width: 16, depth: 3.5, material: "timber" },
    { id: "level-2-long-bridge", level: 2, x: 10, z: 10, width: 20, depth: 4, material: "core" },
    // 4F (26%): a short west bridge, offset north connector and south sky terrace leave most of the level open.
    { id: "level-3-west-observation-gallery", level: 3, x: -4, z: -4, width: 16, depth: 8, material: "timber" },
    { id: "level-3-east-observation-gallery", level: 3, x: 21.5, z: 0, width: 3, depth: 22, material: "stone" },
    { id: "level-3-north-observation-gallery", level: 3, x: 10, z: -9, width: 12, depth: 4, material: "core" },
    { id: "level-3-north-connector", level: 3, x: 18, z: -9, width: 4, depth: 2, material: "core" },
    { id: "level-3-north-observation-bridge", level: 3, x: 8, z: -5, width: 8, depth: 2, material: "core" },
    { id: "level-3-sky-observation-terrace", level: 3, x: 12, z: 10, width: 16, depth: 2, material: "timber" },
  ] satisfies readonly CityPlatform[],
  stairs: [
    // Switchback stair: cross west-to-east, rise through the east stairwell slot, then return west across the open atrium.
    { id: "stair-ground-to-level-1", start: { x: 4, z: 6.5, y: 0 }, end: { x: 20, z: 6.5, y: 4 }, width: 1.6, steps: 32, material: "stone" },
    { id: "stair-level-1-to-level-2", start: { x: 20.8, z: 6.5, y: 4 }, end: { x: 20.8, z: 0, y: 8 }, width: 1.6, steps: 23, material: "timber" },
    { id: "stair-level-2-to-level-3", start: { x: 20.8, z: 0, y: 8 }, end: { x: 4, z: 0, y: 12 }, width: 1.6, steps: 32, material: "stone" },
  ] satisfies readonly CityStair[],
  bridgeRails: [
    { id: "level-1-bridge-rail-near", level: 1, x: 12, z: -4.95, width: 16, depth: 0.1 },
    { id: "level-1-bridge-rail-far", level: 1, x: 12, z: -3.05, width: 16, depth: 0.1 },
    { id: "level-2-bridge-rail-near", level: 2, x: 10, z: 8.05, width: 20, depth: 0.1 },
    { id: "level-2-bridge-rail-far", level: 2, x: 10, z: 11.95, width: 20, depth: 0.1 },
    { id: "level-3-bridge-rail-near", level: 3, x: 8, z: -5.95, width: 8, depth: 0.1 },
    { id: "level-3-bridge-rail-far", level: 3, x: 8, z: -4.05, width: 8, depth: 0.1 },
  ] as const,
  columns: [
    { id: "stone-support-west", x: -20, z: 0, width: 0.82, depth: 0.82, bottom: 0, top: 11.7, material: "stone" },
    { id: "stone-support-east", x: 22, z: 9.5, width: 0.82, depth: 0.82, bottom: 0, top: 15.2, material: "stone" },
    { id: "stone-support-north", x: 12, z: -9.5, width: 0.78, depth: 0.78, bottom: 0, top: 14.2, material: "stone" },
    { id: "stone-support-terrace", x: 12, z: 10, width: 0.78, depth: 0.78, bottom: 8, top: 14.2, material: "stone" },
  ] as const,
  // South entrance interrupts the 40 × 3 × 8 m library wall; shelving leaves a 7 m lobby opening.
  obstacles: [
    { id: "south-library-shelf-west", x: -9.5, z: 10.55, width: 11, depth: 0.52, bottom: 0, top: 7.7 },
    { id: "south-library-shelf-east", x: 14.5, z: 10.55, width: 21, depth: 0.52, bottom: 0, top: 7.7 },
  ] satisfies readonly CityObstacle[],
  /** Stair rails stop before each landing so their end posts do not block the threshold. */
  stairRailInset: 0.45,
  /** Platform / bridge / stair guardrail heights and light member section (metres). */
  railHeight: 1.05,
  platformRailPostWidth: 0.07,
  glassRailThickness: 0.055,
} as const;

/** Shared member layout for rendering and collision, so the white model and movement use identical frames. */
export function cityFrameMembers(frame: CityFrame): CityFrameMember[] {
  const members: CityFrameMember[] = [];
  const depth = frame.depth ?? frame.width;
  const add = (x: number, z: number, width: number, memberDepth: number, bottom: number, top: number) => {
    if (top - bottom > 1e-4 && width > 0 && memberDepth > 0) {
      members.push({ x, z, width, depth: memberDepth, bottom, top });
    }
  };

  if (frame.plane === "horizontal") {
    const halfX = frame.width / 2 - frame.thickness / 2;
    const halfZ = depth / 2 - frame.thickness / 2;
    const lowerTop = frame.bottom + frame.beamHeight;
    const upperBottom = frame.bottom + frame.height - frame.beamHeight;
    const addRingEdge = (
      edge: CityFrameOpening["edge"],
      axis: "x" | "z",
      fixed: number,
      start: number,
      end: number,
      bottom: number,
      top: number
    ) => {
      let intervals = [{ start, end }];
      for (const opening of frame.openings ?? []) {
        if (opening.edge !== edge || opening.bottom >= top || opening.top <= bottom) continue;
        const next: Array<{ start: number; end: number }> = [];
        for (const interval of intervals) {
          if (opening.end <= interval.start || opening.start >= interval.end) {
            next.push(interval);
            continue;
          }
          if (opening.start > interval.start) next.push({ start: interval.start, end: Math.min(opening.start, interval.end) });
          if (opening.end < interval.end) next.push({ start: Math.max(opening.end, interval.start), end: interval.end });
        }
        intervals = next;
      }
      for (const interval of intervals) {
        if (interval.end - interval.start <= 1e-4) continue;
        if (axis === "x") {
          add((interval.start + interval.end) / 2, fixed, interval.end - interval.start, frame.thickness, bottom, top);
        } else {
          add(fixed, (interval.start + interval.end) / 2, frame.thickness, interval.end - interval.start, bottom, top);
        }
      }
    };
    const addRing = (bottom: number, top: number) => {
      addRingEdge("north", "x", -halfZ, -frame.width / 2, frame.width / 2, bottom, top);
      addRingEdge("south", "x", halfZ, -frame.width / 2, frame.width / 2, bottom, top);
      addRingEdge("west", "z", -halfX, -depth / 2, depth / 2, bottom, top);
      addRingEdge("east", "z", halfX, -depth / 2, depth / 2, bottom, top);
    };
    addRing(frame.bottom, lowerTop);
    addRing(upperBottom, frame.bottom + frame.height);
    for (const xSide of [-1, 1]) {
      for (const zSide of [-1, 1]) {
        add(xSide * halfX, zSide * halfZ, frame.thickness, frame.thickness, lowerTop, upperBottom);
      }
    }
    for (const band of frame.bands ?? []) {
      const bandHeight = frame.beamHeight * 0.58;
      const bottom = frame.bottom + band - bandHeight / 2;
      addRing(bottom, bottom + bandHeight);
    }
    return members;
  }

  if (frame.plane === "x") {
    const half = frame.width / 2 - frame.thickness / 2;
    add(-half, 0, frame.thickness, frame.thickness, frame.bottom, frame.bottom + frame.height);
    add(half, 0, frame.thickness, frame.thickness, frame.bottom, frame.bottom + frame.height);
    add(0, 0, frame.width, frame.thickness, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
    for (const band of frame.bands ?? []) {
      const height = frame.beamHeight * 0.58;
      add(0, 0, frame.width, frame.thickness, frame.bottom + band - height / 2, frame.bottom + band + height / 2);
    }
    return members;
  }

  if (frame.plane === "z") {
    const half = frame.width / 2 - frame.thickness / 2;
    add(0, -half, frame.thickness, frame.thickness, frame.bottom, frame.bottom + frame.height);
    add(0, half, frame.thickness, frame.thickness, frame.bottom, frame.bottom + frame.height);
    add(0, 0, frame.thickness, frame.width, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
    for (const band of frame.bands ?? []) {
      const height = frame.beamHeight * 0.58;
      add(0, 0, frame.thickness, frame.width, frame.bottom + band - height / 2, frame.bottom + band + height / 2);
    }
    return members;
  }

  const halfX = frame.width / 2 - frame.thickness / 2;
  const halfZ = depth / 2 - frame.thickness / 2;
  for (const xSide of [-1, 1]) {
    for (const zSide of [-1, 1]) {
      add(xSide * halfX, zSide * halfZ, frame.thickness, frame.thickness, frame.bottom, frame.bottom + frame.height);
    }
  }
  add(0, -halfZ, frame.width, frame.thickness, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
  add(0, halfZ, frame.width, frame.thickness, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
  add(-halfX, 0, frame.thickness, depth, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
  add(halfX, 0, frame.thickness, depth, frame.bottom + frame.height - frame.beamHeight, frame.bottom + frame.height);
  for (const band of frame.bands ?? []) {
    const height = frame.beamHeight * 0.58;
    const bottom = frame.bottom + band - height / 2;
    const top = bottom + height;
    add(0, -halfZ, frame.width, frame.thickness, bottom, top);
    add(0, halfZ, frame.width, frame.thickness, bottom, top);
    add(-halfX, 0, frame.thickness, depth, bottom, top);
    add(halfX, 0, frame.thickness, depth, bottom, top);
  }
  return members;
}

/** Height of the open-riser stair surface at a normalized run position. */
export function cityStairHeightAt(stair: CityStair, progress: number): number {
  const t = Math.max(0, Math.min(1, progress));
  const stepIndex = t >= 1 ? stair.steps : Math.ceil(t * stair.steps - 1e-9);
  return stair.start.y + ((stair.end.y - stair.start.y) * stepIndex) / stair.steps;
}

/**
 * Derive guardrail segments from exposed platform edges, leaving only real floor joins and stair mouths open.
 * Bridge edges are covered by their explicitly dimensioned bridge rails.
 */
export function nestedCityPlatformRails(): CityPlatformRail[] {
  const epsilon = 1e-4;
  const minimumRailLength = 0.4;
  const intervalsMinus = (intervals: Array<{ start: number; end: number }>, cutStart: number, cutEnd: number) => {
    const next: Array<{ start: number; end: number }> = [];
    for (const interval of intervals) {
      if (cutEnd <= interval.start + epsilon || cutStart >= interval.end - epsilon) {
        next.push(interval);
        continue;
      }
      if (cutStart - interval.start > epsilon) next.push({ start: interval.start, end: Math.min(cutStart, interval.end) });
      if (interval.end - cutEnd > epsilon) next.push({ start: Math.max(cutEnd, interval.start), end: interval.end });
    }
    return next;
  };
  const stairEnds = NESTED_CITY.stairs.flatMap((stair) => [
    { y: stair.start.y, point: stair.start, width: stair.width },
    { y: stair.end.y, point: stair.end, width: stair.width },
  ]);
  const rails: CityPlatformRail[] = [];

  for (const platform of NESTED_CITY.platforms) {
    if (platform.id.includes("bridge")) continue;
    const bounds = {
      minX: platform.x - platform.width / 2,
      maxX: platform.x + platform.width / 2,
      minZ: platform.z - platform.depth / 2,
      maxZ: platform.z + platform.depth / 2,
    };
    const edges = [
      { axis: "z" as const, edge: "west" as const, fixed: bounds.minX, inward: 1 as const, start: bounds.minZ, end: bounds.maxZ },
      { axis: "z" as const, edge: "east" as const, fixed: bounds.maxX, inward: -1 as const, start: bounds.minZ, end: bounds.maxZ },
      { axis: "x" as const, edge: "north" as const, fixed: bounds.minZ, inward: 1 as const, start: bounds.minX, end: bounds.maxX },
      { axis: "x" as const, edge: "south" as const, fixed: bounds.maxZ, inward: -1 as const, start: bounds.minX, end: bounds.maxX },
    ];

    for (const edge of edges) {
      let intervals = [{ start: edge.start, end: edge.end }];
      for (const neighbor of NESTED_CITY.platforms) {
        if (neighbor.id === platform.id || neighbor.level !== platform.level) continue;
        const neighborBounds = {
          minX: neighbor.x - neighbor.width / 2,
          maxX: neighbor.x + neighbor.width / 2,
          minZ: neighbor.z - neighbor.depth / 2,
          maxZ: neighbor.z + neighbor.depth / 2,
        };
        const sharesBoundary = edge.axis === "z"
          ? Math.abs(edge.fixed - neighborBounds.minX) <= epsilon || Math.abs(edge.fixed - neighborBounds.maxX) <= epsilon
          : Math.abs(edge.fixed - neighborBounds.minZ) <= epsilon || Math.abs(edge.fixed - neighborBounds.maxZ) <= epsilon;
        if (!sharesBoundary) continue;
        const overlapStart = edge.axis === "z"
          ? Math.max(edge.start, neighborBounds.minZ)
          : Math.max(edge.start, neighborBounds.minX);
        const overlapEnd = edge.axis === "z"
          ? Math.min(edge.end, neighborBounds.maxZ)
          : Math.min(edge.end, neighborBounds.maxX);
        if (overlapEnd - overlapStart > epsilon) intervals = intervalsMinus(intervals, overlapStart, overlapEnd);
      }

      const floorY = NESTED_CITY.levels[platform.level];
      for (const endpoint of stairEnds) {
        if (Math.abs(endpoint.y - floorY) > epsilon) continue;
        const distanceToEdge = edge.axis === "z" ? Math.abs(endpoint.point.x - edge.fixed) : Math.abs(endpoint.point.z - edge.fixed);
        if (distanceToEdge > endpoint.width / 2 + 0.05) continue;
        const along = edge.axis === "z" ? endpoint.point.z : endpoint.point.x;
        intervals = intervalsMinus(intervals, along - endpoint.width / 2, along + endpoint.width / 2);
      }
      // A flight that runs parallel to a platform edge needs a continuous open stairwell, not just end gaps.
      for (const stair of NESTED_CITY.stairs) {
        if (Math.abs(stair.start.y - floorY) > epsilon && Math.abs(stair.end.y - floorY) > epsilon) continue;
        const dx = Math.abs(stair.end.x - stair.start.x);
        const dz = Math.abs(stair.end.z - stair.start.z);
        if (edge.axis === "z" && dx <= epsilon && Math.abs(stair.start.x - edge.fixed) <= stair.width / 2 + 0.05) {
          intervals = intervalsMinus(
            intervals,
            Math.min(stair.start.z, stair.end.z) - stair.width / 2,
            Math.max(stair.start.z, stair.end.z) + stair.width / 2
          );
        } else if (edge.axis === "x" && dz <= epsilon && Math.abs(stair.start.z - edge.fixed) <= stair.width / 2 + 0.05) {
          intervals = intervalsMinus(
            intervals,
            Math.min(stair.start.x, stair.end.x) - stair.width / 2,
            Math.max(stair.start.x, stair.end.x) + stair.width / 2
          );
        }
      }

      intervals.forEach((interval, index) => {
        if (interval.end - interval.start < minimumRailLength) return;
        rails.push({
          id: `${platform.id}:${edge.edge}:${index}`,
          platformId: platform.id,
          level: platform.level,
          axis: edge.axis,
          edge: edge.edge,
          fixed: edge.fixed,
          inward: edge.inward,
          start: interval.start,
          end: interval.end,
        });
      });
    }
  }
  return rails;
}

export interface NestedCityFloorLabel {
  full: string;
  compact: string;
}

/** Convert a walking-surface height to a compact HUD label without updating on every stair tread. */
export function nestedCityFloorLabel(floorY: number): NestedCityFloorLabel {
  if (!Number.isFinite(floorY)) return { full: "位置未知", compact: "未知" };

  const levelIndex = NESTED_CITY.levels.findIndex((level) => Math.abs(level - floorY) <= 0.32);
  if (levelIndex === 0) return { full: "1F · 0 m", compact: "1F" };
  if (levelIndex > 0) {
    const level = NESTED_CITY.levels[levelIndex];
    const floorNumber = levelIndex + 1;
    return { full: `${floorNumber}F · ${level} m`, compact: `${floorNumber}F` };
  }
  return { full: "階梯", compact: "階梯" };
}

// 大面積玻璃窗（北牆 z = −depth/2），以落地採光取代單層小房間窗洞。
// 墩寬、窗高與窗寬是概念模型假設；保留既有桌面、書本與工作視角的公尺尺度。
const WINDOW_WEST_PIER = 0.35;
const WINDOW_EAST_PIER = 1.2;
const WINDOW_LEFT = -ROOM.width / 2 + WINDOW_WEST_PIER;
const WINDOW_RIGHT = ROOM.width / 2 - WINDOW_EAST_PIER;
export const WINDOW = {
  cx: (WINDOW_LEFT + WINDOW_RIGHT) / 2,
  width: WINDOW_RIGHT - WINDOW_LEFT,
  sill: 0.24,
  top: ROOM.height - 0.65,
  frame: 0.09,
  depth: 0.2,
  mullions: 4,
  bars: 0,
  sillDepth: 0.34,
  sillThickness: 0.08,
};

// L 形大理石檯面：沿北窗延伸，並沿西側回折；只平移到新窗位，不隨房間放大。
// 桌板頂 0.78、厚 0.05、深 0.68；沿窗段維持既有 5.79 m 尺寸。
export const DESK = {
  cx: WINDOW.cx, // 沿窗段中心（工作視角錨點）
  width: 5.79, // 保持擴大房間前的實際沿窗段長度
  depth: 0.68, // 檯面深
  top: 0.78, // 桌面高度
  thickness: 0.05,
  sideDepth: 1.7, // 西牆回折總長；尺寸不隨房間擴大
  sideX: 0.68, // 西牆回折段深（X），保持家具實際尺度
};

/** Physical planes used by room labels and their aspect-matched canvas textures. */
export const CATEGORY_LABEL_PLANE = { width: 0.18, height: 0.05 } as const;
export const DESK_PREVIEW_PLANE = { width: 1.7, height: 0.42 } as const;

export function heldCoverPlaneSize(bookDepth: number, bookHeight: number): { width: number; height: number } {
  return {
    width: Math.max(0.01, bookDepth * 0.92),
    height: Math.max(0.01, bookHeight * 0.94),
  };
}

// 桌下落地的深炭櫃（圖一：櫃高 0.73、深 0.60、4 片門、縫 0.008）
export const CABINET = {
  height: 0.73,
  depth: 0.6,
  gap: 0.008,
  doors: 4,
};

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
  wall: "#d6d0c6", // 南／東牆：暖灰泥（附圖的灰米色，不用奶油黃）
  wallTint: "#eee9e1", // 照片 albedo 本身已是米灰；乘法 tint 必須近白，否則會變成土黃
  ceiling: "#f1ece3",
  floorTint: "#a2988a", // 附圖的暖灰褐石材地坪（照片大理石 × 中灰 tint）
  deskTint: "#c9c1b5", // 淺灰大理石檯面（albedo 已是灰白，tint 只需壓掉過曝）
  shelfWood: "#4a3728", // 書牆木作：深胡桃（附圖層板暗但仍看得到木紋）
  shelfWoodTint: "#c2a181",
  shelfBack: "#6c5a48", // 背板：打光的古銅色石材
  shelfBackTint: "#cfc0ae",
  ledge: "#4a3a2b",
  valance: "#3a322a", // 窗上深色木簾盒
  bronze: "#2b2520",
  led: "#ffb46b", // 層板燈帶（暖）
  ledSoft: "#ffd9ad",
  chairFabric: "#b5a894",
  chairSteel: "#a8a39a",
  rug: "#8a8172", // 暖灰地毯（附圖地毯比地坪再深一階）
  cabinet: "#3b342c",
  cabinetDoor: "#463e34",
  deskEdge: "#9a9083",
  picFrame: "#141210",
  picMat: "#e3dacb",
};

// 懸浮薄層板書牆（v8.3：西牆 wallSign=-1；-1＝西牆、+1＝東牆，保留可切換）
// xBack 為背牆面 X；板材自背牆往室內長 depth；層板沿 Z 長 width。
const SHELF_CENTER_Z = 0;
const SHELF_WIDTH = ROOM.depth - 0.5;
export const SHELF = {
  wallSign: FIDELITY.shelfWallSign,
  // 書牆沿西牆延伸；兩端各留約 0.25 m，不會撞到南北牆。
  z: SHELF_CENTER_Z,
  width: SHELF_WIDTH, // 沿 Z 軸寬度（房間深 7.07 → 書架長 6.57 m）
  height: 2.46, // 最上層板「頂面」Y（附圖量測）
  depth: 0.28, // 層板深
  plank: 0.035, // 板厚
  pitch: 0.335, // 層板間距（v8.5：附圖 5 排，原 4 排 0.40）
  minRows: 5, // 至少 5 排懸浮層板（資料列不足時以空板＋裝飾書補滿）
  xBack: (ROOM.width / 2 - 0.16) * FIDELITY.shelfWallSign, // 西側書牆背板 X（−11.84 m）
  baseY: 0,
  bookDepth: 0.19, // 書本深度（X 向）
  bookGap: 0.006,
  boardGap: 0.05,
  labelWidth: 0.15, // 櫃板標籤佔寬
  maxRowHeight: 0.52,
  pullOut: 0.055, // 書本抽出距離（預覽）
  // 腰高長檯面（板頂 0.92、厚 0.045、深 0.30），與書牆等長並留 0.10 m 收邊。
  ledge: {
    top: 0.92,
    thickness: 0.045,
    depth: 0.3,
    z0: SHELF_CENTER_Z - SHELF_WIDTH / 2 + 0.1,
    z1: SHELF_CENTER_Z + SHELF_WIDTH / 2 - 0.1,
  },
  /** 背板燈槽：每層板後方洗牆光的亮度（0–1） */
  backGlow: 0.85,
  // 檯面下矮擱板（板頂 0.40、厚 0.035、深 0.28）
  lowShelf: {
    top: 0.4,
    thickness: 0.035,
    depth: 0.28,
    z0: SHELF_CENTER_Z - SHELF_WIDTH / 2 + 0.1,
    z1: SHELF_CENTER_Z + SHELF_WIDTH / 2 - 0.1,
  },
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
  const mainMinX = DESK.cx - DESK.width / 2;
  const mainMaxX = DESK.cx + DESK.width / 2;
  const mainMinZ = wallInnerZ;
  const mainMaxZ = wallInnerZ + DESK.depth;
  return [
    { minX: mainMinX, maxX: mainMaxX, minZ: mainMinZ, maxZ: mainMaxZ },
    {
      minX: mainMinX,
      maxX: mainMinX + DESK.sideX,
      minZ: mainMaxZ,
      maxZ: wallInnerZ + DESK.sideDepth,
    },
  ];
})();

/** 桌下深炭櫃 footprint；RoomGeometry 的櫃體/門片與玩家碰撞共用此座標真相。 */
export const CABINET_FOOTPRINT: readonly RoomRect[] = (() => {
  const wallZ = -ROOM.depth / 2;
  const wallInnerZ = wallZ + ROOM.wall;
  const [mainDesk, sideDesk] = DESK_FOOTPRINT;
  const deskX1 = mainDesk.maxX;
  const cabinetZ0 = wallZ;
  const cabinetZ1 = cabinetZ0 + CABINET.depth;
  const sideCabinetX0 = sideDesk.minX;
  const sideCabinetX1 = sideDesk.maxX - 0.08;
  return [
    { minX: sideCabinetX1, maxX: deskX1 - 0.12, minZ: cabinetZ0, maxZ: cabinetZ1 },
    { minX: sideCabinetX0, maxX: sideCabinetX1, minZ: wallInnerZ + 0.02, maxZ: cabinetZ1 },
  ];
})();

/** v8.3 椅子位置由桌面 footprint 推導，桌緣前距 0.62 m 並離側桌外緣至少 0.55 m。 */
const MAIN_DESK_FOOTPRINT = DESK_FOOTPRINT[0];
const SIDE_DESK_FOOTPRINT = DESK_FOOTPRINT[1];
const MAIN_DESK_CENTER_X = (MAIN_DESK_FOOTPRINT.minX + MAIN_DESK_FOOTPRINT.maxX) / 2;
export const CHAIR = {
  x: Math.max(SIDE_DESK_FOOTPRINT.maxX + 0.55, MAIN_DESK_CENTER_X - 0.87),
  y: 0,
  z: MAIN_DESK_FOOTPRINT.maxZ + 0.62,
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
  color: "#fff5e6",
  // 初始假設的高窗晨光：主光由北側高窗斜入多層挑空，柔度由環境光補足。
  intensity: 2.35,
  position: new THREE.Vector3(ROOM.width * 0.34, ROOM.height + 1.5, -ROOM.depth / 2 - 2.1),
  target: new THREE.Vector3(-ROOM.width * 0.08, 0.45, ROOM.depth * 0.22),
  shadowMap: { desktop: 2048, mobile: 1024 },
  /** PCFSoft 陰影模糊半徑（桌機較柔） */
  shadowRadius: { desktop: 7, mobile: 4 },
};
export const SUN_SHADOW_CAMERA = {
  left: -ROOM.width * 0.78,
  right: ROOM.width * 0.78,
  top: ROOM.depth * 0.88,
  bottom: -ROOM.depth * 0.76,
};
export const AMBIENT = {
  // 多層構件會遮住大量直射窗光；提高低頻填充，讓深處木／石材質仍可辨識。
  hemisphereSky: "#e8eae8",
  hemisphereGround: "#d2ccc1",
  hemisphereIntensity: 0.64,
  ambientColor: "#f7f0e6",
  ambientIntensity: 0.24,
};

/** 窗外柔光（無陰影補光；手機只留一盞）——讓窗邊與桌面有附圖的柔亮漸層。 */
export const WINDOW_FILL = {
  color: "#f2f5f8",
  intensityDesktop: 1.1,
  intensityMobile: 0.7,
  position: new THREE.Vector3(WINDOW.cx - 0.1, ROOM.height * 0.8, -ROOM.depth / 2 + 1.2),
  target: new THREE.Vector3(WINDOW.cx - 0.3, 1.2, ROOM.depth * 0.34),
};

function evenlySpaced(start: number, end: number, count: number): number[] {
  if (count <= 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1));
}

/** 書牆三盞暖光洗牆燈維持原數量與亮度，位置依新書牆長度等分。 */
const SHELF_WASH_START = SHELF.z - SHELF.width / 2 + 0.55;
const SHELF_WASH_END = SHELF.z + SHELF.width / 2 - 0.55;
export const SHELF_WASH = {
  color: "#ffc28c",
  intensityDesktop: 0.3,
  intensityMobile: 0.22,
  distance: 2.7,
  z: evenlySpaced(SHELF_WASH_START, SHELF_WASH_END, 3),
  y: 1.9,
  xOffset: 0.42,
};

/** 附圖的橫向百葉：上段遮蔽、下段透空，深色底桿。 */
export const BLINDS = {
  /** 簾片覆蓋窗洞高度比例（附圖只遮上段，下面整片見景） */
  cover: 0.05,
  slatPitch: 0.055,
  slatThickness: 0.015,
  slatDepth: 0.065,
  tiltDeg: 28,
  railHeight: 0.042,
  /** 窗頂簾盒高度：附圖是細窄的深色橫帶，不是一整條黑色厚板 */
  valanceHeight: 0.075,
  color: "#f2ece0", // 灰米色，避免過曝成純白
  /** 簾片上每 6 片一條細橫線（附圖百葉的節奏），以及 3 段垂直拉繩 */
  cordEvery: 6,
  cordColor: "#8a8274",
};

/** 大理石柔反射參數（v8.3 §P4） */
export const MARBLE_ROUGH = {
  // 附圖檯面是「霧面淺灰石」，地坪是更霧的微水泥質感：
  // 提高粗糙度並壓低環境反射，避免整片地板變成鏡面。
  desk: 0.38,
  floor: 0.94,
  metalness: 0,
  envIntensityDesk: 0.3,
  envIntensityFloor: 0.03,
};

// ================= 相機 =================
export const CAMERA = {
  fov: 60,
  near: 0.05,
  far: 110,
  pitchMin: THREE.MathUtils.degToRad(-70),
  pitchMax: THREE.MathUtils.degToRad(40),
  heightMin: 1.0,
  heightMax: 2.3,
  wallMargin: ROOM_EDGE_MARGIN, // 離開放結構外緣最小距離
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
  return CAMERA.fov + widen * 18; // 直式最寬 78°
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
    garden: "mountain-courtyard-view.png", // 山景庭園全景；作為北側高窗與環境反射（生成素材）
    spines: "book-spines.jpg", // 書脊色票（保留；不再當背板）
    microcement: "microcement.jpg", // 書牆背牆：深褐微水泥
    blind: "blind-slats.jpg", // 透光橫紋簾 alphaMap（3px 亮 / 6px 暗）
    leaf: "monstera-leaf.jpg", // 龜背竹葉片 alphaMap（白底黑葉）
  },
  repeat: {
    wall: [3, 2],
    microcement: [2.2, 1.6],
    floorOak: [6.4, 5.4],
    floorMarble: [3.6, 3.0],
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
  // 退到房間東南側，依新房寬／深比例取景，讓「左書牆、中轉角、右窗」完整入鏡。
  x: ROOM.width * 0.424,
  z: ROOM.depth * 0.418,
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

export interface AspectCanvasSize {
  width: number;
  height: number;
  aspect: number;
}

/** 建立與實體平面同 aspect 的 canvas 尺寸，避免 CanvasTexture 被非等比拉伸。 */
export function canvasSizeForPlane(planeW: number, planeH: number, canvasH = 512): AspectCanvasSize {
  const safeW = Number.isFinite(planeW) && planeW > 0 ? planeW : 1;
  const safeH = Number.isFinite(planeH) && planeH > 0 ? planeH : 1;
  const height = Math.max(1, Math.round(canvasH));
  const width = Math.max(1, Math.round(height * safeW / safeH));
  return { width, height, aspect: width / height };
}

const SPINE_LABEL_CANVAS_H = 512;
const SPINE_LABEL_MIN_CANVAS_W = 96;

/** 書脊直排字：最多六個字，標題過長以省略號佔最後一格。 */
export function spineTitleGlyphs(title: string): string[] {
  const chars = Array.from(String(title || "未命名").trim() || "未命名");
  return chars.length > 6 ? [...chars.slice(0, 5), "…"] : chars;
}

/**
 * 依書本尺寸推導書脊標籤的幾何與畫布：canvas aspect 永遠等於 plane aspect。
 * Plane 可透明延伸到完整書高；實際紙籤仍以書厚的 62% 和書高的 72% 繪製。
 */
export function spineLabelLayout(input: {
  title: string;
  thickness: number;
  height: number;
}): {
  planeW: number;
  planeH: number;
  aspect: number;
  canvasW: number;
  canvasH: number;
  fontSize: number;
  charCount: number;
  lineGap: number;
} {
  const thickness = Math.max(0.001, Number.isFinite(input.thickness) ? input.thickness : 0.03);
  const height = Math.max(0.01, Number.isFinite(input.height) ? input.height : 0.22);
  const planeH = height;
  // 96px 最小寬度避免細書脊 canvas 過度低解析度；透明 plane 不會把標籤白底撐出書脊。
  const planeW = Math.max(thickness, planeH * SPINE_LABEL_MIN_CANVAS_W / SPINE_LABEL_CANVAS_H);
  const canvasW = Math.round(SPINE_LABEL_CANVAS_H * planeW / planeH);
  const charCount = spineTitleGlyphs(input.title).length;
  const fontSize = Math.round(canvasW * 0.62);
  return {
    planeW,
    planeH,
    aspect: planeW / planeH,
    canvasW,
    canvasH: SPINE_LABEL_CANVAS_H,
    fontSize,
    charCount,
    lineGap: fontSize * 1.25,
  };
}

/** 對書脊垂直排版做純數學 bounds 計算（不用 canvas，測試可確保 6 字不溢出）。 */
export function spineLabelTextBounds(layout: Pick<
  ReturnType<typeof spineLabelLayout>,
  "canvasW" | "canvasH" | "fontSize" | "charCount" | "lineGap"
>): { left: number; right: number; top: number; bottom: number } {
  const textHeight = layout.fontSize + Math.max(0, layout.charCount - 1) * layout.lineGap;
  const top = (layout.canvasH - textHeight) / 2;
  return {
    left: (layout.canvasW - layout.fontSize) / 2,
    right: (layout.canvasW + layout.fontSize) / 2,
    top,
    bottom: top + textHeight,
  };
}

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

export type RoomColliderKind = "desk" | "cabinet" | "shelf" | "chair" | "player" | "structure" | "railing";
export interface OrientedColliderFootprint {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  rotationY: number;
}
export interface Aabb extends RoomRect {
  kind: RoomColliderKind;
  bottom?: number;
  top: number;
  standable: boolean;
  /** Exact footprint for rotated architectural members; min/max remain broad-phase bounds. */
  oriented?: OrientedColliderFootprint;
}
export type RoomCollider = Aabb;

/** Circle-versus-box footprint query; rotated members use their actual local rectangle, not the broad AABB. */
export function colliderOverlapsCircle(collider: Aabb, x: number, z: number, radius = 0): boolean {
  if (collider.oriented) {
    const { centerX, centerZ, width, depth, rotationY } = collider.oriented;
    const dx = x - centerX;
    const dz = z - centerZ;
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    const closestX = THREE.MathUtils.clamp(localX, -width / 2, width / 2);
    const closestZ = THREE.MathUtils.clamp(localZ, -depth / 2, depth / 2);
    return (localX - closestX) ** 2 + (localZ - closestZ) ** 2 <= radius ** 2 + 1e-10;
  }
  const closestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
  const closestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
  return (x - closestX) ** 2 + (z - closestZ) ** 2 <= radius ** 2 + 1e-10;
}

function separateCircleFromOrientedRect(
  x: number,
  z: number,
  radius: number,
  footprint: OrientedColliderFootprint
): { x: number; z: number } | null {
  const dx = x - footprint.centerX;
  const dz = z - footprint.centerZ;
  const cos = Math.cos(footprint.rotationY);
  const sin = Math.sin(footprint.rotationY);
  let localX = dx * cos - dz * sin;
  let localZ = dx * sin + dz * cos;
  const halfWidth = footprint.width / 2;
  const halfDepth = footprint.depth / 2;
  const closestX = THREE.MathUtils.clamp(localX, -halfWidth, halfWidth);
  const closestZ = THREE.MathUtils.clamp(localZ, -halfDepth, halfDepth);
  let pushX = localX - closestX;
  let pushZ = localZ - closestZ;
  const distance = Math.hypot(pushX, pushZ);
  if (distance >= radius) return null;

  if (distance > 1e-8) {
    const scale = (radius - distance) / distance;
    localX += pushX * scale;
    localZ += pushZ * scale;
  } else {
    const candidates = [
      { axis: "x" as const, value: -halfWidth - radius, distance: localX + halfWidth },
      { axis: "x" as const, value: halfWidth + radius, distance: halfWidth - localX },
      { axis: "z" as const, value: -halfDepth - radius, distance: localZ + halfDepth },
      { axis: "z" as const, value: halfDepth + radius, distance: halfDepth - localZ },
    ].sort((a, b) => {
      const difference = a.distance - b.distance;
      if (difference !== 0) return difference;
      if (a.axis === b.axis) return 0;
      return a.axis === "x" ? -1 : 1;
    });
    if (candidates[0].axis === "x") localX = candidates[0].value;
    else localZ = candidates[0].value;
  }

  return {
    x: footprint.centerX + localX * cos + localZ * sin,
    z: footprint.centerZ - localX * sin + localZ * cos,
  };
}

/** 玩家以 XZ 圓形近似；bottom/top 讓樓層碰撞只阻擋與角色身高相交的物件。 */
const frameStructureColliders: Aabb[] = [...NESTED_CITY.frames, ...NESTED_CITY.featureFrames].flatMap((frame) =>
  cityFrameMembers(frame).map((member) => {
    const cos = Math.cos(frame.rotationY);
    const sin = Math.sin(frame.rotationY);
    const x = frame.x + member.x * cos + member.z * sin;
    const z = frame.z - member.x * sin + member.z * cos;
    const halfX = Math.abs(cos) * member.width / 2 + Math.abs(sin) * member.depth / 2;
    const halfZ = Math.abs(sin) * member.width / 2 + Math.abs(cos) * member.depth / 2;
    return {
      minX: x - halfX,
      maxX: x + halfX,
      minZ: z - halfZ,
      maxZ: z + halfZ,
      kind: "structure" as const,
      bottom: member.bottom,
      top: member.top,
      standable: false,
      ...(Math.abs(frame.rotationY) > 1e-8 ? {
        oriented: { centerX: x, centerZ: z, width: member.width, depth: member.depth, rotationY: frame.rotationY },
      } : {}),
    };
  })
);
const chairCos = Math.abs(Math.cos(CHAIR.yaw));
const chairSin = Math.abs(Math.sin(CHAIR.yaw));
const chairHalfX = (CHAIR.width * chairCos + CHAIR.depth * chairSin) / 2;
const chairHalfZ = (CHAIR.width * chairSin + CHAIR.depth * chairCos) / 2;
const structureColliders: Aabb[] = NESTED_CITY.columns.map((column) => ({
  minX: column.x - column.width / 2,
  maxX: column.x + column.width / 2,
  minZ: column.z - column.depth / 2,
  maxZ: column.z + column.depth / 2,
  kind: "structure",
  bottom: column.bottom,
  top: column.top,
  standable: false,
}));
const cityObstacleColliders: Aabb[] = NESTED_CITY.obstacles.map((obstacle) => ({
  minX: obstacle.x - obstacle.width / 2,
  maxX: obstacle.x + obstacle.width / 2,
  minZ: obstacle.z - obstacle.depth / 2,
  maxZ: obstacle.z + obstacle.depth / 2,
  kind: "structure",
  bottom: obstacle.bottom,
  top: obstacle.top,
  standable: false,
}));
const bridgeRailColliders: Aabb[] = NESTED_CITY.bridgeRails.map((rail) => {
  const floorY = NESTED_CITY.levels[rail.level];
  return {
    minX: rail.x - rail.width / 2,
    maxX: rail.x + rail.width / 2,
    minZ: rail.z - rail.depth / 2,
    maxZ: rail.z + rail.depth / 2,
    kind: "railing",
    bottom: floorY + 0.02,
    top: floorY + NESTED_CITY.railHeight,
    standable: false,
  };
});
const platformRailColliders: Aabb[] = nestedCityPlatformRails().map((rail) => {
  const floorY = NESTED_CITY.levels[rail.level];
  const halfThickness = NESTED_CITY.glassRailThickness / 2;
  const fixed = rail.fixed + rail.inward * halfThickness;
  return {
    minX: rail.axis === "x" ? rail.start : fixed - halfThickness,
    maxX: rail.axis === "x" ? rail.end : fixed + halfThickness,
    minZ: rail.axis === "z" ? rail.start : fixed - halfThickness,
    maxZ: rail.axis === "z" ? rail.end : fixed + halfThickness,
    kind: "railing",
    bottom: floorY + 0.08,
    top: floorY + NESTED_CITY.railHeight,
    standable: false,
  };
});
const stairRailColliders: Aabb[] = NESTED_CITY.stairs.flatMap((stair) => {
  const dx = stair.end.x - stair.start.x;
  const dz = stair.end.z - stair.start.z;
  const length = Math.hypot(dx, dz);
  if (length <= 1e-9) return [];
  const insetT = Math.min(0.15, NESTED_CITY.stairRailInset / length);
  const railStartT = insetT;
  const railEndT = 1 - insetT;
  const postWidth = NESTED_CITY.platformRailPostWidth;
  const samples = Math.max(2, Math.ceil(length * (railEndT - railStartT) / 1.65));
  const sideX = -dz / length;
  const sideZ = dx / length;
  return [-1, 1].flatMap((side) => Array.from({ length: samples + 1 }, (_, i) => {
    const t = railStartT + (railEndT - railStartT) * i / samples;
    const surfaceY = cityStairHeightAt(stair, t);
    const x = stair.start.x + dx * t + sideX * (stair.width / 2 - postWidth / 2) * side;
    const z = stair.start.z + dz * t + sideZ * (stair.width / 2 - postWidth / 2) * side;
    return {
      minX: x - postWidth / 2,
      maxX: x + postWidth / 2,
      minZ: z - postWidth / 2,
      maxZ: z + postWidth / 2,
      kind: "railing" as const,
      bottom: surfaceY,
      top: surfaceY + NESTED_CITY.railHeight,
      standable: false,
    };
  }));
});
export const COLLIDERS: readonly Aabb[] = [
  ...DESK_FOOTPRINT.map((rect) => ({ ...rect, kind: "desk" as const, bottom: 0, top: DESK.top, standable: false })),
  ...CABINET_FOOTPRINT.map((rect) => ({ ...rect, kind: "cabinet" as const, bottom: 0, top: CABINET.height, standable: false })),
  {
    minX: Math.min(SHELF.xBack, shelfFrontX()),
    maxX: Math.max(SHELF.xBack, shelfFrontX()),
    minZ: SHELF.z - SHELF.width / 2,
    maxZ: SHELF.z + SHELF.width / 2,
    kind: "shelf",
    bottom: 0,
    top: SHELF.height,
    standable: false,
  },
  {
    minX: CHAIR.x - chairHalfX,
    maxX: CHAIR.x + chairHalfX,
    minZ: CHAIR.z - chairHalfZ,
    maxZ: CHAIR.z + chairHalfZ,
    kind: "chair",
    bottom: 0,
    top: CHAIR.seatHeight,
    standable: false,
  },
  ...structureColliders,
  ...cityObstacleColliders,
  ...frameStructureColliders,
  ...bridgeRailColliders,
  ...platformRailColliders,
  ...stairRailColliders,
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
  chairPosition?: { x: number; z: number },
  otherPlayerPosition?: { x: number; z: number; floorY?: number } | null,
  floorY = 0
): { x: number; z: number } {
  const start = clampRoomPosition(x, z);
  let px = start.x;
  let pz = start.z;
  const dynamicPlayerCollider: Aabb[] = otherPlayerPosition && Number.isFinite(otherPlayerPosition.x) && Number.isFinite(otherPlayerPosition.z)
    ? [{
        minX: otherPlayerPosition.x - PLAYER_RADIUS,
        maxX: otherPlayerPosition.x + PLAYER_RADIUS,
        minZ: otherPlayerPosition.z - PLAYER_RADIUS,
        maxZ: otherPlayerPosition.z + PLAYER_RADIUS,
        kind: "player",
        bottom: otherPlayerPosition.floorY ?? 0,
        top: (otherPlayerPosition.floorY ?? 0) + 1.7,
        standable: false,
      }]
    : [];
  const playerTop = floorY + 1.75;
  const colliders = [...COLLIDERS, ...dynamicPlayerCollider].filter((collider) =>
    !(ignoreChair && collider.kind === "chair") &&
    !(ignoreDeskAndCabinet && (collider.kind === "desk" || collider.kind === "cabinet")) &&
    collider.top > floorY + 0.05 && (collider.bottom ?? 0) < playerTop
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

      if (collider.oriented) {
        const orientation = {
          ...collider.oriented,
          centerX: collider.oriented.centerX + chairOffsetX,
          centerZ: collider.oriented.centerZ + chairOffsetZ,
        };
        const separated = separateCircleFromOrientedRect(px, pz, radius, orientation);
        if (!separated) continue;
        const bounded = clampRoomPosition(separated.x, separated.z);
        px = bounded.x;
        pz = bounded.z;
        changed = true;
        continue;
      }

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

/** 最大無跳躍垂直落差；階梯踏步高度必須遠低於此值。 */
export const MAX_WALKABLE_STEP = 0.62;

/**
 * 回傳最接近目前樓層的可行走面高度。堆疊平台可投影到同一 XZ 區域，
 * 因此必須帶入目前高度，避免玩家從地面瞬移到上層；階梯只在腳下可接續時採用。
 */
export function groundHeightAt(x: number, z: number, referenceY = 0): number {
  const stairHeights: number[] = [];
  for (const stair of NESTED_CITY.stairs) {
    const dx = stair.end.x - stair.start.x;
    const dz = stair.end.z - stair.start.z;
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq <= 1e-9) continue;
    const t = ((x - stair.start.x) * dx + (z - stair.start.z) * dz) / lengthSq;
    if (t < 0 || t > 1) continue;
    const closestX = stair.start.x + dx * t;
    const closestZ = stair.start.z + dz * t;
    if (Math.hypot(x - closestX, z - closestZ) > stair.width / 2) continue;
    const height = cityStairHeightAt(stair, t);
    if (Math.abs(height - referenceY) <= MAX_WALKABLE_STEP) stairHeights.push(height);
  }
  if (stairHeights.length) {
    return stairHeights.reduce((best, height) =>
      Math.abs(height - referenceY) < Math.abs(best - referenceY) ? height : best
    );
  }

  const floorCandidates = [0, ...NESTED_CITY.platforms
    .filter((platform) =>
      x >= platform.x - platform.width / 2 && x <= platform.x + platform.width / 2 &&
      z >= platform.z - platform.depth / 2 && z <= platform.z + platform.depth / 2
    )
    .map((platform) => NESTED_CITY.levels[platform.level])];
  return floorCandidates.reduce((best, height) =>
    Math.abs(height - referenceY) < Math.abs(best - referenceY) ? height : best
  );
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
  const depth = portrait ? -0.72 : -0.76;
  const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * Math.abs(depth);
  const halfW = halfH * safeAspect;
  return {
    // 直式手機往左收（避開右下角的放置／回架按鈕），橫式放在右下但保留邊距。
    x: portrait ? -0.06 : Math.min(0.24, Math.max(halfW * 0.42, 0.13)),
    y: -halfH * (portrait ? 0.4 : 0.43),
    z: depth,
    scale: portrait ? 0.72 : 0.6,
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
  /** World-space walking surface; optional for peers running the earlier v1 presence shape. */
  floorY?: number;
  jumpOffset: number;
  yaw: number;
  pitch: number;
  moving: boolean;
  sprinting?: boolean;
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
  arm: { x: 0.245, y: -0.25, z: -0.42, width: 0.066, length: 0.2 },
  /** 胸口：貼近下緣，只露出上緣一片，讀成「低頭看到自己的身體」 */
  chest: { y: -0.31, z: -0.48, width: 0.3, height: 0.26, depth: 0.19, tilt: 0.42 },
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
  distance: 2.5,
  // v8.6：1.05 m 時人物後腦會佔掉畫面中央一大塊（實際預覽），退到 1.45 m 才看得到全身。
  minDistance: 1.5,
  rise: 0.72,
  shoulder: 0.4,
  // 視線目標再往右、往前帶：角色因此更靠畫面左側，不會擋住桌面與窗。
  lookAhead: 1.75,
  wallMargin: 0.24,
  /** 直式手機（aspect < 0.85）拉遠：窄視野下角色才不會佔滿畫面 */
  portraitDistance: 3.0,
  portraitAspect: 0.85,
  /** 貼牆時的抬高階梯（公尺）：越高越能越過角色頭頂看前方 */
  jamLift: [0.42, 0.78, 1.12],
  /** 第三人稱額外視野（度）：角色與房間能同時入鏡，第一人稱不受影響 */
  // v8.6：貼牆時相機只能退 1.4 m，若不加寬視野，後腦會佔掉畫面中央（實際預覽）。
  fovBoost: 20,
  /** 直式手機的加寬幅度較小（房間視野本來就加寬到 80°） */
  fovBoostPortrait: 8,
  /** 準心對準角色右肩外側，角色因此落在畫面左側且不會擋住互動目標（公尺） */
  aimShoulder: 0.46,
  /** 直式手機：水平視角只有約 44°，角色必須推得更靠左，否則胸口佔滿畫面中央 */
  portraitAimShoulder: 0.92,
  portraitLookAhead: 2.05,
  portraitLookDrop: 0.9,
  /** 視線目標比眼睛低多少（公尺）：讓全身與腿部動作入鏡 */
  lookDrop: 0.6,
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
    y > (collider.bottom ?? 0) - 0.1 && y < collider.top + 0.12 &&
    colliderOverlapsCircle(collider, x, z, 0.18)
  );
}

/**
 * 第三人稱相機位置（純函式）：由角色眼睛往視線反方向退開，遇到牆／家具自動縮短。
 * 只回傳位置；lookAt 由 CameraRig 依角色前方計算。
 */
export function resolveThirdPersonCamera(
  pose: Pick<PlayerPose, "x" | "z" | "eyeY" | "jumpOffset" | "floorY">,
  viewYaw: number,
  viewPitch: number,
  distance = THIRD_PERSON.distance
): { x: number; y: number; z: number } {
  const eyeY = groundHeightAt(pose.x, pose.z, pose.floorY ?? 0) + pose.eyeY + pose.jumpOffset;
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
      x: THREE.MathUtils.clamp(
        pose.x + bx * d + right.x * shoulder,
        -ROOM.width / 2 + THIRD_PERSON.wallMargin,
        ROOM.width / 2 - THIRD_PERSON.wallMargin
      ),
      y,
      z: THREE.MathUtils.clamp(
        pose.z + bz * d + right.z * shoulder,
        -ROOM.depth / 2 + THIRD_PERSON.wallMargin,
        ROOM.depth / 2 - THIRD_PERSON.wallMargin
      ),
    };
  };
  const minimumVisibleDistance = Math.min(1.02, Math.max(0.5, distance * 0.4));
  const isUsableCameraPosition = (candidate: { x: number; y: number; z: number }) =>
    Math.hypot(candidate.x - pose.x, candidate.z - pose.z) > 0.28 &&
    Math.hypot(candidate.x - pose.x, candidate.y - eyeY, candidate.z - pose.z) > minimumVisibleDistance &&
    !thirdPersonBlocked(candidate.x, candidate.y, candidate.z);

  // 1) 理想：從最遠處往內找第一個沒被擋住、且未被牆角夾到角色身上的位置。
  const steps = 18;
  for (let i = steps; i >= 0; i -= 1) {
    const d = THIRD_PERSON.minDistance + (distance - THIRD_PERSON.minDistance) * (i / steps);
    const candidate = candidateAt(d, baseY);
    if (isUsableCameraPosition(candidate)) return candidate;
  }

  // 2) 貼牆／貼家具：抬高視點，讓角色仍在畫面內（不穿牆、也不消失在後腦）。
  for (const lift of THIRD_PERSON.jamLift) {
    const y = Math.min(ROOM.height - 0.14, baseY + lift);
    for (let i = steps; i >= 0; i -= 1) {
      const d = THIRD_PERSON.minDistance + (distance - THIRD_PERSON.minDistance) * (i / steps);
      const lifted = candidateAt(d, y);
      if (isUsableCameraPosition(lifted)) return lifted;
    }
  }

  // 3) 牆角（正後方完全沒有空間）：往左右肩側前方找位置，寧可側拍也不要塞進角色。
  const sideAngles = [Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
  for (const angle of sideAngles) {
    for (const d of [1.5, 1.25, THIRD_PERSON.minDistance, 0.82]) {
      const side = candidateAt(d, baseY, angle);
      if (isUsableCameraPosition(side)) return side;
    }
    for (const lift of [0.55, 0.95]) {
      const y = Math.min(ROOM.height - 0.14, baseY + lift);
      for (const d of [1.4, 1.1, 0.82]) {
        const side = candidateAt(d, y, angle);
        if (isUsableCameraPosition(side)) return side;
      }
    }
  }

  // 4) 最後手段：抬高到角色上方、水平只退 0.45 m；相機仍在房內且不會與頭部重疊。
  const overhead = candidateAt(0.45, Math.min(ROOM.height - 0.12, eyeY + 1.25));
  if (isUsableCameraPosition(overhead)) return overhead;
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
