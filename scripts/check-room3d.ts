import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, DESK, FIDELITY, MARBLE_ROUGH, MATCH_VIEW, ROOM, SHELF, SHELF_INWARD,
  SUN, TEXTURES, WINDOW, clampRoomPosition, clampPitchRad, clampHeight,
  forwardFromYawPitch, easeInOutCubic, projectToScreen, detectQuality,
  shelfFrontX, shelfPlankCount, shelfPlankY,
} from "../src/lib/room3d";

const edge = clampRoomPosition(100, -100);
assert.equal(edge.x, ROOM.width / 2 - CAMERA.wallMargin);
assert.equal(edge.z, -ROOM.depth / 2 + CAMERA.wallMargin);
assert.equal(clampPitchRad(-100), CAMERA.pitchMin);
assert.equal(clampPitchRad(100), CAMERA.pitchMax);
assert.equal(clampHeight(-1), CAMERA.heightMin);
assert.equal(clampHeight(100), CAMERA.heightMax);
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

console.log("ALL ROOM CHECKS PASS (bounds / 360° / flight easing / sunlight / projection / SSR quality / 貼圖資產 / v8.3 西牆書牆＋對照視角＋層板堆疊)");
