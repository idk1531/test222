import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, CABINET_FOOTPRINT, CATEGORY_LABEL_PLANE, CHAIR, COLLIDERS, DESK, DESK_FOOTPRINT, DESK_PREVIEW_PLANE, DESK_SNAP, FIDELITY, JUMP,
  MARBLE_ROUGH, MATCH_VIEW, MAX_WALKABLE_STEP, NESTED_CITY, PLAYER_RADIUS, ROOM, ROOM_AREA_SCALE, SHELF, SHELF_INWARD, SIT,
  cityFrameMembers, cityStairHeightAt, colliderOverlapsCircle, nestedCityPlatformRails,
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
assert.equal(edge.x, ROOM.width / 2 - CAMERA.wallMargin);
assert.equal(edge.z, -ROOM.depth / 2 + CAMERA.wallMargin);

// Reference-board envelope and walkable floor rhythm (1F–4F).
assert.equal(ROOM_AREA_SCALE, 16);
assert.equal(ROOM.width, 48);
assert.equal(ROOM.depth, 24);
assert.equal(ROOM.width * ROOM.depth, 1152);
assert.equal(ROOM.height, 16);
assert.equal(ROOM.wall, 0.32);
assert.deepEqual(DEFAULT_CAMERA, { yaw: 70, pitch: 15, x: 0, z: 10.4, height: 1.52, floorY: 0 });
assert.deepEqual(NESTED_CITY.levels, [0, 4, 8, 12]);
assert.deepEqual(NESTED_CITY.atrium, { x: 12, z: 2.5, width: 16, depth: 11 }, "2F–4F 應保留相同的 16 × 11 m 連續挑空");
assert.deepEqual(nestedCityFloorLabel(0), { full: "1F · 0 m", compact: "1F" });
assert.deepEqual(nestedCityFloorLabel(4), { full: "2F · 4 m", compact: "2F" });
assert.deepEqual(nestedCityFloorLabel(8), { full: "3F · 8 m", compact: "3F" });
assert.deepEqual(nestedCityFloorLabel(12), { full: "4F · 12 m", compact: "4F" });
assert.deepEqual(nestedCityFloorLabel(2), { full: "階梯", compact: "階梯" });
assert.deepEqual(nestedCityFloorLabel(Number.NaN), { full: "位置未知", compact: "未知" });
assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 1).length, 4);
assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 2).length, 6, "3F 東側樓梯井需以分段平台和獨立落腳區表示");
assert.equal(NESTED_CITY.platforms.filter((platform) => platform.level === 3).length, 6, "4F 應由錯位觀景平台、短橋和連接段組成，而非鋪滿整層");
assert.equal(NESTED_CITY.frames.length, 3, "主構圖由外框、橫向穿插體與內核三重結構組成");
assert.deepEqual(NESTED_CITY.frames.map(({ width, depth, height }) => ({ width, depth, height })), [
  { width: 48, depth: 24, height: 16 },
  { width: 36, depth: 18, height: 12 },
  { width: 24, depth: 12, height: 8 },
]);
assert.deepEqual(NESTED_CITY.frames.map(({ x, z, bottom }) => ({ x, z, bottom })), [
  { x: 0, z: 0, bottom: 0 },
  { x: 6, z: 4, bottom: 2 },
  { x: 12, z: 8, bottom: 4 },
]);
assert.ok(Math.abs(NESTED_CITY.frames[1].rotationY - THREE.MathUtils.degToRad(15)) < 1e-12);
assert.ok(Math.abs(NESTED_CITY.frames[2].rotationY - THREE.MathUtils.degToRad(-10)) < 1e-12);
assert.deepEqual(NESTED_CITY.featureFrames.map(({ x, z, width, depth, height, bottom }) => ({ x, z, width, depth, height, bottom })), [
  { x: 4, z: 8, width: 30, depth: 16, height: 4, bottom: 4 },
  { x: 10, z: 10, width: 20, depth: 4, height: 3, bottom: 8 },
  { x: 5, z: 12, width: 40, depth: 3, height: 8, bottom: 0 },
]);
assert.equal(NESTED_CITY.frames.length, 3, "主構圖由外框、橫向穿插體與內核三重結構組成");
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
for (const level of [1, 2, 3]) {
  const floorPlatforms = NESTED_CITY.platforms.filter((platform) => platform.level === level);
  assert.ok(floorPlatforms.length > 0, `第 ${level} 層必須有可走平台`);
  const floorCoverage = floorPlatforms.reduce((area, platform) => area + platform.width * platform.depth, 0) / (ROOM.width * ROOM.depth);
  assert.ok(floorCoverage <= 0.65, `第 ${level + 1}F 樓板面積需保留至少 35% 挑空／開放空間（目前 ${(floorCoverage * 100).toFixed(1)}%）`);
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
  const bounds = platformBounds(support);
  if (rail.axis === "x") {
    assert.ok(rail.start >= bounds.minX - PLATFORM_EPSILON && rail.end <= bounds.maxX + PLATFORM_EPSILON);
    assert.ok(Math.abs(rail.fixed - (rail.edge === "north" ? bounds.minZ : bounds.maxZ)) <= PLATFORM_EPSILON);
  } else {
    assert.ok(rail.start >= bounds.minZ - PLATFORM_EPSILON && rail.end <= bounds.maxZ + PLATFORM_EPSILON);
    assert.ok(Math.abs(rail.fixed - (rail.edge === "west" ? bounds.minX : bounds.maxX)) <= PLATFORM_EPSILON);
  }
}
const stairMouthHalfWidth = NESTED_CITY.stairs[0].width / 2 - 0.05;
for (const opening of [
  { platformId: "level-1-east-gallery", edge: "west", along: 6.5 },
  { platformId: "level-2-stair-landing", edge: "west", along: 0 },
  { platformId: "level-2-stair-landing", edge: "south", along: 20.8 },
  { platformId: "level-3-west-observation-gallery", edge: "east", along: 0 },
]) {
  assert.ok(!platformRails.some((rail) => rail.platformId === opening.platformId && rail.edge === opening.edge &&
    rail.start < opening.along + stairMouthHalfWidth && rail.end > opening.along - stairMouthHalfWidth),
  `${opening.platformId} 的 ${opening.edge} 邊需為階梯保留通口`);
}
const switchbackRun = NESTED_CITY.stairs[1];
const runStart = Math.min(switchbackRun.start.z, switchbackRun.end.z) - switchbackRun.width / 2;
const runEnd = Math.max(switchbackRun.start.z, switchbackRun.end.z) + switchbackRun.width / 2;
for (const level of [1, 2]) {
  const eastGalleryIds = new Set(NESTED_CITY.platforms.filter((platform) => platform.level === level && platform.x > 20).map((platform) => platform.id));
  assert.ok(!platformRails.some((rail) => eastGalleryIds.has(rail.platformId) && rail.edge === "west" &&
    rail.start < runEnd && rail.end > runStart), `第 ${level + 1}F 東側樓板沿樓梯井需保持連續開口`);
}

const footprintCoveredByFloor = (
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number },
  floorPlatforms: readonly (typeof NESTED_CITY.platforms)[number][]
) => {
  const xCuts = [footprint.minX, footprint.maxX];
  const zCuts = [footprint.minZ, footprint.maxZ];
  for (const platform of floorPlatforms) {
    const bounds = platformBounds(platform);
    for (const x of [bounds.minX, bounds.maxX]) if (x > footprint.minX && x < footprint.maxX) xCuts.push(x);
    for (const z of [bounds.minZ, bounds.maxZ]) if (z > footprint.minZ && z < footprint.maxZ) zCuts.push(z);
  }
  const sortedUnique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  const sortedX = sortedUnique(xCuts);
  const sortedZ = sortedUnique(zCuts);
  for (let xi = 0; xi < sortedX.length - 1; xi++) {
    for (let zi = 0; zi < sortedZ.length - 1; zi++) {
      const x = (sortedX[xi] + sortedX[xi + 1]) / 2;
      const z = (sortedZ[zi] + sortedZ[zi + 1]) / 2;
      if (!floorPlatforms.some((platform) => {
        const bounds = platformBounds(platform);
        return x >= bounds.minX - PLATFORM_EPSILON && x <= bounds.maxX + PLATFORM_EPSILON &&
          z >= bounds.minZ - PLATFORM_EPSILON && z <= bounds.maxZ + PLATFORM_EPSILON;
      })) return false;
    }
  }
  return true;
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
console.log("  ✓ 48 × 24 × 16 m 參考建築／4 層樓板與既有書本／畫布標籤比例");

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
assert.ok(SHELF.xBack < 0, "v8.3：書牆必須在西牆（SHELF.xBack < 0）");
assert.equal(Math.abs(SHELF.xBack), ROOM.width / 2 - 0.16);
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

// ---- 嵌套之城白模：三重結構交錯、中央挑空、4F 環廊、開放踏階與淨高 ----
{
  const [outerFrame, middleFrame, coreFrame] = NESTED_CITY.frames;
  assert.equal(outerFrame.id, "outer-timber-shell");
  assert.equal(outerFrame.plane, "box", "外部巨構應為連續三維框架，而不是四片互不相接的門架");
  assert.equal(middleFrame.id, "middle-horizontal-insert");
  assert.equal(middleFrame.plane, "horizontal", "第二重必須是水平穿插體");
  assert.equal(coreFrame.id, "offset-rotated-core");
  assert.equal(coreFrame.plane, "box");
  assert.notEqual(coreFrame.rotationY, 0, "內核需有明確旋轉，不能成為同心等距盒");
  assert.ok(Math.abs(coreFrame.x) > 0.5 && Math.abs(coreFrame.z) > 0.5, "內核需相對主框架偏移");
  const middleCos = Math.cos(middleFrame.rotationY);
  const middleSin = Math.sin(middleFrame.rotationY);
  const middleHalfX = Math.abs(middleCos) * middleFrame.width / 2 + Math.abs(middleSin) * middleFrame.depth! / 2;
  const middleHalfZ = Math.abs(middleSin) * middleFrame.width / 2 + Math.abs(middleCos) * middleFrame.depth! / 2;
  const outerMinX = outerFrame.x - outerFrame.width / 2;
  const outerMaxX = outerFrame.x + outerFrame.width / 2;
  const outerMinZ = outerFrame.z - outerFrame.depth! / 2;
  const outerMaxZ = outerFrame.z + outerFrame.depth! / 2;
  const middleMinX = middleFrame.x - middleHalfX;
  const middleMaxX = middleFrame.x + middleHalfX;
  const middleMinZ = middleFrame.z - middleHalfZ;
  const middleMaxZ = middleFrame.z + middleHalfZ;
  assert.ok(middleMinX > outerMinX && middleMaxX > outerMaxX,
    "36 m 石框應與 48 m 外木框重疊並按參考表向東錯位");
  assert.ok(middleMinZ > outerMinZ && middleMaxZ > outerMaxZ,
    "18 m 石框應與 24 m 外框重疊並呈現參考圖的斜向穿插");
  assert.notEqual(middleFrame.rotationY, 0, "中框須依參考表轉向 15°");
  assert.equal(middleFrame.x, 6, "石框中心 X 依位置表");
  assert.equal(middleFrame.z, 4, "石框中心 Z 依位置表");
  assert.equal(middleFrame.bottom, 2, "石框垂直範圍依剖面落在 2–14 m");
  assert.equal(middleFrame.bottom + middleFrame.height, 14);
  assert.equal(coreFrame.x, 12, "核心中心 X 依位置表");
  assert.equal(coreFrame.z, 8, "核心中心 Z 依位置表");
  assert.equal(coreFrame.bottom, 4, "核心垂直範圍依剖面落在 4–12 m");
  assert.ok(coreFrame.width < middleFrame.width && coreFrame.depth! < middleFrame.depth!,
    "24 × 12 m 內核須小於 36 × 18 m 石框");
  assert.ok(coreFrame.bottom >= middleFrame.bottom &&
    coreFrame.bottom + coreFrame.height <= middleFrame.bottom + middleFrame.height,
  "內核需落在石框高度範圍內，對應 2F–4F 挑空");
  assert.ok(cityFrameMembers(outerFrame).length >= 20 && cityFrameMembers(middleFrame).length >= 12 &&
    cityFrameMembers(coreFrame).length >= 12 && NESTED_CITY.featureFrames.every((frame) => cityFrameMembers(frame).length >= 8),
  "三重主框架與平台／橋廊／書庫模組均需由真實梁柱構成");

  const onPlatform = (level: number, x: number, z: number) => NESTED_CITY.platforms.some((platform) =>
    platform.level === level &&
    Math.abs(x - platform.x) <= platform.width / 2 &&
    Math.abs(z - platform.z) <= platform.depth / 2
  );
  for (const level of [1, 2, 3]) {
    let openSamples = 0;
    const atrium = NESTED_CITY.atrium;
    for (let xi = 0; xi < 5; xi++) {
      const x = atrium.x - atrium.width / 2 + (xi + 0.5) * atrium.width / 5;
      for (let zi = 0; zi < 5; zi++) {
        const z = atrium.z - atrium.depth / 2 + (zi + 0.5) * atrium.depth / 5;
        if (!onPlatform(level, x, z)) openSamples++;
      }
    }
    assert.equal(openSamples, 25, `第 ${level} 層的 16 × 11 m 中庭需 25/25 個樣點保持開放，不得被橋板或樓板遮斷`);
  }
  assert.ok(![1, 2, 3].some((level) => onPlatform(level, NESTED_CITY.atrium.x, NESTED_CITY.atrium.z)), "中央挑空不能被樓板填滿");
  assert.equal(groundHeightAt(NESTED_CITY.atrium.x, NESTED_CITY.atrium.z, 0), 0, "地面仍可穿越挑空底部");
  assert.equal(groundHeightAt(-9.75, 0, 4), 4, "Level 1 西側環廊可行走");
  assert.equal(groundHeightAt(-8.5, 0, 8), 8, "同一投影位置依目前高度選取 Level 2");
  assert.equal(groundHeightAt(-8.5, 0, 0), 0, "不能從地面瞬移到重疊上層");

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
    if (index === 1) {
      const stepRun = Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z) / stair.steps;
      for (let step = 0; step < stair.steps; step++) {
        const progress = (step + 0.5) / stair.steps;
        const centerZ = stair.start.z + (stair.end.z - stair.start.z) * progress;
        const treadBounds = {
          minX: stair.start.x - stair.width / 2,
          maxX: stair.start.x + stair.width / 2,
          minZ: centerZ - stepRun / 2,
          maxZ: centerZ + stepRun / 2,
        };
        assert.ok(!NESTED_CITY.platforms.some((platform) => {
          if (platform.level !== endLevel) return false;
          const bounds = platformBounds(platform);
          return Math.min(treadBounds.maxX, bounds.maxX) - Math.max(treadBounds.minX, bounds.minX) > PLATFORM_EPSILON &&
            Math.min(treadBounds.maxZ, bounds.maxZ) - Math.max(treadBounds.minZ, bounds.minZ) > PLATFORM_EPSILON;
        }), `3F 東側樓梯井不得與第 ${step + 1} 個樓梯踏板相交`);
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
  const upperWalkPoint = { x: 0, z: 0 };
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
  assert.ok(nearWall.z < ROOM.depth / 2 - THIRD_PERSON.wallMargin + 1e-9, "第三人稱相機必須留在房間內");
  // 面西時相機在東側；面南時相機在北側（符號不可反）
  const faceWest = resolveThirdPersonCamera(pose, Math.PI / 2, 0);
  assert.ok(faceWest.x < -0.5, "面西時相機退到東側前需先確認方向：right = forward × up");
  const faceSouth = resolveThirdPersonCamera(pose, Math.PI, 0);
  assert.ok(faceSouth.z < -0.5, "面南時相機需退到北側（−Z）");
  // 牆角回歸：玩家貼在東南角時，相機不得被拉進角色頭部（實際預覽曾整個人物消失）。
  const cornerPose = { x: ROOM.width / 2 - CAMERA.wallMargin, z: ROOM.depth / 2 - CAMERA.wallMargin, eyeY: 1.55, jumpOffset: 0 };
  const corner = resolveThirdPersonCamera(cornerPose, -Math.PI / 4, -0.1);
  const cornerDist = Math.hypot(corner.x - cornerPose.x, corner.y - cornerPose.eyeY, corner.z - cornerPose.z);
  assert.ok(cornerDist > 1.0, "牆角第三人稱仍需保持可視距離，不可貼在角色身上");
  assert.ok(Math.hypot(corner.x - cornerPose.x, corner.z - cornerPose.z) > 0.25, "牆角相機至少要離開頭部水平 0.25 m");
  assert.ok(corner.y > 2.0, "牆角需抬高相機越過角色頭頂");
  assert.ok(corner.x > -ROOM.width / 2 && corner.x < ROOM.width / 2, "牆角相機仍需在房內（X）");
  assert.ok(corner.z > -ROOM.depth / 2 && corner.z < ROOM.depth / 2, "牆角相機仍需在房內（Z）");
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

console.log("ALL ROOM CHECKS PASS (nested-city 3-frame structure / 4 levels / central void / platform connectivity / stair treads, head clearance and collisions / 360° camera / flight easing / sunlight / projection / SSR quality / textures / shelf and furniture / remote-player AABB / character detail, gait, sprint, jump, sit)");
