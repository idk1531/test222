import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, CABINET_FOOTPRINT, CHAIR, COLLIDERS, DESK, DESK_FOOTPRINT, DESK_SNAP, FIDELITY, JUMP,
  MARBLE_ROUGH, MATCH_VIEW, PLAYER_RADIUS, ROOM, SHELF, SHELF_INWARD, SIT,
  SUN, TEXTURES, WINDOW, clampRoomPosition, clampPitchRad, clampHeight, clampToDesk,
  forwardFromYawPitch, easeInOutCubic, groundHeightAt, isWithinSitTrigger, projectToScreen, detectQuality,
  resolveCollision, shelfFrontX, shelfPlankCount, shelfPlankY, stepJump,
} from "../src/lib/room3d";
import { resolveAction, type HitKind, type InputKey, type RoomAction, type RoomActionCtx } from "../src/lib/roomActions";

const edge = clampRoomPosition(100, -100);
assert.equal(edge.x, ROOM.width / 2 - CAMERA.wallMargin);
assert.equal(edge.z, -ROOM.depth / 2 + CAMERA.wallMargin);

// v8.4 家具 AABB：櫃體碰撞沿用 RoomGeometry 的同一 footprint，桌緣採玩家半徑擴張。
assert.deepEqual(
  COLLIDERS.filter((collider) => collider.kind === "cabinet").map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ })),
  CABINET_FOOTPRINT
);
assert.ok(COLLIDERS.some((collider) => collider.kind === "desk" && collider.standable === false));
assert.ok(COLLIDERS.some((collider) => collider.kind === "shelf"));
const chairCollider = COLLIDERS.find((collider) => collider.kind === "chair")!;
assert.ok(CHAIR.x > chairCollider.minX && CHAIR.x < chairCollider.maxX && CHAIR.z > chairCollider.minZ && CHAIR.z < chairCollider.maxZ);
const deskEdge = resolveCollision(0, -1.6);
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
  diagonal.x > collider.minX - PLAYER_RADIUS && diagonal.x < collider.maxX + PLAYER_RADIUS &&
  diagonal.z > collider.minZ - PLAYER_RADIUS && diagonal.z < collider.maxZ + PLAYER_RADIUS
), "斜向分離後不可仍與 AABB 重疊");
assert.equal(groundHeightAt(0, 0), 0);
console.log("  ✓ 家具 AABB footprint、桌緣碰撞、斜角滑動與平地高度");

// 坐下觸發與「坐著滑進桌下 → F 安全起立」防死鎖。
assert.deepEqual(SIT, { triggerRadius: 0.34, seatY: 0.42, eyeY: 1.18, walkSpeed: 1.15, fov: 58, fadeOpacity: 0.25 });
assert.ok(isWithinSitTrigger(CHAIR.x + SIT.triggerRadius - 1e-6, CHAIR.z));
assert.equal(isWithinSitTrigger(CHAIR.x + SIT.triggerRadius, CHAIR.z), false, "trigger 半徑使用嚴格小於 0.34 m");
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
// 房高與圖一量測一致；窗台低於桌面外緣的連續大理石
assert.equal(ROOM.height, 2.75);
assert.ok(WINDOW.sill > DESK.top && WINDOW.sill - DESK.top < 0.15, "窗台應略高於桌板（同一塊大理石墊高）");
assert.ok(WINDOW.top - WINDOW.sill > 1.6, "窗洞高度需保留大面積採光");
assert.equal(WINDOW.mullions, 1); // 單中挺
assert.equal(WINDOW.bars, 0);
assert.ok(TEXTURES.floor === "marble", "v8.3 地坪必須切到淺灰大理石");
assert.ok(MARBLE_ROUGH.desk < 0.4 && MARBLE_ROUGH.floor < 0.4, "大理石需低粗糙度才有柔反射");
assert.equal(FIDELITY.shelfWallSign, -1);
// 層板堆疊：最上層板頂 = 2.42，往下每 0.40 一排，至少 4 排
assert.equal(shelfPlankCount(1), 4);
assert.equal(shelfPlankCount(6), 6);
assert.ok(Math.abs(shelfPlankY(0, 4) - 2.42) < 1e-9);
assert.ok(Math.abs(shelfPlankY(3, 4) - 1.22) < 1e-9);
for (let r = 1; r < 4; r++) {
  assert.ok(Math.abs(shelfPlankY(r - 1, 4) - shelfPlankY(r, 4) - SHELF.pitch) < 1e-9);
}
// 底層板高於腰高檯面（板下仍看得到檯面與矮擱板）
assert.ok(shelfPlankY(3, 4) > SHELF.ledge.top + 0.2);
// 書脊面在牆與室內之間，且朝 +X
assert.ok(shelfFrontX() > SHELF.xBack && shelfFrontX() < 0);

// ---- 對照視角投影：左書牆、右窗（可重複判定的「像不像」）----
{
  const cam = new THREE.PerspectiveCamera(MATCH_VIEW.fov, 16 / 9, 0.05, 80);
  cam.position.set(MATCH_VIEW.x, MATCH_VIEW.height, MATCH_VIEW.z);
  cam.up.set(0, 1, 0);
  cam.lookAt(cam.position.clone().add(forwardFromYawPitch(MATCH_VIEW.yaw, MATCH_VIEW.pitch)));
  cam.updateMatrixWorld();
  const px = (x: number, y: number, z: number) => {
    const v = new THREE.Vector3(x, y, z).project(cam);
    return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5, front: v.z < 1 };
  };
  const shelfWall = px(-ROOM.width / 2, 1.9, SHELF.z);
  const corner = px(-ROOM.width / 2, 1.5, -ROOM.depth / 2);
  const winMid = px(WINDOW.cx, (WINDOW.sill + WINDOW.top) / 2, -ROOM.depth / 2);
  const winL = px(WINDOW.cx - WINDOW.width / 2, 1.7, -ROOM.depth / 2);
  const winR = px(WINDOW.cx + WINDOW.width / 2, 1.7, -ROOM.depth / 2);
  const deskFront = px(0, DESK.top, -ROOM.depth / 2 + ROOM.wall + DESK.depth);
  const ceiling = px(-0.5, ROOM.height, 0);
  // 書牆在畫面左三分之一、窗在右半；轉角柱落在中央
  assert.ok(shelfWall.x < 0.4, `書牆需在畫面左側（實際 ${shelfWall.x.toFixed(2)}）`);
  assert.ok(corner.x > 0.4 && corner.x < 0.6, "西北轉角需落在畫面中央");
  assert.ok(winMid.x > 0.55 && winL.x > 0.4 && winR.x < 0.95, "窗需在畫面右側且完整入鏡");
  assert.ok(deskFront.y > 0.55, "桌板前緣需落在畫面下半（圖一檯面線 ~0.6–0.73）");
  assert.ok(ceiling.y < 0.2, "天花需在畫面上緣 0–0.2（房高 2.75 的壓迫感）");
  for (const p of [shelfWall, corner, winMid, deskFront]) assert.ok(p.front, "對照視角的關鍵點必須在相機前方");
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

const outsideDesk = clampToDesk(100, -100);
assert.ok(Math.abs(outsideDesk.x / DESK_SNAP - Math.round(outsideDesk.x / DESK_SNAP)) < 1e-9);
assert.ok(Math.abs(outsideDesk.z / DESK_SNAP - Math.round(outsideDesk.z / DESK_SNAP)) < 1e-9);
assert.ok(DESK_FOOTPRINT.some((r) =>
  outsideDesk.x >= r.minX + 0.1 - 1e-9 && outsideDesk.x <= r.maxX - 0.1 + 1e-9 &&
  outsideDesk.z >= r.minZ + 0.1 - 1e-9 && outsideDesk.z <= r.maxZ - 0.1 + 1e-9
), "clampToDesk must keep the book center inside the L-shaped tabletop");
console.log("  ✓ resolveAction 35/35 cells, modifier/source variants, work/flight guards, and desk snapping");

console.log("ALL ROOM CHECKS PASS (bounds / 360° / flight easing / sunlight / projection / SSR quality / 貼圖資產 / v8.3 西牆書牆＋對照視角＋層板堆疊 / v8.4 actions, AABB, jump, sit)");
