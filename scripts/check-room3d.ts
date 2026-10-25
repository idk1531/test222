import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, CABINET_FOOTPRINT, CATEGORY_LABEL_PLANE, CHAIR, COLLIDERS, DESK, DESK_FOOTPRINT, DESK_PREVIEW_PLANE, DESK_SNAP, FIDELITY, JUMP,
  MARBLE_ROUGH, MATCH_VIEW, MAX_WALKABLE_STEP, NESTED_CITY, NESTED_CITY_CAMERA_VIEWS, PLAYER_RADIUS, ROOM, ROOM_AREA_SCALE, SHELF, SHELF_INWARD, SIT,
  cityCorridorFramePlan, cityFrameMembers, cityPlatformFootprint, cityStairHeightAt, cityTrapezoidCornerFootprint,
  cityTrapezoidWallBandFootprint, clipCityPolygonToTrapezoid, isCityPointInsidePolygon, isCityPointInsideTrapezoid,
  colliderOverlapsCircle, nestedCityPlatformRails, nestedCityInspectionDistance,
  SUN, TEXTURES, WINDOW, canvasSizeForPlane, heldCoverPlaneSize, spineLabelLayout, spineLabelTextBounds, spineTitleGlyphs,
  clampRoomPosition, clampPitchRad, clampHeight, clampToDesk,
  forwardFromYawPitch, easeInOutCubic, groundHeightAt, isWithinSitTrigger, projectToScreen, detectQuality,
  resolveCollision, nestedCityFloorLabel, shelfFrontX, shelfPlankCount, shelfPlankY, stepJump, roomFovFor, thirdPersonHandOffset,
  yawFromLookDelta, pitchFromLookDelta, resolveThirdPersonCamera, canJump, THIRD_PERSON, firstPersonHeldAnchor, firstPersonViewVisibility, VIEW_MODEL, PLAYER_RADIUS as RADIUS,
} from "../src/lib/room3d";
import { DEFAULT_CAMERA } from "../src/lib/study";
import { canvasCJKFont } from "../src/lib/fonts";
import { CHARACTER, characterAnim } from "../src/lib/character";
import { resolveAction, type HitKind, type InputKey, type RoomAction, type RoomActionCtx } from "../src/lib/roomActions";

const edge = clampRoomPosition(100, -100);
assert.ok(isCityPointInsidePolygon(edge, NESTED_CITY.trapezoid.walkableFootprint),
  "camera/player clamps must use the inset trapezoid, not the old square room boundary");
assert.ok(!isCityPointInsideTrapezoid({ x: 100, z: -100 }, 0.84));

// Reference-board envelope and walkable floor rhythm (1F–4F).
assert.equal(ROOM_AREA_SCALE, 16);
assert.equal(ROOM.width, 48);
assert.equal(ROOM.depth, 48);
assert.equal(ROOM.width * ROOM.depth, 2304);
assert.equal(ROOM.height, 16);
assert.equal(ROOM.wall, 0.32);
assert.deepEqual(DEFAULT_CAMERA, { yaw: 70, pitch: 15, x: 0, z: 22.4, height: 1.52, floorY: 0 });
assert.deepEqual(NESTED_CITY.levels, [0, 4, 8, 12]);
assert.deepEqual(NESTED_CITY.atrium, { x: 0, z: 0, width: 20, depth: 20 }, "2F–4F 應保留 20 × 20 m 中央挑空；跨層走道只容許局部穿越");
assert.deepEqual(nestedCityFloorLabel(0), { full: "1F · 0 m", compact: "1F" });
assert.deepEqual(nestedCityFloorLabel(4), { full: "2F · 4 m", compact: "2F" });
assert.deepEqual(nestedCityFloorLabel(8), { full: "3F · 8 m", compact: "3F" });
assert.deepEqual(nestedCityFloorLabel(12), { full: "4F · 12 m", compact: "4F" });
assert.deepEqual(nestedCityFloorLabel(2), { full: "階梯", compact: "階梯" });
assert.deepEqual(nestedCityFloorLabel(Number.NaN), { full: "位置未知", compact: "未知" });

// Trapezoid envelope and connected 2 m corridor chain (coordinates are X/Z in metres).
{
  const { trapezoid, corridor } = NESTED_CITY;
  const { A, B, C, D, E, F } = trapezoid.points;
  assert.deepEqual([A, B, C, D, E, F], [
    { x: -12, z: -24 }, { x: 12, z: -24 }, { x: 24, z: 24 },
    { x: -24, z: 24 }, { x: 21, z: 12 }, { x: -21, z: 12 },
  ], "AB=24 m is the selected modeling default; E/F are exactly 3/4 along B→C and A→D");
  assert.equal(trapezoid.shortBase, 24);
  assert.equal(trapezoid.longBase, 48);
  assert.equal(trapezoid.depth, 48);
  assert.equal(trapezoid.openEdge, "CD");
  assert.deepEqual(trapezoid.wallEdges.map(({ id }) => id), ["AB", "BC", "AD"],
    "the CD boundary stays open and must not be rendered as a wall/frame beam");
  assert.deepEqual(trapezoid.wallBandLevels, [0, 4, 8, 12, 16]);
  assert.equal(trapezoid.walkableFootprint.length, 4);
  assert.ok(trapezoid.walkableFootprint.every((point) => isCityPointInsidePolygon(point, [A, B, C, D])),
    "the playable floor/camera polygon must be inset inside the exterior trapezoid");
  for (const wall of trapezoid.wallEdges) {
    const wallBand = cityTrapezoidWallBandFootprint(wall, ROOM.wall);
    assert.ok(wallBand.length >= 4 && wallBand.every((point) => isCityPointInsidePolygon(point, [A, B, C, D])),
      `${wall.id} exterior wall thickness must be directed inward and clipped to ABCD`);
  }
  for (const corner of [A, B, C, D]) {
    const post = cityTrapezoidCornerFootprint(corner, ROOM.wall);
    assert.ok(post.length >= 3 && post.every((point) => isCityPointInsidePolygon(point, [A, B, C, D])),
      "the corner-post footprint must not extend beyond the actual outer wall");
  }
  assert.deepEqual(corridor.floors, [0, 4, 8, 12], "the connected corridor footprint is present on all four floor planes");
  assert.equal(corridor.width, 2);
  assert.equal(NESTED_CITY.floorHeight, 4);
  assert.deepEqual(corridor.segments.map(({ id, referenceFrom, referenceTo }) => ({ id, referenceFrom, referenceTo })), [
    { id: "CE", referenceFrom: "C", referenceTo: "E" },
    { id: "EF", referenceFrom: "E", referenceTo: "F" },
    { id: "FA", referenceFrom: "F", referenceTo: "A" },
    { id: "AB", referenceFrom: "A", referenceTo: "B" },
  ], "the route is the connected chain C→E→F→A→B, with no CD corridor");
  for (const segment of corridor.segments) {
    const referenceFrom = trapezoid.points[segment.referenceFrom];
    const referenceTo = trapezoid.points[segment.referenceTo];
    const actual = { x: segment.to.x - segment.from.x, z: segment.to.z - segment.from.z };
    const reference = { x: referenceTo.x - referenceFrom.x, z: referenceTo.z - referenceFrom.z };
    assert.ok(Math.hypot(actual.x, actual.z) > 0);
    assert.ok(Math.abs(actual.x * reference.z - actual.z * reference.x) < 1e-6,
      `${segment.id} corridor floor projection must remain parallel to its named run`);
  }

  const trapezoidVertices = [A, B, C, D];
  const signedArea = (points: readonly { x: number; z: number }[]) => points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.z - next.x * point.z;
  }, 0) / 2;
  const trapezoidArea = (trapezoid.shortBase + trapezoid.longBase) * trapezoid.depth / 2;
  const corridorArea = Math.abs(signedArea(corridor.footprint));
  const oversizedSquare = clipCityPolygonToTrapezoid([
    { x: -30, z: -30 }, { x: 30, z: -30 }, { x: 30, z: 30 }, { x: -30, z: 30 },
  ]);
  assert.ok(Math.abs(Math.abs(signedArea(oversizedSquare)) - trapezoidArea) < 1e-8,
    "polygon clipping must return the real trapezoid, not merely a 48×48 bounding box");
  assert.equal(trapezoidArea, 1728);
  assert.ok(corridorArea > 0 && corridorArea < trapezoidArea * 0.2,
    "the narrow connected corridors must leave the majority of the trapezoid open to view");
  const orientation = Math.sign(signedArea(trapezoidVertices));
  for (const point of corridor.footprint) {
    for (let index = 0; index < trapezoidVertices.length; index++) {
      const start = trapezoidVertices[index];
      const end = trapezoidVertices[(index + 1) % trapezoidVertices.length];
      const edge = { x: end.x - start.x, z: end.z - start.z };
      const delta = { x: point.x - start.x, z: point.z - start.z };
      assert.ok((edge.x * delta.z - edge.z * delta.x) * orientation >= -1e-6,
        "corridor slabs must be clipped to the trapezoid footprint");
    }
  }
  const corridorShape = new THREE.Shape();
  corridorShape.moveTo(corridor.footprint[0].x, -corridor.footprint[0].z);
  for (const point of corridor.footprint.slice(1)) corridorShape.lineTo(point.x, -point.z);
  corridorShape.closePath();
  const corridorGeometry = new THREE.ExtrudeGeometry(corridorShape, { depth: 0.3, bevelEnabled: false });
  corridorGeometry.rotateX(-Math.PI / 2);
  corridorGeometry.computeBoundingBox();
  assert.ok(corridorGeometry.attributes.position.count > 0 && corridorGeometry.boundingBox,
    "the connected corridor outline must triangulate to actual Three.js slab geometry");
  assert.ok(corridorGeometry.boundingBox!.min.x >= -ROOM.width / 2 - 1e-6 &&
    corridorGeometry.boundingBox!.max.x <= ROOM.width / 2 + 1e-6 &&
    corridorGeometry.boundingBox!.min.z >= -ROOM.depth / 2 - 1e-6 &&
    corridorGeometry.boundingBox!.max.z <= ROOM.depth / 2 + 1e-6,
  "corridor slab geometry must stay within the 48×48 m envelope");
  corridorGeometry.dispose();

  const [t1, t2] = corridor.frames;
  assert.deepEqual(corridor.frames.map(({ id, corridorId, width, bottom, top }) => ({ id, corridorId, width, bottom, top })), [
    { id: "T1", corridorId: "EF", width: 2, bottom: 0, top: 8 },
    { id: "T2", corridorId: "FA", width: 2, bottom: 8, top: 12 },
  ]);
  for (const frame of corridor.frames) {
    const segment = corridor.segments.find(({ id }) => id === frame.corridorId);
    assert.ok(segment, `${frame.id} must refer to a rendered corridor segment`);
    assert.equal(frame.width, corridor.width, `${frame.id} floor/ceiling rectangle width matches the corridor`);
    assert.ok(Number.isInteger((frame.top - frame.bottom) / NESTED_CITY.floorHeight),
      `${frame.id} height must be an integer multiple of floor height h`);
    const direction = { x: segment!.to.x - segment!.from.x, z: segment!.to.z - segment!.from.z };
    const plan = cityCorridorFramePlan(frame);
    assert.ok(plan);
    assert.ok(Math.abs(plan.length - Math.hypot(direction.x, direction.z)) < 1e-9 && plan.width === corridor.width,
      `${frame.id} floor/ceiling rectangle must retain the corridor's length and width`);
    const projectedRectangleAxis = { x: Math.sin(plan.rotationY), z: Math.cos(plan.rotationY) };
    assert.ok(Math.abs(direction.x * projectedRectangleAxis.z - direction.z * projectedRectangleAxis.x) < 1e-9,
      `${frame.id} floor/ceiling projection must have the same long-axis orientation as ${frame.corridorId}`);
  }
  assert.ok(t1.bottom < NESTED_CITY.levels[1] && t1.top > NESTED_CITY.levels[1],
    "T1 spans 1h below and 1h above the 2F corridor");
  assert.equal(t2.top, t1.top + NESTED_CITY.floorHeight,
    "T2 ceiling is at least one floor height above the T1 ceiling");
}

assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 1).length, 5, "2F 由兩側廊、錯位跨橋和南北連接段組成");
assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 2).length, 4, "3F 以錯位側廊、跨橋和北連接段維持大挑空");
assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 3).length, 4, "4F 由錯位觀景平台、短橋和小露台組成，而非鋪滿整層");
assert.equal(NESTED_CITY.frames.length, 3, "主構圖由外框、中框與內核三重同向縮尺結構組成");
assert.deepEqual(NESTED_CITY.frames.map(({ width, depth, height }) => ({ width, depth, height })), [
  { width: 30, depth: 16, height: 16 },
  { width: 22.5, depth: 12, height: 12 },
  { width: 15, depth: 8, height: 8 },
], "W/S/C 保留垂直層級與逐層等比例，平面尺寸已配合梯形外牆內縮");
assert.deepEqual(NESTED_CITY.frames.map(({ x, z, bottom }) => ({ x, z, bottom })), [
  { x: 0, z: 0, bottom: 0 },
  { x: 4, z: 4, bottom: 2 },
  { x: -4, z: -4, bottom: 4 },
], "三層使用明確有限的水平錯位，並保持各自 Y 底標高");
assert.ok(NESTED_CITY.frames.every((frame) => Math.abs(frame.rotationY) < 1e-12), "三層框架必須共用 X/Z 軸，不得彼此旋轉");
for (let index = 1; index < NESTED_CITY.frames.length; index++) {
  const parent = NESTED_CITY.frames[index - 1];
  const child = NESTED_CITY.frames[index];
  const scaleX = child.width / parent.width;
  const scaleZ = child.depth! / parent.depth!;
  const scaleY = child.height / parent.height;
  assert.ok(scaleX > 0 && scaleX < 1 && Math.abs(scaleX - scaleZ) < 1e-12 && Math.abs(scaleZ - scaleY) < 1e-12,
    `${child.id} 必須是前一層等比例縮小的長方形，不得改變長寬比`);
}
assert.deepEqual(NESTED_CITY.featureFrames.map(({ x, z, width, depth, height, bottom }) => ({ x, z, width, depth, height, bottom })), [
  { x: 4, z: 8, width: 26, depth: 16, height: 4, bottom: 4 },
  { x: 10, z: 10, width: 18, depth: 4, height: 3, bottom: 8 },
  { x: 4, z: 12, width: 30, depth: 3, height: 8, bottom: 0 },
]);
assert.equal(NESTED_CITY.frames.length, 3, "主構圖由外框、中框與內核三重同向縮尺結構組成");
assert.equal(NESTED_CITY.stairs.length, 3);
assert.ok(NESTED_CITY.stairs.every((stair, index) =>
  stair.start.y === NESTED_CITY.levels[index] && stair.end.y === NESTED_CITY.levels[index + 1] &&
  (stair.end.y - stair.start.y) / stair.steps <= 0.2 &&
  Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z) / stair.steps >= 0.28
), "三段開放踏階要連接四個高度，踏高與踏深均需可走");

// Same-height deck slabs must meet at walkable edges, not overlap (z-fighting) or leave holes.
const PLATFORM_EPSILON = 1e-6;
const MIN_PLATFORM_CONNECTION_WIDTH = 0.8;
const platformBounds = (platform: (typeof NESTED_CITY.platforms)[number]) => ({
  minX: platform.x - platform.width / 2,
  maxX: platform.x + platform.width / 2,
  minZ: platform.z - platform.depth / 2,
  maxZ: platform.z + platform.depth / 2,
});
const platformsShareWalkableEdge = (
  a: (typeof NESTED_CITY.platforms)[number],
  b: (typeof NESTED_CITY.platforms)[number]
) => {
  const aBounds = platformBounds(a);
  const bBounds = platformBounds(b);
  const overlapX = Math.min(aBounds.maxX, bBounds.maxX) - Math.max(aBounds.minX, bBounds.minX);
  const overlapZ = Math.min(aBounds.maxZ, bBounds.maxZ) - Math.max(aBounds.minZ, bBounds.minZ);
  const shareXEdge = Math.abs(aBounds.maxX - bBounds.minX) <= PLATFORM_EPSILON ||
    Math.abs(bBounds.maxX - aBounds.minX) <= PLATFORM_EPSILON;
  const shareZEdge = Math.abs(aBounds.maxZ - bBounds.minZ) <= PLATFORM_EPSILON ||
    Math.abs(bBounds.maxZ - aBounds.minZ) <= PLATFORM_EPSILON;
  return (shareXEdge && overlapZ >= MIN_PLATFORM_CONNECTION_WIDTH) ||
    (shareZEdge && overlapX >= MIN_PLATFORM_CONNECTION_WIDTH);
};
const trapezoidPlanArea = (NESTED_CITY.trapezoid.shortBase + NESTED_CITY.trapezoid.longBase) * NESTED_CITY.trapezoid.depth / 2;
const testPolygonArea = (points: readonly { x: number; z: number }[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.z - next.x * point.z;
}, 0) / 2);
for (const level of [1, 2, 3]) {
  const floorPlatforms = NESTED_CITY.platforms.filter((platform) => platform.level === level);
  assert.ok(floorPlatforms.length > 0, `第 ${level} 層必須有可走平台`);
  const clippedFootprints = floorPlatforms.map(cityPlatformFootprint);
  assert.ok(clippedFootprints.every((footprint) => footprint.length >= 3 &&
    footprint.every((point) => isCityPointInsideTrapezoid(point))),
  `第 ${level + 1}F 每片實際樓板都必須裁切在 ABCD 外牆內`);
  const floorCoverage = clippedFootprints.reduce((area, footprint) => area + testPolygonArea(footprint), 0) / trapezoidPlanArea;
  assert.ok(floorCoverage <= 0.5, `第 ${level + 1}F 樓板需至少保留一半梯形面積作為挑空／開放（目前 ${(floorCoverage * 100).toFixed(1)}%）`);
  for (let i = 0; i < floorPlatforms.length; i++) {
    for (let j = i + 1; j < floorPlatforms.length; j++) {
      const a = platformBounds(floorPlatforms[i]);
      const b = platformBounds(floorPlatforms[j]);
      const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
      assert.ok(!(overlapX > PLATFORM_EPSILON && overlapZ > PLATFORM_EPSILON),
        `${floorPlatforms[i].id} 與 ${floorPlatforms[j].id} 同高重疊，會形成重複樓板表面`);
    }
  }
  const connected = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const current = queue.shift()!;
    for (let next = 0; next < floorPlatforms.length; next++) {
      if (!connected.has(next) && platformsShareWalkableEdge(floorPlatforms[current], floorPlatforms[next])) {
        connected.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(connected.size, floorPlatforms.length, `第 ${level} 層所有平台需以至少 ${MIN_PLATFORM_CONNECTION_WIDTH} m 寬的邊相連`);
}

const BRIDGE_POST_WIDTH = 0.085;
for (const rail of NESTED_CITY.bridgeRails) {
  const railBounds = {
    minX: rail.x - rail.width / 2,
    maxX: rail.x + rail.width / 2,
    minZ: rail.z - rail.depth / 2,
    maxZ: rail.z + rail.depth / 2,
  };
  const support = NESTED_CITY.platforms.find((platform) => {
    if (platform.level !== rail.level) return false;
    const bounds = platformBounds(platform);
    return railBounds.minX >= bounds.minX - PLATFORM_EPSILON &&
      railBounds.maxX <= bounds.maxX + PLATFORM_EPSILON &&
      railBounds.minZ >= bounds.minZ - PLATFORM_EPSILON &&
      railBounds.maxZ <= bounds.maxZ + PLATFORM_EPSILON;
  });
  assert.ok(support, `${rail.id} 的欄杆底座必須完整落在同層橋板上`);
  const postsAlongX = rail.width >= rail.depth;
  const postInset = BRIDGE_POST_WIDTH / 2;
  const postStart = postsAlongX ? rail.x - rail.width / 2 + postInset : rail.z - rail.depth / 2 + postInset;
  const postEnd = postsAlongX ? rail.x + rail.width / 2 - postInset : rail.z + rail.depth / 2 - postInset;
  const supportBounds = platformBounds(support!);
  const postMin = Math.min(postStart, postEnd) - postInset;
  const postMax = Math.max(postStart, postEnd) + postInset;
  const supportMin = postsAlongX ? supportBounds.minX : supportBounds.minZ;
  const supportMax = postsAlongX ? supportBounds.maxX : supportBounds.maxZ;
  assert.ok(postMin >= supportMin - PLATFORM_EPSILON && postMax <= supportMax + PLATFORM_EPSILON,
    `${rail.id} 兩端支柱不得懸在橋板外`);
}

const platformRails = nestedCityPlatformRails();
assert.ok(platformRails.length >= 20, "環廊外露邊需有連續護欄，不只橋道有欄杆");
assert.ok(COLLIDERS.some((collider) => collider.kind === "railing"), "護欄應納入角色碰撞資料");
for (const rail of platformRails) {
  const support = NESTED_CITY.platforms.find((platform) => platform.id === rail.platformId)!;
  const footprint = cityPlatformFootprint(support);
  const midpoint = { x: (rail.from.x + rail.to.x) / 2, z: (rail.from.z + rail.to.z) / 2 };
  const insideOffset = {
    x: midpoint.x + rail.inward.x * 0.01,
    z: midpoint.z + rail.inward.z * 0.01,
  };
  assert.ok(isCityPointInsidePolygon(rail.from, footprint) && isCityPointInsidePolygon(rail.to, footprint) &&
    isCityPointInsidePolygon(insideOffset, footprint), `${rail.id} must sit on an exposed clipped platform edge`);
  assert.ok(isCityPointInsideTrapezoid(rail.from) && isCityPointInsideTrapezoid(rail.to),
    `${rail.id} railing endpoints must stay inside ABCD`);
  assert.ok(Math.abs(Math.hypot(rail.inward.x, rail.inward.z) - 1) < 1e-8,
    `${rail.id} needs a normalized inward normal for collision/rendering`);
}
const pointSegmentDistance = (point: { x: number; z: number }, from: { x: number; z: number }, to: { x: number; z: number }) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 1e-12 ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSq)) : 0;
  return Math.hypot(point.x - (from.x + dx * t), point.z - (from.z + dz * t));
};
const stairLanding = NESTED_CITY.stairs[2].end;
assert.ok(!platformRails.some((rail) => rail.platformId === "level-3-west-observation-gallery" &&
  pointSegmentDistance(stairLanding, rail.from, rail.to) < NESTED_CITY.stairs[2].width / 2 - PLATFORM_EPSILON),
"the clipped west observation gallery must retain an open stair landing mouth");
const bridgeRailBlocksX = (rail: (typeof NESTED_CITY.bridgeRails)[number], x: number, halfWidth: number) =>
  rail.x - rail.width / 2 < x + halfWidth && rail.x + rail.width / 2 > x - halfWidth;
const southNearRails = NESTED_CITY.bridgeRails.filter((rail) => rail.id.startsWith("level-1-south-connector-rail-near"));
for (const stair of [NESTED_CITY.stairs[0], NESTED_CITY.stairs[1]]) {
  assert.ok(!southNearRails.some((rail) => bridgeRailBlocksX(rail, stair.end.y === 4 ? stair.end.x : stair.start.x, stair.width / 2)),
    `${stair.id} 必須穿過南側 2F 連接橋的護欄開口`);
}
const upperBridgeFarRail = NESTED_CITY.bridgeRails.find((rail) => rail.id === "level-2-crossing-rail-far-west")!;
assert.ok(!bridgeRailBlocksX(upperBridgeFarRail, NESTED_CITY.stairs[1].end.x, NESTED_CITY.stairs[1].width / 2),
  "2F→3F 樓梯落點需對準 3F 跨橋護欄缺口");
const footprintCoveredByFloor = (
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number },
  floorPlatforms: readonly (typeof NESTED_CITY.platforms)[number][]
) => {
  const corners = [
    { x: footprint.minX, z: footprint.minZ },
    { x: footprint.maxX, z: footprint.minZ },
    { x: footprint.maxX, z: footprint.maxZ },
    { x: footprint.minX, z: footprint.maxZ },
  ];
  return floorPlatforms.some((platform) => {
    const floorFootprint = cityPlatformFootprint(platform);
    return corners.every((corner) => isCityPointInsidePolygon(corner, floorFootprint, PLATFORM_EPSILON));
  });
};
for (const column of NESTED_CITY.columns) {
  const footprint = {
    minX: column.x - column.width / 2,
    maxX: column.x + column.width / 2,
    minZ: column.z - column.depth / 2,
    maxZ: column.z + column.depth / 2,
  };
  for (const level of [1, 2, 3]) {
    const floorY = NESTED_CITY.levels[level];
    if (column.bottom < floorY && column.top > floorY) {
      const floorPlatforms = NESTED_CITY.platforms.filter((platform) => platform.level === level);
      assert.ok(footprintCoveredByFloor(footprint, floorPlatforms),
        `${column.id} 在第 ${level} 層的柱腳投影需完整落在樓板聯集上`);
    }
  }
}
console.log("  ✓ 平台拓撲連通／無同高重疊，橋欄支柱與承重柱均落在樓板支承範圍內");
assert.equal(DESK.width, 5.79, "room-area growth must not scale the existing desk");
assert.equal(DESK_FOOTPRINT[0].maxX - DESK_FOOTPRINT[0].minX, DESK.width);

// 書房 v8.7 B：canvas 與實際平面同 aspect；直排中文至多六字，超長尾字改省略號。
const spineLayout = spineLabelLayout({ title: "書房書脊排版測試標題", thickness: 0.03, height: 0.22 });
assert.equal(spineLayout.canvasH, 512);
assert.equal(spineLayout.canvasW, Math.round(spineLayout.canvasH * spineLayout.planeW / spineLayout.planeH));
assert.ok(spineLayout.canvasW >= 96);
assert.equal(spineLayout.fontSize, Math.round(spineLayout.canvasW * 0.62));
assert.ok(spineLayout.fontSize >= 40);
assert.equal(spineLayout.lineGap, spineLayout.fontSize * 1.25);
assert.ok(Math.abs(spineLayout.canvasW / spineLayout.canvasH - spineLayout.planeW / spineLayout.planeH) < 0.002);
assert.deepEqual(spineTitleGlyphs("特別長的書房測試標題"), ["特", "別", "長", "的", "書", "…"]);
assert.deepEqual(spineTitleGlyphs("正好六個字嗎"), ["正", "好", "六", "個", "字", "嗎"]);
assert.deepEqual(spineTitleGlyphs("書名"), ["書", "名"]);
const cjkFont = canvasCJKFont();
assert.ok(cjkFont.includes('"SciNotes Noto Sans TC"'));
assert.ok(cjkFont.includes('"Microsoft JhengHei"') && cjkFont.endsWith("sans-serif"));
const spineBounds = spineLabelTextBounds({ ...spineLayout, charCount: 6 });
assert.ok(spineBounds.left >= 0 && spineBounds.right <= spineLayout.canvasW);
assert.ok(spineBounds.top >= 0 && spineBounds.bottom <= spineLayout.canvasH, "六字脊標題需在 canvas 高度內排完");
assert.deepEqual(CATEGORY_LABEL_PLANE, { width: 0.18, height: 0.05 });
assert.deepEqual(DESK_PREVIEW_PLANE, { width: 1.7, height: 0.42 });
const heldCoverPlane = heldCoverPlaneSize(0.18, 0.22);
const heldCoverSize = canvasSizeForPlane(heldCoverPlane.width, heldCoverPlane.height, 512);
assert.ok(Math.abs(heldCoverSize.aspect - heldCoverPlane.width / heldCoverPlane.height) < 1 / heldCoverSize.height);
const categoryLabelSize = canvasSizeForPlane(CATEGORY_LABEL_PLANE.width, CATEGORY_LABEL_PLANE.height, 160);
assert.ok(Math.abs(categoryLabelSize.aspect - CATEGORY_LABEL_PLANE.width / CATEGORY_LABEL_PLANE.height) < 1 / categoryLabelSize.height);
const deskPreviewSize = canvasSizeForPlane(DESK_PREVIEW_PLANE.width, DESK_PREVIEW_PLANE.height, 512);
assert.ok(Math.abs(deskPreviewSize.aspect - DESK_PREVIEW_PLANE.width / DESK_PREVIEW_PLANE.height) < 1 / deskPreviewSize.height);
console.log("  ✓ 48 × 48 × 16 m 參考建築／稀疏樓板與既有書本／畫布標籤比例");

// v8.4 家具 AABB：櫃體碰撞沿用 RoomGeometry 的同一 footprint，桌緣採玩家半徑擴張。
assert.deepEqual(
  COLLIDERS.filter((collider) => collider.kind === "cabinet").map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ })),
  CABINET_FOOTPRINT
);
assert.ok(COLLIDERS.some((collider) => collider.kind === "desk" && collider.standable === false));
assert.ok(COLLIDERS.some((collider) => collider.kind === "shelf"));
const chairCollider = COLLIDERS.find((collider) => collider.kind === "chair")!;
assert.ok(CHAIR.x > chairCollider.minX && CHAIR.x < chairCollider.maxX && CHAIR.z > chairCollider.minZ && CHAIR.z < chairCollider.maxZ);
const deskEdge = resolveCollision(0, DESK_FOOTPRINT[0].maxZ + 0.1);
assert.equal(deskEdge.x, 0);
assert.ok(Math.abs(deskEdge.z - (DESK_FOOTPRINT[0].maxZ + PLAYER_RADIUS)) < 1e-9, "玩家需停在桌板南緣外側");
let diagonal = { x: 2.4, z: -1.3 };
for (let i = 0; i < 50; i++) {
  const separated = resolveCollision(diagonal.x - 0.02, diagonal.z - 0.02);
  diagonal = clampRoomPosition(separated.x, separated.z);
}
assert.ok(Number.isFinite(diagonal.x) && Number.isFinite(diagonal.z));
assert.ok(diagonal.x < 2.4 && diagonal.z < -1.3, "斜向撞桌角仍須沿障礙滑動，不能卡死");
assert.ok(!COLLIDERS.some((collider) =>
  collider.top > 0.05 && (collider.bottom ?? 0) < 1.75 &&
  diagonal.x > collider.minX - PLAYER_RADIUS && diagonal.x < collider.maxX + PLAYER_RADIUS &&
  diagonal.z > collider.minZ - PLAYER_RADIUS && diagonal.z < collider.maxZ + PLAYER_RADIUS
), "地面層斜向分離後不可仍與角色高度相交的 AABB 重疊");
const otherPlayer = { x: 0, z: 0 };
const playerSeparation = resolveCollision(0.32, 0, PLAYER_RADIUS, false, false, undefined, otherPlayer);
assert.ok(Math.hypot(playerSeparation.x - otherPlayer.x, playerSeparation.z - otherPlayer.z) >= PLAYER_RADIUS * 2 - 1e-9,
  "雙人共享時不可穿過遠端玩家的水平碰撞範圍");
assert.deepEqual(resolveCollision(1, 0, PLAYER_RADIUS, false, false, undefined, otherPlayer), { x: 1, z: 0 },
  "遠離遠端玩家時不應被動態玩家碰撞體推動");
assert.equal(groundHeightAt(0, 0), 0);
console.log("  ✓ 家具／遠端玩家 AABB 碰撞、桌緣、斜角滑動與平地高度");

// 坐下觸發與「坐著滑進桌下 → F 安全起立」防死鎖。
assert.deepEqual(SIT, { triggerRadius: 0.34, seatY: 0.42, eyeY: 1.18, walkSpeed: 1.15, fov: 58, fadeOpacity: 0.25 });
assert.ok(isWithinSitTrigger(CHAIR.x + SIT.triggerRadius - 1e-6, CHAIR.z));
assert.equal(isWithinSitTrigger(CHAIR.x + SIT.triggerRadius + 1e-6, CHAIR.z), false, "trigger 半徑使用嚴格小於 0.34 m");
const seatedUnderDesk = resolveCollision(0, -1.9, PLAYER_RADIUS, true, true);
assert.deepEqual(seatedUnderDesk, { x: 0, z: -1.9 }, "坐姿可滑入桌下，桌／櫃碰撞暫時不阻擋");
const safeStand = resolveCollision(seatedUnderDesk.x, seatedUnderDesk.z, 0.30, true);
assert.ok(!COLLIDERS.some((collider) =>
  (collider.kind === "desk" || collider.kind === "cabinet") &&
  safeStand.x > collider.minX - 0.30 && safeStand.x < collider.maxX + 0.30 &&
  safeStand.z > collider.minZ - 0.30 && safeStand.z < collider.maxZ + 0.30
), "桌下按 F 起立前必須推到不與桌櫃重疊的安全位置");
const movedChair = { x: CHAIR.x + 1.5, z: CHAIR.z };
assert.deepEqual(resolveCollision(CHAIR.x, CHAIR.z, PLAYER_RADIUS, false, false, movedChair), { x: CHAIR.x, z: CHAIR.z },
  "椅子跟隨玩家後，碰撞箱也要移動，原位置不可殘留幽靈碰撞");
console.log("  ✓ SIT trigger 半徑、跟隨椅碰撞與桌下安全起立");

// 跳躍高度是瞬態 offset；0.5 秒後 base height（持久化視高）仍與起跳前完全相同。
{
  const baseHeight = clampHeight(1.52);
  const heightBeforeJump = baseHeight;
  let jump = { offset: 0, velocity: JUMP.velocity, onGround: false };
  for (let i = 0; i < 50; i++) jump = stepJump(jump, 0.01);
  const cameraHeight = groundHeightAt(0, 0) + baseHeight + jump.offset;
  assert.ok(Math.abs(baseHeight - heightBeforeJump) < 1e-6);
  assert.ok(Math.abs(cameraHeight - (baseHeight + jump.offset)) < 1e-9);
  assert.ok(jump.offset > 0);
  assert.ok(Math.abs(JUMP.velocity ** 2 / (2 * JUMP.gravity) - 0.56) < 0.01, "跳躍頂高應約 0.56 m");
  for (let i = 0; i < 25; i++) jump = stepJump(jump, 0.01);
  assert.deepEqual(jump, { offset: 0, velocity: 0, onGround: true });
}
console.log("  ✓ 跳躍頂高約 0.56 m、0.5 秒不污染 base height、最終落地");
assert.equal(clampPitchRad(-100), CAMERA.pitchMin);
assert.equal(clampPitchRad(-100, true), THREE.MathUtils.degToRad(-80), "seated pitch minimum relaxes to −80°");
assert.equal(clampPitchRad(100), CAMERA.pitchMax);
assert.equal(clampHeight(-1), CAMERA.heightMin);
assert.equal(clampHeight(100), CAMERA.heightMax);
assert.equal(CAMERA.lookSensitivity, 0.0042, "drag sensitivity remains unchanged");
assert.equal(CAMERA.lockSensitivity, 0.0022, "pointer-lock sensitivity is independently tuned");
assert.ok(forwardFromYawPitch(0, 0).distanceTo(forwardFromYawPitch(Math.PI * 8, 0)) < 1e-10);
assert.equal(easeInOutCubic(0), 0);
assert.equal(easeInOutCubic(0.5), 0.5);
assert.equal(easeInOutCubic(1), 1);
assert.ok(SUN.position.z < -ROOM.depth / 2);
assert.ok(SUN.target.z > -ROOM.depth / 2);

const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
camera.updateMatrixWorld();
const viewport = { clientWidth: 375, clientHeight: 375 } as HTMLElement;
const center = projectToScreen(new THREE.Vector3(0, 0, -2), camera, viewport);
assert.deepEqual(center, { x: 187.5, y: 187.5, visible: true });
assert.equal(projectToScreen(new THREE.Vector3(0, 0, 2), camera, viewport).visible, false);
assert.ok(detectQuality().pixelRatio <= 2); // SSR-safe, no browser globals required.
// ---- v8.2 照片級貼圖介接（public/textures/study-room）----
assert.equal(TEXTURES.enabled, true);
assert.ok(!TEXTURES.dir.startsWith("/"), "TEXTURES.dir 必須是相對路徑（assetUrl 負責補 basePath）");
assert.ok(["oak", "marble"].includes(TEXTURES.floor), "TEXTURES.floor 只能是 oak / marble");
for (const [key, file] of Object.entries(TEXTURES.files)) {
  const p = path.join(process.cwd(), "public", TEXTURES.dir, file);
  assert.ok(fs.existsSync(p), `缺少貼圖 ${key}：${p}（請跑 scripts/make-room-textures.sh）`);
  assert.ok(fs.statSync(p).size > 8_000, `貼圖 ${key} 過小，疑似損壞：${p}`);
}
for (const [key, [u, v]] of Object.entries(TEXTURES.repeat)) {
  assert.ok(u > 0 && v > 0, `TEXTURES.repeat.${key} 需為正數`);
}

// ---- v8.3「完全復刻圖一」幾何斷言 ----
// P0：書牆搬到西牆（xBack < 0），且距離牆面與 v8.2 相同（只翻符號，不是重寫）
assert.ok(SHELF.xBack < 0, "書牆保留西側朝向，但作為位於外牆內的自由書牆");
assert.equal(Math.abs(SHELF.xBack), 5);
assert.equal(SHELF.width, 28, "書牆需縮短並移入室內，避免沿斜外牆穿出梯形");
assert.equal(SHELF_INWARD, 1); // 西牆：室內方向 = +X
// 對照視角：站東南角面向西北 → 左書牆、右窗；且不會被 clampRoomPosition 卡在牆外
const match = clampRoomPosition(MATCH_VIEW.x, MATCH_VIEW.z);
assert.equal(match.x, MATCH_VIEW.x);
assert.equal(match.z, MATCH_VIEW.z);
// 面向 −45° 時 screen-right ≈ (+X, −Z)：西牆在左、北牆在右
{
  const yaw = MATCH_VIEW.yaw;
  const forward = forwardFromYawPitch(yaw, 0);
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  assert.ok(right.x > 0.5 && right.z < -0.5, "yaw=-45° 時畫面右方必須同時指向 +X 與 −Z");
  assert.ok(forward.x < 0 && forward.z < 0, "yaw=-45° 時視線必須望向西北（書牆與窗的交角）");
}
// 高窗跨越多層挑空；尺寸按初始假設建模，不冒稱由參考圖量得。
assert.equal(ROOM.height, 16);
assert.ok(WINDOW.sill >= 0 && WINDOW.top < ROOM.height);
assert.ok(WINDOW.top - WINDOW.sill > 14, "落地高窗需涵蓋大部分挑空高度");
assert.equal(WINDOW.mullions, 4);
assert.equal(WINDOW.bars, 0);

// Ordinary study-room view shares the same ABCD footprint; the original study/library furniture stays inside it.
const roomRectCorners = (rect: { minX: number; maxX: number; minZ: number; maxZ: number }) => [
  { x: rect.minX, z: rect.minZ }, { x: rect.maxX, z: rect.minZ },
  { x: rect.maxX, z: rect.maxZ }, { x: rect.minX, z: rect.maxZ },
];
for (const [name, footprint] of [
  ...DESK_FOOTPRINT.map((rect, index) => [`desk-${index + 1}`, rect] as const),
  ...CABINET_FOOTPRINT.map((rect, index) => [`cabinet-${index + 1}`, rect] as const),
]) {
  assert.ok(roomRectCorners(footprint).every((point) => isCityPointInsideTrapezoid(point)),
    `${name} in the regular study view must stay within the shared trapezoid ground floor`);
}
const shelfBounds = {
  minX: Math.min(SHELF.xBack, shelfFrontX()) - 0.12,
  maxX: Math.max(SHELF.xBack, shelfFrontX()) + 0.12,
  minZ: SHELF.z - SHELF.width / 2 - 0.12,
  maxZ: SHELF.z + SHELF.width / 2 + 0.12,
};
assert.ok(roomRectCorners(shelfBounds).every((point) => isCityPointInsideTrapezoid(point)),
  "the retained free-standing library wall must stay within the narrowing north half of the trapezoid");
assert.ok(isCityPointInsideTrapezoid(
  { x: CHAIR.x, z: CHAIR.z }, Math.hypot(CHAIR.width / 2, CHAIR.depth / 2)
), "the existing study chair and its full plan footprint must remain inside the outer wall");
const windowEnvelope = [
  { x: WINDOW.cx - WINDOW.width / 2, z: NESTED_CITY.trapezoid.points.A.z },
  { x: WINDOW.cx + WINDOW.width / 2, z: NESTED_CITY.trapezoid.points.B.z },
];
assert.ok(windowEnvelope.every((point) => isCityPointInsideTrapezoid(point)),
  "the north window opening must fit between the short-base corner piers");
const roomGeometrySource = fs.readFileSync(path.join(process.cwd(), "src/components/RoomGeometry.tsx"), "utf8");
assert.match(roomGeometrySource, /new THREE\.Shape\(\)/);
assert.match(roomGeometrySource, /NESTED_CITY\.trapezoid\.points/);
assert.match(roomGeometrySource, /floor\.name = "trapezoid-ground-floor-ABCD"/);
assert.match(roomGeometrySource, /for \(const point of \[B, C, southWest\]\)/,
  "the ordinary view's actual Three.js floor must trace A→B→C→D, not render a square box");
assert.doesNotMatch(roomGeometrySource, /box\(D\s*\+\s*0\.48\s*,\s*0\.1\s*,\s*D\s*\+\s*0\.48/,
  "the old oversized square ground slab must not return");
assert.ok(TEXTURES.floor === "marble", "v8.3 地坪必須切到淺灰大理石");
assert.ok(MARBLE_ROUGH.desk < 0.45, "桌板需保留柔反射");
assert.ok(MARBLE_ROUGH.floor > 0.6 && MARBLE_ROUGH.floor <= 1, "地坪需比桌板更霧，避免變成整片鏡面");
assert.equal(FIDELITY.shelfWallSign, -1);
// 層板堆疊：最上層板頂 = SHELF.height，往下每 0.335 一排，至少 5 排
assert.equal(shelfPlankCount(1), 5);
assert.equal(shelfPlankCount(6), 6);
assert.ok(Math.abs(shelfPlankY(0, 5) - SHELF.height) < 1e-9);
assert.ok(Math.abs(shelfPlankY(4, 5) - (SHELF.height - 4 * SHELF.pitch)) < 1e-9);
for (let r = 1; r < 5; r++) {
  assert.ok(Math.abs(shelfPlankY(r - 1, 5) - shelfPlankY(r, 5) - SHELF.pitch) < 1e-9);
}
// 最底層板仍高於腰高檯面（板下看得到檯面與矮擱板）
assert.ok(shelfPlankY(4, 5) > SHELF.ledge.top + 0.1);
// 書脊面在牆與室內之間，且朝 +X
assert.ok(shelfFrontX() > SHELF.xBack && shelfFrontX() < 0);

// ---- 嵌套之城白模：梯形走廊與 T1/T2；保留三重長方框架、中央挑空、樓梯與淨高 ----
{
  const [outerFrame, middleFrame, coreFrame] = NESTED_CITY.frames;
  assert.equal(outerFrame.id, "outer-timber-frame");
  assert.equal(outerFrame.plane, "box", "外部巨構應為連續三維框架，而不是四片互不相接的門架");
  assert.equal(middleFrame.id, "middle-stone-frame");
  assert.equal(middleFrame.plane, "box", "中框也必須是實際梁柱框架，不能只存水平規格");
  assert.equal(coreFrame.id, "inner-core-frame");
  assert.equal(coreFrame.plane, "box");
  assert.deepEqual(NESTED_CITY.frames.map(({ width, depth, height, x, z, bottom }) => ({ width, depth, height, x, z, bottom })), [
    { width: 30, depth: 16, height: 16, x: 0, z: 0, bottom: 0 },
    { width: 22.5, depth: 12, height: 12, x: 4, z: 4, bottom: 2 },
    { width: 15, depth: 8, height: 8, x: -4, z: -4, bottom: 4 },
  ]);
  assert.ok(NESTED_CITY.frames.every((frame) => Math.abs(frame.rotationY) < 1e-12),
    "三層長方形框架保留指定的中心錯位但一律不得旋轉");
  assert.deepEqual(NESTED_CITY.frames.map(({ bottom, height }) => bottom + height / 2), [8, 8, 8],
    "三層等比例縮尺必須以同一個 Y=8 中心對齊");
  const localPlanCorners = (frame: typeof outerFrame, x = 0, z = 0, width = frame.width, depth = frame.depth!) => {
    const cos = Math.cos(frame.rotationY);
    const sin = Math.sin(frame.rotationY);
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz]) => ({
      x: frame.x + x * cos + z * sin + sx * width / 2 * cos + sz * depth / 2 * sin,
      z: frame.z - x * sin + z * cos - sx * width / 2 * sin + sz * depth / 2 * cos,
    }));
  };
  const pointInFramePlan = (frame: typeof outerFrame, x: number, z: number, inset = 0) => {
    const dx = x - frame.x;
    const dz = z - frame.z;
    const cos = Math.cos(frame.rotationY);
    const sin = Math.sin(frame.rotationY);
    const localX = dx * cos - dz * sin;
    const localZ = dx * sin + dz * cos;
    return Math.abs(localX) <= frame.width / 2 - inset + 1e-9 &&
      Math.abs(localZ) <= frame.depth! / 2 - inset + 1e-9;
  };
  const trapezoidBoundary = [NESTED_CITY.trapezoid.points.A, NESTED_CITY.trapezoid.points.B,
    NESTED_CITY.trapezoid.points.C, NESTED_CITY.trapezoid.points.D];
  for (const corner of localPlanCorners(middleFrame)) {
    assert.ok(isCityPointInsideTrapezoid(corner),
      "調整後的偏移中框與全部角點須位於真正的梯形外牆內");
  }
  assert.equal(middleFrame.z + middleFrame.depth! / 2 - (outerFrame.z + outerFrame.depth! / 2), 2,
    "S 框仍在 +Z 方向超出 W 框 2 m，但不得超出梯形外牆");
  for (const corner of localPlanCorners(coreFrame)) {
    assert.ok(isCityPointInsideTrapezoid(corner) &&
      pointInFramePlan(outerFrame, corner.x, corner.z),
    "C 框需位於整棟梯形外牆及 W 框範圍內；不假設它完全置中於 S 框");
  }
  assert.equal(middleFrame.bottom + middleFrame.height, 14);
  assert.equal(coreFrame.bottom + coreFrame.height, 12);
  assert.ok(coreFrame.bottom >= middleFrame.bottom &&
    coreFrame.bottom + coreFrame.height <= middleFrame.bottom + middleFrame.height,
  "內核需落在中框高度範圍內，對應 2F–4F 挑空");
  for (const frame of NESTED_CITY.frames) {
    const members = cityFrameMembers(frame);
    const memberBounds = {
      minX: Math.min(...members.map((member) => member.x - member.width / 2)),
      maxX: Math.max(...members.map((member) => member.x + member.width / 2)),
      minZ: Math.min(...members.map((member) => member.z - member.depth / 2)),
      maxZ: Math.max(...members.map((member) => member.z + member.depth / 2)),
      minY: Math.min(...members.map((member) => member.bottom)),
      maxY: Math.max(...members.map((member) => member.top)),
    };
    assert.deepEqual(memberBounds, {
      minX: -frame.width / 2,
      maxX: frame.width / 2,
      minZ: -frame.depth! / 2,
      maxZ: frame.depth! / 2,
      minY: frame.bottom,
      maxY: frame.bottom + frame.height,
    }, `${frame.id} 實際梁柱網格外包必須等於尺寸表，不可只改規格資料`);
    assert.equal(frame.thickness, NESTED_CITY.corridor.width,
      `${frame.id} 平面構件寬度須沿用 2 m 走廊寬，外包尺寸不變`);
    assert.ok(Math.abs(frame.beamHeight / frame.height - 0.1) < 1e-12,
      `${frame.id} 未標定的垂直梁高只作一致呈現假設，不可冒稱圖面量值`);
    const posts = members.filter((member) => member.bottom === frame.bottom &&
      member.top === frame.bottom + frame.height &&
      Math.abs(member.width - frame.thickness) < 1e-9 &&
      Math.abs(member.depth - frame.thickness) < 1e-9);
    assert.equal(posts.length, 4, `${frame.id} 必須以四根角柱形成連續門式框架，側邊中點保持通透`);
    for (const member of members) {
      assert.ok(member.bottom >= -1e-9 && member.top <= ROOM.height + 1e-9, `${frame.id} 構件須位於 0–16 m 剖面內`);
      for (const corner of localPlanCorners(frame, member.x, member.z, member.width, member.depth)) {
        assert.ok(isCityPointInsidePolygon(corner, trapezoidBoundary) && isCityPointInsideTrapezoid(corner, 0.5 - 1e-6),
          `${frame.id} 的每根梁柱須保留至少 0.5 m 淨距，完全落在整棟梯形外牆內`);
      }
    }
  }
  assert.deepEqual(coreFrame.openings ?? [], [], "位於 C 框 +Z 外側的上層樓梯不應再切開內核梁柱");
  const upperStair = NESTED_CITY.stairs[2];
  assert.ok(upperStair.start.z - upperStair.width / 2 > coreFrame.z + coreFrame.depth! / 2,
    "3F→4F 踏階須完整走在偏移內核 +Z 邊界之外，保留 30 cm 構件淨距");
  const frameMemberOverlapCount = (frameA: typeof outerFrame, frameB: typeof outerFrame) => {
    const membersA = cityFrameMembers(frameA);
    const membersB = cityFrameMembers(frameB);
    let count = 0;
    for (const a of membersA) {
      const aMinX = frameA.x + a.x - a.width / 2;
      const aMaxX = frameA.x + a.x + a.width / 2;
      const aMinZ = frameA.z + a.z - a.depth / 2;
      const aMaxZ = frameA.z + a.z + a.depth / 2;
      for (const b of membersB) {
        const overlapX = Math.min(aMaxX, frameB.x + b.x + b.width / 2) - Math.max(aMinX, frameB.x + b.x - b.width / 2);
        const overlapZ = Math.min(aMaxZ, frameB.z + b.z + b.depth / 2) - Math.max(aMinZ, frameB.z + b.z - b.depth / 2);
        const overlapY = Math.min(a.top, b.top) - Math.max(a.bottom, b.bottom);
        if (overlapX > 1e-6 && overlapZ > 1e-6 && overlapY > 1e-6) count++;
      }
    }
    return count;
  };
  assert.deepEqual([
    frameMemberOverlapCount(outerFrame, middleFrame),
    frameMemberOverlapCount(outerFrame, coreFrame),
    frameMemberOverlapCount(middleFrame, coreFrame),
  ], [19, 12, 11], "指定錯位且採 2 m 構件寬的實際梁柱交疊數需保持可追蹤，對應圖中的交錯節點");
  const level2Stair = NESTED_CITY.stairs[1];
  const upperFlight = NESTED_CITY.stairs[2];
  const westStairOpening = middleFrame.openings?.find(({ edge }) => edge === "west");
  assert.ok(westStairOpening, "S 框西側 Y=12 梁需為 3F→4F 踏階留出穿越口");
  assert.ok(westStairOpening!.start <= upperFlight.start.z - middleFrame.z - upperFlight.width / 2 - PLAYER_RADIUS &&
    westStairOpening!.end >= upperFlight.start.z - middleFrame.z + upperFlight.width / 2 + PLAYER_RADIUS,
  "S 框西側開口須涵蓋樓梯淨寬與玩家碰撞半徑");
  const westBandCenterY = middleFrame.bottom + 10;
  const westBandHalfHeight = middleFrame.beamHeight * 0.58 / 2;
  assert.ok(westStairOpening!.bottom <= westBandCenterY - westBandHalfHeight &&
    westStairOpening!.top >= westBandCenterY + westBandHalfHeight,
  "S 框西側開口須完整移除 Y=12 梁帶的碰撞高度");
  for (const frame of [outerFrame, middleFrame]) {
    const opening = frame.openings?.find(({ edge }) => edge === "south");
    assert.ok(opening, `${frame.id} 需為 2F→3F 樓梯保留南側橫梁淨空`);
    assert.equal((opening.start + opening.end) / 2, level2Stair.start.x - frame.x,
      `${frame.id} 的局部開口必須轉換到指定中心後，與世界 X=${level2Stair.start.x} 樓梯對齊`);
    const bandHeight = frame.beamHeight * 0.58;
    const bandBottom = 8 - bandHeight / 2;
    const southEdgeZ = frame.depth! / 2 - frame.thickness / 2;
    const bandSegments = cityFrameMembers(frame).filter((member) =>
      Math.abs(member.z - southEdgeZ) < 1e-9 &&
      Math.abs(member.depth - frame.thickness) < 1e-9 &&
      Math.abs(member.bottom - bandBottom) < 1e-9 &&
      Math.abs(member.top - (bandBottom + bandHeight)) < 1e-9
    );
    assert.equal(bandSegments.length, 2, `${frame.id} 的 Y=8 南側環梁需在樓梯通道分成兩段`);
    for (const segment of bandSegments) {
      const start = segment.x - segment.width / 2;
      const end = segment.x + segment.width / 2;
      assert.ok(end <= opening.start + 1e-6 || start >= opening.end - 1e-6,
        `${frame.id} 的南側環梁不得侵入樓梯淨空`);
    }
    for (const y of [4, 12]) {
      const otherBandBottom = y - bandHeight / 2;
      const intactBandSegments = cityFrameMembers(frame).filter((member) =>
        Math.abs(member.z - southEdgeZ) < 1e-9 &&
        Math.abs(member.depth - frame.thickness) < 1e-9 &&
        Math.abs(member.bottom - otherBandBottom) < 1e-9 &&
        Math.abs(member.top - (otherBandBottom + bandHeight)) < 1e-9
      );
      assert.equal(intactBandSegments.length, 1, `${frame.id} 的 Y=${y} 南側環梁不得因樓梯開口被切斷`);
    }
  }
  assert.ok(cityFrameMembers(outerFrame).length >= 20 && cityFrameMembers(middleFrame).length >= 20 &&
    cityFrameMembers(coreFrame).length >= 12 && NESTED_CITY.featureFrames.every((frame) => cityFrameMembers(frame).length >= 8),
  "三重主框架與平台／橋廊／書庫模組均需由真實梁柱構成");
  for (const frame of NESTED_CITY.featureFrames) {
    for (const member of cityFrameMembers(frame)) {
      for (const corner of localPlanCorners(frame, member.x, member.z, member.width, member.depth)) {
        assert.ok(isCityPointInsideTrapezoid(corner), `${frame.id} 任何附加梁柱都不可越過梯形外牆`);
      }
    }
  }
  assert.deepEqual(Object.keys(NESTED_CITY_CAMERA_VIEWS).sort(), ["main", "side", "top"]);
  const modelRadius = Math.hypot(ROOM.width / 2, ROOM.height / 2, ROOM.depth / 2);
  for (const aspect of [0.4, 0.56, 1, 16 / 9]) {
    for (const [view, preset] of Object.entries(NESTED_CITY_CAMERA_VIEWS) as Array<[
      keyof typeof NESTED_CITY_CAMERA_VIEWS,
      (typeof NESTED_CITY_CAMERA_VIEWS)[keyof typeof NESTED_CITY_CAMERA_VIEWS]
    ]>) {
      const verticalHalfFov = THREE.MathUtils.degToRad(preset.fov / 2);
      const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
      const requiredDistance = modelRadius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * 1.08;
      assert.ok(Number.isFinite(nestedCityInspectionDistance(view, aspect)) &&
        nestedCityInspectionDistance(view, aspect) >= requiredDistance - 1e-9,
      `${view} 驗收視角在 aspect=${aspect} 時需完整涵蓋 48 × 48 × 16 m 外包絡`);
    }
  }

  const onPlatform = (level: number, x: number, z: number) => NESTED_CITY.platforms.some((platform) =>
    platform.level === level &&
    Math.abs(x - platform.x) <= platform.width / 2 &&
    Math.abs(z - platform.z) <= platform.depth / 2
  );
  for (const level of [1, 2, 3]) {
    let openSamples = 0;
    const sampleCount = 10;
    const atrium = NESTED_CITY.atrium;
    for (let xi = 0; xi < sampleCount; xi++) {
      const x = atrium.x - atrium.width / 2 + (xi + 0.5) * atrium.width / sampleCount;
      for (let zi = 0; zi < sampleCount; zi++) {
        const z = atrium.z - atrium.depth / 2 + (zi + 0.5) * atrium.depth / sampleCount;
        if (!onPlatform(level, x, z)) openSamples++;
      }
    }
    assert.ok(openSamples >= 80, `第 ${level} 層的 20 × 20 m 中央挑空需至少保留 80% 視線通透（目前 ${openSamples}/100）`);
  }
  assert.ok(![1, 2, 3].some((level) => onPlatform(level, NESTED_CITY.atrium.x, NESTED_CITY.atrium.z)), "中央挑空中心不可被樓板填滿");
  assert.equal(groundHeightAt(NESTED_CITY.atrium.x, NESTED_CITY.atrium.z, 0), 0, "地面仍可穿越挑空底部");
  assert.equal(groundHeightAt(-17, 0, 4), 4, "2F 西側環廊可行走");
  assert.equal(groundHeightAt(-17, -2, 8), 8, "同一投影位置依目前高度選取 3F 西側環廊");
  assert.equal(groundHeightAt(-17, 0, 0), 0, "不能從地面瞬移到重疊上層");

  for (const [index, stair] of NESTED_CITY.stairs.entries()) {
    const startFloor: number = NESTED_CITY.levels[index];
    const endFloor: number = NESTED_CITY.levels[index + 1];
    assert.equal(stair.start.y, startFloor, `${stair.id} 起點高度`);
    assert.equal(stair.end.y, endFloor, `${stair.id} 終點高度`);
    for (const endpoint of [stair.start, stair.end]) {
      if (endpoint.y === 0) continue;
      const levelIndex = NESTED_CITY.levels.indexOf(endpoint.y as (typeof NESTED_CITY.levels)[number]);
      assert.ok(NESTED_CITY.platforms.some((platform) => {
        const bounds = platformBounds(platform);
        return platform.level === levelIndex && endpoint.x >= bounds.minX - PLATFORM_EPSILON &&
          endpoint.x <= bounds.maxX + PLATFORM_EPSILON && endpoint.z >= bounds.minZ - PLATFORM_EPSILON &&
          endpoint.z <= bounds.maxZ + PLATFORM_EPSILON;
      }), `${stair.id} 的落點必須接上對應樓層平台`);
    }

    const endLevel = index + 1;
    const ceilingBottom = endFloor - 0.3;
    const samples = stair.steps * 4;
    const dx = stair.end.x - stair.start.x;
    const dz = stair.end.z - stair.start.z;
    const horizontalLength = Math.hypot(dx, dz);
    const direction = { x: dx / horizontalLength, z: dz / horizontalLength };
    const transverse = { x: direction.z, z: -direction.x };
    const stepRun = horizontalLength / stair.steps;
    const treadOverlapsPlatform = (center: { x: number; z: number }, platform: (typeof NESTED_CITY.platforms)[number]) => {
      const bounds = platformBounds(platform);
      const delta = { x: center.x - platform.x, z: center.z - platform.z };
      const axes = [
        { x: 1, z: 0 }, { x: 0, z: 1 }, direction, transverse,
      ];
      return axes.every((axis) => {
        const treadRadius = stair.width / 2 * Math.abs(transverse.x * axis.x + transverse.z * axis.z) +
          stepRun / 2 * Math.abs(direction.x * axis.x + direction.z * axis.z);
        const platformRadius = platform.width / 2 * Math.abs(axis.x) + platform.depth / 2 * Math.abs(axis.z);
        const distance = Math.abs(delta.x * axis.x + delta.z * axis.z);
        return distance < treadRadius + platformRadius - PLATFORM_EPSILON;
      });
    };
    for (let step = 0; step < stair.steps; step++) {
      const progress = (step + 0.5) / stair.steps;
      const center = {
        x: stair.start.x + dx * progress,
        z: stair.start.z + dz * progress,
      };
      for (const platform of NESTED_CITY.platforms.filter((candidate) => candidate.level === endLevel)) {
        assert.ok(!treadOverlapsPlatform(center, platform),
          `${stair.id} 第 ${step + 1} 個踏板不得侵入 ${endLevel + 1}F 上層平台或樓板`);
      }
    }
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const x = stair.start.x + (stair.end.x - stair.start.x) * t;
      const z = stair.start.z + (stair.end.z - stair.start.z) * t;
      const surfaceY = cityStairHeightAt(stair, t);
      assert.ok(Math.abs(groundHeightAt(x, z, surfaceY) - surfaceY) < 1e-6,
        `${stair.id} 每個踏階都要是角色可讀取的實際行走面`);
      for (const platform of NESTED_CITY.platforms.filter((candidate) => candidate.level === endLevel)) {
        const bounds = platformBounds(platform);
        const underUpperSlab = x > bounds.minX + PLATFORM_EPSILON && x < bounds.maxX - PLATFORM_EPSILON &&
          z > bounds.minZ + PLATFORM_EPSILON && z < bounds.maxZ - PLATFORM_EPSILON;
        if (underUpperSlab) {
          assert.ok(surfaceY + 1.75 <= ceilingBottom + 1e-6,
            `${stair.id} 不得在上層樓板下方穿越角色頭部淨高`);
        }
      }
      const moved = resolveCollision(x, z, PLAYER_RADIUS, false, false, undefined, undefined, surfaceY);
      assert.ok(Math.hypot(moved.x - x, moved.z - z) < 0.12,
        `${stair.id} 的扶手／框架碰撞不可封住動線`);
      assert.ok(Math.abs(groundHeightAt(moved.x, moved.z, surfaceY) - surfaceY) <= MAX_WALKABLE_STEP + 1e-6,
        `${stair.id} 不可有不可走的高度斷差`);
    }
    assert.ok(Math.abs(cityStairHeightAt(stair, 1) - endFloor) < 1e-9);
  }

  const deskRect = DESK_FOOTPRINT[0];
  const deskCenter = { x: DESK.cx, z: (deskRect.minZ + deskRect.maxZ) / 2 };
  const lowerCollision = resolveCollision(deskCenter.x, deskCenter.z);
  // The specified 2 m S-frame member reaches z=0; sample just inside the open atrium for this desk-only projection check.
  const upperWalkPoint = { x: 0, z: 0.5 };
  const upperClearance = resolveCollision(upperWalkPoint.x, upperWalkPoint.z, PLAYER_RADIUS, false, false, undefined, undefined, 4);
  assert.notDeepEqual(lowerCollision, deskCenter, "地面仍要撞到桌體");
  assert.deepEqual(upperClearance, upperWalkPoint, "上層角色不應被地面桌櫃的投影碰撞阻擋");
}

// ---- v8.4 clampToDesk 與 resolveAction 完整輸入表（5 命中 × 7 輸入）----
const actionKeys: InputKey[] = ["click", "shiftClick", "rightClick", "KeyE", "KeyQ", "KeyF", "Space"];
const actionHits: HitKind[] = ["book", "heldBook", "deskPaper", "chair", "none"];
const actionCardId = "v84-card";
const deskPoint = { x: 0, z: -1.9 };
const deskPointClamped = clampToDesk(deskPoint.x, deskPoint.z);
const baseActionCtx: RoomActionCtx = {
  mode: "room",
  flying: false,
  held: null,
  seated: false,
  bookOnDesk: false,
  hitDeskSurface: false,
  seatedCanStand: true,
  cardId: actionCardId,
  deskPoint,
  playerYawDeg: 37,
  chairInTrigger: false,
};
const roomActionCells: Array<{ hit: HitKind; key: InputKey; ctx: RoomActionCtx; expected: RoomAction }> = [];
for (const hit of actionHits) {
  for (const key of actionKeys) {
    const ctx: RoomActionCtx = {
      ...baseActionCtx,
      held: hit === "heldBook" ? actionCardId : null,
      hitDeskSurface: hit === "heldBook",
      chairInTrigger: hit === "chair",
    };
    let expected: RoomAction = { type: "noop" };
    if (hit === "book") {
      if (key === "click") expected = { type: "openCard", cardId: actionCardId, from: "shelf" };
      else if (key === "shiftClick" || key === "rightClick") expected = { type: "openPreview", cardId: actionCardId };
      else if (key === "KeyE") expected = { type: "pickUp", cardId: actionCardId };
    } else if (hit === "heldBook") {
      if (key === "click" || key === "KeyE") {
        expected = { type: "putOnDesk", ...deskPointClamped, yawDeg: 30 };
      } else if (key === "shiftClick" || key === "rightClick" || key === "KeyQ") {
        expected = { type: "returnToShelf" };
      }
    } else if (hit === "deskPaper" && key === "click") {
      expected = { type: "enterWorkView" };
    } else if (hit === "chair" && (key === "click" || key === "KeyF")) {
      expected = { type: "sit" };
    } else if (hit === "none" && key === "Space") {
      expected = { type: "jump" };
    }
    roomActionCells.push({ hit, key, ctx, expected });
  }
}
assert.equal(roomActionCells.length, 35, "the resolver test must cover every cell in the 5×7 action table");
for (const { hit, key, ctx, expected } of roomActionCells) {
  assert.deepEqual(resolveAction(hit, key, ctx), expected, `resolveAction(${hit}, ${key})`);
}
// The same shelf/desk row keeps its book-source distinction, and unsafe stand context never deadlocks.
assert.deepEqual(resolveAction("book", "click", { ...baseActionCtx, bookOnDesk: true }), {
  type: "openCard", cardId: actionCardId, from: "desk",
});
assert.deepEqual(resolveAction("heldBook", "click", { ...baseActionCtx, held: actionCardId }), { type: "noop" });
assert.deepEqual(resolveAction("none", "KeyF", { ...baseActionCtx, seated: true, seatedCanStand: false }), { type: "stand" });
assert.deepEqual(resolveAction("none", "Space", { ...baseActionCtx, seated: true }), { type: "noop" });
assert.deepEqual(resolveAction("book", "click", { ...baseActionCtx, mode: "work" }), { type: "noop" });
assert.deepEqual(resolveAction("book", "click", { ...baseActionCtx, flying: true }), { type: "noop" });
// 手持書：E 對準另一本書不得「換拿」；只有命中桌面才放下。Q 與準心無關。
assert.deepEqual(
  resolveAction("book", "KeyE", { ...baseActionCtx, held: actionCardId, hitDeskSurface: false }),
  { type: "noop" },
  "手持書時對準另一本書按 E 不可換拿"
);
assert.deepEqual(
  resolveAction("book", "KeyE", { ...baseActionCtx, held: actionCardId, hitDeskSurface: true }),
  { type: "putOnDesk", ...deskPointClamped, yawDeg: 30 },
  "手持書時對準桌面按 E 需放下"
);
assert.deepEqual(
  resolveAction("book", "KeyQ", { ...baseActionCtx, held: actionCardId }),
  { type: "returnToShelf" },
  "手持書時 Q 不受準心命中物件影響"
);
assert.deepEqual(
  resolveAction("none", "KeyQ", { ...baseActionCtx, held: actionCardId }),
  { type: "returnToShelf" },
  "手持書時 Q 在空白處也要回架"
);
assert.deepEqual(
  resolveAction("book", "KeyF", { ...baseActionCtx, held: actionCardId, seated: true }),
  { type: "stand" },
  "手持書且坐下時 F 仍需起立"
);

const outsideDesk = clampToDesk(100, -100);
assert.ok(Math.abs(outsideDesk.x / DESK_SNAP - Math.round(outsideDesk.x / DESK_SNAP)) < 1e-9);
assert.ok(Math.abs(outsideDesk.z / DESK_SNAP - Math.round(outsideDesk.z / DESK_SNAP)) < 1e-9);
assert.ok(DESK_FOOTPRINT.some((r) =>
  outsideDesk.x >= r.minX + 0.1 - 1e-9 && outsideDesk.x <= r.maxX - 0.1 + 1e-9 &&
  outsideDesk.z >= r.minZ + 0.1 - 1e-9 && outsideDesk.z <= r.maxZ - 0.1 + 1e-9
), "clampToDesk must keep the book center inside the L-shaped tabletop");
console.log("  ✓ resolveAction 35/35 cells, modifier/source variants, work/flight guards, and desk snapping");

// ---- v8.5 視角方向回歸：往左拖曳＝視線往左（不得再反轉）----
{
  const sensitivity = CAMERA.lookSensitivity;
  const startYaw = 0; // 望向 −Z（北）
  const right = forwardFromYawPitch(yawFromLookDelta(startYaw, 120, sensitivity), 0);
  const left = forwardFromYawPitch(yawFromLookDelta(startYaw, -120, sensitivity), 0);
  assert.ok(right.x > 0.4, "往右拖曳時 forward.x 必須為正（視線轉向東／畫面右方）");
  assert.ok(left.x < -0.4, "往左拖曳時 forward.x 必須為負（視線轉向西／畫面左方）");
  // 畫面右方向 = forward × up，符號與「右拖＝右轉」一致
  const screenRight = new THREE.Vector3().crossVectors(forwardFromYawPitch(startYaw, 0), new THREE.Vector3(0, 1, 0));
  assert.ok(screenRight.x > 0.9, "yaw=0 時畫面右方必須是 +X");
  assert.ok(screenRight.dot(right) > 0.4, "右拖後視線需落在原本的畫面右半邊");
  // Pointer Lock 使用同一組符號（e.movementX 與拖曳 dx 同方向）
  const locked = yawFromLookDelta(startYaw, 40, CAMERA.lockSensitivity);
  const dragged = yawFromLookDelta(startYaw, 40, CAMERA.lookSensitivity);
  assert.equal(Math.sign(locked), Math.sign(dragged));
  // 往下拖／往下移＝視線往下（pitch 變小）
  assert.ok(pitchFromLookDelta(0, 80, sensitivity) < 0);
  assert.ok(pitchFromLookDelta(0, -80, sensitivity) > 0);
  // 180° 轉身後左右仍然一致（不能只在 yaw=0 成立）
  const turned = Math.PI;
  // 面向南（+Z）時，畫面左方 = 東（+X）；往左拖曳必須轉向 +X。
  const turnedLeft = forwardFromYawPitch(yawFromLookDelta(turned, -120, sensitivity), 0);
  assert.ok(turnedLeft.x > 0, "轉身 180° 後往左拖曳，視線必須轉向面南時的左側（+X）");
}
console.log("  ✓ 視角方向回歸：拖曳與 Pointer Lock 左拖＝左轉、右拖＝右轉");

// ---- v8.5 第三人稱相機：站在角色後方、遇牆縮短、不進家具 ----
{
  const pose = { x: 0, z: 0, eyeY: 1.5, jumpOffset: 0 };
  const behind = resolveThirdPersonCamera(pose, 0, 0);
  assert.ok(behind.z > 0.8, "面向北時第三人稱相機需退到南側（+Z）");
  // over-the-shoulder：面向北時右肩在 +X，角色因此落在畫面左側而不擋住準心。
  assert.ok(behind.x > 0.2 && behind.x < 0.6, "第三人稱相機需有右肩偏移");
  assert.ok(behind.y > 1.8, "第三人稱相機需高於角色頭頂（不可貼在後腦）");
  assert.ok(behind.y < ROOM.height, "第三人稱相機不可穿出天花板");
  const nearWall = resolveThirdPersonCamera({ x: 0, z: 2.2, eyeY: 1.5, jumpOffset: 0 }, 0, 0);
  const dist = Math.hypot(nearWall.x, nearWall.z - 2.2);
  assert.ok(dist <= Math.hypot(THIRD_PERSON.distance, THIRD_PERSON.shoulder) + 1e-9);
  assert.ok(!COLLIDERS.some((collider) =>
    nearWall.y > (collider.bottom ?? 0) - 0.1 && nearWall.y < collider.top + 0.12 &&
    colliderOverlapsCircle(collider, nearWall.x, nearWall.z, 0.18)
  ), "第三人稱相機不得落入同高度的家具／結構碰撞體");
  assert.ok(isCityPointInsideTrapezoid({ x: nearWall.x, z: nearWall.z }, THIRD_PERSON.wallMargin),
    "第三人稱相機須保留與梯形外牆的最小淨距，不可沿用方形 Z 邊界");
  // 面西時相機在東側；面南時相機在北側（符號不可反）
  const faceWest = resolveThirdPersonCamera(pose, Math.PI / 2, 0);
  assert.ok(faceWest.x < -0.5, "面西時相機退到東側前需先確認方向：right = forward × up");
  const faceSouth = resolveThirdPersonCamera(pose, Math.PI, 0);
  assert.ok(faceSouth.z < -0.5, "面南時相機需退到北側（−Z）");
  // 牆角回歸：玩家貼在東南角時，相機不得被拉進角色頭部（實際預覽曾整個人物消失）。
  const cornerPosition = clampRoomPosition(100, 100);
  const cornerPose = { ...cornerPosition, eyeY: 1.55, jumpOffset: 0 };
  const corner = resolveThirdPersonCamera(cornerPose, -Math.PI / 4, -0.1);
  const cornerDist = Math.hypot(corner.x - cornerPose.x, corner.y - cornerPose.eyeY, corner.z - cornerPose.z);
  assert.ok(cornerDist > 1.0, "牆角第三人稱仍需保持可視距離，不可貼在角色身上");
  assert.ok(Math.hypot(corner.x - cornerPose.x, corner.z - cornerPose.z) > 0.25, "牆角相機至少要離開頭部水平 0.25 m");
  assert.ok(corner.y > 2.0, "牆角需抬高相機越過角色頭頂");
  assert.ok(isCityPointInsideTrapezoid({ x: corner.x, z: corner.z }, THIRD_PERSON.wallMargin),
    "牆角相機必須完整留在梯形房間內，並保留外牆淨距");
  assert.ok(!COLLIDERS.some((collider) =>
    corner.y > (collider.bottom ?? 0) - 0.1 && corner.y < collider.top + 0.12 &&
    colliderOverlapsCircle(collider, corner.x, corner.z, 0.18)
  ), "牆角相機不得落入同高度的家具／結構碰撞體");
  // 初始機位必須留給第三人稱足夠後退空間（否則一按 V 就貼臉）。
  const start = resolveThirdPersonCamera(
    { x: DEFAULT_CAMERA.x!, z: DEFAULT_CAMERA.z!, eyeY: DEFAULT_CAMERA.height!, jumpOffset: 0 },
    THREE.MathUtils.degToRad(DEFAULT_CAMERA.yaw),
    THREE.MathUtils.degToRad(DEFAULT_CAMERA.pitch)
  );
  const startDist = Math.hypot(start.x - DEFAULT_CAMERA.x!, start.z - DEFAULT_CAMERA.z!);
  assert.ok(startDist > 1.2, "初始相機位置需讓第三人稱退到 1.2 m 以上");
}
console.log("  ✓ 第三人稱相機：後方跟隨、牆面縮短、避開家具、牆角不貼臉");

// ---- 第一人稱 view model：站直時不得佔住畫面，低頭才出現 ----
{
  const level = firstPersonViewVisibility(0, false);
  assert.equal(level.arms, false, "站直時不顯示前臂");
  assert.equal(level.chest, false, "站直時不顯示胸口");
  const down = firstPersonViewVisibility(-0.35, false);
  assert.equal(down.arms, true, "低頭時需看見手臂");
  assert.equal(down.chest, false, "小幅低頭只露出手臂");
  const deep = firstPersonViewVisibility(-0.75, false);
  assert.equal(deep.chest, true, "低頭夠深時需看見軀幹");
  assert.equal(firstPersonViewVisibility(0, true).arms, true, "手持書時需有手掌");
  // 幾何上：水平視線時，胸口與手臂頂端都在垂直視錐之外。
  // view model 掛在相機空間：pitch 不會移動它，因此「站直時看不到」只能靠 pitch 閘門；
  // 幾何本身必須落在視錐內，否則低頭時會被裁掉（v8.6 前的實際 bug）。
  const halfH = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2)) * Math.abs(VIEW_MODEL.chest.z);
  assert.ok(VIEW_MODEL.chest.y + VIEW_MODEL.chest.height / 2 > -halfH, "胸口頂端必須在視錐內（低頭才看得見身體）");
  assert.ok(VIEW_MODEL.chest.y - VIEW_MODEL.chest.height / 2 < -halfH, "胸口下緣要超出畫面，避免變成漂浮方塊");
  const armHalfH = Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2)) * Math.abs(VIEW_MODEL.arm.z);
  assert.ok(VIEW_MODEL.arm.y + VIEW_MODEL.arm.width / 2 > -armHalfH, "手臂必須在視錐內（低頭才看得見手）");
  assert.equal(firstPersonViewVisibility(0).arms, false, "站直（pitch 0）不得露出前臂");
  assert.equal(firstPersonViewVisibility(0).chest, false, "站直（pitch 0）不得露出胸口");
  assert.equal(firstPersonViewVisibility(-0.6).arms, true, "低頭必須露出前臂");
  assert.equal(firstPersonViewVisibility(-0.6).chest, true, "低頭必須露出胸口");
}
console.log("  ✓ 第一人稱 view model：站直不遮畫面，低頭才看見手臂／軀幹");

// ---- v8.5 跳躍閘門與角色動作 ----
{
  const base = { mode: "room" as const, flying: false, uiOpen: false, seated: false, onGround: true, typing: false };
  assert.equal(canJump(base), true);
  assert.equal(canJump({ ...base, seated: true }), false);
  assert.equal(canJump({ ...base, typing: true }), false);
  assert.equal(canJump({ ...base, mode: "work" }), false);
  assert.equal(canJump({ ...base, flying: true }), false);
  assert.equal(canJump({ ...base, uiOpen: true }), false);
  assert.equal(canJump({ ...base, onGround: false }), false);
  assert.ok(CHARACTER.eyeHeight > 1.4 && CHARACTER.eyeHeight < 1.75, "角色眼高需接近真人");
  const idle = characterAnim({ phase: 0, moving: false });
  const walkA = characterAnim({ phase: Math.PI / 2, moving: true });
  const walkB = characterAnim({ phase: (3 * Math.PI) / 2, moving: true });
  const jumpAnim = characterAnim({ phase: 0, moving: false, airborne: true });
  const sitAnim = characterAnim({ phase: 0, moving: false, seated: true });
  assert.ok(Math.abs(idle.leftLeg) < 0.1 && Math.abs(idle.rightLeg) < 0.1, "待機時雙腿接近直立");
  assert.ok(walkA.leftLeg > 0.3 && walkA.rightLeg < -0.3, "行走時雙腿反相擺動");
  assert.ok(walkB.leftLeg < -0.3 && walkB.rightLeg > 0.3, "行走半步後擺動方向反轉");
  assert.ok(jumpAnim.bodyDrop === 0 && jumpAnim.leftLeg !== idle.leftLeg, "跳躍有獨立姿勢");
  assert.ok(sitAnim.bodyDrop < 0, "坐下時身體下降");
  assert.notDeepEqual(idle, sitAnim);
  const holdAnim = characterAnim({ phase: 0, moving: false, holding: true });
  assert.ok(holdAnim.rightArm > 0.9 && holdAnim.leftArm > 0.7, "手持書時雙臂需向前抬到胸前");
  assert.ok(jumpAnim.leftArmZ < -1.8 && jumpAnim.rightArmZ > 1.8, "跳躍時雙臂向外展開");
  const runAnim = characterAnim({ phase: Math.PI / 2, moving: true, sprinting: true });
  const easedWalk = characterAnim({ phase: Math.PI / 2, moving: true, moveWeight: 0.35 });
  assert.ok(runAnim.leftLeg > walkA.leftLeg && runAnim.torsoLean > walkA.torsoLean, "衝刺步幅與前傾需高於行走");
  assert.ok(easedWalk.leftLeg < walkA.leftLeg && easedWalk.leftLeg > 0, "起步／停步權重需讓步態平滑漸變");
  // 第一人稱手持書錨點：直式在畫面中央偏左、橫式在右下，且都在相機前方。
  const portraitAnchor = firstPersonHeldAnchor(390 / 844, 58);
  const landscapeAnchor = firstPersonHeldAnchor(1440 / 900, 62);
  assert.ok(portraitAnchor.z < 0 && landscapeAnchor.z < 0);
  assert.ok(portraitAnchor.x < 0, "直式手持書需偏左，避開右側操作按鈕");
  assert.ok(landscapeAnchor.x > 0.1, "橫式手持書需偏右，不遮住準心");
  assert.ok(Math.abs(portraitAnchor.y) < 0.3 && Math.abs(landscapeAnchor.y) < 0.3);
  // 直式手機加寬視野，橫式維持 62°；手持書錨點要跟著 fov 走。
  assert.equal(roomFovFor(1440 / 900), 60);
  assert.ok(roomFovFor(390 / 844) > 74, "直式手機房間視野需加寬到 74° 以上");
  const wideAnchor = firstPersonHeldAnchor(390 / 844, roomFovFor(390 / 844));
  assert.ok(wideAnchor.x < 0 && wideAnchor.z < 0);
  // 第三人稱手持書：右手在角色右側、胸前高度、身體前方。
  const hand = thirdPersonHandOffset(1.62);
  assert.ok(hand.x > 0.2, "右手需在角色右側");
  assert.ok(hand.y > 0.9 && hand.y < 1.3, "右手需落在胸前高度");
  assert.ok(hand.z < -0.3, "右手需在角色前方（-Z）");
}
console.log("  ✓ 跳躍閘門（工作／輸入／坐下／離地）與角色待機／行走／跳躍／坐下動作");

console.log("ALL ROOM CHECKS PASS (trapezoid footprint / connected corridors / T1-T2 projections / nested W-S-C frames / 4 levels / central void / legacy platform connectivity / stairs and collisions / 360° camera / flight easing / sunlight / projection / SSR quality / textures / shelf and furniture / remote-player AABB / character detail, gait, sprint, jump, sit)");
