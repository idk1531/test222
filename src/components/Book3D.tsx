"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { SHELF, SHELF_INWARD } from "@/lib/room3d";
import type { ShelfLayout, ShelfBookPlacement } from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

function makeBookLabel(title: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = "rgba(255,249,232,0.9)";
    ctx.fillRect(18, 18, 220, 476);
    ctx.fillStyle = "#55432e";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "bold 26px 'Noto Sans TC', sans-serif";
    const chars = [...(title || "未命名")].slice(0, 11);
    chars.forEach((ch, i) => ctx.fillText(ch, 128, 36 + i * 37, 205));
    ctx.fillStyle = "rgba(138,100,64,0.55)";
    ctx.fillRect(32, 460, 192, 5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * 手持書封面：不是空白紙面，而是看得到書名、分類色帶與出版社記號的封面。
 * 這張貼圖只給 `place === "held"` 使用（書架上的書仍以書脊標籤為主）。
 */
function makeHeldCover(title: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const text = title || "未命名";
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 512, 512);
    // 內頁紙面：暖白＋細邊框（附圖的書封是米白紙質）
    ctx.fillStyle = "#f6efdf";
    ctx.fillRect(18, 18, 476, 476);
    ctx.strokeStyle = "rgba(74,58,38,0.34)";
    ctx.lineWidth = 4;
    ctx.strokeRect(18, 18, 476, 476);
    // 上方分類色帶
    ctx.fillStyle = accent;
    ctx.fillRect(18, 18, 12, 476);
    ctx.fillStyle = "rgba(255,250,236,0.9)";
    ctx.fillRect(50, 56, 120, 6);
    // 書名（自動換行、縮放字級）
    ctx.fillStyle = "#3c3022";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const chars = [...text].slice(0, 34);
    const lines: string[] = [];
    let line = "";
    const size = chars.length > 22 ? 40 : 48;
    ctx.font = `bold ${size}px 'Noto Sans TC', 'Noto Sans CJK TC', sans-serif`;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > 372 && line) {
        lines.push(line);
        line = ch;
        if (lines.length === 4) break;
      } else {
        line = test;
      }
    }
    if (line && lines.length < 5) lines.push(line);
    lines.forEach((row, i) => ctx.fillText(row, 58, 96 + i * (size + 12), 380));
    // 下方小字與出版社記號
    ctx.fillStyle = "rgba(74,58,38,0.55)";
    ctx.font = "500 22px 'Noto Sans TC', sans-serif";
    ctx.fillText("SciNotes 理科筆記", 58, 424);
    ctx.fillStyle = accent;
    ctx.fillRect(58, 458, 64, 5);
    ctx.fillRect(130, 458, 26, 5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function materialFor(hex: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: 0.83,
    metalness: 0,
  });
}

/**
 * 看不見但可 raycast 的放大命中盒：資料書混在裝飾書中，沒有它手指／準心幾乎點不到。
 * （透明材質仍會被 Raycaster 命中；visible=false 則不會。）
 */
export function addPickProxy(
  group: THREE.Group,
  placement: ShelfBookPlacement,
  place: "shelf" | "desk" | "held"
): void {
  const dims = {
    depth: 0.22,
    height: Math.max(0.16, placement.height) * 1.12,
    thickness: Math.max(0.045, placement.thickness) * 2.1,
  };
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(dims.depth, dims.height, dims.thickness),
    material
  );
  proxy.userData.kind = "book";
  proxy.userData.cardId = placement.cardId;
  proxy.userData.categoryId = placement.categoryId;
  proxy.userData.place = place;
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  group.add(proxy);
}

export function makeBook(placement: ShelfBookPlacement, title: string, place: "shelf" | "desk" | "held" = "shelf"): THREE.Group {
  const g = new THREE.Group();
  g.position.set(placement.x, placement.y, placement.z);
  const d = Math.max(0.12, placement.height);
  const t = placement.thickness;
  const depth = 0.18;
  const spineMat = materialFor(placement.spineHex);
  const coverMat = materialFor(placement.spineHex);
  const pageMat = new THREE.MeshStandardMaterial({ color: "#f3ead5", roughness: 0.98 });
  const shapeMat = materialFor(placement.shapeHex);
  const book = new THREE.Mesh(new THREE.BoxGeometry(depth, d, t), [pageMat, pageMat, pageMat, pageMat, spineMat, coverMat]);
  // 材質索引由 BoxGeometry 順序決定；面向室內的 X− 側使用書脊色。
  book.castShadow = true;
  book.receiveShadow = true;
  book.userData.kind = "book";
  book.userData.cardId = placement.cardId;
  book.userData.categoryId = placement.categoryId;
  book.userData.place = place;
  g.add(book);
  // 書名標籤貼於書脊（v8.3：書牆在西牆，法向一律乘 wallSign）
  const labelTexture = makeBookLabel(title, placement.categoryHex || "#e1c797");
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTexture,
    roughness: 0.9,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(t * 0.78, d * 0.86), labelMat);
  label.rotation.y = (-Math.PI / 2) * SHELF.wallSign;
  label.position.set((-depth / 2 - 0.001) * SHELF.wallSign, 0, 0);
  label.userData.kind = "book";
  label.userData.cardId = placement.cardId;
  label.userData.categoryId = placement.categoryId;
  label.userData.place = place;
  label.castShadow = false;
  g.add(label);
  // 手持時書面朝向鏡頭：補一張封面標籤（書脊標籤只有 5cm 寬，拿在手上看不清）。
  if (place === "held") {
    const coverTexture = makeHeldCover(title, placement.categoryHex || placement.spineHex || "#d9c7a6");
    const coverMatLabel = new THREE.MeshStandardMaterial({
      map: coverTexture,
      roughness: 0.9,
      transparent: true,
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#3c3226"),
      emissiveIntensity: 0.18,
    });
    const coverLabel = new THREE.Mesh(new THREE.PlaneGeometry(depth * 0.92, d * 0.94), coverMatLabel);
    // 封面貼在「+Z、朝相機」的外側面；平面法向預設 +Z，正好面向鏡頭（不可再轉 180°）。
    coverLabel.position.set(0, 0, t / 2 + 0.002);
    coverLabel.userData.kind = "book";
    coverLabel.userData.cardId = placement.cardId;
    coverLabel.userData.categoryId = placement.categoryId;
    coverLabel.userData.place = place;
    coverLabel.castShadow = false;
    g.add(coverLabel);
  }
  // 分類紙標籤：書脊下沿 1.4cm
  if (placement.categoryHex) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.018, t * 0.86), materialFor(placement.categoryHex));
    stripe.position.set((-depth / 2 - 0.004) * SHELF.wallSign, -d * 0.39, 0);
    stripe.userData.kind = "book";
    stripe.userData.cardId = placement.cardId;
    stripe.userData.place = place;
    g.add(stripe);
  }
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.012, t * 0.8), shapeMat);
  foot.position.set((-depth / 2 - 0.005) * SHELF.wallSign, -d * 0.46, 0);
  foot.userData.kind = "book";
  foot.userData.cardId = placement.cardId;
  foot.userData.place = place;
  g.add(foot);
  addPickProxy(g, placement, place);
  return g;
}

/** Dispose the geometry/materials/textures owned by one standalone book model. */
export function disposeBookModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) geometries.add(mesh.geometry);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    list.forEach((material) => materials.add(material));
  });
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value);
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
}

export interface DeskBookModel {
  placement: ShelfBookPlacement;
  yawDeg: number;
}

/** 3D 書脊/桌上書 meshes；每本書以 userData.cardId 導回唯一筆記卡。 */
export const Book3D: React.FC<{
  api: StudySceneApi;
  layout: ShelfLayout;
  deskBooks: DeskBookModel[];
  heldCardId: string | null;
  titleOf: (id: string) => string;
}> = ({ api, layout, deskBooks, heldCardId, titleOf }) => {
  useEffect(() => {
    const group = new THREE.Group();
    group.name = "study-books";
    const materials = new Set<THREE.Material>();
    layout.rows.forEach((row) => {
      row.boards.forEach((board) => {
        board.books.forEach((placement) => {
          if (placement.cardId === heldCardId) return;
          const book = makeBook(placement, titleOf(placement.cardId));
          book.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.material) {
              const list = Array.isArray(m.material) ? m.material : [m.material];
              list.forEach((material) => materials.add(material));
            }
          });
          group.add(book);
        });
        // 分類標籤：木隔板前的彩色紙片，2.6D 實體
        const textCanvas = document.createElement("canvas");
        textCanvas.width = 512;
        textCanvas.height = 128;
        const ctx = textCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = board.category.color;
          ctx.fillRect(0, 0, 512, 128);
          ctx.fillStyle = "#fffaf0";
          ctx.font = "bold 56px 'Noto Sans TC', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(board.category.name.slice(0, 12), 256, 64, 480);
        }
        const labelTexture = new THREE.CanvasTexture(textCanvas);
        labelTexture.colorSpace = THREE.SRGBColorSpace;
        const labelFaceMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.9, side: THREE.DoubleSide });
        materials.add(labelFaceMat);
        // 分類櫃板標籤：站在板前緣的小卡（P1 要求保留），面向室內
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(0.18, 0.05),
          labelFaceMat
        );
        label.rotation.y = (-Math.PI / 2) * SHELF.wallSign;
        label.position.set(
          layout.frontX + SHELF_INWARD * 0.035,
          row.plankY + 0.027,
          board.z0 + SHELF.labelWidth / 2
        );
        label.userData.kind = "categoryLabel";
        label.userData.categoryId = board.category.id;
        label.castShadow = false;
        group.add(label);
      });
    });
    deskBooks.forEach(({ placement, yawDeg }) => {
      if (placement.cardId === heldCardId) return;
      const book = makeBook(placement, titleOf(placement.cardId), "desk");
      const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yawDeg));
      const layFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
      book.quaternion.copy(yaw).multiply(layFlat);
      book.traverse((o) => {
        const mesh = o as THREE.Mesh;
        const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        list.forEach((material) => materials.add(material));
      });
      group.add(book);
    });
    api.scene.add(group);
    return () => {
      api.scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
      materials.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial && m.map) m.map.dispose();
        m.dispose();
      });
    };
  }, [api, layout, deskBooks, heldCardId, titleOf]);
  return null;
};
