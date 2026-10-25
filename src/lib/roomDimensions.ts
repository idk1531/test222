// Shared room/building envelope source for geometry, camera, collision, and the nested-city model.
// The accepted exterior is an isosceles trapezoid within this 48 × 48 m bounding envelope, 16 m tall.
// A 12 × 12 m base module scaled by four provides the bounding dimensions, not a square footprint.
export const ROOM_AREA_SCALE = 16;
const BASE_ROOM = { width: 12, depth: 12 };
const ROOM_LINEAR_SCALE = Math.sqrt(ROOM_AREA_SCALE);

export const ROOM_DIMENSIONS = {
  width: +(BASE_ROOM.width * ROOM_LINEAR_SCALE).toFixed(1),
  depth: +(BASE_ROOM.depth * ROOM_LINEAR_SCALE).toFixed(1),
  height: 16,
  wall: 0.32,
} as const;

/** Player/camera clearance inset from the trapezoid's exterior wall (metres). */
export const ROOM_EDGE_MARGIN = 0.84;

export interface RoomPlanPoint {
  x: number;
  z: number;
}

/** Accepted ABCD exterior footprint: short AB north, long CD south, CD intentionally open. */
export const TRAPEZOID_POINTS = {
  A: { x: -ROOM_DIMENSIONS.width / 4, z: -ROOM_DIMENSIONS.depth / 2 },
  B: { x: ROOM_DIMENSIONS.width / 4, z: -ROOM_DIMENSIONS.depth / 2 },
  C: { x: ROOM_DIMENSIONS.width / 2, z: ROOM_DIMENSIONS.depth / 2 },
  D: { x: -ROOM_DIMENSIONS.width / 2, z: ROOM_DIMENSIONS.depth / 2 },
} as const satisfies Record<"A" | "B" | "C" | "D", RoomPlanPoint>;

const BOUNDARY: readonly RoomPlanPoint[] = [
  TRAPEZOID_POINTS.A,
  TRAPEZOID_POINTS.B,
  TRAPEZOID_POINTS.C,
  TRAPEZOID_POINTS.D,
];
const cross = (a: RoomPlanPoint, b: RoomPlanPoint) => a.x * b.z - a.z * b.x;
const subtract = (a: RoomPlanPoint, b: RoomPlanPoint): RoomPlanPoint => ({ x: a.x - b.x, z: a.z - b.z });
const add = (a: RoomPlanPoint, b: RoomPlanPoint): RoomPlanPoint => ({ x: a.x + b.x, z: a.z + b.z });
const scale = (point: RoomPlanPoint, amount: number): RoomPlanPoint => ({ x: point.x * amount, z: point.z * amount });
const signedArea = (points: readonly RoomPlanPoint[]) => points.reduce((area, point, index) => {
  const next = points[(index + 1) % points.length];
  return area + point.x * next.z - next.x * point.z;
}, 0) / 2;

function inwardNormal(from: RoomPlanPoint, to: RoomPlanPoint): RoomPlanPoint {
  const edge = subtract(to, from);
  const length = Math.hypot(edge.x, edge.z);
  return { x: -edge.z / length, z: edge.x / length };
}

function lineIntersection(
  pointA: RoomPlanPoint,
  directionA: RoomPlanPoint,
  pointB: RoomPlanPoint,
  directionB: RoomPlanPoint
): RoomPlanPoint {
  const denominator = cross(directionA, directionB);
  if (Math.abs(denominator) < 1e-10) return pointA;
  const t = cross(subtract(pointB, pointA), directionB) / denominator;
  return add(pointA, scale(directionA, t));
}

/** Parallel inset of the convex outer walls; clearance is measured perpendicular to each wall. */
export function trapezoidFootprintAtClearance(clearance: number): RoomPlanPoint[] {
  if (clearance <= 0) return [...BOUNDARY];
  const directions = BOUNDARY.map((point, index) => subtract(BOUNDARY[(index + 1) % BOUNDARY.length], point));
  const normals = BOUNDARY.map((point, index) => inwardNormal(point, BOUNDARY[(index + 1) % BOUNDARY.length]));
  return BOUNDARY.map((point, index) => {
    const previous = (index + BOUNDARY.length - 1) % BOUNDARY.length;
    const previousOffset = add(point, scale(normals[previous], clearance));
    const nextOffset = add(point, scale(normals[index], clearance));
    return lineIntersection(previousOffset, directions[previous], nextOffset, directions[index]);
  });
}

export const TRAPEZOID_WALKABLE_FOOTPRINT = trapezoidFootprintAtClearance(ROOM_EDGE_MARGIN);

export function isPointInsideTrapezoid(point: RoomPlanPoint, clearance = 0, epsilon = 1e-8): boolean {
  const safeClearance = Number.isFinite(clearance) ? Math.max(0, clearance) : 0;
  const polygon = safeClearance === ROOM_EDGE_MARGIN
    ? TRAPEZOID_WALKABLE_FOOTPRINT
    : trapezoidFootprintAtClearance(safeClearance);
  if (polygon.length < 3) return false;
  const orientation = signedArea(polygon) >= 0 ? 1 : -1;
  return polygon.every((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return cross(subtract(end, start), subtract(point, start)) * orientation >= -epsilon;
  });
}

/** Closest point projection into the inset trapezoid, shared by local movement and remote-pose sanitizing. */
export function clampToTrapezoid(x: number, z: number, clearance = ROOM_EDGE_MARGIN): RoomPlanPoint {
  const point = {
    x: Number.isFinite(x) ? x : 0,
    z: Number.isFinite(z) ? z : 0,
  };
  const safeClearance = Number.isFinite(clearance) ? Math.max(0, clearance) : 0;
  const polygon = safeClearance === ROOM_EDGE_MARGIN
    ? TRAPEZOID_WALKABLE_FOOTPRINT
    : trapezoidFootprintAtClearance(safeClearance);
  if (isPointInsideTrapezoid(point, safeClearance)) return point;

  let bestPoint = polygon[0];
  let bestDistanceSq = Infinity;
  for (let index = 0; index < polygon.length; index++) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const edge = subtract(end, start);
    const edgeLengthSq = edge.x * edge.x + edge.z * edge.z;
    const t = edgeLengthSq > 1e-12
      ? Math.max(0, Math.min(1, ((point.x - start.x) * edge.x + (point.z - start.z) * edge.z) / edgeLengthSq))
      : 0;
    const candidate = { x: start.x + edge.x * t, z: start.z + edge.z * t };
    const distanceSq = (candidate.x - point.x) ** 2 + (candidate.z - point.z) ** 2;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestPoint = candidate;
    }
  }
  return { x: bestPoint.x, z: bestPoint.z };
}
