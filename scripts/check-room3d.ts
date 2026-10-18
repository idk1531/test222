import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import {
  CAMERA, ROOM, SUN, TEXTURES, clampRoomPosition, clampPitchRad, clampHeight,
  forwardFromYawPitch, easeInOutCubic, projectToScreen, detectQuality,
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

console.log("ALL ROOM CHECKS PASS (bounds / 360° / flight easing / sunlight / projection / SSR quality / 貼圖資產)");
