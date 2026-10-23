// Shared room footprint source for geometry, camera, collision, and the nested-city model.
// 初始假設：以 6 × 5 m 的既有房間模組作為基準，平面放大 4 倍、高度放大後為 16 m。
// 這是為了概念模型與動線選定的起始尺寸，不是從參考圖精確量測而來。
export const ROOM_AREA_SCALE = 16;
const BASE_ROOM = { width: 6, depth: 5 };
const ROOM_LINEAR_SCALE = Math.sqrt(ROOM_AREA_SCALE);

export const ROOM_DIMENSIONS = {
  width: +(BASE_ROOM.width * ROOM_LINEAR_SCALE).toFixed(1),
  depth: +(BASE_ROOM.depth * ROOM_LINEAR_SCALE).toFixed(1),
  height: 16,
  wall: 0.32,
} as const;

/** Camera/player stay this far inside the open structural perimeter. */
export const ROOM_EDGE_MARGIN = 0.35;
