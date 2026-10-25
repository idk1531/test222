"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import {
  cityTrapezoidCornerFootprint,
  cityTrapezoidWallBandFootprint,
  NESTED_CITY,
  ROOM,
} from "@/lib/room3d";
import type { CityPlanPoint, CityTrapezoidWallSegment } from "@/lib/room3d";
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

function addPlanPrism(
  group: THREE.Group,
  footprint: readonly CityPlanPoint[],
  bottomY: number,
  height: number,
  material: THREE.Material,
  name: string,
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
}

function addBox(
  group: THREE.Group,
  dimensions: { width: number; height: number; depth: number },
  position: { x: number; y: number; z: number },
  material: THREE.Material,
  name: string,
  rotationY = 0,
) {
  const mesh = new THREE.Mesh(UNIT_BOX, material);
  mesh.name = name;
  mesh.position.set(position.x, position.y, position.z);
  mesh.rotation.y = rotationY;
  mesh.scale.set(dimensions.width, dimensions.height, dimensions.depth);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addBoxBatch(group: THREE.Group, boxes: readonly BoxInstance[], material: THREE.Material, name: string) {
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
    );
  }

  for (const wall of NESTED_CITY.trapezoid.wallEdges) {
    const footprint = cityTrapezoidWallBandFootprint(wall, ROOM.wall);
    for (const level of NESTED_CITY.trapezoid.wallBandLevels) {
      const bottom = level === ROOM.height ? level - WALL_BAND_HEIGHT : level;
      addPlanPrism(
        shell,
        footprint,
        bottom,
        WALL_BAND_HEIGHT,
        material,
        `trapezoid-wall:${wall.id}:${level}`,
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
  bookMaterials: readonly THREE.Material[],
) {
  const sideWalls = walls.filter((wall) => wall.id === "BC" || wall.id === "AD");
  const panels: BoxInstance[] = [];
  const verticalPosts: BoxInstance[] = [];
  const shelves: BoxInstance[] = [];
  const bookBatches = bookMaterials.map(() => [] as BoxInstance[]);

  for (const wall of sideWalls) {
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
        const bayDepth = bay.end - bay.start;
        const shelfCenter = offsetPoint(centerOnWall, wall.inward, 0.76);
        const backCenter = offsetPoint(centerOnWall, wall.inward, 0.43);
        panels.push({
          width: 0.14,
          height: 3.72,
          depth: bayDepth - 0.045,
          x: backCenter.x,
          y: floorY + 1.86,
          z: backCenter.z,
          rotationY: yaw,
        });

        // Narrow timber uprights divide the very long book wall into readable bays.
        const postCenter = offsetPoint(centerOnWall, wall.inward, 0.74);
        verticalPosts.push({
          width: 0.17,
          height: 3.76,
          depth: 0.16,
          x: postCenter.x,
          y: floorY + 1.88,
          z: postCenter.z,
          rotationY: yaw,
        });

        const rowCount = 6;
        for (let row = 0; row < rowCount; row++) {
          const boardY = floorY + 0.43 + row * 0.55;
          shelves.push({
            width: 0.62,
            height: 0.075,
            depth: bayDepth - 0.08,
            x: shelfCenter.x,
            y: boardY,
            z: shelfCenter.z,
            rotationY: yaw,
          });

          const spacing = 0.14;
          const bookCount = Math.max(1, Math.floor((bayDepth - 0.2) / spacing));
          for (let bookIndex = 0; bookIndex < bookCount; bookIndex++) {
            const distance = centerDistance + (bookIndex - (bookCount - 1) / 2) * spacing;
            const spinePoint = offsetPoint(pointAlong(wallLine, distance / length), wall.inward, 0.79);
            const height = 0.32 + ((bayIndex * 13 + row * 7 + bookIndex * 3 + floorIndex) % 11) * 0.014;
            const materialIndex = (bayIndex * 3 + row + bookIndex * 5 + floorIndex) % bookBatches.length;
            bookBatches[materialIndex].push({
              width: 0.095,
              height,
              depth: 0.075 + ((bookIndex + row) % 3) * 0.012,
              x: spinePoint.x,
              y: boardY + 0.0375 + height / 2,
              z: spinePoint.z,
              rotationY: yaw,
            });
          }
        }
      }

      // A consistent wooden stile at each bay joint emphasizes the repeated, multi-storey shelves.
      for (const boundaryDistance of [first, ...bays.map(({ end }) => end)]) {
        const postPoint = offsetPoint(pointAlong(wallLine, boundaryDistance / length), wall.inward, 0.73);
        verticalPosts.push({
          width: 0.2,
          height: 3.8,
          depth: 0.2,
          x: postPoint.x,
          y: floorY + 1.9,
          z: postPoint.z,
          rotationY: yaw,
        });
      }
    }
  }

  addBoxBatch(group, panels, panelMaterial, "continuous-side-bookshelf-backing");
  addBoxBatch(group, shelves, woodMaterial, "six-tier-oak-shelf-boards");
  addBoxBatch(group, verticalPosts, woodMaterial, "bookshelf-bay-stiles");
  bookBatches.forEach((books, index) => {
    addBoxBatch(group, books, bookMaterials[index], `instanced-library-books:${index}`);
  });
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
  for (const layout of NESTED_CITY.gallery.floorLayouts) {
    const floorY = layout.level;
    for (const edge of layout.galleryInnerEdges) {
      addGuardrail(group, edge, floorY, darkMaterial, glassMaterial,
        `gallery-atrium-rail:${edge.id}:${floorY}m`);
    }
    const outerRailEdges = layout.galleryOuterEdges.filter(({ id }) => layout.sideClearance > 0 || id === "CD");
    for (const edge of outerRailEdges) {
      addGuardrail(group, edge, floorY, darkMaterial, glassMaterial,
        `gallery-perimeter-rail:${edge.id}:${floorY}m`);
    }
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

function addPortalFrame(
  group: THREE.Group,
  options: {
    name: string;
    centerX: number;
    centerZ: number;
    width: number;
    depth: number;
    bottom: number;
    top: number;
    section: number;
    material: THREE.Material;
    bandLevels: readonly number[];
  },
) {
  const { centerX, centerZ, width, depth, bottom, top, section, material, name, bandLevels } = options;
  const xMin = centerX - width / 2;
  const xMax = centerX + width / 2;
  const zMin = centerZ - depth / 2;
  const zMax = centerZ + depth / 2;
  const postHeight = top - bottom;

  for (const [x, z, id] of [
    [xMin, zMin, "SW"], [xMin, zMax, "NW"], [xMax, zMin, "SE"], [xMax, zMax, "NE"],
  ] as const) {
    addBox(
      group,
      { width: section, height: postHeight, depth: section },
      { x, y: (bottom + top) / 2, z },
      material,
      `${name}:post:${id}`,
    );
  }

  const levels = [...new Set([bottom, ...bandLevels, top])].filter((level) => level >= bottom && level <= top);
  for (const level of levels) {
    for (const z of [zMin, zMax]) {
      addBeamBetween(
        group,
        new THREE.Vector3(xMin, level, z),
        new THREE.Vector3(xMax, level, z),
        section,
        section,
        material,
        `${name}:beam:x:${z}:${level}`,
      );
    }
    for (const x of [xMin, xMax]) {
      addBeamBetween(
        group,
        new THREE.Vector3(x, level, zMin),
        new THREE.Vector3(x, level, zMax),
        section,
        section,
        material,
        `${name}:beam:z:${x}:${level}`,
      );
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
      const center = offsetPoint(pointAlong(side, t), wall.inward, layout.sideClearance + 2.82);
      addReadingTable(group, center, layout.level, yaw, woodMaterial, metalMaterial, tableIndex++);
    }

    for (const t of [0.08, 0.92]) {
      const center = offsetPoint(pointAlong(side, t), wall.inward, layout.sideClearance + 3.52);
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
    const shelfPanelMaterial = material({
      color: color("#35393a"), roughness: 0.88, metalness: 0.02, envMapIntensity: 0,
    });
    const timberMaterial = material({
      color: color("#b78350"), roughness: 0.73, metalness: 0.01, envMapIntensity: 0,
    });
    const frameWoodMaterial = material({
      color: color("#a67748"), roughness: 0.68, metalness: 0.02, envMapIntensity: 0,
    });
    const bookMaterials = [
      "#a45c43", "#bc864c", "#557765", "#395b6c", "#c8ad7b", "#88515a", "#5f5449", "#d4c2a5",
    ].map((bookColor) => material({
      color: color(bookColor), roughness: 0.82, metalness: 0, envMapIntensity: 0,
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
    addSideBookshelves(group, NESTED_CITY.trapezoid.wallEdges, shelfPanelMaterial, timberMaterial, bookMaterials);
    addGallerySupportBeams(group, darkMaterial);
    addGallerySupportColumns(group, darkMaterial);
    addGalleryGuardrails(group, darkMaterial, glassMaterial);

    addPortalFrame(group, {
      name: "central-atrium-frame-outer",
      centerX: 0,
      centerZ: 0,
      width: 14.4,
      depth: 11.2,
      bottom: 0,
      top: ROOM.height,
      section: 0.44,
      material: frameWoodMaterial,
      bandLevels: NESTED_CITY.levels,
    });
    addPortalFrame(group, {
      name: "central-atrium-frame-middle",
      centerX: 0.55,
      centerZ: 0.25,
      width: 9.4,
      depth: 7.6,
      bottom: 2,
      top: 14,
      section: 0.34,
      material: darkMaterial,
      bandLevels: NESTED_CITY.gallery.floors,
    });
    addPortalFrame(group, {
      name: "central-atrium-frame-inner",
      centerX: -0.6,
      centerZ: -0.45,
      width: 5.8,
      depth: 4.7,
      bottom: 4,
      top: 12,
      section: 0.27,
      material: frameWoodMaterial,
      bandLevels: [8],
    });

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
      ownedGeometries.forEach((geometry) => geometry.dispose());
      materials.forEach((entry) => entry.dispose());
    };
  }, [api, structureOnly, whiteModel]);

  return null;
};
