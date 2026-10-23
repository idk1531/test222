"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { NESTED_CITY, ROOM, type CityFrame, type CityMaterial, type CityRamp } from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

const SLAB_THICKNESS = 0.3;
const RAMP_THICKNESS = 0.22;
const LOCAL_Z = new THREE.Vector3(0, 0, 1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);

function makeBox(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  castShadow = true
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.kind = "nestedCityStructure";
  return mesh;
}

function addFrame(group: THREE.Group, frame: CityFrame, material: THREE.Material) {
  const frameGroup = new THREE.Group();
  frameGroup.name = `nested-city-frame:${frame.id}`;
  frameGroup.position.set(frame.x, 0, frame.z);
  frameGroup.rotation.y = frame.rotationY;
  group.add(frameGroup);

  const yMid = frame.bottom + (frame.height - frame.beamHeight) / 2;
  const postHeight = frame.height - frame.beamHeight;
  const topY = frame.bottom + frame.height - frame.beamHeight / 2;
  const addLocal = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    frameGroup.add(makeBox(w, h, d, material, x, y, z));
  };

  if (frame.plane === "x") {
    for (const side of [-1, 1]) {
      addLocal(frame.thickness, postHeight, frame.thickness, side * frame.width / 2, yMid, 0);
    }
    addLocal(frame.width, frame.beamHeight, frame.thickness, 0, topY, 0);
    for (const band of frame.bands ?? []) {
      addLocal(frame.width, frame.beamHeight * 0.72, frame.thickness, 0, frame.bottom + band, 0);
    }
  } else if (frame.plane === "z") {
    for (const side of [-1, 1]) {
      addLocal(frame.thickness, postHeight, frame.thickness, 0, yMid, side * frame.width / 2);
    }
    addLocal(frame.thickness, frame.beamHeight, frame.width, 0, topY, 0);
    for (const band of frame.bands ?? []) {
      addLocal(frame.thickness, frame.beamHeight * 0.72, frame.width, 0, frame.bottom + band, 0);
    }
  } else {
    const depth = frame.depth ?? frame.width;
    for (const xSide of [-1, 1]) {
      for (const zSide of [-1, 1]) {
        addLocal(frame.thickness, postHeight, frame.thickness, xSide * frame.width / 2, yMid, zSide * depth / 2);
      }
    }
    addLocal(frame.width, frame.beamHeight, frame.thickness, 0, topY, -depth / 2);
    addLocal(frame.width, frame.beamHeight, frame.thickness, 0, topY, depth / 2);
    addLocal(frame.thickness, frame.beamHeight, depth, -frame.width / 2, topY, 0);
    addLocal(frame.thickness, frame.beamHeight, depth, frame.width / 2, topY, 0);
    for (const band of frame.bands ?? []) {
      const bandY = frame.bottom + band;
      addLocal(frame.width, frame.beamHeight * 0.58, frame.thickness, 0, bandY, -depth / 2);
      addLocal(frame.width, frame.beamHeight * 0.58, frame.thickness, 0, bandY, depth / 2);
      addLocal(frame.thickness, frame.beamHeight * 0.58, depth, -frame.width / 2, bandY, 0);
      addLocal(frame.thickness, frame.beamHeight * 0.58, depth, frame.width / 2, bandY, 0);
    }
  }
}

function rampQuaternion(ramp: CityRamp): THREE.Quaternion {
  const direction = new THREE.Vector3(
    ramp.end.x - ramp.start.x,
    ramp.end.y - ramp.start.y,
    ramp.end.z - ramp.start.z
  ).normalize();
  return new THREE.Quaternion().setFromUnitVectors(LOCAL_Z, direction);
}

function addBeamBetween(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  width: number,
  height: number,
  material: THREE.Material
) {
  const direction = to.clone().sub(from);
  const length = direction.length();
  if (length <= 1e-4) return;
  const mesh = makeBox(width, height, length, material, 0, 0, 0);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(LOCAL_Z, direction.normalize());
  group.add(mesh);
}

function addRamp(group: THREE.Group, ramp: CityRamp, materials: Record<CityMaterial, THREE.Material>, railMat: THREE.Material, treadMat: THREE.Material) {
  const start = new THREE.Vector3(ramp.start.x, ramp.start.y, ramp.start.z);
  const end = new THREE.Vector3(ramp.end.x, ramp.end.y, ramp.end.z);
  const delta = end.clone().sub(start);
  const length = delta.length();
  const quaternion = rampQuaternion(ramp);
  const normal = LOCAL_UP.clone().applyQuaternion(quaternion).normalize();
  const center = start.clone().add(end).multiplyScalar(0.5).addScaledVector(normal, -RAMP_THICKNESS / 2);
  const slab = makeBox(ramp.width, RAMP_THICKNESS, length, materials[ramp.material], center.x, center.y, center.z);
  slab.name = `nested-city-ramp:${ramp.id}`;
  slab.quaternion.copy(quaternion);
  group.add(slab);

  // 橫向淺刻線讓斜坡讀成可走的石階／木階；角色仍沿連續斜面行走。
  const treads = Math.max(12, Math.floor(length / 0.42));
  for (let i = 1; i < treads; i++) {
    const t = i / treads;
    const point = start.clone().lerp(end, t).addScaledVector(normal, 0.018);
    const tread = makeBox(ramp.width - 0.22, 0.035, 0.055, treadMat, point.x, point.y, point.z, false);
    tread.quaternion.copy(quaternion);
    group.add(tread);
  }

  const horizontalLength = Math.hypot(ramp.end.x - ramp.start.x, ramp.end.z - ramp.start.z);
  const sideX = -(ramp.end.z - ramp.start.z) / horizontalLength;
  const sideZ = (ramp.end.x - ramp.start.x) / horizontalLength;
  for (const side of [-1, 1]) {
    const offset = (ramp.width / 2 - 0.07) * side;
    const insetT = Math.min(0.35, NESTED_CITY.rampRailInset / horizontalLength);
    const railStartT = insetT;
    const railEndT = 1 - insetT;
    const railStart = new THREE.Vector3(
      ramp.start.x + (ramp.end.x - ramp.start.x) * railStartT + sideX * offset,
      ramp.start.y + (ramp.end.y - ramp.start.y) * railStartT + 0.92,
      ramp.start.z + (ramp.end.z - ramp.start.z) * railStartT + sideZ * offset
    );
    const railEnd = new THREE.Vector3(
      ramp.start.x + (ramp.end.x - ramp.start.x) * railEndT + sideX * offset,
      ramp.start.y + (ramp.end.y - ramp.start.y) * railEndT + 0.92,
      ramp.start.z + (ramp.end.z - ramp.start.z) * railEndT + sideZ * offset
    );
    addBeamBetween(group, railStart, railEnd, 0.12, 0.12, railMat);
    const posts = Math.max(3, Math.ceil(horizontalLength * (railEndT - railStartT) / 2.2));
    for (let i = 0; i <= posts; i++) {
      const t = railStartT + (railEndT - railStartT) * i / posts;
      const x = ramp.start.x + (ramp.end.x - ramp.start.x) * t + sideX * offset;
      const z = ramp.start.z + (ramp.end.z - ramp.start.z) * t + sideZ * offset;
      const y = ramp.start.y + (ramp.end.y - ramp.start.y) * t;
      group.add(makeBox(0.085, 0.94, 0.085, railMat, x, y + 0.48, z));
    }
  }
}

function addBridgeRail(
  group: THREE.Group,
  rail: (typeof NESTED_CITY.bridgeRails)[number],
  material: THREE.Material,
  postMaterial: THREE.Material
) {
  const floorY = NESTED_CITY.levels[rail.level];
  const postCount = Math.max(2, Math.ceil(Math.max(rail.width, rail.depth) / 1.65));
  const isXLong = rail.width >= rail.depth;
  const top = makeBox(rail.width, 0.08, rail.depth, material, rail.x, floorY + NESTED_CITY.railHeight, rail.z);
  top.name = `nested-city-guardrail:${rail.id}`;
  group.add(top);
  for (let i = 0; i <= postCount; i++) {
    const t = i / postCount;
    const x = isXLong ? rail.x - rail.width / 2 + rail.width * t : rail.x;
    const z = isXLong ? rail.z : rail.z - rail.depth / 2 + rail.depth * t;
    group.add(makeBox(0.085, NESTED_CITY.railHeight, 0.085, postMaterial, x, floorY + NESTED_CITY.railHeight / 2, z));
  }
}

/** 三重框架、挑空樓板與斜坡幾何；既有 RoomGeometry 繼續供應書桌／書本資料。 */
export const NestedCityGeometry: React.FC<{ api: StudySceneApi }> = ({ api }) => {
  useEffect(() => {
    const group = new THREE.Group();
    group.name = "nested-city-architecture";
    api.scene.add(group);

    const timber = new THREE.MeshStandardMaterial({ color: "#8b6545", roughness: 0.78, metalness: 0.02 });
    const timberLight = new THREE.MeshStandardMaterial({ color: "#ae8a63", roughness: 0.72, metalness: 0.02 });
    const stone = new THREE.MeshStandardMaterial({ color: "#99958c", roughness: 0.91, metalness: 0.015 });
    const stoneLight = new THREE.MeshStandardMaterial({ color: "#b9b2a7", roughness: 0.86, metalness: 0.01 });
    const core = new THREE.MeshStandardMaterial({ color: "#665e60", roughness: 0.84, metalness: 0.025 });
    const coreLight = new THREE.MeshStandardMaterial({ color: "#87787b", roughness: 0.78, metalness: 0.025 });
    const deckTimber = new THREE.MeshStandardMaterial({ color: "#59483a", roughness: 0.88 });
    const deckStone = new THREE.MeshStandardMaterial({ color: "#88847c", roughness: 0.92 });
    const deckCore = new THREE.MeshStandardMaterial({ color: "#514a4d", roughness: 0.87 });
    const underside = new THREE.MeshStandardMaterial({ color: "#4d4743", roughness: 0.92 });
    const rail = new THREE.MeshStandardMaterial({ color: "#4a3a30", roughness: 0.7 });
    const railStone = new THREE.MeshStandardMaterial({ color: "#69655f", roughness: 0.82 });
    const tread = new THREE.MeshStandardMaterial({ color: "#c2a17b", roughness: 0.85 });
    const led = new THREE.MeshBasicMaterial({ color: "#ffc887", toneMapped: false });
    const materials: Record<CityMaterial, THREE.Material> = { timber, stone, core };
    const platformMaterials: Record<CityMaterial, THREE.Material> = { timber: deckTimber, stone: deckStone, core: deckCore };
    const allMaterials: THREE.Material[] = [
      timber, timberLight, stone, stoneLight, core, coreLight, deckTimber, deckStone, deckCore, underside, rail, railStone, tread, led,
    ];

    // 外側暖木主框、中層石構件、偏心旋轉的內核；各自朝向／深度不同，不是同心套盒。
    for (const frame of NESTED_CITY.frames) {
      const material = frame.material === "timber" ? timber : frame.material === "stone" ? stone : core;
      addFrame(group, frame, material);
      // 木構接點以一條細亮色壓條提示榫接，不把整個框做成發光輪廓。
      if (frame.material === "timber") {
        const y = frame.bottom + frame.height - frame.beamHeight + 0.06;
        const width = frame.plane === "z" ? frame.thickness + 0.015 : frame.width;
        const depth = frame.plane === "x" ? frame.thickness + 0.015 : frame.width;
        const accent = makeBox(width, 0.035, depth, timberLight, frame.x, y, frame.z, false);
        if (frame.rotationY) {
          accent.position.set(frame.x, y, frame.z);
          accent.rotation.y = frame.rotationY;
        }
        group.add(accent);
      }
    }

    // 外殼僅留低矮石基座與高窗，不再用整圈實牆／平頂封住中央挑空。
    group.add(makeBox(ROOM.width - 0.65, 1.15, 0.38, stone, 0, 0.575, ROOM.depth / 2 - 0.25));
    group.add(makeBox(0.38, 1.15, ROOM.depth - 0.7, stone, ROOM.width / 2 - 0.25, 0.575, 0));
    group.add(makeBox(0.38, 1.15, ROOM.depth - 0.7, stone, -ROOM.width / 2 + 0.25, 0.575, 0));

    for (const column of NESTED_CITY.columns) {
      group.add(makeBox(column.width, column.top - column.bottom, column.depth, stone, column.x, (column.top + column.bottom) / 2, column.z));
    }

    for (const platform of NESTED_CITY.platforms) {
      const y = NESTED_CITY.levels[platform.level];
      const slab = makeBox(
        platform.width,
        SLAB_THICKNESS,
        platform.depth,
        platformMaterials[platform.material],
        platform.x,
        y - SLAB_THICKNESS / 2,
        platform.z
      );
      slab.name = `nested-city-platform:${platform.id}`;
      group.add(slab);
      // 平台外緣加入厚石／木封邊，讓懸挑樓板有明確的結構深度。
      const fasciaMat = platform.material === "timber" ? timber : platform.material === "stone" ? stoneLight : coreLight;
      const fasciaDepth = Math.min(0.12, platform.depth * 0.12);
      group.add(makeBox(platform.width, 0.1, fasciaDepth, fasciaMat, platform.x, y - 0.12, platform.z + platform.depth / 2 - fasciaDepth / 2, false));
      group.add(makeBox(platform.width, 0.018, 0.035, led, platform.x, y - 0.035, platform.z + platform.depth / 2 - 0.055, false));
    }

    for (const ramp of NESTED_CITY.ramps) {
      addRamp(group, ramp, materials, rail, tread);
    }
    for (const bridgeRail of NESTED_CITY.bridgeRails) {
      addBridgeRail(group, bridgeRail, railStone, rail);
    }

    // 局部木作書格與閱讀平台：只提供空間層次，真實卡片書本仍由既有書架系統管理。
    for (const [y, x, z, width] of [
      [4.35, -9.55, -2.1, 3.6],
      [8.35, 8.15, 1.6, 2.1],
      [12.35, -7.2, 0.3, 3.1],
    ] as const) {
      for (let row = 0; row < 3; row++) {
        const shelfY = y + row * 0.48;
        group.add(makeBox(width, 0.075, 0.34, timber, x, shelfY, z, true));
        group.add(makeBox(width - 0.12, 0.018, 0.018, led, x, shelfY - 0.05, z + 0.16, false));
        // 僅以低矮色塊表現書格厚度，不偽造或取代資料書本。
        for (let book = 0; book < 7; book++) {
          const h = 0.25 + ((book * 13 + row * 7) % 5) * 0.035;
          const w = 0.12 + (book % 3) * 0.025;
          const xBook = x - width / 2 + 0.18 + book * (width - 0.36) / 7;
          const bookMat = book % 3 === 0 ? coreLight : book % 3 === 1 ? stoneLight : timberLight;
          group.add(makeBox(w, h, 0.16, bookMat, xBook, shelfY + h / 2 + 0.045, z - 0.06, false));
        }
      }
    }

    // 兩層暖色閱讀燈與橋底洗牆燈；自然窗光由 WindowLight 管理。
    for (const [x, y, z] of [
      [-8.1, 5.2, 0], [8.6, 9.2, -1], [2.8, 13.1, -1.7],
    ] as const) {
      const point = new THREE.PointLight("#ffd5a0", 0.34, 7.5, 2);
      point.position.set(x, y, z);
      point.castShadow = false;
      group.add(point);
    }

    return () => {
      api.scene.remove(group);
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      allMaterials.forEach((material) => material.dispose());
    };
  }, [api]);

  return null;
};
