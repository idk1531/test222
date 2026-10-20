"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import {
  DESK,
  FIDELITY,
  SHELF,
  SHELF_INWARD,
  shelfFrontX,
  shelfPlankCount,
  shelfPlankY,
  type ShelfLayout,
  type ShelfRowLayout,
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
  // 附圖的藏書以暖褐、奶油、灰藍為主，少量鏽紅點綴；不要一整排高飽和色塊。
  "#6d5a45", "#8d7a5e", "#cbb994", "#d8c8a8", "#5b4a3c",
  "#3f4a4a", "#4a4f57", "#7d6b57", "#9b8768", "#b8a27e",
  "#8a5a45", "#5d4a3a", "#e0d4bc", "#6f6353",
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
    const materials: THREE.Material[] = [];

    const inward = SHELF_INWARD;
    const frontX = shelfFrontX();
    const plankCount = shelfPlankCount(layout.rows.length);
    // 資料列可能落在任一層板（v8.5 由最下層板往上長），以 plankIndex 對位。
    const boardsByPlank = new Map<number, ShelfRowLayout["boards"]>();
    layout.rows.forEach((entry) => boardsByPlank.set(entry.plankIndex, entry.boards));
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
      // v8.6：只保留「分類標籤」與每本資料書的實際厚度，其餘空隙全部補裝飾書。
      // 舊版把整個 board 當成已佔用，資料書稀疏的分類就會留下大片空層板。
      const occupied: Array<readonly [number, number]> = [];
      for (const b of boardsByPlank.get(r) ?? []) {
        occupied.push([b.z0, Math.min(b.z1, b.z0 + SHELF.labelWidth)] as const);
        for (const item of b.books) {
          occupied.push([
            item.z - item.thickness / 2 - 0.003,
            item.z + item.thickness / 2 + 0.003,
          ] as const);
        }
      }
      occupied.sort((p, q) => p[0] - q[0]);
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

    // ---- 腰高檯面／矮擱板的書堆（附圖：檯面與地面層板上的橫躺書堆） ----
    {
      const stackColors = ["#3a3f47", "#7a3b34", "#c9b999", "#4a4f57", "#8a6a4a", "#6b5a45"];
      const stackSpecs: Array<[number, number, number]> = [
        // [y, z, count]
        [SHELF.ledge.top, 0.52, 4],
        [SHELF.ledge.top, 1.18, 3],
        [SHELF.lowShelf.top, 0.32, 5],
        [SHELF.lowShelf.top, 0.98, 4],
        [0.02, 0.18, 5],
      ];
      stackSpecs.forEach(([baseY, z, count], si) => {
        const len = 0.3 + (si % 3) * 0.04;
        const width = 0.22 + (si % 2) * 0.03;
        for (let i = 0; i < count; i++) {
          const height = 0.03 + ((si + i) % 3) * 0.008;
          const material = new THREE.MeshStandardMaterial({
            color: stackColors[(si + i) % stackColors.length],
            roughness: 0.86,
          });
          const pageMaterial = new THREE.MeshStandardMaterial({ color: "#e6dcc8", roughness: 0.95 });
          materials.push(material, pageMaterial);
          const bookMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width - i * 0.008, height, len - i * 0.012),
            [pageMaterial, pageMaterial, material, pageMaterial, pageMaterial, pageMaterial]
          );
          bookMesh.position.set(
            SHELF.xBack + inward * (width / 2 + 0.03 + (i % 2) * 0.008),
            baseY + height / 2 + i * 0.034 + 0.002,
            z + (i % 2 === 0 ? 0.01 : -0.012)
          );
          bookMesh.rotation.y = (i % 3 - 1) * 0.05;
          bookMesh.castShadow = true;
          bookMesh.receiveShadow = true;
          group.add(bookMesh);
        }
      });
    }
    // ---- 相框：上層 1、腰高檯面 2（斜靠西牆） ----
    const frameBlack = new THREE.MeshStandardMaterial({ color: "#141210", roughness: 0.6 });
    const frameFace = new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 0.85 });
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


    // ---- 西牆回折檯面：附圖左下的相框與書堆（避免檯面中央空一大片） ----
    {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.34, 0.44), frameBlack);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), frameFace);
      face.rotation.y = inward * (Math.PI / 2);
      face.position.x = inward * 0.014;
      back.castShadow = true;
      back.receiveShadow = true;
      const holder = new THREE.Group();
      holder.add(back, face);
      holder.position.set(SHELF.xBack + inward * 0.06, DESK.top + 0.18, -0.35);
      holder.rotation.z = inward * 0.08;
      group.add(holder);
    }
    {
      const stackColors = ["#3a3f47", "#7a3b34", "#c9b999", "#4a4f57"];
      const baseZ = -1.2;
      for (let i = 0; i < 4; i++) {
        const material = new THREE.MeshStandardMaterial({ color: stackColors[i], roughness: 0.88 });
        materials.push(material);
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.2 - i * 0.008, 0.03, 0.29 - i * 0.01),
          [material, material, material, material, material, material]
        );
        book.position.set(SHELF.xBack + inward * 0.17, DESK.top + 0.017 + i * 0.032, baseZ + (i % 2 ? 0.01 : -0.008));
        book.rotation.y = (i % 2 ? -1 : 1) * 0.04;
        book.castShadow = true;
        book.receiveShadow = true;
        group.add(book);
      }
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
      materials.forEach((material) => material.dispose());
    };
  }, [api, layout]);

  return null;
};
