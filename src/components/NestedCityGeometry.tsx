"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import {
  cityFrameMembers,
  cityStairHeightAt,
  nestedCityPlatformRails,
  NESTED_CITY,
  ROOM,
  type CityFrame,
  type CityMaterial,
  type CityPlatformRail,
  type CityStair,
} from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

const SLAB_THICKNESS = 0.3;
const STAIR_TREAD_THICKNESS = 0.12;
const BRIDGE_POST_WIDTH = 0.085;
const PLATFORM_RAIL_WIDTH = NESTED_CITY.platformRailPostWidth;
const UNIT_BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const LOCAL_Z = new THREE.Vector3(0, 0, 1);

type BoxInstance = {
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
};

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
  const mesh = new THREE.Mesh(UNIT_BOX_GEOMETRY, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(width, height, depth);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  mesh.userData.kind = "nestedCityStructure";
  return mesh;
}

function addBoxInstances(
  group: THREE.Group,
  material: THREE.Material,
  instances: readonly BoxInstance[],
  name: string,
  castShadow = true
) {
  if (!instances.length) return;
  const batch = new THREE.InstancedMesh(UNIT_BOX_GEOMETRY, material, instances.length);
  batch.name = name;
  batch.castShadow = castShadow;
  batch.receiveShadow = true;
  batch.userData.kind = "nestedCityStructureBatch";
  const transform = new THREE.Object3D();
  instances.forEach((instance, index) => {
    transform.position.set(instance.x, instance.y, instance.z);
    transform.rotation.set(0, instance.rotationY ?? 0, 0);
    transform.scale.set(instance.width, instance.height, instance.depth);
    transform.updateMatrix();
    batch.setMatrixAt(index, transform.matrix);
  });
  batch.instanceMatrix.needsUpdate = true;
  batch.computeBoundingSphere();
  group.add(batch);
}

function addFrame(group: THREE.Group, frame: CityFrame, material: THREE.Material) {
  const frameGroup = new THREE.Group();
  frameGroup.name = `nested-city-frame:${frame.id}`;
  frameGroup.position.set(frame.x, 0, frame.z);
  frameGroup.rotation.y = frame.rotationY;
  group.add(frameGroup);

  for (const member of cityFrameMembers(frame)) {
    const mesh = makeBox(
      member.width,
      member.top - member.bottom,
      member.depth,
      material,
      member.x,
      (member.bottom + member.top) / 2,
      member.z
    );
    mesh.userData.frameId = frame.id;
    frameGroup.add(mesh);
  }
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

function addStair(group: THREE.Group, stair: CityStair, materials: Record<CityMaterial, THREE.Material>, railMat: THREE.Material, treadMat: THREE.Material) {
  const dx = stair.end.x - stair.start.x;
  const dz = stair.end.z - stair.start.z;
  const horizontalLength = Math.hypot(dx, dz);
  const stepRun = horizontalLength / stair.steps;
  const yaw = Math.atan2(dx, dz);
  const directionX = dx / horizontalLength;
  const directionZ = dz / horizontalLength;
  const sideX = -directionZ;
  const sideZ = directionX;
  const treadInstances: BoxInstance[] = [];
  const noseInstances: BoxInstance[] = [];

  for (let index = 0; index < stair.steps; index++) {
    const progress = (index + 0.5) / stair.steps;
    const x = stair.start.x + dx * progress;
    const z = stair.start.z + dz * progress;
    const topY = stair.start.y + ((stair.end.y - stair.start.y) * (index + 1)) / stair.steps;
    treadInstances.push({
      width: stair.width,
      height: STAIR_TREAD_THICKNESS,
      depth: stepRun,
      x,
      y: topY - STAIR_TREAD_THICKNESS / 2,
      z,
      rotationY: yaw,
    });

    const noseDistance = (index + 1) * stepRun - 0.025;
    noseInstances.push({
      width: stair.width - 0.12,
      height: 0.025,
      depth: 0.04,
      x: stair.start.x + directionX * noseDistance,
      y: topY - 0.012,
      z: stair.start.z + directionZ * noseDistance,
      rotationY: yaw,
    });
  }
  addBoxInstances(group, materials[stair.material], treadInstances, `nested-city-stair-treads:${stair.id}`);
  addBoxInstances(group, treadMat, noseInstances, `nested-city-stair-noses:${stair.id}`, false);

  const railInsetT = Math.min(0.15, NESTED_CITY.stairRailInset / horizontalLength);
  const railStartT = railInsetT;
  const railEndT = 1 - railInsetT;
  for (const side of [-1, 1]) {
    const sideOffset = (stair.width / 2 - PLATFORM_RAIL_WIDTH / 2) * side;
    const stringerOffset = (stair.width / 2 - 0.08) * side;
    const stringerStart = new THREE.Vector3(
      stair.start.x + sideX * stringerOffset,
      stair.start.y - 0.1,
      stair.start.z + sideZ * stringerOffset
    );
    const stringerEnd = new THREE.Vector3(
      stair.end.x + sideX * stringerOffset,
      stair.end.y - 0.1,
      stair.end.z + sideZ * stringerOffset
    );
    addBeamBetween(group, stringerStart, stringerEnd, 0.08, 0.1, railMat);

    const railStart = new THREE.Vector3(
      stair.start.x + dx * railStartT + sideX * sideOffset,
      cityStairHeightAt(stair, railStartT) + NESTED_CITY.railHeight - 0.04,
      stair.start.z + dz * railStartT + sideZ * sideOffset
    );
    const railEnd = new THREE.Vector3(
      stair.start.x + dx * railEndT + sideX * sideOffset,
      cityStairHeightAt(stair, railEndT) + NESTED_CITY.railHeight - 0.04,
      stair.start.z + dz * railEndT + sideZ * sideOffset
    );
    addBeamBetween(group, railStart, railEnd, PLATFORM_RAIL_WIDTH, PLATFORM_RAIL_WIDTH, railMat);

    const posts = Math.max(2, Math.ceil(horizontalLength * (railEndT - railStartT) / 1.65));
    for (let index = 0; index <= posts; index++) {
      const t = railStartT + (railEndT - railStartT) * index / posts;
      const x = stair.start.x + dx * t + sideX * sideOffset;
      const z = stair.start.z + dz * t + sideZ * sideOffset;
      const surfaceY = cityStairHeightAt(stair, t);
      group.add(makeBox(
        PLATFORM_RAIL_WIDTH,
        NESTED_CITY.railHeight,
        PLATFORM_RAIL_WIDTH,
        railMat,
        x,
        surfaceY + NESTED_CITY.railHeight / 2,
        z
      ));
    }
  }
}

function addPlatformGuardrail(group: THREE.Group, rail: CityPlatformRail, material: THREE.Material, postMaterial: THREE.Material) {
  const floorY = NESTED_CITY.levels[rail.level];
  const length = rail.end - rail.start;
  const fixed = rail.fixed + rail.inward * PLATFORM_RAIL_WIDTH / 2;
  const center = (rail.start + rail.end) / 2;
  const top = rail.axis === "x"
    ? makeBox(length, PLATFORM_RAIL_WIDTH, PLATFORM_RAIL_WIDTH, material, center, floorY + NESTED_CITY.railHeight, fixed)
    : makeBox(PLATFORM_RAIL_WIDTH, PLATFORM_RAIL_WIDTH, length, material, fixed, floorY + NESTED_CITY.railHeight, center);
  top.name = `nested-city-platform-rail:${rail.id}`;
  group.add(top);

  const postCount = Math.max(1, Math.ceil(length / 1.65));
  for (let index = 0; index <= postCount; index++) {
    const along = rail.start + PLATFORM_RAIL_WIDTH / 2 + (length - PLATFORM_RAIL_WIDTH) * index / postCount;
    const x = rail.axis === "x" ? along : fixed;
    const z = rail.axis === "z" ? along : fixed;
    group.add(makeBox(
      PLATFORM_RAIL_WIDTH,
      NESTED_CITY.railHeight,
      PLATFORM_RAIL_WIDTH,
      postMaterial,
      x,
      floorY + NESTED_CITY.railHeight / 2,
      z
    ));
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
  const railLength = isXLong ? rail.width : rail.depth;
  for (let i = 0; i <= postCount; i++) {
    // Keep each end post fully over the deck instead of centering it on the slab's outer edge.
    const t = i / postCount;
    const along = BRIDGE_POST_WIDTH / 2 + (railLength - BRIDGE_POST_WIDTH) * t;
    const x = isXLong ? rail.x - rail.width / 2 + along : rail.x;
    const z = isXLong ? rail.z : rail.z - rail.depth / 2 + along;
    group.add(makeBox(BRIDGE_POST_WIDTH, NESTED_CITY.railHeight, BRIDGE_POST_WIDTH, postMaterial, x, floorY + NESTED_CITY.railHeight / 2, z));
  }
}

/** 三重框架、挑空樓板與開放踏階幾何；既有 RoomGeometry 繼續供應書桌／書本資料。 */
export const NestedCityGeometry: React.FC<{ api: StudySceneApi; whiteModel?: boolean }> = ({ api, whiteModel = false }) => {
  useEffect(() => {
    const group = new THREE.Group();
    group.name = "nested-city-architecture";
    api.scene.add(group);

    const materialColor = (base: string) => whiteModel ? "#d8d5cf" : base;
    const timber = new THREE.MeshStandardMaterial({ color: materialColor("#8b6545"), roughness: 0.78, metalness: 0.02 });
    const timberLight = new THREE.MeshStandardMaterial({ color: materialColor("#ae8a63"), roughness: 0.72, metalness: 0.02 });
    const stone = new THREE.MeshStandardMaterial({ color: materialColor("#99958c"), roughness: 0.91, metalness: 0.015 });
    const stoneLight = new THREE.MeshStandardMaterial({ color: materialColor("#b9b2a7"), roughness: 0.86, metalness: 0.01 });
    const core = new THREE.MeshStandardMaterial({ color: materialColor("#665e60"), roughness: 0.84, metalness: 0.025 });
    const coreLight = new THREE.MeshStandardMaterial({ color: materialColor("#87787b"), roughness: 0.78, metalness: 0.025 });
    const deckTimber = new THREE.MeshStandardMaterial({ color: materialColor("#59483a"), roughness: 0.88 });
    const deckStone = new THREE.MeshStandardMaterial({ color: materialColor("#88847c"), roughness: 0.92 });
    const deckCore = new THREE.MeshStandardMaterial({ color: materialColor("#514a4d"), roughness: 0.87 });
    const underside = new THREE.MeshStandardMaterial({ color: materialColor("#4d4743"), roughness: 0.92 });
    const rail = new THREE.MeshStandardMaterial({ color: materialColor("#4a3a30"), roughness: 0.7 });
    const railStone = new THREE.MeshStandardMaterial({ color: materialColor("#69655f"), roughness: 0.82 });
    const tread = new THREE.MeshStandardMaterial({ color: materialColor("#c2a17b"), roughness: 0.85 });
    const led = new THREE.MeshBasicMaterial({ color: whiteModel ? "#f4f2ed" : "#ffc887", toneMapped: false });
    const materials: Record<CityMaterial, THREE.Material> = { timber, stone, core };
    const platformMaterials: Record<CityMaterial, THREE.Material> = { timber: deckTimber, stone: deckStone, core: deckCore };
    const allMaterials: THREE.Material[] = [
      timber, timberLight, stone, stoneLight, core, coreLight, deckTimber, deckStone, deckCore, underside, rail, railStone, tread, led,
    ];

    // 三重主體以共用構件資料生成：連續外框、橫向穿插體、較小且偏轉的內核。
    for (const frame of NESTED_CITY.frames) {
      const material = frame.material === "timber" ? timber : frame.material === "stone" ? stone : core;
      addFrame(group, frame, material);
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
    }

    for (const stair of NESTED_CITY.stairs) {
      addStair(group, stair, materials, rail, tread);
    }
    for (const bridgeRail of NESTED_CITY.bridgeRails) {
      addBridgeRail(group, bridgeRail, railStone, rail);
    }
    for (const platformRail of nestedCityPlatformRails()) {
      addPlatformGuardrail(group, platformRail, railStone, rail);
    }

    // 局部木作書格與閱讀平台：只提供空間層次，真實卡片書本仍由既有書架系統管理。
    for (const [y, x, z, width] of [
      [4.35, -9.55, -2.1, 3.6],
      [8.35, 8.15, 1.6, 2.1],
      [12.35, -9.3, 0.3, 3],
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
      const point = new THREE.PointLight(whiteModel ? "#ffffff" : "#ffd5a0", whiteModel ? 0.22 : 0.34, 7.5, 2);
      point.position.set(x, y, z);
      point.castShadow = false;
      group.add(point);
    }

    return () => {
      api.scene.remove(group);
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== UNIT_BOX_GEOMETRY) mesh.geometry.dispose();
      });
      allMaterials.forEach((material) => material.dispose());
    };
  }, [api, whiteModel]);

  return null;
};
