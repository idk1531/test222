// Shared room footprint source for geometry, camera, collision, and the nested-city model.
// Reference-board scale: the outer timber shell is 48 × 24 × 16 m. The 12 × 6 m
// base module is enlarged by a linear factor of four (area scale 16).
export const ROOM_AREA_SCALE = 16;
const BASE_ROOM = { width: 12, depth: 6 };
const ROOM_LINEAR_SCALE = Math.sqrt(ROOM_AREA_SCALE);

export const ROOM_DIMENSIONS = {
  width: +(BASE_ROOM.width * ROOM_LINEAR_SCALE).toFixed(1),
  depth: +(BASE_ROOM.depth * ROOM_LINEAR_SCALE).toFixed(1),
  height: 16,
  wall: 0.32,
} as const;

/** Keep the player just inside the 1.1 m outer-frame posts (half beam + capsule radius). */
export const ROOM_EDGE_MARGIN = 0.84;
