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
import { attachPhotoMap } from "@/lib/roomTextures";
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

function addStair(
  group: THREE.Group,
  stair: CityStair,
  materials: Record<CityMaterial, THREE.Material>,
  railMat: THREE.Material,
  treadMat: THREE.Material
) {
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

function addPlatformGuardrail(
  group: THREE.Group,
  rail: CityPlatformRail,
  topRailMaterial: THREE.Material,
  postMaterial: THREE.Material,
  glassMaterial: THREE.Material
) {
  const floorY = NESTED_CITY.levels[rail.level];
  const length = rail.end - rail.start;
  const halfGlass = NESTED_CITY.glassRailThickness / 2;
  const fixed = rail.fixed + rail.inward * halfGlass;
  const center = (rail.start + rail.end) / 2;
  const panelHeight = NESTED_CITY.railHeight - 0.16;
  const panel = rail.axis === "x"
    ? makeBox(length, panelHeight, NESTED_CITY.glassRailThickness, glassMaterial, center, floorY + 0.08 + panelHeight / 2, fixed, false)
    : makeBox(NESTED_CITY.glassRailThickness, panelHeight, length, glassMaterial, fixed, floorY + 0.08 + panelHeight / 2, center, false);
  panel.name = `nested-city-glass-guard:${rail.id}`;
  group.add(panel);

  const top = rail.axis === "x"
    ? makeBox(length, PLATFORM_RAIL_WIDTH, PLATFORM_RAIL_WIDTH, topRailMaterial, center, floorY + NESTED_CITY.railHeight, fixed)
    : makeBox(PLATFORM_RAIL_WIDTH, PLATFORM_RAIL_WIDTH, length, topRailMaterial, fixed, floorY + NESTED_CITY.railHeight, center);
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
  topRailMaterial: THREE.Material,
  postMaterial: THREE.Material,
  glassMaterial: THREE.Material
) {
  const floorY = NESTED_CITY.levels[rail.level];
  const postCount = Math.max(2, Math.ceil(Math.max(rail.width, rail.depth) / 1.65));
  const isXLong = rail.width >= rail.depth;
  const panelHeight = NESTED_CITY.railHeight - 0.16;
  const panel = isXLong
    ? makeBox(rail.width, panelHeight, NESTED_CITY.glassRailThickness, glassMaterial, rail.x, floorY + 0.08 + panelHeight / 2, rail.z, false)
    : makeBox(NESTED_CITY.glassRailThickness, panelHeight, rail.depth, glassMaterial, rail.x, floorY + 0.08 + panelHeight / 2, rail.z, false);
  panel.name = `nested-city-glass-bridge-guard:${rail.id}`;
  group.add(panel);

  const top = makeBox(
    rail.width,
    PLATFORM_RAIL_WIDTH,
    rail.depth,
    topRailMaterial,
    rail.x,
    floorY + NESTED_CITY.railHeight,
    rail.z
  );
  top.name = `nested-city-bridge-rail:${rail.id}`;
  group.add(top);

  const railLength = isXLong ? rail.width : rail.depth;
  for (let index = 0; index <= postCount; index++) {
    // Keep each end post fully over the deck instead of centering it on the slab's outer edge.
    const t = index / postCount;
    const along = BRIDGE_POST_WIDTH / 2 + (railLength - BRIDGE_POST_WIDTH) * t;
    const x = isXLong ? rail.x - rail.width / 2 + along : rail.x;
    const z = isXLong ? rail.z : rail.z - rail.depth / 2 + along;
    group.add(makeBox(BRIDGE_POST_WIDTH, NESTED_CITY.railHeight, BRIDGE_POST_WIDTH, postMaterial, x, floorY + NESTED_CITY.railHeight / 2, z));
  }
}

function addReadingTable(
  group: THREE.Group,
  x: number,
  floorY: number,
  z: number,
  width: number,
  depth: number,
  wood: THREE.Material,
  metal: THREE.Material,
  seating = true
) {
  const topY = floorY + 0.78;
  group.add(makeBox(width, 0.1, depth, wood, x, topY, z));
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      group.add(makeBox(0.075, 0.72, 0.075, metal, x + dx * (width / 2 - 0.12), floorY + 0.36, z + dz * (depth / 2 - 0.1), false));
    }
  }
  if (!seating) return;

  for (const side of [-1, 1]) {
    const chairX = x + side * (width * 0.33);
    const chairZ = z + depth / 2 + 0.46;
    group.add(makeBox(0.62, 0.08, 0.5, wood, chairX, floorY + 0.48, chairZ));
    group.add(makeBox(0.62, 0.56, 0.08, wood, chairX, floorY + 0.76, chairZ + 0.22));
    group.add(makeBox(0.07, 0.46, 0.07, metal, chairX - 0.22, floorY + 0.23, chairZ - 0.12, false));
    group.add(makeBox(0.07, 0.46, 0.07, metal, chairX + 0.22, floorY + 0.23, chairZ - 0.12, false));
  }
}

function addPlanter(
  group: THREE.Group,
  x: number,
  floorY: number,
  z: number,
  size: number,
  planterMaterial: THREE.Material,
  soilMaterial: THREE.Material,
  trunkMaterial: THREE.Material,
  foliageMaterial: THREE.Material
) {
  const planterHeight = 0.42;
  group.add(makeBox(size, planterHeight, size * 0.82, planterMaterial, x, floorY + planterHeight / 2, z));
  group.add(makeBox(size * 0.84, 0.05, size * 0.68, soilMaterial, x, floorY + planterHeight + 0.02, z));

  const trunkHeight = size * 1.65;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.055, size * 0.09, trunkHeight, 7), trunkMaterial);
  trunk.position.set(x, floorY + planterHeight + trunkHeight / 2, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crownY = floorY + planterHeight + trunkHeight * 0.9;
  for (const [dx, dy, dz, scale] of [
    [0, 0, 0, 1],
    [-size * 0.28, size * 0.18, 0, 0.7],
    [size * 0.28, size * 0.14, size * 0.08, 0.68],
    [0, size * 0.2, -size * 0.26, 0.72],
  ] as const) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.42 * scale, 1), foliageMaterial);
    crown.position.set(x + dx, crownY + dy, z + dz);
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);
  }
}

function addLibraryWall(
  group: THREE.Group,
  wood: THREE.Material,
  bookMaterials: readonly THREE.Material[],
  led: THREE.Material
) {
  const bookInstances: BoxInstance[][] = bookMaterials.map(() => []);
  for (const obstacle of NESTED_CITY.obstacles) {
    group.add(makeBox(
      obstacle.width,
      obstacle.top - obstacle.bottom,
      obstacle.depth,
      wood,
      obstacle.x,
      (obstacle.top + obstacle.bottom) / 2,
      obstacle.z,
      false
    ));

    const left = obstacle.x - obstacle.width / 2 + 0.16;
    const right = obstacle.x + obstacle.width / 2 - 0.16;
    const shelfRows = 8;
    for (let row = 0; row < shelfRows; row++) {
      const shelfY = 0.72 + row * 0.92;
      group.add(makeBox(obstacle.width - 0.16, 0.075, 0.5, wood, obstacle.x, shelfY, obstacle.z - 0.24, false));
      group.add(makeBox(obstacle.width - 0.28, 0.018, 0.025, led, obstacle.x, shelfY - 0.055, obstacle.z - 0.48, false));

      let cursor = left;
      let bookIndex = row * 13;
      while (cursor < right - 0.2) {
        const width = 0.13 + (bookIndex % 4) * 0.025;
        const height = 0.48 + ((bookIndex * 7 + row * 3) % 5) * 0.065;
        const materialIndex = bookIndex % bookInstances.length;
        bookInstances[materialIndex].push({
          width,
          height,
          depth: 0.15,
          x: cursor + width / 2,
          y: shelfY + 0.04 + height / 2,
          z: obstacle.z - obstacle.depth / 2 - 0.07,
        });
        cursor += width + 0.055;
        bookIndex++;
      }
    }
  }
  bookInstances.forEach((instances, index) => {
    addBoxInstances(group, bookMaterials[index], instances, `nested-city-library-books:${index}`, false);
  });
}

/** Reference floor program: 1F entrance/exhibition, 2F public stacks, 3F quiet study, 4F sky terrace. */
export const NestedCityGeometry: React.FC<{ api: StudySceneApi; whiteModel?: boolean; structureOnly?: boolean }> = ({ api, whiteModel = false, structureOnly = false }) => {
  useEffect(() => {
    const group = new THREE.Group();
    group.name = "nested-city-architecture";
    api.scene.add(group);
    const textureDisposers: Array<() => void> = [];
    const originalEnvironmentIntensity = api.scene.environmentIntensity;
    // Three.js owns this mutable scene property; clear reflections only for the isolated inspection scene.
    // eslint-disable-next-line react-hooks/immutability -- intentional imperative Three.js scene mutation
    if (structureOnly) api.scene.environmentIntensity = 0;

    const materialColor = (base: string) => whiteModel ? "#d8d5cf" : base;
    const timberBase = structureOnly ? "#c7894f" : "#8b6545";
    const stoneBase = structureOnly ? "#8799a8" : "#99958c";
    const coreBase = structureOnly ? "#9874c7" : "#665e60";
    const timber = new THREE.MeshStandardMaterial({ color: materialColor(timberBase), roughness: 1, metalness: 0, envMapIntensity: structureOnly ? 0 : 0.08 });
    const timberLight = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#d19a60" : "#ae8a63"), roughness: 1, metalness: 0 });
    const stone = new THREE.MeshStandardMaterial({ color: materialColor(stoneBase), roughness: 1, metalness: 0, envMapIntensity: structureOnly ? 0 : 0.05 });
    const stoneLight = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#a7b3bd" : "#b9b2a7"), roughness: 1, metalness: 0 });
    const core = new THREE.MeshStandardMaterial({ color: materialColor(coreBase), roughness: 1, metalness: 0, envMapIntensity: structureOnly ? 0 : 0.08 });
    const coreLight = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#b49bdd" : "#87787b"), roughness: 1, metalness: 0 });
    const deckTimber = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#dfc4a2" : "#59483a"), roughness: 1, metalness: 0, envMapIntensity: 0 });
    const deckStone = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#d5dce1" : "#88847c"), roughness: 1, metalness: 0, envMapIntensity: 0 });
    const deckCore = new THREE.MeshStandardMaterial({ color: materialColor(structureOnly ? "#d2c4e3" : "#514a4d"), roughness: 1, metalness: 0, envMapIntensity: 0 });
    const rail = new THREE.MeshStandardMaterial({ color: materialColor("#4a3a30"), roughness: 0.7 });
    const railStone = new THREE.MeshStandardMaterial({ color: materialColor("#69655f"), roughness: 0.82, metalness: 0.12 });
    const metal = new THREE.MeshStandardMaterial({ color: materialColor("#79736a"), roughness: 0.42, metalness: 0.68 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: whiteModel ? "#f1efeb" : "#9dbec1",
      roughness: 0.08,
      metalness: 0.04,
      transparent: true,
      opacity: whiteModel ? 0.12 : 0.24,
      transmission: whiteModel ? 0 : 0.28,
      thickness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.45,
    });
    const entranceGlass = new THREE.MeshPhysicalMaterial({
      color: whiteModel ? "#f1efeb" : "#a9c7c8",
      roughness: 0.06,
      metalness: 0.03,
      transparent: true,
      opacity: whiteModel ? 0.14 : 0.2,
      transmission: whiteModel ? 0 : 0.38,
      thickness: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 0.5,
    });
    const tread = new THREE.MeshStandardMaterial({ color: materialColor("#c2a17b"), roughness: 0.85 });
    const planterMat = new THREE.MeshStandardMaterial({ color: materialColor("#79766e"), roughness: 0.94 });
    const soilMat = new THREE.MeshStandardMaterial({ color: materialColor("#473c30"), roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: materialColor("#72583c"), roughness: 0.95 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: materialColor("#58764f"), roughness: 0.92 });
    const led = new THREE.MeshBasicMaterial({ color: whiteModel ? "#f4f2ed" : "#ffc887", toneMapped: false });
    const materials: Record<CityMaterial, THREE.Material> = { timber, stone, core };
    const platformMaterials: Record<CityMaterial, THREE.Material> = { timber: deckTimber, stone: deckStone, core: deckCore };
    const allMaterials: THREE.Material[] = [
      timber, timberLight, stone, stoneLight, core, coreLight, deckTimber, deckStone, deckCore,
      rail, railStone, metal, glass, entranceGlass, tread, planterMat, soilMat, trunkMat, foliageMat, led,
    ];

    const disposeSceneGroup = () => {
      api.scene.remove(group);
      if (structureOnly) api.scene.environmentIntensity = originalEnvironmentIntensity;
      textureDisposers.forEach((dispose) => dispose());
      group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry && mesh.geometry !== UNIT_BOX_GEOMETRY) mesh.geometry.dispose();
      });
      allMaterials.forEach((material) => material.dispose());
    };

    if (!whiteModel && !structureOnly) {
      const anisotropy = Math.min(8, api.renderer.capabilities.getMaxAnisotropy());
      textureDisposers.push(attachPhotoMap(timber, "walnut", { repeat: [5, 1], tint: "#d0ad86", anisotropy }));
      textureDisposers.push(attachPhotoMap(stone, "microcement", { repeat: [4, 3], tint: "#c5c0b7", anisotropy }));
      textureDisposers.push(attachPhotoMap(core, "microcement", { repeat: [3, 2], tint: "#958d87", anisotropy }));
    }

    // Structure inspection deliberately renders only the three dimensioned primary frames.
    const visibleFrames = structureOnly ? NESTED_CITY.frames : [...NESTED_CITY.frames, ...NESTED_CITY.featureFrames];
    for (const frame of visibleFrames) {
      const material = frame.material === "timber" ? timber : frame.material === "stone" ? stone : core;
      addFrame(group, frame, material);
    }

    if (!structureOnly) {
      // Open stone plinths leave a 7 m front lobby opening for the entrance doors.
      const entranceWidth = 7;
      const halfOpening = entranceWidth / 2;
      const sideWidth = ROOM.width / 2 - halfOpening;
      const sideCenter = (ROOM.width / 2 + halfOpening) / 2;
      const southZ = ROOM.depth / 2 - 0.25;
      group.add(makeBox(sideWidth, 1.15, 0.38, stone, -sideCenter, 0.575, southZ));
      group.add(makeBox(sideWidth, 1.15, 0.38, stone, sideCenter, 0.575, southZ));
      group.add(makeBox(0.38, 1.15, ROOM.depth - 0.7, stone, ROOM.width / 2 - 0.25, 0.575, 0));
      group.add(makeBox(0.38, 1.15, ROOM.depth - 0.7, stone, -ROOM.width / 2 + 0.25, 0.575, 0));

      // Full-height glass entry doors and slim bronze framing at the south lobby.
      const doorY = 1.52;
      const doorZ = ROOM.depth / 2 - 0.48;
      const doorWidth = 3.28;
      for (const x of [-1.68, 1.68]) {
        group.add(makeBox(doorWidth, 2.76, 0.075, entranceGlass, x, doorY, doorZ, false));
        group.add(makeBox(0.045, 2.82, 0.1, metal, x - doorWidth / 2, doorY, doorZ, false));
        group.add(makeBox(0.045, 2.82, 0.1, metal, x + doorWidth / 2, doorY, doorZ, false));
      }
      group.add(makeBox(entranceWidth, 0.11, 0.12, timber, 0, 2.96, doorZ, false));
      group.add(makeBox(0.055, 0.62, 0.06, metal, -0.14, 1.5, doorZ - 0.07, false));
      group.add(makeBox(0.055, 0.62, 0.06, metal, 0.14, 1.5, doorZ - 0.07, false));
    }

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
      addBridgeRail(group, bridgeRail, railStone, metal, glass);
    }
    for (const platformRail of nestedCityPlatformRails()) {
      addPlatformGuardrail(group, platformRail, railStone, metal, glass);
    }

    if (structureOnly) {
      // A ground-only base makes the structural model readable without adding walls or room décor.
      group.add(makeBox(ROOM.width, 0.3, ROOM.depth, deckStone, 0, -0.15, 0, false));
      const hemi = new THREE.HemisphereLight("#f5f7fb", "#85817a", 2.1);
      const key = new THREE.DirectionalLight("#fff4e6", 2.6);
      key.position.set(42, 64, 38);
      key.target.position.set(0, 7, 0);
      key.castShadow = true;
      key.shadow.mapSize.set(api.quality.shadowMap, api.quality.shadowMap);
      key.shadow.camera.left = -34;
      key.shadow.camera.right = 34;
      key.shadow.camera.top = 34;
      key.shadow.camera.bottom = -34;
      key.shadow.camera.near = 0.1;
      key.shadow.camera.far = 120;
      key.shadow.bias = -0.0002;
      group.add(hemi, key, key.target);
      return disposeSceneGroup;
    }

    // 1F: welcome counter, exhibition plinths, and planted lobby edges.
    group.add(makeBox(4.4, 0.16, 1.15, timber, -8.5, 1.06, 6.5));
    group.add(makeBox(3.9, 0.72, 0.82, core, -8.5, 0.43, 6.5));
    for (const [x, z, height] of [[-2.5, 1.8, 0.8], [4.2, -0.8, 0.62], [0.5, -4.2, 0.7]] as const) {
      group.add(makeBox(1.35, 0.12, 1.35, stoneLight, x, height, z));
      group.add(makeBox(0.46, height * 1.35, 0.46, timberLight, x, height + height * 0.68, z));
    }

    // 2F public library: communal reading tables; 3F: small quiet-study / note desks.
    addReadingTable(group, 8.5, NESTED_CITY.levels[1], -7.35, 3.5, 1.1, timber, metal);
    addReadingTable(group, 15.5, NESTED_CITY.levels[1], -7.35, 3.5, 1.1, timber, metal);
    for (const x of [8.4, 12, 15.6]) {
      addReadingTable(group, x, NESTED_CITY.levels[2], -8, 1.45, 0.72, timberLight, metal, false);
      group.add(makeBox(1.25, 1.35, 0.065, core, x, NESTED_CITY.levels[2] + 0.68, -8.48, false));
      group.add(makeBox(0.065, 1.05, 0.92, stoneLight, x - 0.82, NESTED_CITY.levels[2] + 0.53, -8, false));
    }
    // 4F observation terrace: low benches and planting beds preserve the open sky edge.
    for (const x of [9, 15]) {
      group.add(makeBox(2.25, 0.12, 0.52, timber, x, 12.48, 9.95));
      group.add(makeBox(2.25, 0.54, 0.08, timber, x, 12.75, 10.2));
      for (const dx of [-0.8, 0.8]) {
        group.add(makeBox(0.07, 0.42, 0.07, metal, x + dx, 12.21, 9.95, false));
      }
    }

    // The double-height reference library wall retains an open, glazed entrance at its centre.
    addLibraryWall(group, timber, [timberLight, stoneLight, coreLight], led);

    // Lush but restrained planting: entry planters, atrium landings and the 4F sky terrace.
    for (const [x, y, z, size] of [
      [-19, 0, 7.2, 1.3], [19, 0, 7.2, 1.3], [-19, 0, -6.8, 1.1],
      [3.1, 4, 4.5, 0.9], [22, 4, -9, 0.9],
      [7.2, 12, 10, 0.8], [17.1, 12, 10, 0.8],
    ] as const) {
      addPlanter(group, x, y, z, size, planterMat, soilMat, trunkMat, foliageMat);
    }

    // Warm LED lines under the outer timber bands and soft luminaires at each occupied floor.
    for (const y of [4, 8, 12]) {
      for (const z of [-ROOM.depth / 2 + 0.72, ROOM.depth / 2 - 0.72]) {
        group.add(makeBox(ROOM.width - 2.2, 0.025, 0.035, led, 0, y - 0.66, z, false));
      }
    }
    for (const [x, y, z] of [
      [-8, 3.5, -2], [8, 3.5, -3], [14, 7.5, 1], [8, 7.5, -7],
      [12, 11.5, 5], [10, 15.1, 2],
    ] as const) {
      const point = new THREE.PointLight(whiteModel ? "#ffffff" : "#ffd5a0", whiteModel ? 0.2 : 0.38, 9, 2);
      point.position.set(x, y, z);
      point.castShadow = false;
      group.add(point);
    }

    return disposeSceneGroup;
  }, [api, whiteModel, structureOnly]);

  return null;
};
