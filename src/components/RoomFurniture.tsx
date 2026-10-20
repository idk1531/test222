"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { CHAIR, DESK, FIDELITY, LOOK } from "@/lib/room3d";
import { attachPhotoMap } from "@/lib/roomTextures";

/**
 * v8.3 P5：圖一的家具（App 原本完全沒有 →「不像」的第二主因）。
 * 全部程序化低面數＋共用材質；只有椅子標記 `userData.kind="chair"` 供坐下互動，
 * 其餘家具不參與書本 raycast → HTML 預覽的手勢分流。
 * 面數上限：桌機 ≤ 9k、手機 ≤ 6k（實測約 2.4k 三角）。
 * 逐項關閉：FIDELITY.furniture。
 */
export interface RoomFurnitureRig {
  group: THREE.Group;
  shell: THREE.Mesh;
  shellMaterial: THREE.Material;
}

export const RoomFurniture: React.FC<{
  api: StudySceneApi;
  chairRigRef?: React.MutableRefObject<RoomFurnitureRig | null>;
}> = ({ api, chairRigRef }) => {
  useEffect(() => {
    if (!FIDELITY.furniture) return;
    const group = new THREE.Group();
    group.name = "room-furniture";
    api.scene.add(group);
    const disposers: Array<() => void> = [];
    const shared: THREE.Material[] = [];

    const leather = new THREE.MeshStandardMaterial({
      color: LOOK.chairFabric,
      roughness: 0.82, // v8.5：附圖的布面椅，比皮革更霧
      metalness: 0.01,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: LOOK.chairSteel,
      roughness: 0.34,
      metalness: 0.72,
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
      color: "#6f955f",
      roughness: 0.62,
      metalness: 0,
      emissive: new THREE.Color("#33452a"),
      emissiveIntensity: 0.5,
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

    // ---------- 布面單椅（附圖：淺米色圓弧薄殼椅＋4 支外八細金屬腳） ----------
    const chair = new THREE.Group();
    chair.position.set(CHAIR.x, CHAIR.y, CHAIR.z);
    chair.rotation.y = CHAIR.yaw; // 面向桌
    const fabricMat = leather; // 共用淺米色布料材質
    // 座墊（圓角薄墊，前緣略垂）
    const seat = new THREE.Mesh(new THREE.BoxGeometry(CHAIR.seatWidth, 0.08, CHAIR.seatDepth), fabricMat);
    seat.position.set(0, CHAIR.seatHeight - 0.04, 0.03);
    chair.add(seat);
    const seatFront = new THREE.Mesh(new THREE.BoxGeometry(CHAIR.seatWidth - 0.03, 0.07, 0.05), fabricMat);
    seatFront.position.set(0, CHAIR.seatHeight - 0.055, 0.03 + CHAIR.seatDepth / 2 - 0.02);
    chair.add(seatFront);
    // 弧形殼：開口圓柱（薄壁、單面），開口朝 +Z（坐面）；坐下時這片殼淡出
    const shellMaterial = leather.clone();
    shellMaterial.transparent = true;
    shellMaterial.side = THREE.DoubleSide;
    shared.push(shellMaterial);
    // 開口朝 +Z（坐面）：gap 置中於 theta=0（three 的圓柱 x=r·sinθ、z=r·cosθ）。
    const gapHalf = 0.42;
    const shellGeo = new THREE.CylinderGeometry(
      0.335,
      0.305,
      0.4,
      24,
      1,
      true,
      gapHalf,
      Math.PI * 2 - gapHalf * 2
    );
    const shell = new THREE.Mesh(shellGeo, shellMaterial);
    shell.position.set(0, CHAIR.seatHeight + 0.16, 0.015);
    shell.scale.set(1, 1, 1.06);
    chair.add(shell);
    // 殼緣上緣捲邊（讓薄殼不會讀成紙片）
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.328, 0.013, 6, 24, Math.PI * 2 - gapHalf * 2),
      fabricMat
    );
    rim.rotation.x = -Math.PI / 2;
    rim.rotation.z = Math.PI / 2 - gapHalf;
    rim.position.set(0, CHAIR.seatHeight + 0.36, 0.015);
    rim.scale.set(1, 1.06, 1);
    chair.add(rim);
    // 4 支細金屬腳（Ø0.02、外八 9°）
    const legGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.42, 8);
    for (const [lx, lz, rx, rz] of [
      [-0.24, 0.2, -0.09, 0.09],
      [0.24, 0.2, -0.09, -0.09],
      [-0.24, -0.2, 0.09, 0.09],
      [0.24, -0.2, 0.09, -0.09],
    ] as const) {
      const leg = new THREE.Mesh(legGeo, steel);
      leg.position.set(lx, 0.2, lz);
      leg.rotation.set(rx, 0, rz);
      chair.add(leg);
    }
    // 座墊下的橫向支撐
    const brace = new THREE.Mesh(new THREE.BoxGeometry(CHAIR.seatWidth - 0.06, 0.012, 0.012), steel);
    brace.position.set(0, 0.36, -0.16);
    chair.add(brace);
    chair.userData.kind = "chair";
    add(chair);
    if (chairRigRef) chairRigRef.current = { group: chair, shell, shellMaterial };

    // ---------- 筆電（13"／105° 夾角） ----------
    const laptop = new THREE.Group();
    laptop.position.set(0.12, DESK.top + 0.002, -1.98);
    laptop.rotation.y = 3.06;
    const aluminum = new THREE.MeshStandardMaterial({ color: "#b9b6ae", roughness: 0.38, metalness: 0.55 });
    shared.push(aluminum);
    const keyboard = new THREE.MeshStandardMaterial({ color: "#2a2b29", roughness: 0.7 });
    shared.push(keyboard);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.012, 0.225), aluminum);
    base.position.set(0, 0.006, 0);
    laptop.add(base);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.003, 0.11), keyboard);
    keys.position.set(0, 0.013, 0.01);
    laptop.add(keys);
    const trackpad = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.002, 0.06), keyboard);
    trackpad.position.set(0, 0.0135, 0.075);
    laptop.add(trackpad);
    const hinge = new THREE.Group();
    hinge.position.set(0, 0.012, -0.112);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.225, 0.009), screen);
    lid.position.set(0, 0.112, 0);
    const lidBack = new THREE.Mesh(new THREE.BoxGeometry(0.335, 0.23, 0.004), aluminum);
    lidBack.position.set(0, 0.112, 0.006);
    hinge.add(lid, lidBack);
    // 螢幕與底座夾角 105°：鉸鏈局部 +Y → (0, cos15°, −sin15°)
    hinge.rotation.x = THREE.MathUtils.degToRad(-15);
    laptop.add(hinge);
    add(laptop);

    // ---------- 黑色小物（0.24×0.09×0.07） ----------
    const object = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.09), blackMatte);
    object.position.set(1.05, DESK.top + 0.035, -2.02);
    object.rotation.y = 0.35;
    add(object);

    // ---------- 龜背竹（盆 Ø0.32、全株高約 0.95 m；附圖右側的大葉盆栽） ----------
    const plant = new THREE.Group();
    plant.position.set(1.15, DESK.top, -1.93);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 18), potMat);
    pot.position.set(0, 0.11, 0);
    plant.add(pot);
    const rimPot = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.008, 6, 18), potMat);
    rimPot.rotation.x = -Math.PI / 2;
    rimPot.position.set(0, 0.22, 0);
    plant.add(rimPot);
    // 莖從盆心向外斜伸，末端再接大葉片；葉片用 alphaMap 剪影，維持低面數。
    const stemGeo = new THREE.CylinderGeometry(0.007, 0.01, 0.52, 6);
    const leafGeo = new THREE.PlaneGeometry(0.46, 0.39);
    const leafCount = 11;
    for (let i = 0; i < leafCount; i++) {
      const a = (i / leafCount) * Math.PI * 2 + 0.35;
      const reach = 0.16 + (i % 3) * 0.05;
      const lift = 0.58 + (i % 4) * 0.09;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(Math.sin(a) * reach * 0.45, lift * 0.7, Math.cos(a) * reach * 0.45);
      stem.rotation.z = -Math.sin(a) * 0.55;
      stem.rotation.x = Math.cos(a) * 0.55;
      plant.add(stem);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(a) * reach, lift + 0.18, Math.cos(a) * reach);
      leaf.rotation.order = "YXZ";
      leaf.rotation.y = a + Math.PI / 2;
      leaf.rotation.x = -0.5 - (i % 3) * 0.12;
      leaf.rotation.z = Math.cos(a) * 0.18;
      const scale = 0.95 + (i % 4) * 0.09;
      leaf.scale.set(scale, scale, scale);
      plant.add(leaf);
    }
    add(plant);

    return () => {
      if (chairRigRef?.current?.group === chair) chairRigRef.current = null;
      disposers.forEach((d) => d());
      api.scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      shared.forEach((m) => m.dispose());
    };
  }, [api, chairRigRef]);

  return null;
};
