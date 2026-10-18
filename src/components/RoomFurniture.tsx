"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { DESK, FIDELITY } from "@/lib/room3d";
import { attachPhotoMap } from "@/lib/roomTextures";

/**
 * v8.3 P5：圖一的家具（App 原本完全沒有 →「不像」的第二主因）。
 * 全部程序化低面數＋共用材質；`userData.kind` 一律留空，
 * 因此不參與書本 raycast → HTML 預覽的手勢分流，家具只是佈景。
 * 面數上限：桌機 ≤ 9k、手機 ≤ 6k（實測約 2.4k 三角）。
 * 逐項關閉：FIDELITY.furniture。
 */
export const RoomFurniture: React.FC<{ api: StudySceneApi }> = ({ api }) => {
  useEffect(() => {
    if (!FIDELITY.furniture) return;
    const group = new THREE.Group();
    group.name = "room-furniture";
    api.scene.add(group);
    const disposers: Array<() => void> = [];
    const shared: THREE.Material[] = [];

    const leather = new THREE.MeshStandardMaterial({
      color: "#b3a08c",
      roughness: 0.66,
      metalness: 0.02,
      side: THREE.DoubleSide, // 椅殼為開口圓柱，需要雙面
    });
    const steel = new THREE.MeshStandardMaterial({
      color: "#8f8d89",
      roughness: 0.35,
      metalness: 0.7,
    });
    const charcoal = new THREE.MeshStandardMaterial({ color: "#2a2c2f", roughness: 0.52 });
    const screen = new THREE.MeshStandardMaterial({
      color: "#151a1e",
      roughness: 0.35,
      emissive: new THREE.Color("#1d2a33"),
      emissiveIntensity: 0.35,
    });
    const blackMatte = new THREE.MeshStandardMaterial({ color: "#1b1b1c", roughness: 0.55 });
    const potMat = new THREE.MeshStandardMaterial({ color: "#211f1d", roughness: 0.72 });
    const stemMat = new THREE.MeshStandardMaterial({ color: "#3c4a34", roughness: 0.8 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: "#33543a",
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
      transparent: false,
      alphaTest: 0.45,
    });
    shared.push(leather, steel, charcoal, screen, blackMatte, potMat, stemMat, leafMat);
    // 葉片剪影（alphaMap：黑底白葉＝白色處不透明；沿用 §5 產製流程）
    disposers.push(
      attachPhotoMap(leafMat, "leaf", {
        tileable: false,
        srgb: false,
        slot: "alphaMap",
        anisotropy: Math.min(8, api.renderer.capabilities.getMaxAnisotropy()),
      })
    );

    const add = <T extends THREE.Object3D>(o: T): T => {
      o.traverse((c) => {
        const mesh = c as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      group.add(o);
      return o;
    };

    // ---------- 皮革單椅（座高 0.42、殼寬 0.62、深 0.60、總高 0.78、4 支細金屬腳） ----------
    const chair = new THREE.Group();
    chair.position.set(0.55, 0, 0.62);
    chair.rotation.y = 2.55; // 面向桌
    // 座墊
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.075, 0.52), leather);
    seat.position.set(0, 0.393, 0.02);
    chair.add(seat);
    // 殼：半圓柱環抱背與兩側（開口朝 +Z＝坐面）
    const shellGeo = new THREE.CylinderGeometry(0.31, 0.335, 0.5, 20, 1, true, Math.PI / 2, Math.PI);
    const shell = new THREE.Mesh(shellGeo, leather);
    shell.position.set(0, 0.54, -0.03);
    shell.scale.set(1, 1, 0.94);
    chair.add(shell);
    // 4 支金屬細腳（Ø0.022、外八 8°）
    const legGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.4, 8);
    for (const [lx, lz, rx, rz] of [
      [-0.23, 0.19, -0.14, 0.14],
      [0.23, 0.19, -0.14, -0.14],
      [-0.23, -0.19, 0.14, 0.14],
      [0.23, -0.19, 0.14, -0.14],
    ] as const) {
      const leg = new THREE.Mesh(legGeo, steel);
      leg.position.set(lx, 0.185, lz);
      leg.rotation.set(rx, 0, rz);
      chair.add(leg);
    }
    add(chair);

    // ---------- 筆電（13"／105° 夾角） ----------
    const laptop = new THREE.Group();
    laptop.position.set(0.15, DESK.top + 0.002, -1.95);
    laptop.rotation.y = 3.05;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.21), charcoal);
    base.position.set(0, 0.004, 0);
    laptop.add(base);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.008, -0.105);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.21, 0.007), screen);
    lid.position.set(0, 0.105, 0);
    hinge.add(lid);
    // 螢幕與底座夾角 105°：鉸鏈局部 +Y → (0, cos15°, −sin15°)
    hinge.rotation.x = THREE.MathUtils.degToRad(-15);
    laptop.add(hinge);
    add(laptop);

    // ---------- 黑色小物（0.24×0.09×0.07） ----------
    const object = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.09), blackMatte);
    object.position.set(1.05, DESK.top + 0.035, -2.02);
    object.rotation.y = 0.35;
    add(object);

    // ---------- 龜背竹（盆 Ø0.30、全株高 0.62） ----------
    const plant = new THREE.Group();
    plant.position.set(1.62, DESK.top, -1.95);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.125, 0.2, 18), potMat);
    pot.position.set(0, 0.1, 0);
    plant.add(pot);
    const rimPot = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.008, 6, 18), potMat);
    rimPot.rotation.x = -Math.PI / 2;
    rimPot.position.set(0, 0.2, 0);
    plant.add(rimPot);
    const stemGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.34, 6);
    const leafGeo = new THREE.PlaneGeometry(0.24, 0.17);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      const tilt = 0.28 + (i % 3) * 0.1;
      const reach = 0.1 + (i % 4) * 0.035;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(Math.sin(a) * 0.05, 0.36, Math.cos(a) * 0.05);
      stem.rotation.z = -Math.sin(a) * tilt * 0.6;
      stem.rotation.x = Math.cos(a) * tilt * 0.6;
      plant.add(stem);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(a) * reach, 0.34 + (i % 5) * 0.055, Math.cos(a) * reach);
      leaf.rotation.y = a + Math.PI / 2;
      leaf.rotation.x = -0.55 - (i % 3) * 0.12;
      const s = 0.85 + (i % 4) * 0.08;
      leaf.scale.set(s, s, s);
      plant.add(leaf);
    }
    add(plant);

    return () => {
      disposers.forEach((d) => d());
      api.scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      shared.forEach((m) => m.dispose());
    };
  }, [api]);

  return null;
};
