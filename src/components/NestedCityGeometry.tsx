"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import {
  cityTrapezoidCornerFootprint,
  cityTrapezoidWallBandFootprint,
  makeColliderBox,
  nestedCityGuardrailSegments,
  LOOK,
  NESTED_CITY,
  ROOM,
  SHELF,
  TEXTURES,
} from "@/lib/room3d";
import { SHELF_DECOR_BOOK_COLORS } from "@/lib/shelfDecorBooks";
import { attachPhotoMap } from "@/lib/roomTextures";
import type { Aabb, CityPlanPoint, CityTrapezoidWallSegment } from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

const SLAB_THICKNESS = 0.3;
const WALL_BAND_HEIGHT = 0.55;
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);

type BoxInstance = {
  width: number;
  height: number;
  depth: number;
  x: number;
  y: number;
  z: number;
  rotationY?: number;
};

type Segment3D = { from: CityPlanPoint; to: CityPlanPoint };

function registerCollider(group: THREE.Group, collider: Aabb) {
  const colliders = group.userData.collisionBoxes as Aabb[] | undefined;
  if (colliders) colliders.push(collider);
  else group.userData.collisionBoxes = [collider];
}

function addPlanPrism(
  group: THREE.Group,
  footprint: readonly CityPlanPoint[],
  bottomY: number,
  height: number,
  material: THREE.Material,
  name: string,
  collider?: Aabb,
) {
  if (footprint.length < 3 || height <= 0) return;

  const shape = new THREE.Shape();
  shape.moveTo(footprint[0].x, -footprint[0].z);
  for (const point of footprint.slice(1)) shape.lineTo(point.x, -point.z);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.y = bottomY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.kind = "trapezoidLibraryFloor";
  group.add(mesh);
  if (collider) registerCollider(group, collider);
}

function addBox(
  group: THREE.Group,
  dimensions: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  material: THREE.Material,
  name: string,
  rotationY = 0,
  collidable = true,
) {
  const mesh = new THREE.Mesh(UNIT_BOX, material);
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.y = rotationY;
  mesh.scale.set(dimensions.width, dimensions.height, dimensions.depth);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  if (collidable) {
    registerCollider(group, makeColliderBox(
      { x: position.x, z: position.z },
      dimensions.width,
      dimensions.depth,
      position.y - dimensions.height / 2,
      position.y + dimensions.height / 2,
      "model",
      rotationY,
    ));
  }
  return mesh;
}

function addBoxBatch(
  group: THREE.Group,
  boxes: readonly BoxInstance[],
  material: THREE.Material,
  name: string,
  collidable = true,
) {
  if (boxes.length === 0) return;

  const instances = new THREE.InstancedMesh(UNIT_BOX, material, boxes.length);
  instances.name = name;
  instances.castShadow = true;
  instances.receiveShadow = true;
  const transform = new THREE.Object3D();
  boxes.forEach((box, index) => {
    transform.position.set(box.x, box.y, box.z);
    transform.rotation.set(0, box.rotationY ?? 0, 0);
    transform.scale.set(box.width, box.height, box.depth);
    transform.updateMatrix();
    instances.setMatrixAt(index, transform.matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.computeBoundingSphere();
  group.add(instances);
  if (collidable) {
    for (const box of boxes) {
      registerCollider(group, makeColliderBox(
        { x: box.x, z: box.z },
        box.width,
        box.depth,
        box.y - box.height / 2,
        box.y + box.height / 2,
        "model",
        box.rotationY ?? 0,
      ));
    }
  }
}

function addBeamBetween(
  group: THREE.Group,
  from: THREE.Vector3,
  to: THREE.Vector3,
  width: number,
  height: number,
  material: THREE.Material,
  name: string,
) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  if (length < 1e-5) return;

  const beam = new THREE.Mesh(UNIT_BOX, material);
  beam.name = name;
  beam.position.copy(from).add(to).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(LOCAL_FORWARD, direction.normalize());
  beam.scale.set(width, height, length);
  beam.castShadow = true;
  beam.receiveShadow = true;
  group.add(beam);
  const horizontalLength = Math.hypot(to.x - from.x, to.z - from.z);
  const beamYaw = Math.atan2(to.x - from.x, to.z - from.z);
  const halfThickness = Math.max(width, height) / 2;
  registerCollider(group, makeColliderBox(
    { x: beam.position.x, z: beam.position.z },
    Math.max(width, height),
    Math.max(width, horizontalLength + width * 0.5),
    Math.min(from.y, to.y) - halfThickness,
    Math.max(from.y, to.y) + halfThickness,
    "model",
    beamYaw,
  ));
}

function planPointToVector(point: CityPlanPoint, y: number): THREE.Vector3 {
  return new THREE.Vector3(point.x, y, point.z);
}

function pointAlong(segment: Segment3D, t: number): CityPlanPoint {
  return {
    x: segment.from.x + (segment.to.x - segment.from.x) * t,
    z: segment.from.z + (segment.to.z - segment.from.z) * t,
  };
}

function segmentLength(segment: Segment3D): number {
  return Math.hypot(segment.to.x - segment.from.x, segment.to.z - segment.from.z);
}

function segmentYaw(segment: Segment3D): number {
  return Math.atan2(segment.to.x - segment.from.x, segment.to.z - segment.from.z);
}

function offsetPoint(point: CityPlanPoint, direction: CityPlanPoint, distance: number): CityPlanPoint {
  return { x: point.x + direction.x * distance, z: point.z + direction.z * distance };
}

function makeShelfSurfaceTexture(kind: "walnut" | "marble"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (context && kind === "walnut") {
    context.fillStyle = "#6e5c4a";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 110; index++) {
      const y = (index * 73) % canvas.height;
      context.strokeStyle = `rgba(24,18,12,${0.035 + (index % 6) * 0.012})`;
      context.lineWidth = 0.5 + (index % 3) * 0.5;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 28; x <= canvas.width; x += 28) {
        context.lineTo(x, y + Math.sin(x * 0.018 + index * 1.7) * 2.6);
      }
      context.stroke();
    }
  } else if (context) {
    context.fillStyle = "#e7e6e2";
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 18; index++) {
      context.strokeStyle = `rgba(150,150,146,${0.05 + (index % 5) * 0.018})`;
      context.lineWidth = 0.6 + (index % 4) * 0.45;
      context.beginPath();
      let x = (index * 47) % canvas.width;
      context.moveTo(x, 0);
      for (let y = 16; y <= canvas.height; y += 16) {
        x += ((index + y) % 3 - 1) * 5;
        context.lineTo(x, y);
      }
      context.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  const repeat = kind === "walnut" ? TEXTURES.repeat.shelf : [2.6, 1.2] as const;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 4;
  return texture;
}

function makeWarmShelfGlowTexture(whiteModel: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, whiteModel ? "rgba(255,255,255,0.85)" : "rgba(255,196,132,0.85)");
    gradient.addColorStop(0.35, whiteModel ? "rgba(255,255,255,0.38)" : "rgba(255,168,104,0.38)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addTrapezoidShell(group: THREE.Group, material: THREE.Material) {
  const { A, B, C, D } = NESTED_CITY.trapezoid.points;
  const shell = new THREE.Group();
  shell.name = "trapezoid-exterior-ABCD-open-CD";
  shell.userData.exteriorBoundary = "ABCD";
  shell.userData.openEdge = "CD";
  group.add(shell);

  // Four corner piers and the three specified perimeter bands; CD intentionally remains open.
  for (const [id, point] of Object.entries({ A, B, C, D })) {
    addPlanPrism(
      shell,
      cityTrapezoidCornerFootprint(point, ROOM.wall),
      0,
      ROOM.height,
      material,
      `trapezoid-corner:${id}`,
      makeColliderBox(point, ROOM.wall, ROOM.wall, 0, ROOM.height),
    );
  }

  for (const wall of NESTED_CITY.trapezoid.wallEdges) {
    const footprint = cityTrapezoidWallBandFootprint(wall, ROOM.wall);
    const dx = wall.to.x - wall.from.x;
    const dz = wall.to.z - wall.from.z;
    const length = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    const center = {
      x: (wall.from.x + wall.to.x) / 2 + wall.inward.x * ROOM.wall / 2,
      z: (wall.from.z + wall.to.z) / 2 + wall.inward.z * ROOM.wall / 2,
    };
    for (const level of NESTED_CITY.trapezoid.wallBandLevels) {
      const bottom = level === ROOM.height ? level - WALL_BAND_HEIGHT : level;
      addPlanPrism(
        shell,
        footprint,
        bottom,
        WALL_BAND_HEIGHT,
        material,
        `trapezoid-wall:${wall.id}:${level}`,
        makeColliderBox(center, ROOM.wall, length, bottom, bottom + WALL_BAND_HEIGHT, "model", yaw),
      );
    }
  }
}

function addGroundFloor(group: THREE.Group, material: THREE.Material) {
  const { A, B, C, D } = NESTED_CITY.trapezoid.points;
  addPlanPrism(group, [A, B, C, D], -0.16, 0.16, material, "library-ground-floor-ABCD");
}

function addGalleryFloors(
  group: THREE.Group,
  galleryMaterial: THREE.Material,
  corridorMaterial: THREE.Material,
  structureOnly: boolean,
) {
  for (const layout of NESTED_CITY.gallery.floorLayouts) {
    layout.galleryFootprints.forEach((footprint, index) => {
      const edgeId = layout.gallerySegments[index].id;
      addPlanPrism(
        group,
        footprint,
        layout.level + 0.003 - SLAB_THICKNESS,
        SLAB_THICKNESS,
        galleryMaterial,
        `library-gallery-floor:${layout.floorNumber}F:${edgeId}`,
      );
    });
  }

  for (const layout of NESTED_CITY.corridor.floorLayouts) {
    const top = layout.level === 0 && !structureOnly ? 0.014 : layout.level + 0.014;
    layout.corridorFootprints.forEach((footprint, index) => {
      const edgeId = layout.corridorSegments[index].id;
      addPlanPrism(
        group,
        footprint,
        top - 0.045,
        0.045,
        corridorMaterial,
        `connected-corridor:${layout.floorNumber}F:${edgeId}`,
      );
    });
  }
}

function addSideBookshelves(
  group: THREE.Group,
  walls: readonly CityTrapezoidWallSegment[],
  panelMaterial: THREE.Material,
  woodMaterial: THREE.Material,
  ledMaterial: THREE.Material,
  glowMaterial: THREE.Material,
  bookMaterials: readonly THREE.Material[],
) {
  const sideWalls = walls.filter((wall) => wall.id === "BC" || wall.id === "AD");
  const panels: BoxInstance[] = [];
  const verticalPosts: BoxInstance[] = [];
  const shelves: BoxInstance[] = [];
  const ledStrips: BoxInstance[] = [];
  const topLedStrips: BoxInstance[] = [];
  const glowPlanes: BoxInstance[] = [];
  const bookBatches = bookMaterials.map(() => [] as BoxInstance[]);
  const rowCount = 6;
  const backThickness = 0.014;
  const frameThickness = 0.045;
  const frameDepth = SHELF.depth + 0.02;
  const frameHeight = 3.76;
  const capHeight = 0.1;

  for (let wallIndex = 0; wallIndex < sideWalls.length; wallIndex++) {
    const wall = sideWalls[wallIndex];
    const wallLine = { from: wall.from, to: wall.to };
    const length = segmentLength(wallLine);
    const yaw = segmentYaw(wallLine);
    const first = 0.55;
    const last = length - 0.55;
    const bayCount = Math.ceil((last - first) / 2.75);
    const bayLength = (last - first) / bayCount;
    const bays = Array.from({ length: bayCount }, (_, index) => ({
      start: first + index * bayLength,
      end: first + (index + 1) * bayLength,
    }));

    for (let floorIndex = 0; floorIndex < NESTED_CITY.levels.length; floorIndex++) {
      const floorY = NESTED_CITY.levels[floorIndex];
      for (let bayIndex = 0; bayIndex < bays.length; bayIndex++) {
        const bay = bays[bayIndex];
        const centerDistance = (bay.start + bay.end) / 2;
        const centerOnWall = pointAlong(wallLine, centerDistance / length);
        const bayLength = bay.end - bay.start;
        const bookcaseCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + frameDepth / 2);
        const backingCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + backThickness / 2);
        const shelfCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + SHELF.depth / 2);
        const lightCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + SHELF.depth - 0.024);
        const glowCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + 0.024);

        registerCollider(group, makeColliderBox(
          bookcaseCenter,
          frameDepth,
          bayLength,
          floorY,
          floorY + frameHeight,
          "model",
          yaw,
        ));
        panels.push({
          width: backThickness,
          height: frameHeight,
          depth: bayLength,
          x: backingCenter.x,
          y: floorY + frameHeight / 2,
          z: backingCenter.z,
          rotationY: yaw,
        });

        for (let row = 0; row < rowCount; row++) {
          const boardTopY = floorY + frameHeight - capHeight - row * 0.55;
          const boardLength = bayLength - frameThickness;
          shelves.push({
            width: SHELF.depth,
            height: SHELF.plank,
            depth: boardLength,
            x: shelfCenter.x,
            y: boardTopY - SHELF.plank / 2,
            z: shelfCenter.z,
            rotationY: yaw,
          });
          ledStrips.push({
            width: 0.012,
            height: 0.018,
            depth: boardLength - 0.08,
            x: lightCenter.x,
            y: boardTopY - SHELF.plank - 0.009,
            z: lightCenter.z,
            rotationY: yaw,
          });
          glowPlanes.push({
            width: boardLength - 0.06,
            height: 0.34,
            depth: 1,
            x: glowCenter.x,
            y: boardTopY - SHELF.plank - 0.17,
            z: glowCenter.z,
            rotationY: Math.atan2(wall.inward.x, wall.inward.z),
          });

          // Keep the same muted solid-color book blocks and warm palette as the main wall shelf.
          const bookStart = bay.start + frameThickness / 2 + 0.025;
          const bookEnd = bay.end - frameThickness / 2 - 0.025;
          let distance = bookStart;
          let bookIndex = 0;
          while (distance < bookEnd - 0.022) {
            const pattern = wallIndex * 13 + bayIndex * 7 + row * 11 + bookIndex * 5 + floorIndex * 3;
            const thickness = 0.022 + (pattern % 27) * 0.001;
            if (distance + thickness > bookEnd) break;
            const height = 0.16 + ((pattern * 3) % 8) * 0.01;
            const depth = 0.16 + ((pattern * 7) % 5) * 0.01;
            const spinePoint = pointAlong(wallLine, (distance + thickness / 2) / length);
            const bookCenter = offsetPoint(
              spinePoint,
              wall.inward,
              ROOM.wall + SHELF.depth - 0.012 - depth / 2,
            );
            const materialIndex = pattern % bookBatches.length;
            bookBatches[materialIndex].push({
              width: depth,
              height,
              depth: thickness,
              x: bookCenter.x,
              y: boardTopY + 0.0015 + height / 2,
              z: bookCenter.z,
              rotationY: yaw,
            });
            distance += thickness + 0.002 + (bookIndex % 17 === 0 ? 0.018 : 0);
            bookIndex++;
          }
        }

        // A slim dark-walnut header closes each built-in shelf section like the main wall unit.
        const capCenter = offsetPoint(centerOnWall, wall.inward, ROOM.wall + frameDepth / 2);
        verticalPosts.push({
          width: frameDepth,
          height: capHeight,
          depth: bayLength,
          x: capCenter.x,
          y: floorY + frameHeight - capHeight / 2,
          z: capCenter.z,
          rotationY: yaw,
        });
        topLedStrips.push({
          width: 0.014,
          height: 0.02,
          depth: bayLength - 0.12,
          x: offsetPoint(centerOnWall, wall.inward, ROOM.wall + frameDepth - 0.02).x,
          y: floorY + frameHeight - 0.035,
          z: offsetPoint(centerOnWall, wall.inward, ROOM.wall + frameDepth - 0.02).z,
          rotationY: yaw,
        });
      }

      // Full-depth walnut end panels frame each run; adjoining bays share their divider.
      const boundaryDistances = [bays[0].start, ...bays.map(({ end }) => end)];
      for (const boundaryDistance of boundaryDistances) {
        const point = pointAlong(wallLine, boundaryDistance / length);
        const postCenter = offsetPoint(point, wall.inward, ROOM.wall + frameDepth / 2);
        verticalPosts.push({
          width: frameDepth,
          height: frameHeight,
          depth: frameThickness,
          x: postCenter.x,
          y: floorY + frameHeight / 2,
          z: postCenter.z,
          rotationY: yaw,
        });
      }
    }
  }

  addBoxBatch(group, panels, panelMaterial, "warm-stone-bookshelf-backing", false);
  addBoxBatch(group, shelves, woodMaterial, "dark-walnut-floating-shelf-boards", false);
  addBoxBatch(group, verticalPosts, woodMaterial, "dark-walnut-bookshelf-frames", false);
  addBoxBatch(group, ledStrips, ledMaterial, "warm-bookshelf-led-strips", false);
  addBoxBatch(group, topLedStrips, ledMaterial, "warm-bookshelf-header-light", false);
  bookBatches.forEach((books, index) => {
    addBoxBatch(group, books, bookMaterials[index], `instanced-library-books:${index}`, false);
  });

  if (glowPlanes.length) {
    const geometry = new THREE.PlaneGeometry(1, 1);
    const instances = new THREE.InstancedMesh(geometry, glowMaterial, glowPlanes.length);
    instances.name = "warm-bookshelf-light-wash";
    instances.castShadow = false;
    instances.receiveShadow = false;
    const transform = new THREE.Object3D();
    glowPlanes.forEach((plane, index) => {
      transform.position.set(plane.x, plane.y, plane.z);
      transform.rotation.set(0, plane.rotationY ?? 0, 0);
      transform.scale.set(plane.width, plane.height, 1);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    group.add(instances);
  }

}

function addGuardrail(
  group: THREE.Group,
  segment: Segment3D,
  floorY: number,
  material: THREE.Material,
  glassMaterial: THREE.Material,
  name: string,
) {
  const length = segmentLength(segment);
  if (length < 0.5) return;
  const yaw = segmentYaw(segment);
  const midpoint = pointAlong(segment, 0.5);
  const postCount = Math.ceil(length / 2.2);
  const posts: BoxInstance[] = [];
  for (let index = 0; index <= postCount; index++) {
    const point = pointAlong(segment, index / postCount);
    posts.push({
      width: 0.1,
      height: 1.04,
      depth: 0.1,
      x: point.x,
      y: floorY + 0.52,
      z: point.z,
      rotationY: yaw,
    });
  }
  addBoxBatch(group, posts, material, `${name}:posts`);

  addBox(
    group,
    { width: 0.07, height: 0.8, depth: length },
    { x: midpoint.x, y: floorY + 0.57, z: midpoint.z },
    glassMaterial,
    `${name}:clear-infill`,
    yaw,
  );
  const from = planPointToVector(segment.from, floorY + 0.1);
  const to = planPointToVector(segment.to, floorY + 0.1);
  addBeamBetween(group, from, to, 0.12, 0.1, material, `${name}:bottom-rail`);
  addBeamBetween(
    group,
    planPointToVector(segment.from, floorY + 1.02),
    planPointToVector(segment.to, floorY + 1.02),
    0.14,
    0.14,
    material,
    `${name}:top-rail`,
  );
}

function addGalleryGuardrails(
  group: THREE.Group,
  darkMaterial: THREE.Material,
  glassMaterial: THREE.Material,
) {
  for (const segment of nestedCityGuardrailSegments()) {
    addGuardrail(
      group,
      segment,
      segment.level,
      darkMaterial,
      glassMaterial,
      segment.colliderId,
    );
  }
}

function addGalleryStairs(
  group: THREE.Group,
  treadMaterial: THREE.Material,
  landingMaterial: THREE.Material,
  railMaterial: THREE.Material,
) {
  const treadBoxes: BoxInstance[] = [];
  for (const flight of NESTED_CITY.stairs.flights) {
    for (const tread of flight.treads) {
      treadBoxes.push({
        width: flight.width,
        height: flight.riserHeight,
        depth: flight.treadDepth + 0.02,
        x: tread.center.x,
        y: tread.topHeight - flight.riserHeight / 2,
        z: tread.center.z,
        rotationY: flight.yaw,
      });
    }

    const dx = flight.end.x - flight.start.x;
    const dz = flight.end.z - flight.start.z;
    const horizontalLength = Math.hypot(dx, dz);
    const direction = { x: dx / horizontalLength, z: dz / horizontalLength };
    const across = { x: -direction.z, z: direction.x };
    const railOffset = flight.width / 2 + 0.08;
    for (const side of [-1, 1]) {
      const offset = { x: across.x * railOffset * side, z: across.z * railOffset * side };
      const start = new THREE.Vector3(
        flight.start.x + offset.x,
        flight.lowerLevel + 0.92,
        flight.start.z + offset.z,
      );
      const end = new THREE.Vector3(
        flight.end.x + offset.x,
        flight.upperLevel + 0.92,
        flight.end.z + offset.z,
      );
      addBeamBetween(group, start, end, 0.075, 0.075, railMaterial,
        `gallery-stair:${flight.id}:handrail:${side}`);

      for (const t of [0, 0.5, 1]) {
        const point = {
          x: flight.start.x + dx * t + offset.x,
          z: flight.start.z + dz * t + offset.z,
        };
        const floorY = flight.lowerLevel + (flight.upperLevel - flight.lowerLevel) * t;
        addBox(group, { width: 0.075, height: 0.92, depth: 0.075 }, {
          x: point.x,
          y: floorY + 0.46,
          z: point.z,
        }, railMaterial, `gallery-stair:${flight.id}:newel:${side}:${t}`);
      }
    }
  }
  // Tread tops are standable surfaces handled by groundHeightAt; side-wall collisions would block climbing.
  addBoxBatch(group, treadBoxes, treadMaterial, "gallery-stair-treads-all-sides", false);

  const landingGroups = new Map<string, Array<(typeof NESTED_CITY.stairs.landings)[number]>>();
  for (const landing of NESTED_CITY.stairs.landings) {
    const key = `${landing.edge}:${landing.level}:${landing.connectionT.toFixed(6)}`;
    const group = landingGroups.get(key) ?? [];
    group.push(landing);
    landingGroups.set(key, group);
  }
  for (const landings of landingGroups.values()) {
    const landing = landings.reduce((longest, candidate) => {
      const candidateLength = Math.hypot(
        candidate.center.x - candidate.connectionPoint.x,
        candidate.center.z - candidate.connectionPoint.z,
      );
      const longestLength = Math.hypot(
        longest.center.x - longest.connectionPoint.x,
        longest.center.z - longest.connectionPoint.z,
      );
      return candidateLength > longestLength ? candidate : longest;
    });
    addPlanPrism(
      group,
      landing.footprint,
      landing.level - 0.12,
      0.14,
      landingMaterial,
      `gallery-stair-landing:${landing.edge}:${landing.level}m:${landing.id}`,
    );
  }
}

function addGallerySupportBeams(group: THREE.Group, material: THREE.Material) {
  for (const layout of NESTED_CITY.gallery.floorLayouts) {
    const floorY = layout.level;
    const outerSupportEdges = layout.galleryOuterEdges.filter(({ id }) => layout.sideClearance > 0 || id === "CD");
    for (const edge of [...layout.galleryInnerEdges, ...outerSupportEdges]) {
      addBeamBetween(
        group,
        planPointToVector(edge.from, floorY - 0.16),
        planPointToVector(edge.to, floorY - 0.16),
        0.2,
        0.26,
        material,
        `gallery-ring-girder:${edge.id}:${floorY}m`,
      );
    }
  }
}

function addGallerySupportColumns(group: THREE.Group, material: THREE.Material) {
  for (const layout of NESTED_CITY.gallery.floorLayouts) {
    const floorY = layout.level;
    const levelIndex = NESTED_CITY.levels.indexOf(floorY as (typeof NESTED_CITY.levels)[number]);
    const bottomY = NESTED_CITY.levels[levelIndex - 1] ?? 0;
    const height = floorY - bottomY;
    const outerSupportEdges = layout.galleryOuterEdges.filter(({ id }) => layout.sideClearance > 0 || id === "CD");
    const supportRuns = [
      ...layout.galleryInnerEdges.map((edge) => ({ edge, positions: [0.25, 0.75] as const, kind: "atrium" })),
      ...outerSupportEdges.map((edge) => ({ edge, positions: [0.33, 0.67] as const, kind: "perimeter" })),
    ];
    for (const { edge, positions, kind } of supportRuns) {
      for (const t of positions) {
        if (kind === "atrium" && NESTED_CITY.stairs.landings.some((landing) =>
          landing.edge === edge.id &&
          Math.abs(landing.connectionT - t) * segmentLength(edge) < landing.width / 2 + 0.4,
        )) continue;
        const point = pointAlong(edge, t);
        addBox(
          group,
          { width: 0.28, height, depth: 0.28 },
          { x: point.x, y: bottomY + height / 2, z: point.z },
          material,
          `gallery-support-column:${kind}:${edge.id}:${floorY}m:${t}`,
        );
      }
    }
  }
}

function rotateLocalPoint(center: CityPlanPoint, localX: number, localZ: number, yaw: number): CityPlanPoint {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: center.x + localX * cos + localZ * sin,
    z: center.z - localX * sin + localZ * cos,
  };
}

function addReadingTable(
  group: THREE.Group,
  center: CityPlanPoint,
  floorY: number,
  yaw: number,
  woodMaterial: THREE.Material,
  metalMaterial: THREE.Material,
  index: number,
) {
  const tableWidth = 0.82;
  const tableDepth = 1.25;
  const tableTopY = floorY + 0.78;
  const tablePosition = { x: center.x, y: tableTopY, z: center.z };
  addBox(
    group,
    { width: tableWidth, height: 0.09, depth: tableDepth },
    tablePosition,
    woodMaterial,
    `gallery-reading-table:${index}:top`,
    yaw,
  );

  for (const localX of [-tableWidth / 2 + 0.07, tableWidth / 2 - 0.07]) {
    for (const localZ of [-tableDepth / 2 + 0.08, tableDepth / 2 - 0.08]) {
      const leg = rotateLocalPoint(center, localX, localZ, yaw);
      addBox(
        group,
        { width: 0.065, height: 0.74, depth: 0.065 },
        { x: leg.x, y: floorY + 0.37, z: leg.z },
        metalMaterial,
        `gallery-reading-table:${index}:leg`,
        yaw,
      );
    }
  }

  const seatCenter = rotateLocalPoint(center, 0, tableDepth / 2 + 0.3, yaw);
  addBox(
    group,
    { width: 0.56, height: 0.08, depth: 0.32 },
    { x: seatCenter.x, y: floorY + 0.46, z: seatCenter.z },
    woodMaterial,
    `gallery-reading-seat:${index}`,
    yaw,
  );
}

function addPlanter(
  group: THREE.Group,
  center: CityPlanPoint,
  floorY: number,
  woodMaterial: THREE.Material,
  soilMaterial: THREE.Material,
  leafMaterial: THREE.Material,
  index: number,
) {
  addBox(
    group,
    { width: 0.72, height: 0.46, depth: 0.72 },
    { x: center.x, y: floorY + 0.23, z: center.z },
    woodMaterial,
    `library-planter:${index}:box`,
  );
  addBox(
    group,
    { width: 0.62, height: 0.04, depth: 0.62 },
    { x: center.x, y: floorY + 0.47, z: center.z },
    soilMaterial,
    `library-planter:${index}:soil`,
  );
  registerCollider(group, makeColliderBox(
    { x: center.x, z: center.z },
    0.72,
    0.72,
    floorY + 0.46,
    floorY + 1.32,
  ));

  const foliageGeometry = new THREE.IcosahedronGeometry(0.25, 1);
  for (const [dx, dy, dz, scale] of [
    [-0.16, 0.78, 0, 0.9], [0.13, 0.91, 0.08, 1.1], [0.02, 1.08, -0.13, 0.82],
  ] as const) {
    const foliage = new THREE.Mesh(foliageGeometry, leafMaterial);
    foliage.name = `library-planter:${index}:foliage`;
    foliage.position.set(center.x + dx, floorY + dy, center.z + dz);
    foliage.scale.set(scale, scale * 1.15, scale);
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    group.add(foliage);
  }
}

function addGalleryFurniture(
  group: THREE.Group,
  walls: readonly CityTrapezoidWallSegment[],
  woodMaterial: THREE.Material,
  metalMaterial: THREE.Material,
  soilMaterial: THREE.Material,
  leafMaterial: THREE.Material,
) {
  let tableIndex = 0;
  let planterIndex = 0;
  for (const layout of NESTED_CITY.gallery.floorLayouts) {
    const wall = walls.find(({ id }) => id === layout.sideWall);
    if (!wall) continue;

    const side = { from: wall.from, to: wall.to };
    const yaw = segmentYaw(side);
    for (const t of [0.19, 0.39, 0.61, 0.81]) {
      const center = offsetPoint(pointAlong(side, t), wall.inward, ROOM.wall + layout.sideClearance + 2.82);
      addReadingTable(group, center, layout.level, yaw, woodMaterial, metalMaterial, tableIndex++);
    }

    for (const t of [0.08, 0.92]) {
      const center = offsetPoint(pointAlong(side, t), wall.inward, ROOM.wall + layout.sideClearance + 3.52);
      addPlanter(group, center, layout.level, woodMaterial, soilMaterial, leafMaterial, planterIndex++);
    }
  }
}

export const NestedCityGeometry: React.FC<{
  api: StudySceneApi;
  whiteModel?: boolean;
  structureOnly?: boolean;
}> = ({ api, whiteModel = false, structureOnly = false }) => {
  useEffect(() => {
    const group = new THREE.Group();
    group.name = "multi-level-trapezoid-library";
    api.scene.add(group);

    const originalEnvironmentIntensity = api.scene.environmentIntensity;
    // Three.js owns this mutable scene property; isolate the structural view from environment reflections.
    // eslint-disable-next-line react-hooks/immutability -- intentional imperative Three.js scene mutation
    if (structureOnly) api.scene.environmentIntensity = 0;

    const materials: THREE.Material[] = [];
    const material = (options: THREE.MeshStandardMaterialParameters) => {
      const created = new THREE.MeshStandardMaterial(options);
      materials.push(created);
      return created;
    };
    const color = (normal: string, white = "#f2f0ec") => whiteModel ? white : normal;

    const wallMaterial = material({
      color: color("#41474b"), roughness: 0.88, metalness: 0.08, envMapIntensity: structureOnly ? 0 : 0.05,
    });
    const groundMaterial = material({
      color: color(structureOnly ? "#795d42" : "#725c47"), roughness: 0.82, metalness: 0.02, envMapIntensity: 0,
    });
    const galleryMaterial = material({
      color: color(structureOnly ? "#846747" : "#806345"), roughness: 0.78, metalness: 0.01, envMapIntensity: 0,
    });
    const corridorMaterial = material({
      color: color(structureOnly ? "#a18461" : "#947352"), roughness: 0.78, metalness: 0.01, envMapIntensity: 0,
    });
    const darkMaterial = material({
      color: color("#343a3e"), roughness: 0.72, metalness: 0.32, envMapIntensity: structureOnly ? 0 : 0.06,
    });
    const shelfWoodTexture = whiteModel ? null : makeShelfSurfaceTexture("walnut");
    const shelfBackTexture = whiteModel ? null : makeShelfSurfaceTexture("marble");
    const shelfGlowTexture = makeWarmShelfGlowTexture(whiteModel);
    const ownedTextures = [shelfGlowTexture, shelfWoodTexture, shelfBackTexture]
      .filter((texture): texture is THREE.CanvasTexture => texture !== null);
    const textureDisposers: Array<() => void> = [];
    const shelfWoodMaterial = material({
      color: color(LOOK.shelfWood), map: shelfWoodTexture,
      roughness: 0.52, metalness: 0.03,
    });
    const shelfBackMaterial = material({
      color: color(LOOK.shelfBack), map: shelfBackTexture,
      roughness: 0.8, metalness: 0,
      emissive: new THREE.Color(whiteModel ? "#f2f0ec" : "#5d472f"),
      emissiveIntensity: whiteModel ? 0 : 0.07,
    });
    if (!whiteModel) {
      const anisotropy = Math.min(8, api.renderer.capabilities.getMaxAnisotropy());
      textureDisposers.push(attachPhotoMap(shelfWoodMaterial, "walnut", {
        anisotropy,
        repeat: TEXTURES.repeat.shelf,
        tint: LOOK.shelfWoodTint,
      }));
      textureDisposers.push(attachPhotoMap(shelfBackMaterial, "marble", {
        anisotropy,
        repeat: [2.6, 1.2],
        tint: LOOK.shelfBackTint,
      }));
    }
    const shelfLedMaterial = new THREE.MeshBasicMaterial({ color: color(LOOK.ledSoft), toneMapped: false });
    const shelfGlowMaterial = new THREE.MeshBasicMaterial({
      map: shelfGlowTexture,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.push(shelfLedMaterial, shelfGlowMaterial);
    const timberMaterial = material({
      color: color("#b78350"), roughness: 0.73, metalness: 0.01, envMapIntensity: 0,
    });
    const stairWoodMaterial = material({
      color: color("#a67748"), roughness: 0.68, metalness: 0.02, envMapIntensity: 0,
    });
    const bookMaterials = SHELF_DECOR_BOOK_COLORS.map((bookColor) => material({
      color: color(bookColor), roughness: 0.86, metalness: 0, envMapIntensity: 0,
    }));
    const glassMaterial = material({
      color: color("#a9c1c6"), roughness: 0.16, metalness: 0.08, transparent: true, opacity: whiteModel ? 0.28 : 0.24,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const tableMetalMaterial = material({
      color: color("#4a4d4b"), roughness: 0.58, metalness: 0.42, envMapIntensity: 0,
    });
    const soilMaterial = material({ color: color("#49382b"), roughness: 1, metalness: 0, envMapIntensity: 0 });
    const leafMaterial = material({
      color: color("#698253"), roughness: 0.9, metalness: 0, envMapIntensity: 0,
    });

    const ownedGeometries: THREE.BufferGeometry[] = [];
    addTrapezoidShell(group, wallMaterial);
    if (structureOnly) addGroundFloor(group, groundMaterial);
    addGalleryFloors(group, galleryMaterial, corridorMaterial, structureOnly);
    addSideBookshelves(
      group,
      NESTED_CITY.trapezoid.wallEdges,
      shelfBackMaterial,
      shelfWoodMaterial,
      shelfLedMaterial,
      shelfGlowMaterial,
      bookMaterials,
    );
    addGallerySupportBeams(group, darkMaterial);
    addGallerySupportColumns(group, darkMaterial);
    addGalleryGuardrails(group, darkMaterial, glassMaterial);
    addGalleryStairs(group, stairWoodMaterial, corridorMaterial, darkMaterial);

    addGalleryFurniture(group, NESTED_CITY.trapezoid.wallEdges, timberMaterial, tableMetalMaterial, soilMaterial, leafMaterial);

    if (structureOnly) {
      const hemisphere = new THREE.HemisphereLight("#f4f6fa", "#77736c", 2.25);
      const key = new THREE.DirectionalLight("#fff4e6", 2.65);
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
      group.add(hemisphere, key, key.target);
    }

    // Keep the plant geometry shared among planters, but dispose it with this scene group.
    group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry !== UNIT_BOX && !ownedGeometries.includes(object.geometry)) {
        ownedGeometries.push(object.geometry);
      }
    });

    return () => {
      api.scene.remove(group);
      if (structureOnly) api.scene.environmentIntensity = originalEnvironmentIntensity;
      textureDisposers.forEach((dispose) => dispose());
      ownedGeometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
      ownedTextures.forEach((texture) => texture.dispose());
    };
  }, [api, structureOnly, whiteModel]);

  return null;
};
