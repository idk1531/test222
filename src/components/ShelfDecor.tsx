"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import {
  FIDELITY,
  SHELF,
  SHELF_INWARD,
  shelfFrontX,
  shelfPlankCount,
  shelfPlankY,
  type ShelfLayout,
} from "@/lib/room3d";

/** 決定性偽隨機（重繪/重掛載時裝飾書外觀一致，不會每次跳動） */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const SPINE_COLORS = [
  "#7a3b34", "#3f4a3c", "#6b5a45", "#2f3a45", "#8a7a5e",
  "#5b4038", "#4a4f57", "#7d6b57", "#3a3038", "#8a6b4f",
  "#c9b999", "#5d4a3a",
];

interface FakeBook {
  x: number;
  y: number;
  z: number;
  sx: number; // 深（X）
  sy: number; // 高（Y）
  sz: number; // 厚（Z）
  ry: number;
  color: string;
}

/**
 * 書牆裝飾（v8.3 P1/P5）：
 * - 資料書本由 Book3D 負責；此處只補「塞滿」的裝飾書（直立書牆＋橫躺書堆），
 *   全部用一個 InstancedMesh（1 draw call，約 5k 三角），不參與 raycast（沒有 userData.kind）。
 * - 相框 3 個：上層 1、腰高檯面 2，斜靠西牆。
 * 逐項關閉：FIDELITY.decor。
 */
export const ShelfDecor: React.FC<{ api: StudySceneApi; layout: ShelfLayout }> = ({
  api,
  layout,
}) => {
  useEffect(() => {
    if (!FIDELITY.decor) return;
    const group = new THREE.Group();
    group.name = "shelf-decor";
    api.scene.add(group);

    const inward = SHELF_INWARD;
    const frontX = shelfFrontX();
    const plankCount = shelfPlankCount(layout.rows.length);
    const rng = makeRng(20261018);
    const books: FakeBook[] = [];

    const zStart = SHELF.z - SHELF.width / 2 + 0.03;
    const zEnd = SHELF.z + SHELF.width / 2 - 0.03;

    const pushBook = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry: number) => {
      books.push({
        x,
        y,
        z,
        sx,
        sy,
        sz,
        ry,
        color: SPINE_COLORS[Math.floor(rng() * SPINE_COLORS.length) % SPINE_COLORS.length],
      });
    };

    /** 在 [a,b] 區間塞直立書（含 12% 機率換成橫躺書堆） */
    const fillRun = (a: number, b: number, plankY: number, allowStacks: boolean) => {
      if (b - a < 0.05) return;
      let z = a;
      while (z < b - 0.03) {
        if (allowStacks && b - z > 0.3 && rng() < 0.12) {
          // 橫躺書堆：3–5 本，每本高 0.032
          const n = 3 + Math.floor(rng() * 3);
          const depth = 0.17 + rng() * 0.03;
          const len = 0.21 + rng() * 0.04;
          let y = plankY;
          for (let i = 0; i < n; i++) {
            pushBook(
              frontX - inward * (depth / 2),
              y + 0.016,
              z + len / 2,
              depth,
              0.032,
              len - i * 0.008,
              0
            );
            y += 0.032;
          }
          z += 0.27;
          continue;
        }
        const t = 0.022 + rng() * 0.026;
        if (z + t > b) break;
        const h = 0.16 + rng() * 0.075;
        const depth = 0.16 + rng() * 0.04;
        pushBook(frontX - inward * (depth / 2), plankY + h / 2 + 0.0015, z + t / 2, depth, h, t, 0);
        z += t + 0.002 + (rng() < 0.08 ? 0.02 : 0);
      }
    };

    // 相框要「看得見」：最上層板留一段空位（資料書只佔北端，那段本來就空）
    const TOPSHELF_FRAME_Z = -0.4;
    for (let r = 0; r < plankCount; r++) {
      const plankY = shelfPlankY(r, plankCount);
      const occupied = (layout.rows[r]?.boards ?? [])
        .map((b) => [b.z0, b.z1] as const)
        .sort((p, q) => p[0] - q[0]);
      const reserved: Array<[number, number]> =
        r === 0 ? [[TOPSHELF_FRAME_Z - 0.2, TOPSHELF_FRAME_Z + 0.2]] : [];
      let cursor = zStart;
      const fillFree = (from: number, to: number) => {
        let a = from;
        for (const [r0, r1] of reserved) {
          if (r1 <= a || r0 >= to) continue;
          fillRun(a, Math.min(to, r0), plankY, true);
          a = Math.max(a, r1);
        }
        fillRun(a, to, plankY, true);
      };
      for (const [z0, z1] of occupied) {
        if (z0 - cursor > 0.05) fillFree(cursor, z0 - 0.015);
        cursor = Math.max(cursor, z1 + 0.015);
      }
      if (zEnd - cursor > 0.05) fillFree(cursor, zEnd);
    }

    // ---- 裝飾書：單一 InstancedMesh ----
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.86, metalness: 0 });
    const inst = new THREE.InstancedMesh(geo, mat, books.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    books.forEach((b, i) => {
      pos.set(b.x, b.y, b.z);
      scl.set(b.sx, b.sy, b.sz);
      q.setFromAxisAngle(up, b.ry);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(i, m4);
      color.set(b.color);
      inst.setColorAt(i, color);
    });
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);

    // ---- 相框：上層 1、腰高檯面 2（斜靠西牆） ----
    const frameBlack = new THREE.MeshStandardMaterial({ color: "#141414", roughness: 0.6 });
    const frameFace = new THREE.MeshStandardMaterial({ color: "#e8e2d6", roughness: 0.85 });
    // 上層層板：0.26×0.30（板頂 2.42 + 0.30 < 天花 2.75）；腰高檯面：0.22×0.18（閃開 1.22 的底層板）
    const frames: Array<{ y: number; z: number; w: number; h: number }> = [
      { y: shelfPlankY(0, plankCount) + 0.151, z: TOPSHELF_FRAME_Z, w: 0.26, h: 0.3 },
      { y: SHELF.ledge.top + 0.091, z: 0.2, w: 0.22, h: 0.18 },
      { y: SHELF.ledge.top + 0.091, z: 0.9, w: 0.22, h: 0.18 },
    ];
    for (const fr of frames) {
      const holder = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.022, fr.h, fr.w), frameBlack);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(fr.w - 0.03, fr.h - 0.03), frameFace);
      face.rotation.y = inward * (Math.PI / 2);
      face.position.x = inward * 0.012;
      back.castShadow = true;
      back.receiveShadow = true;
      face.castShadow = false;
      holder.add(back, face);
      holder.position.set(SHELF.xBack + inward * 0.05, fr.y, fr.z);
      holder.rotation.z = inward * 0.09; // 頂端往牆面倒
      group.add(holder);
    }

    return () => {
      api.scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      geo.dispose();
      mat.dispose();
      frameBlack.dispose();
      frameFace.dispose();
    };
  }, [api, layout]);

  return null;
};
