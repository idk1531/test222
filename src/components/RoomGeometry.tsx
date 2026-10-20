"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import type { CanvasObjectData } from "./InfiniteCanvas";
import type { CardData } from "./KnowledgeCardNode";
import {
  BLINDS,
  CABINET,
  CABINET_FOOTPRINT,
  DESK,
  DESK_FOOTPRINT,
  FIDELITY,
  LOOK,
  MARBLE_ROUGH,
  PALETTE,
  ROOM,
  SHELF,
  SHELF_INWARD,
  TEXTURES,
  WINDOW,
  shelfFrontX,
  shelfPlankCount,
  shelfPlankY,
  type TextureKey,
} from "@/lib/room3d";
import { attachPhotoMap, type AttachOptions } from "@/lib/roomTextures";

// ================= 程式化貼圖（canvas → CanvasTexture） =================

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { srgb?: boolean } = {}
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
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

/**
 * 深褐微水泥（書牆背牆退回底）。
 * 以中亮暖褐作底、再讓素材 color（#6b5647）乘上去；照片 albedo 載入時 tint 拉回近白。
 */
function drawMicrocement(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#cfc3b4");
  g.addColorStop(0.45, "#c3b6a6");
  g.addColorStop(1, "#bcae9d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const r = 6 + Math.random() * 46;
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(96,74,58,0.045)" : "rgba(255,246,232,0.05)";
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = `rgba(70,54,42,${0.03 + Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
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

/** 大理石板：淺灰底＋柔和灰紋＋1.2×1.2 m 大板縫（程序化退回底） */
function drawMarble(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#e7e6e2";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(150,150,146,${0.05 + Math.random() * 0.1})`;
    ctx.lineWidth = 0.6 + Math.random() * 2.2;
    ctx.beginPath();
    let x = Math.random() * w;
    let y = -10;
    ctx.moveTo(x, y);
    while (y < h + 10) {
      x += (Math.random() - 0.5) * 26;
      y += 8 + Math.random() * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "rgba(120,120,116,0.05)" : "rgba(255,255,255,0.08)";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6);
  }
  // 大板縫（假設貼圖對應 2.4×2.4 m → 一條中線＝1.2 m 板）
  ctx.fillStyle = "rgba(120,118,112,0.45)";
  ctx.fillRect(0, 0, w, 1.4);
  ctx.fillRect(w / 2, 0, 1.4, h);
}

/** 板下暖光暈：由上（亮）到下（透明）的垂直漸層 */
function drawWarmGlow(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,196,132,0.85)");
  g.addColorStop(0.35, "rgba(255,168,104,0.38)");
  g.addColorStop(1, "rgba(255,150,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
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
 * 房間幾何本體（v8.3「完全復刻圖一」）：
 * - 西牆深褐微水泥書牆：4 排懸浮薄層板（板下暖光暈＋LED 燈帶）、腰高長檯面、矮擱板
 * - 北牆大窗：白細框＋單中挺＋透光橫紋簾；窗台與桌板同一塊大理石（L 形連續檯面）
 * - 桌下落地深炭櫃（4 片門、縫 0.008）
 * - 天花燈槽＋2 個方形嵌燈、淺灰大理石地坪
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

    const W = ROOM.width;
    const D = ROOM.depth;
    const H = ROOM.height;
    const T = ROOM.wall;
    const wallZ = -D / 2; // 北牆外側
    const inward = SHELF_INWARD; // 西牆 +1（牆 → 室內）

    // ---- 貼圖（程序化為退回底，照片 albedo 非阻塞覆蓋） ----
    const wallTex = canvasTexture(256, 256, drawPlaster);
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(TEXTURES.repeat.wall[0], TEXTURES.repeat.wall[1]);
    disposers.push(() => wallTex.dispose());

    const westTex = canvasTexture(512, 512, drawMicrocement);
    westTex.wrapS = westTex.wrapT = THREE.RepeatWrapping;
    westTex.repeat.set(TEXTURES.repeat.microcement[0], TEXTURES.repeat.microcement[1]);
    disposers.push(() => westTex.dispose());

    const floorIsMarble = TEXTURES.floor === "marble";
    const floorTex = canvasTexture(512, 512, (c, w, h) =>
      floorIsMarble ? drawMarble(c, w, h) : drawFloorPlanks(c, w, h)
    );
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    const floorRepeat = floorIsMarble
      ? TEXTURES.repeat.floorMarble
      : TEXTURES.repeat.floorOak;
    floorTex.repeat.set(floorRepeat[0], floorRepeat[1]);
    disposers.push(() => floorTex.dispose());

    const plankTex = canvasTexture(256, 256, (c, w, h) =>
      drawWood(c, w, h, "#6e5c4a", "rgba(24,18,12,0.45)")
    );
    disposers.push(() => plankTex.dispose());

    const marbleTex = canvasTexture(512, 512, drawMarble);
    marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping;
    disposers.push(() => marbleTex.dispose());

    const glowTex = canvasTexture(64, 128, drawWarmGlow, { srgb: true });
    disposers.push(() => glowTex.dispose());

    // ---- 材質 ----
    const wallMat = new THREE.MeshStandardMaterial({
      color: LOOK.wall,
      map: wallTex,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.04, // 環境反射只留一點，避免牆面染上窗外綠色
    });
    // 書牆背牆：深褐微水泥（color 與程序化底相乘；照片 albedo 載入時 tint 拉回近白）
    const westMat = new THREE.MeshStandardMaterial({
      color: LOOK.shelfBack,
      map: westTex,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0.015,
    });
    const ceilMat = new THREE.MeshStandardMaterial({
      color: "#f4f0e8",
      roughness: 1,
      metalness: 0,
      // 天花交給環境光；不要自發光，否則整片會變成奶油綠。
      envMapIntensity: 0.015,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: floorIsMarble ? LOOK.floorTint : "#e8d7b8",
      map: floorTex,
      roughness: floorIsMarble ? MARBLE_ROUGH.floor : 0.72,
      metalness: floorIsMarble ? MARBLE_ROUGH.metalness : 0.02,
    });
    if (floorIsMarble) floorMat.envMapIntensity = 0.04;
    // 桌板／窗台／西牆回折段：同一塊大理石（圖一的 L 形連續檯面）
    const deskMat = new THREE.MeshStandardMaterial({
      color: LOOK.deskTint,
      map: marbleTex,
      roughness: MARBLE_ROUGH.desk,
      metalness: MARBLE_ROUGH.metalness,
      envMapIntensity: MARBLE_ROUGH.envIntensityDesk,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: "#b8b0a3",
      roughness: 0.5,
      envMapIntensity: 0.15,
    });
    // 附圖的層板是近黑胡桃木：albedo 淡木紋 × 深色 tint
    const plankMat = new THREE.MeshStandardMaterial({
      color: LOOK.shelfWood,
      map: plankTex,
      roughness: 0.52,
      metalness: 0.03,
    });
    // 書牆背板：打光的古銅色石材（附圖層板後方那一面被 LED 洗亮的牆）。
    const shelfBackMat = new THREE.MeshStandardMaterial({
      color: LOOK.shelfBack,
      map: marbleTex,
      roughness: 0.8,
      metalness: 0,
      emissive: new THREE.Color("#6a3f1c"),
      emissiveIntensity: 0.3,
    });
    const charcoalMat = new THREE.MeshStandardMaterial({
      color: LOOK.cabinet,
      roughness: 0.66,
      envMapIntensity: 0.22,
    });
    const doorMat = new THREE.MeshStandardMaterial({ color: LOOK.cabinetDoor, roughness: 0.6, envMapIntensity: 0.2 });
    const darkBarMat = new THREE.MeshStandardMaterial({ color: "#2b2b2b", roughness: 0.6 });
    // 腰高長檯面：附圖是深色石材板（不是大理石），只有窗側檯面是淺灰石。
    const ledgeTopMat = new THREE.MeshStandardMaterial({
      color: LOOK.ledge,
      map: plankTex,
      roughness: 0.34,
      metalness: 0.08,
      envMapIntensity: 0.4,
    });
    const initialPaperTexture = canvasTexture(640, 400, (c, w, h) =>
      drawDeskPreview(c, w, h, objects, cards)
    );
    paperTextureRef.current = initialPaperTexture;
    const paperMat = new THREE.MeshStandardMaterial({
      color: "#efe6d6",
      map: initialPaperTexture,
      roughness: 0.95,
    });
    disposers.push(() => {
      wallMat.dispose();
      westMat.dispose();
      ceilMat.dispose();
      floorMat.dispose();
      deskMat.dispose();
      frameMat.dispose();
      plankMat.dispose();
      charcoalMat.dispose();
      doorMat.dispose();
      darkBarMat.dispose();
      paperMat.dispose();
      shelfBackMat.dispose();
      ledgeTopMat.dispose();
      paperTextureRef.current?.dispose();
      paperTextureRef.current = null;
      paperRef.current = null;
    });

    // ---- v8.3 照片級 albedo（失敗靜默留程序化版本） ----
    const aniso = Math.min(8, api.renderer.capabilities.getMaxAnisotropy());
    const photo = (
      mat: THREE.MeshStandardMaterial,
      key: TextureKey,
      opts: Omit<AttachOptions, "anisotropy"> = {}
    ) => {
      disposers.push(attachPhotoMap(mat, key, { anisotropy: aniso, ...opts }));
    };
    photo(wallMat, "plaster", { repeat: TEXTURES.repeat.wall, tint: LOOK.wallTint });
    photo(westMat, "microcement", {
      repeat: TEXTURES.repeat.microcement,
      tint: "#cbb49b", // 微水泥 albedo 已是深褐，牆面只需微微提亮
    });
    photo(shelfBackMat, "marble", {
      repeat: [2.6, 1.2],
      tint: LOOK.shelfBackTint, // 背板要亮：照片 albedo × 近白 tint
    });
    photo(
      floorMat,
      floorIsMarble ? "marble" : "oak",
      floorIsMarble
        ? { repeat: TEXTURES.repeat.floorMarble, tint: LOOK.floorTint }
        : { repeat: TEXTURES.repeat.floorOak }
    );
    photo(deskMat, "marble", { repeat: TEXTURES.repeat.desk, tint: LOOK.deskTint });
    photo(plankMat, "walnut", { repeat: TEXTURES.repeat.shelf, tint: LOOK.shelfWoodTint });

    // ---- 地板／天花 ----
    group.add(box(W + 0.48, 0.1, D + 0.48, floorMat, 0, -0.05, 0, { cast: false }));
    // 附圖：淺暖白平頂天花＋沿牆一圈窄燈槽＋兩個方形嵌燈。
    // v8.6 不再做 16 cm 深的大面積上凹（實際預覽會出現突兀的白色斜帶）。
    const ceilingOpts = { cast: false, receive: false } as const;
    group.add(box(W + 0.4, 0.08, D + 0.4, ceilMat, 0, H + 0.04, 0, ceilingOpts));
    // 牆頂收邊的細陰影線，讓平頂與牆面有交界（不是一整片發光）。
    const shadowGapMat = new THREE.MeshStandardMaterial({ color: "#8b8378", roughness: 1 });
    disposers.push(() => shadowGapMat.dispose());
    for (const side of [-1, 1]) {
      group.add(box(W + 0.2, 0.012, 0.012, shadowGapMat, 0, H - 0.006, side * (D / 2 - 0.006), { cast: false, receive: false }));
      group.add(box(0.012, 0.012, D + 0.2, shadowGapMat, side * (W / 2 - 0.006), H - 0.006, 0, { cast: false, receive: false }));
    }

    // ---- 發光材質：天花燈槽＋層板燈帶 ----
    const coveMat = new THREE.MeshBasicMaterial({ color: "#ffddb2" });
    const ledMat = new THREE.MeshBasicMaterial({ color: LOOK.ledSoft, toneMapped: false });
    const lampMat = new THREE.MeshBasicMaterial({ color: LOOK.ledSoft, toneMapped: false });
    disposers.push(() => {
      coveMat.dispose();
      ledMat.dispose();
      lampMat.dispose();
    });
    // 燈槽：貼著牆頂、距牆 9 cm 的連續暖光，從下方只看到一條細亮線。
    const coveY = H - 0.016;
    const coveInset = 0.09;
    group.add(box(W - 2 * coveInset, 0.008, 0.022, coveMat, 0, coveY, -D / 2 + coveInset, { cast: false, receive: false }));
    group.add(box(W - 2 * coveInset, 0.008, 0.022, coveMat, 0, coveY, D / 2 - coveInset, { cast: false, receive: false }));
    group.add(box(0.022, 0.008, D - 2 * coveInset, coveMat, W / 2 - coveInset, coveY, 0, { cast: false, receive: false }));
    group.add(box(0.022, 0.008, D - 2 * coveInset, coveMat, -W / 2 + coveInset, coveY, 0, { cast: false, receive: false }));

    // 2 個方形嵌燈（靠北窗側），深色外框＋暖白發光面
    const lampMatBlack = new THREE.MeshStandardMaterial({ color: "#2a2621", roughness: 0.75 });
    disposers.push(() => lampMatBlack.dispose());
    for (const [lx, lz] of [
      [0.55, -0.75],
      [-0.55, 1.15],
    ] as const) {
      group.add(box(0.13, 0.014, 0.13, lampMatBlack, lx, H - 0.007, lz, { cast: false }));
      group.add(box(0.085, 0.006, 0.085, lampMat, lx, H - 0.016, lz, { cast: false, receive: false }));
    }

    // ---- 牆體 ----
    group.add(box(W + 0.24, H, T, wallMat, 0, H / 2, D / 2 + T / 2)); // 南
    group.add(box(T, H, D + 0.24, wallMat, W / 2 + T / 2, H / 2, 0)); // 東
    // 西牆：微水泥加厚 0.28（外緣仍在 −3.12），內面正好落在 SHELF.xBack，
    // 懸浮層板才是真的「貼牆」（v8.2 背板與牆之間其實有 16 cm 空腔）。
    const westFace = SHELF.xBack; // −2.84（牆內面）
    const westThickness = W / 2 + T - Math.abs(westFace); // 0.28（外緣仍在 −3.12）
    group.add(
      box(westThickness, H, D + 0.24, westMat, westFace - westThickness / 2, H / 2, 0)
    );

    // ---- 北牆（開窗洞：四段） ----
    const winL = WINDOW.cx - WINDOW.width / 2;
    const winR = WINDOW.cx + WINDOW.width / 2;
    const winH = WINDOW.top - WINDOW.sill;
    group.add(box(winL + W / 2 + T, H, T, wallMat, (-W / 2 - T + winL) / 2, H / 2, wallZ - T / 2));
    group.add(box(W / 2 + T - winR, H, T, wallMat, (winR + W / 2 + T) / 2, H / 2, wallZ - T / 2));
    group.add(box(WINDOW.width, WINDOW.sill, T, wallMat, WINDOW.cx, WINDOW.sill / 2, wallZ - T / 2));
    group.add(box(WINDOW.width, H - WINDOW.top, T, wallMat, WINDOW.cx, (H + WINDOW.top) / 2, wallZ - T / 2));

    // ---- 窗框／單中挺／大理石窗台／玻璃 ----
    const f = WINDOW.frame;
    const winY0 = WINDOW.sill;
    const winY1 = WINDOW.top;
    const winMidY = (winY0 + winY1) / 2;
    const winZ = wallZ - T / 2;
    group.add(box(f, winH, WINDOW.depth, frameMat, winL + f / 2, winY0 + winH / 2, winZ));
    group.add(box(f, winH, WINDOW.depth, frameMat, winR - f / 2, winY0 + winH / 2, winZ));
    group.add(box(WINDOW.width, f, WINDOW.depth, frameMat, WINDOW.cx, winY1 - f / 2, winZ));
    group.add(box(WINDOW.width, f, WINDOW.depth, frameMat, WINDOW.cx, winY0 + f / 2, winZ));
    for (let i = 1; i <= WINDOW.mullions; i++) {
      const x = winL + (WINDOW.width / (WINDOW.mullions + 1)) * i;
      group.add(box(f * 0.72, winH - 2 * f, WINDOW.depth * 0.7, frameMat, x, winMidY, winZ));
    }
    for (let i = 1; i <= WINDOW.bars; i++) {
      const y = winY0 + (winH / (WINDOW.bars + 1)) * i;
      group.add(box(WINDOW.width - 2 * f, f * 0.72, WINDOW.depth * 0.7, frameMat, WINDOW.cx, y, winZ));
    }
    // 窗台＝大理石（與桌板同材質；自桌面 0.78 墊到窗台頂 0.90）
    const sillOut = WINDOW.sillThickness;
    group.add(
      box(
        WINDOW.width + 0.02,
        sillOut,
        WINDOW.sillDepth,
        deskMat,
        WINDOW.cx,
        winY0 - sillOut / 2,
        wallZ + WINDOW.sillDepth / 2
      )
    );
    // 玻璃（近透明；窗景 skyMat 近過曝拉開對比）
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(WINDOW.width - 2 * f, winH - 2 * f),
      new THREE.MeshStandardMaterial({
        color: "#dceef5",
        transparent: true,
        opacity: 0.04,
        roughness: 0.08,
        metalness: 0,
        depthWrite: false,
      })
    );
    glass.position.set(WINDOW.cx, winMidY, winZ);
    glass.castShadow = false;
    glass.receiveShadow = false;
    group.add(glass);
    disposers.push(() => glass.material.dispose());

    // ---- 橫向百葉（附圖：上段遮光、下段透空；每片都是實體薄板，會投出條狀柔影） ----
    const blindH = winH * BLINDS.cover;
    const blindW = WINDOW.width - 2 * f - 0.02;
    const blindTop = winY1 - f;
    const blindBottom = blindTop - blindH;
    const slatMat = new THREE.MeshStandardMaterial({
      color: BLINDS.color,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.94, // 半透光：窗外綠意會從簾片間透出來（附圖的柔亮百葉）
      emissive: new THREE.Color("#fff3dd"),
      emissiveIntensity: 0.04,
      side: THREE.DoubleSide,
    });
    const bladeMat = new THREE.MeshStandardMaterial({
      color: "#efe9dc",
      roughness: 0.85,
      emissive: new THREE.Color("#fff6e6"),
      emissiveIntensity: 0.16,
    });
    disposers.push(() => {
      slatMat.dispose();
      bladeMat.dispose();
    });
    // 簾片：一片一片的薄板（桌機 22 片、手機 14 片），比 alphaMap 更接近附圖的立體感。
    const blindGroup = new THREE.Group();
    blindGroup.name = "window-blinds";
    const slatCount = Math.max(10, Math.floor(blindH / BLINDS.slatPitch));
    const slatStep = blindH / slatCount;
    const slatGeometry = new THREE.BoxGeometry(blindW, BLINDS.slatThickness, BLINDS.slatDepth);
    const slatTilt = THREE.MathUtils.degToRad(BLINDS.tiltDeg);
    for (let i = 0; i < slatCount; i++) {
      const slat = new THREE.Mesh(slatGeometry, slatMat);
      slat.position.set(WINDOW.cx, blindBottom + slatStep * (i + 0.5), winZ + 0.12);
      slat.rotation.x = slatTilt;
      slat.castShadow = true;
      slat.receiveShadow = false;
      blindGroup.add(slat);
    }
    // 每 6 片加深一條細橫線：遠看就是附圖百葉的節奏（不額外增加 draw call）
    const lineMat = new THREE.MeshStandardMaterial({ color: BLINDS.cordColor, roughness: 0.9 });
    disposers.push(() => lineMat.dispose());
    const lineGeometry = new THREE.BoxGeometry(blindW, 0.004, 0.002);
    for (let i = BLINDS.cordEvery; i < slatCount; i += BLINDS.cordEvery) {
      const line = new THREE.Mesh(lineGeometry, lineMat);
      line.position.set(WINDOW.cx, blindBottom + slatStep * i, winZ + 0.152);
      blindGroup.add(line);
    }
    disposers.push(() => lineGeometry.dispose());
    // 三條垂直拉繩（穿過簾片）
    const cordGeometry = new THREE.BoxGeometry(0.004, blindH, 0.004);
    disposers.push(() => cordGeometry.dispose());
    for (const k of [-0.32, 0, 0.32]) {
      const cord = new THREE.Mesh(cordGeometry, lineMat);
      cord.position.set(WINDOW.cx + k * blindW, blindBottom + blindH / 2, winZ + 0.15);
      blindGroup.add(cord);
    }
    // 兩側垂直導軌＋簾片支撐線
    for (const side of [-1, 1]) {
      const guide = box(0.012, blindH, 0.03, bladeMat, WINDOW.cx + side * (blindW / 2 - 0.006), blindBottom + blindH / 2, winZ + 0.135, { cast: false, receive: false });
      blindGroup.add(guide);
    }
    // 簾底深色底桿（附圖最明顯的水平深色線）
    const railMat = new THREE.MeshStandardMaterial({ color: LOOK.valance, roughness: 0.5, metalness: 0.15 });
    disposers.push(() => railMat.dispose());
    blindGroup.add(
      box(blindW + 0.03, BLINDS.railHeight, 0.06, railMat, WINDOW.cx, blindBottom - BLINDS.railHeight / 2, winZ + 0.13, {
        cast: true,
        receive: false,
      })
    );
    // 簾盒（附圖窗頂深色橫帶）＋ 天花側收邊
    blindGroup.add(
      box(WINDOW.width + 0.08, 0.11, 0.2, railMat, WINDOW.cx, winY1 + 0.055, winZ + 0.14, {
        cast: true,
        receive: false,
      })
    );
    group.add(blindGroup);
    disposers.push(() => slatGeometry.dispose());
    if (FIDELITY.blind === "cloth") {
      // 退回 v8.2 的不透明布簾（同一位置整片蓋住）
      const cloth = new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 1 });
      disposers.push(() => cloth.dispose());
      blindGroup.visible = false;
      group.add(
        box(blindW, blindH, 0.014, cloth, WINDOW.cx, blindBottom + blindH / 2, winZ + 0.12, {
          cast: false,
          receive: false,
        })
      );
    }

    // ---- L 形大理石檯面（沿窗 3.4 m ＋ 東側延伸 0.8 m ＋ 沿西牆回折 1.7 m） ----
    const [mainDeskFootprint, sideDeskFootprint] = DESK_FOOTPRINT;
    const deskZ = (mainDeskFootprint.minZ + mainDeskFootprint.maxZ) / 2;
    const deskX0 = mainDeskFootprint.minX;
    const deskX1 = mainDeskFootprint.maxX;
    const mainDeskTop = box(deskX1 - deskX0, DESK.thickness, mainDeskFootprint.maxZ - mainDeskFootprint.minZ, deskMat, (deskX0 + deskX1) / 2, DESK.top - DESK.thickness / 2, deskZ);
    mainDeskTop.userData.kind = "deskSurface";
    group.add(mainDeskTop);
    // 沿西牆回折段：與沿窗段在桌面「對接」而非重疊（避免共面 z-fighting），
    // 兩段合計沿西牆 1.70 m（DESK.depth + 1.02）
    const sideZ0 = sideDeskFootprint.minZ;
    const sideZ1 = sideDeskFootprint.maxZ;
    const sideDeskTop = box(
      sideDeskFootprint.maxX - sideDeskFootprint.minX,
      DESK.thickness,
      sideZ1 - sideZ0,
      ledgeTopMat,
      (sideDeskFootprint.minX + sideDeskFootprint.maxX) / 2,
      DESK.top - DESK.thickness / 2,
      (sideZ0 + sideZ1) / 2
    );
    sideDeskTop.userData.kind = "deskSurface";
    group.add(sideDeskTop);
    // 附圖的檯面是厚石板的視覺：前緣加一條 7 cm 垂直封邊（同大理石），避免看起來像薄片。
    group.add(
      box(
        deskX1 - deskX0,
        0.1,
        0.03,
        deskMat,
        (deskX0 + deskX1) / 2,
        DESK.top - DESK.thickness - 0.05,
        mainDeskFootprint.maxZ - 0.015,
        { cast: true }
      )
    );
    group.add(
      box(
        0.03,
        0.1,
        sideZ1 - sideZ0,
        deskMat,
        sideDeskFootprint.maxX - 0.015,
        DESK.top - DESK.thickness - 0.05,
        (sideZ0 + sideZ1) / 2,
        { cast: true }
      )
    );

    // ---- 桌下落地深炭櫃（北側 4 門＋西側 2 門） ----
    const cabH = CABINET.height;
    const [mainCabinetFootprint, sideCabinetFootprint] = CABINET_FOOTPRINT;
    const cabZ0 = mainCabinetFootprint.minZ;
    const cabZ1 = mainCabinetFootprint.maxZ;
    // 北向櫃自「西側回折櫃的東面」起，兩組櫃在轉角對接不互相穿插。
    // Footprint 來自 room3d.ts，幾何與玩家碰撞共用此真相。
    const sideCabX0 = sideCabinetFootprint.minX;
    const sideCabX1 = sideCabinetFootprint.maxX;
    const cabX0 = mainCabinetFootprint.minX;
    const cabX1 = mainCabinetFootprint.maxX;
    group.add(
      box(cabX1 - cabX0, cabH, CABINET.depth, charcoalMat, (cabX0 + cabX1) / 2, cabH / 2, (cabZ0 + cabZ1) / 2)
    );
    const doorW = (cabX1 - cabX0 - CABINET.gap * (CABINET.doors + 1)) / CABINET.doors;
    // 櫃門縫：每片門以細縫分離，並在門板下緣留一道反光線（附圖的深色櫃體細節）
    const gapMat = new THREE.MeshStandardMaterial({ color: "#191a19", roughness: 0.9 });
    const kickMat = new THREE.MeshStandardMaterial({ color: "#26251f", roughness: 0.8 });
    disposers.push(() => {
      gapMat.dispose();
      kickMat.dispose();
    });
    for (let i = 0; i < CABINET.doors; i++) {
      const dx = cabX0 + CABINET.gap + doorW / 2 + i * (doorW + CABINET.gap);
      group.add(box(doorW, cabH - 0.02, 0.018, doorMat, dx, cabH / 2, cabZ1 + 0.009));
      group.add(box(0.01, cabH - 0.03, 0.022, gapMat, dx + doorW / 2 + CABINET.gap / 2, cabH / 2, cabZ1 + 0.011, { cast: false }));
    }
    group.add(box(cabX1 - cabX0, 0.055, 0.03, kickMat, (cabX0 + cabX1) / 2, 0.028, cabZ1 + 0.012, { cast: false }));
    // 西側回折段下的櫃體（2 門；比桌板內縮 0.08，南端對齊北向櫃前緣）
    const sideCabZ0 = sideCabinetFootprint.minZ;
    const sideCabZ1 = sideCabinetFootprint.maxZ;
    group.add(
      box(sideCabX1 - sideCabX0, cabH, sideCabZ1 - sideCabZ0, charcoalMat, (sideCabX0 + sideCabX1) / 2, cabH / 2, (sideCabZ0 + sideCabZ1) / 2)
    );
    const sideDoors = 2;
    const sdW = (sideCabZ1 - sideCabZ0 - CABINET.gap * (sideDoors + 1)) / sideDoors;
    for (let i = 0; i < sideDoors; i++) {
      const dz = sideCabZ0 + CABINET.gap + sdW / 2 + i * (sdW + CABINET.gap);
      group.add(box(0.018, cabH - 0.02, sdW, doorMat, sideCabX1 + 0.009, cabH / 2, dz));
    }

    // ---- 桌面紙面（畫布載體；房間模式顯示預覽，可點擊進入工作視角） ----
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, DESK.depth - 0.26),
      paperMat
    );
    paper.rotation.x = -Math.PI / 2;
    // 紙面靠桌左半（閃開窗台大理石與右側的筆電／小物／盆栽）
    paper.position.set(-1.35, DESK.top + 0.001, deskZ + 0.03);
    paper.castShadow = false;
    paper.receiveShadow = true;
    paper.userData.kind = "deskCanvas";
    group.add(paper);
    paperRef.current = paper;

    // ---- 附圖的地毯：椅子與書桌前一塊淺米色地毯（不參與 raycast） ----
    {
      const rugW = 2.55;
      const rugD = 1.85;
      const rugTex = canvasTexture(256, 192, (c, w, h) => {
        c.fillStyle = "#b3a793";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 3600; i++) {
          c.fillStyle = Math.random() > 0.5 ? "rgba(255,250,240,0.05)" : "rgba(74,58,40,0.08)";
          c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        c.strokeStyle = "rgba(92,76,56,0.35)";
        c.lineWidth = 3;
        c.strokeRect(8, 8, w - 16, h - 16);
      });
      const rugMat = new THREE.MeshStandardMaterial({
        map: rugTex,
        color: "#e0d4c0",
        roughness: 0.99,
        metalness: 0,
      });
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(rugW, rugD), rugMat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0.05, 0.008, 0.6);
      rug.receiveShadow = true;
      rug.castShadow = false;
      group.add(rug);
      disposers.push(() => {
        rugTex.dispose();
        rugMat.dispose();
      });
    }

    // ---- 西牆書牆：懸浮薄層板（無側板／頂板／底座） ----
    const sx = SHELF.xBack;
    const planks = shelfPlankCount(shelfRows);
    const plankLen = SHELF.width;
    const plankCx = sx + inward * (SHELF.depth / 2);
    const plankFront = shelfFrontX();
    for (let r = 0; r < planks; r++) {
      const py = shelfPlankY(r, planks);
      // 薄層板：深 0.28 × 厚 0.035 × 長 3.6
      group.add(
        box(SHELF.depth, SHELF.plank, plankLen, plankMat, plankCx, py - SHELF.plank / 2, SHELF.z)
      );
      // 板底全長暖色 LED（0.018 高）
      group.add(
        box(
          0.012,
          0.018,
          plankLen - 0.08,
          ledMat,
          plankFront - inward * 0.012,
          py - SHELF.plank - 0.009,
          SHELF.z,
          { cast: false, receive: false }
        )
      );
      // 板下暖光暈（貼在背牆上，0.28 m 高）
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(plankLen - 0.06, 0.34),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
      );
      glow.rotation.y = inward * (Math.PI / 2); // 面朝室內
      // 退到木作背板前 1 cm，避免與背板 z-fighting。
      glow.position.set(SHELF.xBack + inward * 0.024, py - SHELF.plank - 0.17, SHELF.z);
      glow.castShadow = false;
      glow.receiveShadow = false;
      group.add(glow);
      disposers.push(() => {
        (glow.material as THREE.Material).dispose();
      });
    }

    // ---- 書牆木作框架（附圖：頂封板＋兩端立板＋深色背板，整面像一體成形的木作） ----
    const frameThickness = 0.045;
    const frameDepth = SHELF.depth + 0.02;
    const plankTop = shelfPlankY(0, planks);
    // 頂封板拉到天花下方 3.5 cm；最上層書（22–26 cm）剛好收在封板下。
    const frameTop = Math.min(ROOM.height - 0.035, plankTop + 0.14);
    // 打光的石材背板：附圖層板之間是「被 LED 洗亮的石牆」，不是黑木。
    group.add(
      box(
        0.014,
        frameTop,
        SHELF.width,
        shelfBackMat,
        sx + inward * 0.007,
        frameTop / 2,
        SHELF.z,
        { cast: false }
      )
    );
    group.add(
      box(
        frameDepth,
        Math.max(0.06, frameTop - plankTop),
        SHELF.width,
        plankMat,
        sx + inward * (frameDepth / 2),
        (plankTop + frameTop) / 2,
        SHELF.z,
        { cast: true }
      )
    );
    // 兩端立板落地：v8.5 只做到 1.18 m，書牆看起來像懸空層板架。
    for (const zEnd of [SHELF.z - SHELF.width / 2, SHELF.z + SHELF.width / 2 - frameThickness]) {
      group.add(
        box(
          frameDepth,
          frameTop,
          frameThickness,
          plankMat,
          sx + inward * (frameDepth / 2),
          frameTop / 2,
          zEnd + frameThickness / 2,
          { cast: true }
        )
      );
    }
    // 頂封板下方的暖色洗牆燈條（附圖天花與書牆交界的柔光）
    group.add(
      box(
        0.014,
        0.02,
        SHELF.width - 0.12,
        ledMat,
        sx + inward * (frameDepth - 0.02),
        frameTop - 0.035,
        SHELF.z,
        { cast: false, receive: false }
      )
    );

    // ---- 腰高長檯面＋檯面下矮擱板（圖一左牆下半） ----
    if (FIDELITY.ledge) {
      const L = SHELF.ledge;
      group.add(
        box(
          L.depth,
          L.thickness,
          L.z1 - L.z0,
          ledgeTopMat,
          sx + inward * (L.depth / 2),
          L.top - L.thickness / 2,
          (L.z0 + L.z1) / 2
        )
      );
      // 檯面前緣的近黑木作收邊（附圖的長檯面是石材板＋深色木封邊）
      group.add(
        box(
          0.02,
          L.thickness,
          L.z1 - L.z0,
          plankMat,
          sx + inward * (L.depth - 0.01),
          L.top - L.thickness / 2,
          (L.z0 + L.z1) / 2
        )
      );
      // 檯面下洗牆燈帶（附圖最亮的一條水平光）
      group.add(
        box(
          0.012,
          0.02,
          L.z1 - L.z0 - 0.12,
          ledMat,
          sx + inward * (L.depth - 0.03),
          L.top - L.thickness - 0.012,
          (L.z0 + L.z1) / 2,
          { cast: false, receive: false }
        )
      );
      // 與沿西牆 L 形檯面（0.78）之間的 14 cm 立面：同一塊大理石，讀成連續檯面的一階
      group.add(
        box(
          L.depth,
          L.top - DESK.top,
          0.04,
          deskMat,
          sx + inward * (L.depth / 2),
          DESK.top + (L.top - DESK.top) / 2,
          L.z0 + 0.02
        )
      );
      const S = SHELF.lowShelf;
      group.add(
        box(
          S.depth,
          S.thickness,
          S.z1 - S.z0,
          plankMat,
          sx + inward * (S.depth / 2),
          S.top - S.thickness / 2,
          (S.z0 + S.z1) / 2
        )
      );
      // 矮擱板下的落地書堆底板
      group.add(
        box(
          S.depth - 0.04,
          0.02,
          S.z1 - S.z0 - 0.1,
          plankMat,
          sx + inward * ((S.depth - 0.04) / 2),
          0.01,
          (S.z0 + S.z1) / 2
        )
      );
    }

    // ---- 踢腳板（南／東／北窗下；西牆書牆不做踢腳） ----
    const skirtMat = new THREE.MeshStandardMaterial({ color: "#e9dfcc", roughness: 0.85 });
    disposers.push(() => skirtMat.dispose());
    group.add(box(W, 0.09, 0.02, skirtMat, 0, 0.045, D / 2 - 0.01, { cast: false }));
    group.add(box(0.02, 0.09, D, skirtMat, W / 2 - 0.01, 0.045, 0, { cast: false }));

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
