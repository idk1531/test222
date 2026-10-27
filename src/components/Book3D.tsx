"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import {
  canvasSizeForPlane,
  CATEGORY_LABEL_PLANE,
  DESK,
  heldCoverPlaneSize,
  makeColliderBox,
  SHELF,
  SHELF_INWARD,
  spineLabelLayout,
  spineLabelTextBounds,
  spineTitleGlyphs,
} from "@/lib/room3d";
import { canvasCJKFont, ensureCanvasCJKFont } from "@/lib/fonts";
import type { ShelfLayout, ShelfBookPlacement } from "@/lib/room3d";
import type { StudyDeskPosition } from "@/lib/study";
import type { ShelfDecorBook } from "@/lib/shelfDecorBooks";
import type { StudySceneApi } from "./StudyScene";

interface SpineTextureEntry {
  texture: THREE.CanvasTexture;
  refs: number;
  lastUsed: number;
}
interface SpineTextureLease {
  key: string;
  cached: boolean;
  refs: number;
}

const SPINE_TEXTURE_CACHE_LIMIT = 64;
const spineTextureCache = new Map<string, SpineTextureEntry>();
const spineTextureLeases = new WeakMap<THREE.Texture, SpineTextureLease>();
let spineTextureClock = 0;
let spineCacheCleanupTimer: number | null = null;

function scheduleUnusedSpineTextureCleanup(): void {
  if (typeof window === "undefined") return;
  if (spineCacheCleanupTimer !== null) window.clearTimeout(spineCacheCleanupTimer);
  spineCacheCleanupTimer = window.setTimeout(() => {
    spineCacheCleanupTimer = null;
    for (const [key, entry] of spineTextureCache) {
      if (entry.refs > 0) continue;
      entry.texture.dispose();
      spineTextureLeases.delete(entry.texture);
      spineTextureCache.delete(key);
    }
  }, 1200);
}

function evictLeastRecentlyUsedSpineTexture(): boolean {
  let oldestKey: string | null = null;
  let oldest: SpineTextureEntry | null = null;
  for (const [key, entry] of spineTextureCache) {
    if (entry.refs > 0 || (oldest && entry.lastUsed >= oldest.lastUsed)) continue;
    oldestKey = key;
    oldest = entry;
  }
  if (oldestKey === null || !oldest) return false;
  oldest.texture.dispose();
  spineTextureLeases.delete(oldest.texture);
  spineTextureCache.delete(oldestKey);
  return true;
}

/** Release one model's reference; unused LRU entries are disposed after the scene settles. */
function releaseTextureReference(texture: THREE.Texture): void {
  const lease = spineTextureLeases.get(texture);
  if (!lease) {
    texture.dispose();
    return;
  }
  if (!lease.cached) {
    lease.refs -= 1;
    if (lease.refs <= 0) {
      spineTextureLeases.delete(texture);
      texture.dispose();
    }
    return;
  }
  const entry = spineTextureCache.get(lease.key);
  if (!entry || entry.texture !== texture) {
    spineTextureLeases.delete(texture);
    texture.dispose();
    return;
  }
  entry.refs = Math.max(0, entry.refs - 1);
  entry.lastUsed = ++spineTextureClock;
  lease.refs = entry.refs;
  scheduleUnusedSpineTextureCleanup();
}

function makeBookLabel(
  title: string,
  color: string,
  thickness: number,
  height: number
): THREE.CanvasTexture {
  const layout = spineLabelLayout({ title, thickness, height });
  const aspectKey = (Math.round(layout.aspect * 1000) / 1000).toFixed(3);
  const key = `${title}|${color.toLowerCase()}|${aspectKey}`;
  const cached = spineTextureCache.get(key);
  if (cached) {
    if (spineCacheCleanupTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(spineCacheCleanupTimer);
      spineCacheCleanupTimer = null;
    }
    cached.refs += 1;
    cached.lastUsed = ++spineTextureClock;
    const lease = spineTextureLeases.get(cached.texture);
    if (lease) lease.refs = cached.refs;
    return cached.texture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = layout.canvasW;
  canvas.height = layout.canvasH;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const tagWidth = canvas.width * (Math.min(thickness, layout.planeW) * 0.62 / layout.planeW);
    const tagHeight = canvas.height * 0.72;
    const tagX = (canvas.width - tagWidth) / 2;
    const tagY = (canvas.height - tagHeight) / 2;
    ctx.fillStyle = "rgba(255,249,232,0.97)";
    ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
    ctx.strokeStyle = "rgba(87,69,47,0.18)";
    ctx.lineWidth = Math.max(1, canvas.width * 0.008);
    ctx.strokeRect(tagX, tagY, tagWidth, tagHeight);
    // 分類色條：窄直條保留在紙籤一側，周圍保留足夠留白。
    ctx.fillStyle = color;
    ctx.fillRect(tagX, tagY, Math.max(2, tagWidth * 0.1), tagHeight);

    const chars = spineTitleGlyphs(title);
    const nominalBounds = spineLabelTextBounds(layout);
    const nominalWidth = nominalBounds.right - nominalBounds.left;
    const tagWidthLimit = Math.max(1, tagWidth * 0.88);
    const heightLimit = tagHeight / (1 + Math.max(0, chars.length - 1) * 1.25);
    const fontSize = Math.max(8, Math.floor(Math.min(layout.fontSize, nominalWidth, tagWidthLimit, heightLimit)));
    const lineGap = fontSize * 1.25;
    const textHeight = fontSize + Math.max(0, chars.length - 1) * lineGap;
    const startY = tagY + (tagHeight - textHeight) / 2;
    ctx.fillStyle = "#403324";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `700 ${fontSize}px ${canvasCJKFont()}`;
    chars.forEach((ch, i) => ctx.fillText(ch, canvas.width / 2, startY + i * lineGap));
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  let canCache = true;
  while (spineTextureCache.size >= SPINE_TEXTURE_CACHE_LIMIT) {
    if (!evictLeastRecentlyUsedSpineTexture()) {
      canCache = false;
      break;
    }
  }
  if (canCache) {
    const entry = { texture, refs: 1, lastUsed: ++spineTextureClock };
    spineTextureCache.set(key, entry);
    spineTextureLeases.set(texture, { key, cached: true, refs: 1 });
  } else {
    spineTextureLeases.set(texture, { key, cached: false, refs: 1 });
  }
  return texture;
}

/**
 * 手持書封面：不是空白紙面，而是看得到書名、分類色帶與出版社記號的封面。
 * 這張貼圖只給 `place === "held"` 使用（書架上的書仍以書脊標籤為主）。
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const chars = Array.from(text);
  const lines: string[] = [];
  let line = "";
  let index = 0;
  for (; index < chars.length; index++) {
    const next = line + chars[index];
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = chars[index];
      if (lines.length >= maxLines) {
        index++;
        break;
      }
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (index < chars.length && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const last = Array.from(lines[lastIndex]);
    while (last.length > 0 && ctx.measureText(`${last.join("")}…`).width > maxWidth) last.pop();
    lines[lastIndex] = `${last.join("")}…`;
  }
  return lines;
}

function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredSize: number,
  family = canvasCJKFont(),
  minSize = 8
): number {
  for (let size = Math.floor(preferredSize); size >= minSize; size--) {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `700 ${minSize}px ${family}`;
  return minSize;
}

function makeHeldCover(
  title: string,
  accent: string,
  planeW: number,
  planeH: number
): THREE.CanvasTexture {
  const canvasSize = canvasSizeForPlane(planeW, planeH, 512);
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const w = canvas.width;
    const h = canvas.height;
    const inset = Math.max(12, w * 0.035);
    const bottom = h - 18;
    const paperW = w - inset * 2;
    const paperH = h - 36;
    const titleX = w * 0.115;
    const maxTitleWidth = w - titleX - w * 0.07;
    // 封面底色：分類色的深階（不是粉彩），再壓上米白紙面。
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, w, h);
    // 內頁紙面：暖白＋細邊框（附圖的書封是米白紙質）
    ctx.fillStyle = "#efe6d2";
    ctx.fillRect(inset, 18, paperW, paperH);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(inset, 18, paperW, Math.max(24, h * 0.08));
    ctx.strokeStyle = "rgba(74,58,38,0.34)";
    ctx.lineWidth = Math.max(2, w * 0.008);
    ctx.strokeRect(inset, 18, paperW, paperH);
    // 上方分類色帶
    ctx.fillStyle = accent;
    ctx.fillRect(inset, 18, Math.max(8, w * 0.026), paperH);
    ctx.fillStyle = "rgba(255,250,236,0.9)";
    ctx.fillRect(titleX, h * 0.11, w * 0.28, Math.max(4, h * 0.012));
    // 書名換行；依封面可用寬度縮字級，不以 fillText(maxWidth) 擠扁字形。
    ctx.fillStyle = "#3c3022";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const text = Array.from(title || "未命名").slice(0, 34).join("");
    let size = Math.min(48, w * 0.12);
    let lines: string[] = [];
    for (; size >= 20; size--) {
      ctx.font = `700 ${size}px ${canvasCJKFont()}`;
      lines = wrapCanvasText(ctx, text, maxTitleWidth, 5);
      if (lines.length * (size + 10) <= h * 0.62) break;
    }
    ctx.font = `700 ${size}px ${canvasCJKFont()}`;
    const titleY = h * 0.19;
    lines.forEach((row, i) => ctx.fillText(row, titleX, titleY + i * (size + 10)));
    // 下方小字與出版社記號
    const footerY = bottom - h * 0.16;
    const footerSize = Math.max(13, Math.min(22, w * 0.055));
    ctx.fillStyle = "rgba(74,58,38,0.65)";
    ctx.font = `500 ${footerSize}px ${canvasCJKFont()}`;
    ctx.fillText("SciNotes 理科筆記", titleX, footerY);
    ctx.fillStyle = accent;
    ctx.fillRect(titleX, bottom - h * 0.06, w * 0.13, Math.max(4, h * 0.01));
    ctx.fillRect(titleX + w * 0.15, bottom - h * 0.06, w * 0.06, Math.max(4, h * 0.01));
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

/** Render one transient empty book using the same plain-box look as ShelfDecor. */
export function makeBlankDecorBook(
  source: ShelfDecorBook,
  cardId: string,
  position: { x: number; y: number; z: number; yawDeg?: number },
  place: "desk" | "held",
): THREE.Group {
  const group = new THREE.Group();
  group.name = `blank-book-${cardId}`;
  group.position.set(position.x, position.y, position.z);
  group.userData.kind = place === "held" ? "heldBook" : "book";
  group.userData.cardId = cardId;
  group.userData.place = place;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(source.sx, source.sy, source.sz),
    materialFor(source.color),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.kind = "book";
  body.userData.cardId = cardId;
  body.userData.place = place;
  group.add(body);

  if (place === "desk") {
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(source.sx, 0.13) * 1.12,
        Math.max(source.sy, 0.075) * 1.14,
        Math.max(source.sz, 0.06) * 1.5,
      ),
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        colorWrite: false,
      }),
    );
    proxy.userData.kind = "book";
    proxy.userData.cardId = cardId;
    proxy.userData.place = place;
    proxy.castShadow = false;
    proxy.receiveShadow = false;
    group.add(proxy);
  }

  const yaw = THREE.MathUtils.degToRad(position.yawDeg ?? THREE.MathUtils.radToDeg(source.ry));
  const yawRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const layFlat = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    place === "desk" && source.sy > 0.05 ? -Math.PI / 2 : 0,
  );
  group.quaternion.copy(yawRotation).multiply(layFlat);
  if (place === "held") {
    const largestSide = Math.max(source.sx, source.sy, source.sz, 0.01);
    group.scale.setScalar(0.22 / largestSide);
  }
  return group;
}

/**
 * 看不見但可 raycast 的放大命中盒：資料書混在裝飾書中，沒有它手指／準心幾乎點不到。"}
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
  const coverMat = materialFor(placement.spineHex);
  // Written books now use the same clean, single-color block as shelf decor; the existing paper
  // title label below remains unchanged and continues to expose the written text.
  const book = new THREE.Mesh(new THREE.BoxGeometry(depth, d, t), coverMat);
  book.castShadow = true;
  book.receiveShadow = true;
  book.userData.kind = "book";
  book.userData.cardId = placement.cardId;
  book.userData.categoryId = placement.categoryId;
  book.userData.place = place;
  g.add(book);
  // 書名紙籤貼於書脊；canvas aspect 由 spineLabelLayout 與實體平面共用同一公式。
  const labelLayout = spineLabelLayout({ title, thickness: t, height: d });
  const labelTexture = makeBookLabel(title, placement.categoryHex || "#e1c797", t, d);
  const labelMat = new THREE.MeshStandardMaterial({
    map: labelTexture,
    roughness: 0.9,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(labelLayout.planeW, labelLayout.planeH), labelMat);
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
    const { width: coverW, height: coverH } = heldCoverPlaneSize(depth, d);
    const coverTexture = makeHeldCover(
      title,
      placement.categoryHex || placement.spineHex || "#d9c7a6",
      coverW,
      coverH
    );
    const coverMatLabel = new THREE.MeshStandardMaterial({
      map: coverTexture,
      roughness: 0.9,
      transparent: true,
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#3c3226"),
      emissiveIntensity: 0.18,
    });
    const coverLabel = new THREE.Mesh(new THREE.PlaneGeometry(coverW, coverH), coverMatLabel);
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
  addPickProxy(g, placement, place);
  return g;
}

/** Store a world-space box around the solid book body, excluding labels and invisible pick proxies. */
function registerBookCollision(bookGroup: THREE.Group): void {
  const bookBody = bookGroup.children[0] as THREE.Mesh | undefined;
  if (!bookBody?.isMesh) return;
  bookGroup.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(bookBody);
  if (bounds.isEmpty()) return;
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  bookGroup.userData.collisionBoxes = [makeColliderBox(
    { x: center.x, z: center.z },
    size.x,
    size.z,
    bounds.min.y,
    bounds.max.y,
  )];
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
  textures.forEach((texture) => releaseTextureReference(texture));
  materials.forEach((material) => material.dispose());
}

export interface DeskBookModel {
  placement: ShelfBookPlacement;
  yawDeg: number;
}

export interface DeskBlankBookModel {
  cardId: string;
  book: ShelfDecorBook;
  desk: StudyDeskPosition;
}

/** 3D 書脊/桌上書 meshes；每本已寫入書以 cardId 導回筆記卡，空書仍只用瞬態 ID。 */
export const Book3D: React.FC<{
  api: StudySceneApi;
  layout: ShelfLayout;
  deskBooks: DeskBookModel[];
  deskBlankBooks: DeskBlankBookModel[];
  heldCardId: string | null;
  titleOf: (id: string) => string;
}> = ({ api, layout, deskBooks, deskBlankBooks, heldCardId, titleOf }) => {
  useEffect(() => {
    let cancelled = false;
    let attached = false;
    let disposed = false;
    let group: THREE.Group | null = null;
    const materials = new Set<THREE.Material>();
    const disposeGroup = () => {
      if (!group || disposed) return;
      disposed = true;
      if (attached) api.scene.remove(group);
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial && material.map) {
          releaseTextureReference(material.map);
        }
        material.dispose();
      });
      materials.clear();
    };

    void (async () => {
      await ensureCanvasCJKFont();
      if (cancelled) return;
      group = new THREE.Group();
      group.name = "study-books";
      const trackBookMaterials = (book: THREE.Object3D) => {
        book.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.material) return;
          const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          list.forEach((material) => materials.add(material));
        });
      };
      layout.rows.forEach((row) => {
        row.boards.forEach((board) => {
          board.books.forEach((placement) => {
            if (placement.cardId === heldCardId) return;
            const book = makeBook(placement, titleOf(placement.cardId));
            registerBookCollision(book);
            trackBookMaterials(book);
            group?.add(book);
          });
          // 分類標籤 canvas 與 0.18 × 0.05 m 平面保持相同長寬比。
          const categoryPlaneW = CATEGORY_LABEL_PLANE.width;
          const categoryPlaneH = CATEGORY_LABEL_PLANE.height;
          const canvasSize = canvasSizeForPlane(categoryPlaneW, categoryPlaneH, 160);
          const textCanvas = document.createElement("canvas");
          textCanvas.width = canvasSize.width;
          textCanvas.height = canvasSize.height;
          const ctx = textCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = board.category.color;
            ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);
            ctx.fillStyle = "#fffaf0";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const chars = Array.from(board.category.name);
            const text = chars.length > 12 ? `${chars.slice(0, 11).join("")}…` : chars.join("");
            const fontSize = fitCanvasFontSize(ctx, text, textCanvas.width * 0.88, Math.min(56, textCanvas.height * 0.42));
            ctx.font = `700 ${fontSize}px ${canvasCJKFont()}`;
            ctx.fillText(text, textCanvas.width / 2, textCanvas.height / 2);
          }
          const labelTexture = new THREE.CanvasTexture(textCanvas);
          labelTexture.colorSpace = THREE.SRGBColorSpace;
          labelTexture.anisotropy = 4;
          const labelFaceMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: 0.9, side: THREE.DoubleSide });
          materials.add(labelFaceMat);
          // 分類櫃板標籤：站在板前緣的小卡（P1 要求保留），面向室內
          const label = new THREE.Mesh(
            new THREE.PlaneGeometry(categoryPlaneW, categoryPlaneH),
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
          group?.add(label);
        });
      });
      deskBooks.forEach(({ placement, yawDeg }) => {
        if (placement.cardId === heldCardId) return;
        const book = makeBook(placement, titleOf(placement.cardId), "desk");
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(yawDeg));
        const layFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        book.quaternion.copy(yaw).multiply(layFlat);
        registerBookCollision(book);
        trackBookMaterials(book);
        group?.add(book);
      });
      deskBlankBooks.forEach(({ cardId, book: source, desk }) => {
        if (cardId === heldCardId) return;
        const thickness = source.sy <= 0.05 ? source.sy : source.sz;
        const book = makeBlankDecorBook(source, cardId, {
          x: desk.x,
          y: DESK.top + thickness / 2 + 0.002,
          z: desk.z,
          yawDeg: desk.yawDeg,
        }, "desk");
        registerBookCollision(book);
        trackBookMaterials(book);
        group?.add(book);
      });
      if (cancelled) {
        disposeGroup();
        return;
      }
      api.scene.add(group);
      attached = true;
    })().catch((error: unknown) => {
      disposeGroup();
      if (!cancelled) console.error("Failed to build shelf book labels", error);
    });
    return () => {
      cancelled = true;
      disposeGroup();
    };
  }, [api, layout, deskBooks, deskBlankBooks, heldCardId, titleOf]);
  return null;
};
