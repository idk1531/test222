"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { makeBook, disposeBookModel } from "./Book3D";
import { firstPersonHeldAnchor, thirdPersonHandOffset, type ShelfBookPlacement } from "@/lib/room3d";
import { ensureCanvasCJKFont } from "@/lib/fonts";
import type { StudySceneApi } from "./StudyScene";
import type { PlayerPose, ViewMode } from "@/lib/room3d";

/**
 * 手持書：第一人稱掛在相機上（天生跟隨視角）；第三人稱改放到角色右手，
 * 兩者都是同一本書的瞬態呈現，拿起時不寫入持久化位置。
 */
export const HeldBook: React.FC<{
  api: StudySceneApi;
  cardId: string | null;
  placement: ShelfBookPlacement | null;
  title: string;
  viewMode?: ViewMode;
  playerRef?: React.MutableRefObject<PlayerPose>;
}> = ({ api, cardId, placement, title, viewMode = "first", playerRef }) => {
  useEffect(() => {
    if (!cardId || !placement) return;
    let cancelled = false;
    let heldGroup: THREE.Group | null = null;
    let removeFrame: (() => void) | null = null;

    void (async () => {
      await ensureCanvasCJKFont();
      if (cancelled) return;
      const group = new THREE.Group();
      heldGroup = group;
      group.name = `held-book-${cardId}`;
      group.userData.kind = "heldBook";
      group.userData.cardId = cardId;
      group.userData.place = "held";
      // 第一人稱：略低於視線、偏右，書面朝向鏡頭，清楚可見。
      const initial = firstPersonHeldAnchor(api.camera.aspect, api.camera.fov);
      group.position.set(initial.x, initial.y, initial.z);
      // 封面貼在書的 +Z 面，group 直接面向相機（不可再繞 Y 轉 180°，否則只看得到封底）。
      group.rotation.set(-0.24, 0.3, 0.08);
      group.scale.setScalar(initial.scale);
      group.add(makeBook({ ...placement, x: 0, y: 0, z: 0 }, title, "held"));
      // 第一人稱：書下方一定要有手掌／袖口，否則書像浮在半空中。
      if (viewMode === "first") {
        const handGroup = new THREE.Group();
        const skin = new THREE.MeshStandardMaterial({ color: "#d9a46f", roughness: 0.86 });
        const sleeve = new THREE.MeshStandardMaterial({ color: "#2f6f6a", roughness: 0.9 });
        // 掌根托在書的下緣、手指扣住封面下緣，前臂往右下延伸出畫面。
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.075, 0.095), skin);
        palm.position.set(0.052, -0.142, 0.05);
        palm.rotation.z = -0.18;
        const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.03, 0.062), skin);
        fingers.position.set(0.052, -0.098, 0.072);
        fingers.rotation.z = -0.18;
        const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.034, 0.05), skin);
        thumb.position.set(-0.005, -0.12, 0.072);
        thumb.rotation.z = 0.3;
        const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.13, 0.095), sleeve);
        wrist.position.set(0.075, -0.235, 0.075);
        wrist.rotation.set(-0.28, 0, -0.28);
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.032, 0.1), new THREE.MeshStandardMaterial({ color: "#245753", roughness: 0.9 }));
        cuff.position.set(0.062, -0.185, 0.078);
        cuff.rotation.z = -0.22;
        handGroup.add(palm, fingers, thumb, wrist, cuff);
        handGroup.traverse((o) => {
          o.userData.kind = "player";
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.castShadow = false;
            mesh.receiveShadow = false;
          }
        });
        group.add(handGroup);
      }
      // 書面要看得清：小範圍補光只服務手持書，不改變房間主光。
      const bookLight = new THREE.PointLight("#ffe8c4", 0.32, 1.4, 2);
      bookLight.position.set(0, 0.16, 0.22);
      group.add(bookLight);
      api.camera.add(group);

      // 直式螢幕的水平視角很窄：手持書要依 aspect 往畫面中央收，否則會落在視錐外。
      const anchorForAspect = () => firstPersonHeldAnchor(api.camera.aspect, api.camera.fov);
      const world = new THREE.Vector3();
      removeFrame = api.addFrameCallback((_dt, t) => {
        const pose = playerRef?.current;
        if (viewMode === "third" && pose) {
          // 優先掛在角色右手骨（含走路擺臂、跳躍、坐下與身高縮放）；
          // 找不到模型時退回肩膀前側的概算位置。
          // 以角色座標直接算右手位置，完全不依賴 scene graph 的掛載順序。
          // （v8.6 之前用 getWorldPosition 會拿到未更新的世界矩陣，書飄在角色背後。）
          const scale = Math.max(0.72, Math.min(1.35, pose.eyeY / 1.62));
          const hand = thirdPersonHandOffset(1.62);
          const forward = new THREE.Vector3(Math.sin(pose.yaw), 0, -Math.cos(pose.yaw));
          const right = new THREE.Vector3(Math.cos(pose.yaw), 0, Math.sin(pose.yaw));
          // 第三人稱相機在角色後方：書若只放在胸前會被軀幹整個遮住（實際預覽看不到）。
          // 因此往右手外側再推 0.16 m、略抬高，站在背後也看得到手上的書。
          world
            .set(pose.x, pose.floorY ?? 0, pose.z)
            .addScaledVector(right, (hand.x + 0.14) * scale)
            .addScaledVector(forward, -hand.z * 0.9 * scale)
            .setY(Math.max(0, pose.jumpOffset) + (hand.y + 0.12 - (pose.seated ? 0.2 : 0)) * scale);
          api.camera.updateMatrixWorld();
          group.position.copy(api.camera.worldToLocal(world.clone()));
          group.scale.setScalar(0.9);
          // 書面朝鏡頭（group 是相機子物件，+Z 才是面向鏡頭）。
          group.rotation.set(-0.18, 0.32, 0.14);
          // 角色右臂抬起時，手掌位置會比軀幹更靠前；書放在手掌上方一點。
          group.position.y += 0.02;
        } else {
          const anchor = anchorForAspect();
          group.position.set(anchor.x, anchor.y + Math.sin(t * 1.9) * 0.006, anchor.z);
          // 手持書要清楚可見：比錨點再放大 18%，並保留呼吸般的微幅擺動。
          group.scale.setScalar(anchor.scale);
          group.rotation.set(-0.22, 0.26 + Math.sin(t * 0.9) * 0.02, 0.12);
        }
      });
    })().catch((error: unknown) => {
      if (!cancelled) console.error("Failed to render held book", error);
    });

    return () => {
      cancelled = true;
      if (!heldGroup) return;
      removeFrame?.();
      api.camera.remove(heldGroup);
      disposeBookModel(heldGroup);
    };
  }, [api, cardId, placement, title, viewMode, playerRef]);

  return null;
};
