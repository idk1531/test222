"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { blankBookCardId } from "@/lib/blankBooks";
import { makeShelfDecorBooks } from "@/lib/shelfDecorBooks";
import {
  DESK,
  DESK_FOOTPRINT,
  FIDELITY,
  makeColliderBox,
  SHELF,
  SHELF_INWARD,
  shelfPlankCount,
  shelfPlankY,
  type Aabb,
  type ShelfLayout,
} from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

const NO_HIDDEN_BOOKS: string[] = [];

/**
 * 書牆裝飾（v8.3 P1/P5）：
 * - 未寫入的書仍由同一組裝飾模型繪製；點擊／E 可編輯或拿放，但不先建立持久資料。
 * - 直立書牆使用單一 InstancedMesh，保留低 draw call；每個 instance 以 instanceId 導回空書。
 * - 相框 3 個：上層 1、腰高檯面 2，斜靠西牆。
 * 逐項關閉：FIDELITY.decor。
 */
export const ShelfDecor: React.FC<{
  api: StudySceneApi;
  layout: ShelfLayout;
  hiddenBlankBookIds?: string[];
}> = ({ api, layout, hiddenBlankBookIds = NO_HIDDEN_BOOKS }) => {
  useEffect(() => {
    if (!FIDELITY.decor) return;
    const group = new THREE.Group();
    group.name = "shelf-decor";
    api.scene.add(group);
    const materials: THREE.Material[] = [];
    const hidden = new Set(hiddenBlankBookIds);
    const decorBooks = makeShelfDecorBooks(layout).filter((book) => !hidden.has(blankBookCardId(book.id)));
    const shelfBooks = decorBooks.filter((book) => book.plankIndex >= 0);
    const stackedBooks = decorBooks.filter((book) => book.plankIndex < 0);
    const registerCollider = (collider: Aabb) => {
      const colliders = group.userData.collisionBoxes as Aabb[] | undefined;
      if (colliders) colliders.push(collider);
      else group.userData.collisionBoxes = [collider];
    };
    const registerObjectCollider = (object: THREE.Object3D) => {
      object.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(object);
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      registerCollider(makeColliderBox(
        { x: center.x, z: center.z },
        size.x,
        size.z,
        bounds.min.y,
        bounds.max.y,
      ));
    };

    const inward = SHELF_INWARD;
    const plankCount = shelfPlankCount(layout.rows.length);
    const topShelfFrameZ = SHELF.z - SHELF.width * 0.1;

    // ---- 裝飾書：牆面書以 InstancedMesh 保持原效能，instanceId 對應瞬態空書 ID ----
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.86, metalness: 0 });
    const inst = new THREE.InstancedMesh(geo, mat, shelfBooks.length);
    inst.userData.kind = "book";
    inst.userData.place = "shelf";
    inst.userData.instanceCardIds = shelfBooks.map((book) => blankBookCardId(book.id));
    inst.castShadow = true;
    inst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const color = new THREE.Color();
    shelfBooks.forEach((book, index) => {
      pos.set(book.x, book.y, book.z);
      scl.set(book.sx, book.sy, book.sz);
      q.setFromAxisAngle(up, book.ry);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(index, m4);
      color.set(book.color);
      inst.setColorAt(index, color);
      registerCollider(makeColliderBox(
        { x: book.x, z: book.z },
        book.sx,
        book.sz,
        book.y - book.sy / 2,
        book.y + book.sy / 2,
        "model",
        book.ry,
      ));
    });
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);

    // Ledge/low-shelf/side-desk stacks stay individual meshes so their original page-edge materials
    // are unchanged; they now carry the same blank-book interaction metadata as the instanced books.
    for (const book of stackedBooks) {
      const coverMaterial = new THREE.MeshStandardMaterial({
        color: book.color,
        roughness: book.pageEdges ? 0.86 : 0.88,
      });
      const pageMaterial = book.pageEdges
        ? new THREE.MeshStandardMaterial({ color: "#e6dcc8", roughness: 0.95 })
        : coverMaterial;
      materials.push(coverMaterial);
      if (book.pageEdges) materials.push(pageMaterial);
      const bookMesh = new THREE.Mesh(
        new THREE.BoxGeometry(book.sx, book.sy, book.sz),
        book.pageEdges
          ? [pageMaterial, pageMaterial, coverMaterial, pageMaterial, pageMaterial, pageMaterial]
          : coverMaterial,
      );
      bookMesh.position.set(book.x, book.y, book.z);
      bookMesh.rotation.y = book.ry;
      bookMesh.castShadow = true;
      bookMesh.receiveShadow = true;
      bookMesh.userData.kind = "book";
      bookMesh.userData.cardId = blankBookCardId(book.id);
      bookMesh.userData.categoryId = null;
      bookMesh.userData.place = "shelf";
      group.add(bookMesh);
      registerObjectCollider(bookMesh);
    }

    // ---- 相框：上層 1、腰高檯面 2（斜靠西牆） ----
    const frameBlack = new THREE.MeshStandardMaterial({ color: "#141210", roughness: 0.6 });
    const frameFace = new THREE.MeshStandardMaterial({ color: "#cfc6b6", roughness: 0.85 });
    materials.push(frameBlack, frameFace);
    const ledgeLength = SHELF.ledge.z1 - SHELF.ledge.z0;
    const frames: Array<{ y: number; z: number; w: number; h: number }> = [
      { y: shelfPlankY(0, plankCount) + 0.151, z: topShelfFrameZ, w: 0.26, h: 0.3 },
      { y: SHELF.ledge.top + 0.091, z: SHELF.ledge.z0 + ledgeLength * 0.42, w: 0.22, h: 0.18 },
      { y: SHELF.ledge.top + 0.091, z: SHELF.ledge.z0 + ledgeLength * 0.74, w: 0.22, h: 0.18 },
    ];
    for (const frame of frames) {
      const holder = new THREE.Group();
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.022, frame.h, frame.w), frameBlack);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(frame.w - 0.03, frame.h - 0.03), frameFace);
      face.rotation.y = inward * (Math.PI / 2);
      face.position.x = inward * 0.012;
      back.castShadow = true;
      back.receiveShadow = true;
      face.castShadow = false;
      holder.add(back, face);
      holder.position.set(SHELF.xBack + inward * 0.05, frame.y, frame.z);
      holder.rotation.z = inward * 0.09;
      group.add(holder);
      registerObjectCollider(holder);
    }

    // ---- 西牆回折檯面相框 ----
    {
      const sideDesk = DESK_FOOTPRINT[1];
      const sideDeskEdgeX = inward > 0 ? sideDesk.minX : sideDesk.maxX;
      const returnLength = sideDesk.maxZ - sideDesk.minZ;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.34, 0.44), frameBlack);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), frameFace);
      face.rotation.y = inward * (Math.PI / 2);
      face.position.x = inward * 0.014;
      back.castShadow = true;
      back.receiveShadow = true;
      const holder = new THREE.Group();
      holder.add(back, face);
      holder.position.set(
        sideDeskEdgeX + inward * 0.06,
        DESK.top + 0.18,
        sideDesk.minZ + returnLength * 0.72,
      );
      holder.rotation.z = inward * 0.08;
      group.add(holder);
      registerObjectCollider(holder);
    }

    return () => {
      api.scene.remove(group);
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      geo.dispose();
      mat.dispose();
      materials.forEach((material) => material.dispose());
    };
  }, [api, hiddenBlankBookIds, layout]);

  return null;
};
