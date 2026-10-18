"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import type { CanvasObjectData } from "./InfiniteCanvas";
import type { CardData } from "./KnowledgeCardNode";
import {
  DESK,
  PALETTE,
  ROOM,
  SHELF,
  TEXTURES,
  WINDOW,
  shelfPlankY,
  type TextureKey,
} from "@/lib/room3d";
import { attachPhotoMap, type AttachOptions } from "@/lib/roomTextures";

// ================= 程式化貼圖（canvas → CanvasTexture） =================

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 木紋：淺色底＋横向細紋（direction: 紋路沿 X） */
function drawWood(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  base: string,
  streak: string
) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 110; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = streak;
    ctx.globalAlpha = 0.04 + Math.random() * 0.1;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= w; x += 28) {
      ctx.lineTo(x, y + Math.sin(x * 0.018 + i * 1.7) * 2.6 + (Math.random() - 0.5) * 1.6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** 細顆粒牆面（米白＋低對比斑點） */
function drawPlaster(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(120,96,64,0.05)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
  }
}

/** 地板：淺橡木拼板（板條沿 X，板縫＋木紋） */
function drawFloorPlanks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rows = 6;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const tone = 0.92 + ((r * 37) % 10) * 0.012;
    ctx.fillStyle = `rgb(${Math.round(217 * tone)},${Math.round(185 * tone)},${Math.round(138 * tone)})`;
    ctx.fillRect(0, r * rh, w, rh);
    // 木紋
    for (let i = 0; i < 26; i++) {
      const y = r * rh + Math.random() * rh;
      ctx.strokeStyle = "rgba(138,100,64,0.16)";
      ctx.lineWidth = 0.6 + Math.random();
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 1.8);
      }
      ctx.stroke();
    }
    // 板縫
    ctx.fillStyle = "rgba(110,77,49,0.55)";
    ctx.fillRect(0, r * rh, w, 1.6);
    // 板接合（錯開）
    const joint = ((r * 173) % w);
    ctx.fillRect(joint, r * rh, 1.6, rh);
  }
}

/**
 * 桌面「畫布預覽」貼圖（房間模式用，非互動）：
 * 把畫布物件的配置／標題畫成紙面縮圖。點擊進入工作視角後即為真實畫布。
 */
function drawDeskPreview(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  objects: CanvasObjectData[],
  cards: CardData[]
) {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
  const objs = objects.filter((o) => !o.isHidden);
  if (objs.length === 0) {
    ctx.fillStyle = "#8a7a66";
    ctx.font = "600 22px 'Noto Sans TC', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("畫布是空的", w / 2, h / 2 - 26);
    ctx.font = "16px 'Noto Sans TC', sans-serif";
    ctx.fillText("點擊桌面進入工作視角，使用上方「＋」新增卡片", w / 2, h / 2 + 4);
    return;
  }
  // 邊界 → 貼齊紙面（留白 30px）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const o of objs) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + (o.width || 200));
    maxY = Math.max(maxY, o.y + (o.height || 160));
  }
  const pad = 40;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh, 1.4);
  const ox = (w - bw * scale) / 2 - minX * scale;
  const oy = (h - bh * scale) / 2 - minY * scale;
  const titleOf = (o: CanvasObjectData) =>
    String(cards.find((c) => c.id === o.cardId)?.title || o.content?.title || "");
  for (const o of objs) {
    const x = o.x * scale + ox;
    const y = o.y * scale + oy;
    const ow = Math.max(26, (o.width || 200) * scale);
    const oh = Math.max(20, (o.height || 160) * scale);
    const accent = String(o.style?.accentColor || "#3b82f6");
    // 卡片紙
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1, 2 * scale);
    roundRect(ctx, x, y, ow, oh, 6 * scale);
    ctx.fill();
    ctx.stroke();
    // 標題（最多 2 行）
    ctx.fillStyle = "#44403c";
    ctx.font = `600 ${Math.max(9, 11 * scale)}px 'Noto Sans TC', sans-serif`;
    ctx.textAlign = "left";
    const title = titleOf(o) || "（未命名）";
    ctx.fillText(title, x + 6 * scale, y + 14 * scale, ow - 12 * scale);
    // 頂端色條（節點主色）
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, ow, Math.max(2, 3 * scale));
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ================= 場景建立 =================

type Disposer = () => void;

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  opts: { cast?: boolean; receive?: boolean } = {}
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

/**
 * 房間幾何本體：四牆／天花／地板、大窗（窗框＋窗櫺＋窗台＋玻璃）、
 * 窗下壁掛桌（無桌腿、有厚度、桌面紙面預覽）、書架本體、踢腳板。
 * 全部靜態共享材質；卸載時完整 dispose。
 */
export const RoomGeometry: React.FC<{
  api: StudySceneApi;
  objects: CanvasObjectData[];
  cards: CardData[];
  shelfRows: number;
}> = ({ api, objects, cards, shelfRows }) => {
  const paperRef = useRef<THREE.Mesh | null>(null);
  const paperTextureRef = useRef<THREE.Texture | null>(null);

  // ---- 靜態幾何（shelfRows 變動才重建） ----
  useEffect(() => {
    const group = new THREE.Group();
    api.scene.add(group);
    const disposers: Disposer[] = [];

    const wallTex = canvasTexture(256, 256, drawPlaster);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(3, 2);
    disposers.push(() => wallTex.dispose());

    // 地板依 TEXTURES.floor 選橡木／大理石；程序化版同時擔任照片貼圖的退回底
    const floorIsMarble = TEXTURES.floor === "marble";
    const floorTex = canvasTexture(512, 512, (c, w, h) =>
      floorIsMarble
        ? drawWood(c, w, h, "#dbdbd6", "rgba(148,148,144,0.28)")
        : drawFloorPlanks(c, w, h)
    );
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const floorRepeat = floorIsMarble
      ? TEXTURES.repeat.floorMarble
      : TEXTURES.repeat.floorOak;
    floorTex.repeat.set(floorRepeat[0], floorRepeat[1]);
    disposers.push(() => floorTex.dispose());

    const deskWoodTex = canvasTexture(256, 256, (c, w, h) =>
      drawWood(c, w, h, "#e2c493", "rgba(138,100,64,0.35)")
    );
    disposers.push(() => deskWoodTex.dispose());

    const shelfWoodTex = canvasTexture(256, 256, (c, w, h) =>
      drawWood(c, w, h, "#d3ac76", "rgba(110,77,49,0.4)")
    );
    disposers.push(() => shelfWoodTex.dispose());

    // 書架背板退回底：深褐紋理牆（圖一書牆背板），照片貼圖換上書脊色票
    const shelfBackTex = canvasTexture(256, 256, (c, w, h) =>
      drawWood(c, w, h, "#4b3729", "rgba(18,12,8,0.45)")
    );
    shelfBackTex.wrapS = shelfBackTex.wrapT = THREE.RepeatWrapping;
    shelfBackTex.repeat.set(3, 2);
    disposers.push(() => shelfBackTex.dispose());

    const wallMat = new THREE.MeshStandardMaterial({
      color: PALETTE.wall,
      map: wallTex,
      roughness: 0.96,
      metalness: 0,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      roughness: 1,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorIsMarble ? "#e9e9e6" : "#e8d7b8",
      map: floorTex,
      roughness: floorIsMarble ? 0.4 : 0.72,
      metalness: floorIsMarble ? 0.05 : 0.02,
    });
    const deskMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: deskWoodTex,
      roughness: 0.5,
      metalness: 0.03,
    });
    const honeyMat = new THREE.MeshStandardMaterial({
      color: PALETTE.honey,
      roughness: 0.6,
    });
    const brownMat = new THREE.MeshStandardMaterial({
      color: PALETTE.brown,
      roughness: 0.7,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: "#f5efe2",
      roughness: 0.5,
    });
    const shelfMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: shelfWoodTex,
      roughness: 0.62,
    });
    // 書架背板：換上書脊色票後讀起來是「塞滿書」的暗深度（圖一書牆）
    const shelfBackMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: shelfBackTex,
      roughness: 0.95,
      metalness: 0,
    });
    const initialPaperTexture = canvasTexture(640, 400, (c, w, h) => drawDeskPreview(c, w, h, objects, cards));
    paperTextureRef.current = initialPaperTexture;
    const paperMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: initialPaperTexture,
      roughness: 0.92,
    });
    disposers.push(() => {
      wallMat.dispose();
      ceilMat.dispose();
      floorMat.dispose();
      deskMat.dispose();
      honeyMat.dispose();
      brownMat.dispose();
      frameMat.dispose();
      shelfMat.dispose();
      shelfBackMat.dispose();
      paperMat.dispose();
      paperTextureRef.current?.dispose();
      paperTextureRef.current = null;
      paperRef.current = null;
    });

    // ---- v8.2 照片級 albedo：載入成功才換掉上面的程序化紋理，失敗靜默留原樣 ----
    const aniso = Math.min(8, api.renderer.capabilities.getMaxAnisotropy());
    const photo = (
      mat: THREE.MeshStandardMaterial,
      key: TextureKey,
      opts: Omit<AttachOptions, "anisotropy"> = {}
    ) => {
      disposers.push(attachPhotoMap(mat, key, { anisotropy: aniso, ...opts }));
    };
    photo(wallMat, "plaster", { repeat: TEXTURES.repeat.wall });
    photo(
      floorMat,
      floorIsMarble ? "marble" : "oak",
      floorIsMarble
        ? { repeat: TEXTURES.repeat.floorMarble, tint: "#f2f2ef" }
        : { repeat: TEXTURES.repeat.floorOak }
    );
    photo(deskMat, "marble", { repeat: TEXTURES.repeat.desk }); // 圖一：淺灰大理石桌板
    photo(shelfMat, "walnut", { repeat: TEXTURES.repeat.shelf }); // 圖一：深胡桃書架
    photo(shelfBackMat, "spines", {
      tileable: false,
      tint: "#8b7a68", // 壓暗成書架深處的低亮度
    });

    const W = ROOM.width;
    const D = ROOM.depth;
    const H = ROOM.height;
    const T = ROOM.wall;
    const wallZ = -D / 2; // 北牆外側
    const wallInnerZ = -D / 2 + T;

    // ---- 地板／天花 ----
    group.add(box(W + 0.48, 0.1, D + 0.48, floorMat, 0, -0.05, 0, { cast: false }));
    group.add(box(W + 0.48, 0.1, D + 0.48, ceilMat, 0, H + 0.05, 0, { receive: false }));

    // ---- 發光材質：天花燈槽＋書牆層板燈帶（圖一的暖色間接光） ----
    const coveMat = new THREE.MeshBasicMaterial({ color: "#ffdcae" });
    const ledMat = new THREE.MeshBasicMaterial({ color: "#ffcf96" });
    disposers.push(() => {
      coveMat.dispose();
      ledMat.dispose();
    });
    const coveY = H - 0.08;
    group.add(box(W - 0.5, 0.024, 0.05, coveMat, 0, coveY, D / 2 - 0.22, { cast: false, receive: false }));
    group.add(box(W - 0.5, 0.024, 0.05, coveMat, 0, coveY, -D / 2 + 0.22, { cast: false, receive: false }));
    group.add(box(0.05, 0.024, D - 0.5, coveMat, W / 2 - 0.22, coveY, 0, { cast: false, receive: false }));
    group.add(box(0.05, 0.024, D - 0.5, coveMat, -W / 2 + 0.22, coveY, 0, { cast: false, receive: false }));

    // ---- 南牆（背後）／西牆／東牆 ----
    group.add(box(W + 0.24, H, T, wallMat, 0, H / 2, D / 2 + T / 2));
    group.add(box(T, H, D + 0.24, wallMat, -W / 2 - T / 2, H / 2, 0));
    group.add(box(T, H, D + 0.24, wallMat, W / 2 + T / 2, H / 2, 0));

    // ---- 北牆（開窗洞：四段） ----
    const winL = WINDOW.cx - WINDOW.width / 2;
    const winR = WINDOW.cx + WINDOW.width / 2;
    const winH = WINDOW.top - WINDOW.sill;
    group.add(box(winL + W / 2 + T, H, T, wallMat, (-W / 2 - T + winL) / 2, H / 2, wallZ - T / 2));
    group.add(box(W / 2 + T - winR, H, T, wallMat, (winR + W / 2 + T) / 2, H / 2, wallZ - T / 2));
    group.add(box(WINDOW.width, WINDOW.sill, T, wallMat, WINDOW.cx, WINDOW.sill / 2, wallZ - T / 2));
    group.add(box(WINDOW.width, H - WINDOW.top, T, wallMat, WINDOW.cx, (H + WINDOW.top) / 2, wallZ - T / 2));

    // ---- 窗框／窗櫺／窗台／玻璃（實體投影 → 地板與桌面光斑影條） ----
    const f = WINDOW.frame;
    const winY0 = WINDOW.sill;
    const winY1 = WINDOW.top;
    const winMidY = (winY0 + winY1) / 2;
    const winZ = wallZ - T / 2; // 窗框置於牆中
    // 左右框
    group.add(box(f, winH, WINDOW.depth, frameMat, winL + f / 2, winY0 + winH / 2, winZ));
    group.add(box(f, winH, WINDOW.depth, frameMat, winR - f / 2, winY0 + winH / 2, winZ));
    // 上下框
    group.add(box(WINDOW.width, f, WINDOW.depth, frameMat, WINDOW.cx, winY1 - f / 2, winZ));
    group.add(box(WINDOW.width, f, WINDOW.depth, frameMat, WINDOW.cx, winY0 + f / 2, winZ));
    // 直向窗櫺（分 3 格）
    for (let i = 1; i <= WINDOW.mullions; i++) {
      const x = winL + (WINDOW.width / (WINDOW.mullions + 1)) * i;
      group.add(box(f * 0.72, winH - 2 * f, WINDOW.depth * 0.7, frameMat, x, winMidY, winZ));
    }
    // 橫向窗櫺
    for (let i = 1; i <= WINDOW.bars; i++) {
      const y = winY0 + (winH / (WINDOW.bars + 1)) * i;
      group.add(box(WINDOW.width - 2 * f, f * 0.72, WINDOW.depth * 0.7, frameMat, WINDOW.cx, y, winZ));
    }
    // 窗台（室內突出）
    group.add(box(WINDOW.width + 0.14, 0.035, WINDOW.depth + 0.12, frameMat, WINDOW.cx, winY0 - 0.017, wallInnerZ + 0.045));
    // 玻璃（不投影）
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.width - 2 * f, winH - 2 * f),
      new THREE.MeshStandardMaterial({
        color: "#dceef5",
        transparent: true,
        opacity: 0.07,
        roughness: 0.08,
        metalness: 0,
      })
    );
    glass.position.set(WINDOW.cx, winMidY, winZ);
    glass.castShadow = false;
    glass.receiveShadow = false;
    group.add(glass);
    disposers.push(() => glass.material.dispose());

    // ---- 白色半拉捲簾（圖一：簾布蓋住窗上段，柔化進光但不遮光） ----
    const blindH = winH * 0.45;
    const blindW = WINDOW.width - 2 * f - 0.02;
    const blindY = winY1 - f - blindH / 2;
    const blindMat = new THREE.MeshStandardMaterial({
      color: "#f6f2e8",
      roughness: 0.95,
      metalness: 0,
      emissive: new THREE.Color("#fff3d6"),
      emissiveIntensity: 0.14, // 背光簾面微微發亮
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });
    disposers.push(() => blindMat.dispose());
    group.add(box(blindW, blindH, 0.014, blindMat, WINDOW.cx, blindY, winZ + 0.12, { cast: false, receive: false }));
    group.add(box(blindW, 0.024, 0.032, brownMat, WINDOW.cx, blindY - blindH / 2, winZ + 0.128, { cast: false, receive: false }));

    // ---- 壁掛書桌（窗下、無桌腿、桌板有厚度） ----
    const deskZ = wallInnerZ + DESK.depth / 2;
    group.add(box(DESK.width, DESK.thickness, DESK.depth, deskMat, DESK.cx, DESK.top - DESK.thickness / 2, deskZ));
    // 前緣厚度條（蜂蜜木）
    group.add(box(DESK.width, 0.075, 0.03, honeyMat, DESK.cx, DESK.top - 0.0375, deskZ + DESK.depth / 2 + 0.015));
    // 牆面支撐角鋁（無桌腿壁掛）
    group.add(box(0.05, 0.1, 0.32, brownMat, DESK.cx - DESK.width / 2 + 0.32, DESK.top - DESK.thickness - 0.05, wallInnerZ + 0.17));
    group.add(box(0.05, 0.1, 0.32, brownMat, DESK.cx + DESK.width / 2 - 0.32, DESK.top - DESK.thickness - 0.05, wallInnerZ + 0.17));

    // ---- 桌面紙面（畫布載體；房間模式顯示預覽，可點擊進入工作視角） ----
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(DESK.width - 0.45, DESK.depth - 0.12),
      paperMat
    );
    paper.rotation.x = -Math.PI / 2;
    paper.position.set(DESK.cx, DESK.top + 0.001, deskZ);
    paper.castShadow = false;
    paper.receiveShadow = true;
    paper.userData.kind = "deskCanvas";
    group.add(paper);
    paperRef.current = paper;

    // ---- 書架本體（東牆；層板數依 shelfRows） ----
    const sx = SHELF.xBack;
    const sz = SHELF.z;
    const sw = SHELF.width;
    const sh = SHELF.height;
    const sd = SHELF.depth;
    group.add(box(0.03, sh, sw, shelfBackMat, sx - 0.015, SHELF.baseY + sh / 2, sz)); // 背板（書脊色票／深褐退回底）
    group.add(box(sd, sh, SHELF.side, shelfMat, sx - sd / 2, SHELF.baseY + sh / 2, sz - sw / 2 + SHELF.side / 2)); // 左側
    group.add(box(sd, sh, SHELF.side, shelfMat, sx - sd / 2, SHELF.baseY + sh / 2, sz + sw / 2 - SHELF.side / 2)); // 右側
    group.add(box(sd, 0.03, sw, shelfMat, sx - sd / 2, SHELF.baseY + sh - 0.015, sz)); // 頂板
    group.add(box(sd, 0.06, sw, brownMat, sx - sd / 2, SHELF.baseY + 0.03, sz)); // 底座
    for (let r = 0; r < shelfRows; r++) {
      const py = shelfPlankY(r, shelfRows);
      group.add(box(sd - 0.05, 0.026, SHELF.width - SHELF.side * 2 - 0.06, shelfMat, sx - sd / 2, py - 0.013, sz));
      // 層板下緣暖色燈帶（圖一書牆 LED；純發光片，不增加光源成本）
      group.add(
        box(0.014, 0.012, SHELF.width - SHELF.side * 2 - 0.22, ledMat, sx - sd - 0.004, py - 0.036, sz, {
          cast: false,
          receive: false,
        })
      );
    }

    // ---- 踢腳板（其餘三面＋北牆窗下段） ----
    const skirtMat = new THREE.MeshStandardMaterial({ color: "#e9dfcc", roughness: 0.85 });
    disposers.push(() => skirtMat.dispose());
    group.add(box(W, 0.09, 0.02, skirtMat, 0, 0.045, D / 2 - 0.01, { cast: false }));
    group.add(box(0.02, 0.09, D, skirtMat, -W / 2 + 0.01, 0.045, 0, { cast: false }));
    group.add(box(0.02, 0.09, D, skirtMat, W / 2 - 0.01, 0.045, 0, { cast: false }));
    group.add(box(WINDOW.width, 0.09, 0.02, skirtMat, WINDOW.cx, 0.045, wallInnerZ + 0.01, { cast: false }));

    return () => {
      disposers.forEach((d) => d());
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      api.scene.remove(group);
    };
    // objects/cards 變動不走此處（紙面貼圖由下方 effect 更新）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, shelfRows]);

  // ---- 桌面紙面預覽貼圖：畫布物件變動時 debounce 重畫 ----
  useEffect(() => {
    const t = window.setTimeout(() => {
      const mesh = paperRef.current;
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const tex = canvasTexture(640, 400, (c, w, h) =>
        drawDeskPreview(c, w, h, objects, cards)
      );
      const old = mat.map;
      mat.map = tex;
      paperTextureRef.current = tex;
      mat.needsUpdate = true;
      if (old) old.dispose();
    }, 250);
    return () => window.clearTimeout(t);
  }, [objects, cards]);

  return null;
};
