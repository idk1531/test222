// Shared room footprint source for geometry and the default study camera.
// Scaling area by 2 grows each plan dimension by sqrt(2), without changing vertical/object scale.
export const ROOM_AREA_SCALE = 2;
const BASE_ROOM = { width: 6, depth: 5 };
const ROOM_LINEAR_SCALE = Math.sqrt(ROOM_AREA_SCALE);

export const ROOM_DIMENSIONS = {
  width: +(BASE_ROOM.width * ROOM_LINEAR_SCALE).toFixed(2),
  depth: +(BASE_ROOM.depth * ROOM_LINEAR_SCALE).toFixed(2),
  height: 2.75,
  wall: 0.12,
} as const;
