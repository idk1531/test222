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
      roughness: 0.85, // v8.5：附圖的布面椅，比皮革更霧
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
      color: "#5f8257",
      roughness: 0.7,
      metalness: 0,
      emissive: new THREE.Color("#2c3f24"),
      emissiveIntensity: 0.22,
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
    // 座面：圓形（不是方盒）。方盒的四角會穿出圓形殼，實際預覽看起來像多出一塊板子。
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.295, 0.285, 0.07, 28), fabricMat);
    seat.scale.set(1, 1, 0.92);
    seat.position.set(0, CHAIR.seatHeight - 0.035, -0.01);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chair.add(seat);
    // 弧形殼：開口圓柱（薄壁、單面），開口朝 +Z（坐面）；坐下時這片殼淡出。
    // 附圖是「淺米色薄殼椅」：殼只包住背與兩側、上緣略外張，不是一個密閉木桶，
    // 因此收窄包覆角（206°）並降低殼高，坐墊才看得見。
    const shellMaterial = leather.clone();
    shellMaterial.transparent = true;
    shellMaterial.side = THREE.DoubleSide;
    shared.push(shellMaterial);
    const gapHalf = 1.35;
    const shellGeo = new THREE.CylinderGeometry(
      0.325,
      0.3,
      0.33,
      28,
      1,
      true,
      gapHalf,
      Math.PI * 2 - gapHalf * 2
    );
    const shell = new THREE.Mesh(shellGeo, shellMaterial);
    shell.position.set(0, CHAIR.seatHeight + 0.135, -0.02);
    shell.scale.set(1, 1, 1.04);
    chair.add(shell);
    // 殼內裡：比外殼略深一階，避免單面薄殼從斜側看變成紙片。
    const linerMaterial = leather.clone();
    linerMaterial.color = new THREE.Color(LOOK.chairFabric).multiplyScalar(0.9);
    linerMaterial.side = THREE.BackSide;
    shared.push(linerMaterial);
    const liner = new THREE.Mesh(shellGeo, linerMaterial);
    liner.position.copy(shell.position);
    liner.scale.set(0.955, 1, 0.99);
    chair.add(liner);
    // 坐墊：殼內一塊有厚度的布墊（附圖坐墊與殼同色、略深）
    const cushionMat = leather.clone();
    cushionMat.color = new THREE.Color(LOOK.chairFabric).multiplyScalar(0.94);
    shared.push(cushionMat);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.265, 0.05, 28), cushionMat);
    cushion.scale.set(1, 1, 0.92);
    cushion.position.set(0, CHAIR.seatHeight + 0.02, -0.01);
    cushion.castShadow = true;
    cushion.receiveShadow = true;
    chair.add(cushion);
    // 殼緣上緣捲邊（讓薄殼不會讀成紙片）
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.328, 0.011, 6, 28, Math.PI * 2 - gapHalf * 2),
      fabricMat
    );
    rim.rotation.x = -Math.PI / 2;
    // 圓柱的開口在 theta∈(−gapHalf, gapHalf)（+Z 前方）；TorusGeometry 只從 +X 起畫，
    // 因此起始角必須是 gapHalf − π/2，否則捲邊會橫在坐面前方變成一根白色橫桿。
    rim.rotation.z = gapHalf - Math.PI / 2;
    rim.position.set(0, CHAIR.seatHeight + 0.3, -0.02);
    rim.scale.set(1, 1.04, 1);
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

    // ---------- 龜背竹（附圖右側、窗前的深綠大葉盆栽） ----------
    const plant = new THREE.Group();
    plant.position.set(1.42, DESK.top, -1.98);
    // 盆：霧面深炭、略收口，底加淺色承接盤（不是一塊黑色大水桶）
    const potMat2 = new THREE.MeshStandardMaterial({ color: "#2c2a27", roughness: 0.86 });
    const saucerMat = new THREE.MeshStandardMaterial({ color: "#8d8478", roughness: 0.9 });
    shared.push(potMat2, saucerMat);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.115, 0.2, 20), potMat2);
    pot.position.set(0, 0.1, 0);
    plant.add(pot);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.145, 0.02, 20), saucerMat);
    saucer.position.set(0, 0.01, 0);
    plant.add(saucer);
    const rimPot = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.007, 6, 20), potMat2);
    rimPot.rotation.x = -Math.PI / 2;
    rimPot.position.set(0, 0.2, 0);
    plant.add(rimPot);
    // 土壤
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.01, 20), stemMat);
    soil.position.set(0, 0.195, 0);
    plant.add(soil);
    // 莖從盆心向外斜伸，末端再接葉片；葉片用 alphaMap 剪影，維持低面數。
    const stemGeo = new THREE.CylinderGeometry(0.006, 0.009, 0.5, 6);
    const leafGeo = new THREE.PlaneGeometry(0.4, 0.34);
    const leafCount = 14;
    for (let i = 0; i < leafCount; i++) {
      const a = (i / leafCount) * Math.PI * 2 + 0.3;
      // 三圈高度：內圈直立、外圈外張下垂（附圖的葉叢層次）
      const tier = i % 3;
      const reach = 0.1 + tier * 0.055 + (i % 2) * 0.02;
      const lift = 0.5 + tier * 0.11 + (i % 4) * 0.035;
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.set(Math.sin(a) * reach * 0.42, lift * 0.72, Math.cos(a) * reach * 0.42);
      stem.rotation.z = -Math.sin(a) * (0.6 - tier * 0.12);
      stem.rotation.x = Math.cos(a) * (0.6 - tier * 0.12);
      plant.add(stem);
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(Math.sin(a) * reach, lift + 0.2, Math.cos(a) * reach);
      leaf.rotation.order = "YXZ";
      leaf.rotation.y = a + Math.PI / 2;
      leaf.rotation.x = -0.42 - (i % 3) * 0.14;
      leaf.rotation.z = Math.cos(a) * 0.22;
      const scale = 0.9 + (i % 4) * 0.08;
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
