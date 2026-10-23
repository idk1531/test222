import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, CABINET_FOOTPRINT, CATEGORY_LABEL_PLANE, CHAIR, COLLIDERS, DESK, DESK_FOOTPRINT, DESK_PREVIEW_PLANE, DESK_SNAP, FIDELITY, JUMP,
  MARBLE_ROUGH, MATCH_VIEW, PLAYER_RADIUS, ROOM, ROOM_AREA_SCALE, SHELF, SHELF_INWARD, SIT,
  SUN, TEXTURES, WINDOW, canvasSizeForPlane, heldCoverPlaneSize, spineLabelLayout, spineLabelTextBounds, spineTitleGlyphs,
  clampRoomPosition, clampPitchRad, clampHeight, clampToDesk,
  forwardFromYawPitch, easeInOutCubic, groundHeightAt, isWithinSitTrigger, projectToScreen, detectQuality,
  resolveCollision, shelfFrontX, shelfPlankCount, shelfPlankY, stepJump, roomFovFor, thirdPersonHandOffset,
  yawFromLookDelta, pitchFromLookDelta, resolveThirdPersonCamera, canJump, THIRD_PERSON, firstPersonHeldAnchor, firstPersonViewVisibility, VIEW_MODEL, PLAYER_RADIUS as RADIUS,
} from "../src/lib/room3d";
import { DEFAULT_CAMERA } from "../src/lib/study";
import { canvasCJKFont } from "../src/lib/fonts";
import { CHARACTER, characterAnim } from "../src/lib/character";
import { resolveAction, type HitKind, type InputKey, type RoomAction, type RoomActionCtx } from "../src/lib/roomActions";

const edge = clampRoomPosition(100, -100);
assert.equal(edge.x, ROOM.width / 2 - CAMERA.wallMargin);
assert.equal(edge.z, -ROOM.depth / 2 + CAMERA.wallMargin);

// 書房 v8.7 A：60 m² 房間，只擴大平面，不改房高。
assert.equal(ROOM_AREA_SCALE, 2);
assert.equal(ROOM.width, 8.49);
assert.equal(ROOM.depth, 7.07);
assert.ok(Math.abs(ROOM.width * ROOM.depth - 60) < 0.1, `房間面積應約 60 m²（實際 ${ROOM.width * ROOM.depth}）`);
assert.equal(ROOM.height, 2.75);
assert.equal(ROOM.wall, 0.12);
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
console.log("  ✓ v8.7 room 60 m² / shelf, held-cover, category, and desk-preview label aspect");

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
  diagonal.x > collider.minX - PLAYER_RADIUS && diagonal.x < collider.maxX + PLAYER_RADIUS &&
  diagonal.z > collider.minZ - PLAYER_RADIUS && diagonal.z < collider.maxZ + PLAYER_RADIUS
), "斜向分離後不可仍與 AABB 重疊");
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
// 房高與圖一量測一致；窗台低於桌面外緣的連續大理石
assert.equal(ROOM.height, 2.75);
assert.ok(WINDOW.sill > DESK.top && WINDOW.sill - DESK.top < 0.15, "窗台應略高於桌板（同一塊大理石墊高）");
assert.ok(WINDOW.top - WINDOW.sill > 1.6, "窗洞高度需保留大面積採光");
assert.equal(WINDOW.mullions, 2); // v8.5 附圖：大窗分成三格
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
  assert.ok(winMid.x > 0.55 && winL.x > 0.4 && winR.x < 0.98, "窗需在畫面右側且完整入鏡");
  assert.ok(deskFront.y > 0.55, "桌板前緣需落在畫面下半（圖一檯面線 ~0.6–0.73）");
  assert.ok(ceiling.y < 0.3, "天花需保留在畫面上方三分之一內（房高維持 2.75 m）");
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
  assert.ok(dist < THIRD_PERSON.distance + 1e-9);
  assert.ok(!COLLIDERS.some((collider) =>
    nearWall.y < collider.top + 0.12 &&
    nearWall.x > collider.minX - 0.18 && nearWall.x < collider.maxX + 0.18 &&
    nearWall.z > collider.minZ - 0.18 && nearWall.z < collider.maxZ + 0.18
  ), "第三人稱相機不得落在書架／桌子等家具內");
  assert.ok(nearWall.z < ROOM.depth / 2 - THIRD_PERSON.wallMargin + 1e-9, "第三人稱相機必須留在房間內");
  // 面西時相機在東側；面南時相機在北側（符號不可反）
  const faceWest = resolveThirdPersonCamera(pose, Math.PI / 2, 0);
  assert.ok(faceWest.x < -0.5, "面西時相機退到東側前需先確認方向：right = forward × up");
  const faceSouth = resolveThirdPersonCamera(pose, Math.PI, 0);
  assert.ok(faceSouth.z < -0.5, "面南時相機需退到北側（−Z）");
  // 牆角回歸：玩家貼在東南角時，相機不得被拉進角色頭部（實際預覽曾整個人物消失）。
  const cornerPose = { x: 2.16, z: 1.84, eyeY: 1.55, jumpOffset: 0 };
  const corner = resolveThirdPersonCamera(cornerPose, -Math.PI / 4, -0.1);
  const cornerDist = Math.hypot(corner.x - cornerPose.x, corner.y - cornerPose.eyeY, corner.z - cornerPose.z);
  assert.ok(cornerDist > 1.0, "牆角第三人稱仍需保持可視距離，不可貼在角色身上");
  assert.ok(Math.hypot(corner.x - cornerPose.x, corner.z - cornerPose.z) > 0.25, "牆角相機至少要離開頭部水平 0.25 m");
  assert.ok(corner.y > 2.0, "牆角需抬高相機越過角色頭頂");
  assert.ok(corner.x > -ROOM.width / 2 && corner.x < ROOM.width / 2, "牆角相機仍需在房內（X）");
  assert.ok(corner.z > -ROOM.depth / 2 && corner.z < ROOM.depth / 2, "牆角相機仍需在房內（Z）");
  assert.ok(!COLLIDERS.some((collider) =>
    corner.y < collider.top + 0.12 &&
    corner.x > collider.minX - 0.18 && corner.x < collider.maxX + 0.18 &&
    corner.z > collider.minZ - 0.18 && corner.z < collider.maxZ + 0.18
  ), "牆角相機不得落在家具內");
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
  assert.ok(holdAnim.rightArm < -0.9 && holdAnim.leftArm < -0.4, "手持書時雙臂需抬到胸前");
  // 第一人稱手持書錨點：直式在畫面中央偏左、橫式在右下，且都在相機前方。
  const portraitAnchor = firstPersonHeldAnchor(390 / 844, 58);
  const landscapeAnchor = firstPersonHeldAnchor(1440 / 900, 62);
  assert.ok(portraitAnchor.z < 0 && landscapeAnchor.z < 0);
  assert.ok(portraitAnchor.x < 0, "直式手持書需偏左，避開右側操作按鈕");
  assert.ok(landscapeAnchor.x > 0.1, "橫式手持書需偏右，不遮住準心");
  assert.ok(Math.abs(portraitAnchor.y) < 0.3 && Math.abs(landscapeAnchor.y) < 0.3);
  // 直式手機加寬視野，橫式維持 62°；手持書錨點要跟著 fov 走。
  assert.equal(roomFovFor(1440 / 900), 62);
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

console.log("ALL ROOM CHECKS PASS (bounds / 360° / flight easing / sunlight / projection / SSR quality / 貼圖資產 / v8.3 西牆書牆＋對照視角＋層板堆疊 / v8.4 actions, furniture and remote-player AABB, jump, sit)");
