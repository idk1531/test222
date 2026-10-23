"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { CHARACTER, characterAnim, type CharacterAnim } from "@/lib/character";
import { VIEW_MODEL, firstPersonViewVisibility } from "@/lib/room3d";
import type { PlayerPose, ViewMode } from "@/lib/room3d";

function pixelTexture(
  draw: (ctx: CanvasRenderingContext2D) => void,
  size = 16
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    draw(ctx);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

/** 原創像素臉：眉眼高光、柔和腮紅與不對稱瀏海，保持清楚的 voxel 輪廓。 */
function makeFaceTexture(): THREE.CanvasTexture {
  return pixelTexture((ctx) => {
    const { skin, hair, eye, mouth } = CHARACTER.colors;
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = hair;
    ctx.fillRect(0, 0, 16, 4);
    ctx.fillRect(0, 4, 2, 7);
    ctx.fillRect(14, 4, 2, 7);
    // 像素瀏海略不對稱，增加髮型辨識度。
    ctx.fillRect(2, 4, 3, 2);
    ctx.fillRect(6, 4, 3, 3);
    ctx.fillRect(10, 4, 4, 2);
    // 眉毛與眼白先分層繪製，光線較暗時眼神仍看得清。
    ctx.fillRect(3, 6, 3, 1);
    ctx.fillRect(10, 6, 3, 1);
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(3, 7, 3, 2);
    ctx.fillRect(10, 7, 3, 2);
    ctx.fillStyle = eye;
    ctx.fillRect(4, 7, 2, 2);
    ctx.fillRect(10, 7, 2, 2);
    ctx.fillStyle = "#fff8ea";
    ctx.fillRect(4, 7, 1, 1);
    ctx.fillRect(10, 7, 1, 1);
    ctx.fillStyle = "#c88d67";
    ctx.fillRect(7, 9, 2, 2);
    ctx.fillStyle = "#c88570";
    ctx.fillRect(2, 10, 2, 1);
    ctx.fillRect(12, 10, 2, 1);
    ctx.fillStyle = mouth;
    ctx.fillRect(6, 12, 4, 1);
    ctx.fillRect(7, 13, 2, 1);
  });
}

/** 連帽外套正面貼圖：明確的拉鍊、抽繩與口袋縫線。 */
function makeHoodieTexture(): THREE.CanvasTexture {
  return pixelTexture((ctx) => {
    const { hoodie, hoodieDark, hoodieLight } = CHARACTER.colors;
    ctx.fillStyle = hoodie;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = hoodieDark;
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(7, 1, 2, 15);
    ctx.fillRect(3, 10, 10, 1);
    ctx.fillRect(3, 10, 1, 4);
    ctx.fillRect(12, 10, 1, 4);
    ctx.fillRect(4, 13, 8, 1);
    ctx.fillStyle = hoodieLight;
    ctx.fillRect(8, 2, 1, 13);
    ctx.fillRect(4, 11, 2, 1);
    ctx.fillRect(10, 11, 2, 1);
    ctx.fillStyle = "#e8e1d3";
    ctx.fillRect(5, 2, 1, 5);
    ctx.fillRect(10, 2, 1, 5);
    ctx.fillStyle = "#f0d39a";
    ctx.fillRect(7, 7, 2, 2);
  });
}

/**
 * 原創 voxel 人物：第一人稱只隱藏頭部，向下可看見軀幹、手臂與腿；
 * 第三人稱完整顯示。每幀從 CameraRig 寫入的 playerRef 取姿態（不經 React state）。
 */
export const VoxelCharacter: React.FC<{
  api: StudySceneApi;
  playerRef: React.MutableRefObject<PlayerPose>;
  viewMode: ViewMode;
}> = ({ api, playerRef, viewMode }) => {
  const headRef = useRef<THREE.Group | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);
  const bodyRef = useRef<THREE.Group | null>(null);
  const torsoRef = useRef<THREE.Mesh | null>(null);
  const gaitPhaseRef = useRef(0);
  const moveWeightRef = useRef(0);
  const sprintWeightRef = useRef(0);
  const wasAirborneRef = useRef(false);
  const landingRef = useRef(0);
  const smoothAnimRef = useRef<CharacterAnim | null>(null);
  const partsRef = useRef<{
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    leftLeg: THREE.Group;
    rightLeg: THREE.Group;
    fpHands: THREE.Group;
    fpArms: THREE.Group;
    fpChest: THREE.Group;
  } | null>(null);

  useEffect(() => {
    const root = new THREE.Group();
    root.name = "voxel-player";
    // 第一人稱相機位於模型內部；互動射線要跳過整個角色，避免 dist=0 的自體命中。
    root.userData.kind = "player";
    api.scene.add(root);

    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const own = <T extends THREE.Material>(material: T): T => {
      materials.push(material);
      return material;
    };

    const faceTexture = makeFaceTexture();
    const hoodieTexture = makeHoodieTexture();
    textures.push(faceTexture, hoodieTexture);

    const skinMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.skin,
      roughness: 0.88,
      metalness: 0,
    }));
    const hairMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.hair,
      roughness: 0.92,
      emissive: new THREE.Color("#241d19"),
      emissiveIntensity: 0.3,
    }));
    const faceMat = own(new THREE.MeshStandardMaterial({
      map: faceTexture,
      roughness: 0.86,
      emissive: new THREE.Color("#4a3a2c"),
      emissiveIntensity: 0.35,
    }));
    const hoodieMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.hoodie,
      roughness: 0.9,
    }));
    const hoodieFrontMat = own(new THREE.MeshStandardMaterial({
      map: hoodieTexture,
      roughness: 0.9,
    }));
    const hoodieDarkMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.hoodieDark,
      roughness: 0.92,
    }));
    const trousersMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.trousers,
      roughness: 0.94,
    }));
    const shoeMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.shoe,
      roughness: 0.8,
    }));
    const accentMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.shoeAccent,
      roughness: 0.75,
    }));
    const hoodieLightMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.hoodieLight,
      roughness: 0.88,
    }));
    const patchMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.patch,
      roughness: 0.76,
    }));
    const trouserLightMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.trouserLight,
      roughness: 0.92,
    }));
    const soleMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.shoeSole,
      roughness: 0.94,
    }));
    const laceMat = own(new THREE.MeshStandardMaterial({
      color: CHARACTER.colors.shoeLace,
      roughness: 0.82,
    }));

    const box = (
      w: number,
      h: number,
      d: number,
      material: THREE.Material | THREE.Material[],
      x = 0,
      y = 0,
      z = 0
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // ---- 軀幹 ----
    const body = new THREE.Group();
    root.add(body);
    bodyRef.current = body;
    const t = CHARACTER.torso;
    const torsoY = CHARACTER.hipY + t.height / 2;
    const torso = box(
      t.width,
      t.height,
      t.depth,
      [
        hoodieMat,
        hoodieMat,
        hoodieFrontMat, // +Y＝肩線／領口（第一人稱往下看最常看到的面）
        hoodieMat,
        hoodieMat,
        hoodieFrontMat, // -Z＝角色正面
      ],
      0,
      torsoY,
      0
    );
    body.add(torso);
    torsoRef.current = torso;
    // 帽兜（在頸後，不遮住第一人稱視線）
    const hood = box(0.3, 0.14, 0.16, hoodieMat, 0, CHARACTER.headBaseY - 0.02, 0.14);
    body.add(hood);
    const hoodInner = box(0.2, 0.06, 0.04, hoodieFrontMat, 0, CHARACTER.headBaseY + 0.02, 0.045);
    body.add(hoodInner);
    // 胸前的小書籤徽章與雙頁亮線，讓外套有一個可辨識的 SciNotes 主題細節。
    const badge = box(0.085, 0.09, 0.014, patchMat, -0.135, torsoY + 0.11, -t.depth / 2 - 0.008);
    const badgeSpine = box(0.008, 0.055, 0.008, hoodieDarkMat, -0.135, torsoY + 0.11, -t.depth / 2 - 0.019);
    const badgePageL = box(0.022, 0.045, 0.008, laceMat, -0.15, torsoY + 0.11, -t.depth / 2 - 0.019);
    const badgePageR = box(0.022, 0.045, 0.008, laceMat, -0.12, torsoY + 0.11, -t.depth / 2 - 0.019);
    body.add(badge, badgeSpine, badgePageL, badgePageR);

    // ---- 頭 ----
    const head = new THREE.Group();
    head.position.set(0, CHARACTER.headBaseY, 0);
    body.add(head);
    headRef.current = head;
    const headSize = CHARACTER.headSize;
    const headMesh = box(
      headSize,
      headSize,
      headSize,
      [
        skinMat, // +X
        skinMat, // -X
        hairMat, // +Y
        skinMat, // -Y
        hairMat, // +Z (後腦)
        faceMat, // -Z (臉)
      ],
      0,
      headSize / 2 + 0.01,
      0
    );
    head.add(headMesh);
    const fringe = box(headSize + 0.012, 0.07, 0.06, hairMat, 0, headSize - 0.01, -headSize / 2 + 0.03);
    const bangL = box(0.13, 0.11, 0.062, hairMat, -0.105, 0.315, -headSize / 2 + 0.026);
    const bangC = box(0.12, 0.14, 0.062, hairMat, 0.005, 0.305, -headSize / 2 + 0.026);
    const bangR = box(0.12, 0.095, 0.062, hairMat, 0.112, 0.325, -headSize / 2 + 0.026);
    const sideburnL = box(0.048, 0.14, 0.07, hairMat, -headSize / 2 + 0.025, 0.22, -0.175);
    const sideburnR = box(0.048, 0.14, 0.07, hairMat, headSize / 2 - 0.025, 0.22, -0.175);
    head.add(fringe, bangL, bangC, bangR, sideburnL, sideburnR);
    const earL = box(0.035, 0.08, 0.08, skinMat, -headSize / 2 - 0.012, headSize * 0.52, 0);
    const earR = box(0.035, 0.08, 0.08, skinMat, headSize / 2 + 0.012, headSize * 0.52, 0);
    head.add(earL, earR);

    // ---- 手臂（樞軸在肩，幾何往下延伸） ----
    const makeArm = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (t.width / 2 + CHARACTER.arm.width / 2), CHARACTER.shoulderY, 0);
      const arm = box(
        CHARACTER.arm.width,
        CHARACTER.arm.height,
        CHARACTER.arm.depth,
        hoodieMat,
        0,
        -CHARACTER.arm.height / 2,
        0
      );
      const cuff = box(CHARACTER.arm.width + 0.012, 0.07, CHARACTER.arm.depth + 0.014, hoodieDarkMat, 0, -CHARACTER.arm.height + 0.09, 0);
      const cuffLine = box(CHARACTER.arm.width + 0.016, 0.018, CHARACTER.arm.depth + 0.018, hoodieLightMat, 0, -CHARACTER.arm.height + 0.12, 0);
      const hand = box(CHARACTER.arm.width + 0.01, 0.09, CHARACTER.arm.depth + 0.01, skinMat, 0, -CHARACTER.arm.height + 0.01, 0);
      const thumb = box(0.035, 0.055, 0.07, skinMat, side * (CHARACTER.arm.width / 2 + 0.015), -CHARACTER.arm.height + 0.035, -0.015);
      hand.name = side === 1 ? "player-right-hand" : "player-left-hand";
      pivot.add(arm, cuff, cuffLine, hand, thumb);
      return pivot;
    };
    const leftArm = makeArm(-1);
    const rightArm = makeArm(1);
    body.add(leftArm, rightArm);

    // ---- 腿（樞軸在髖） ----
    const makeLeg = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * (CHARACTER.leg.width / 2 + 0.02), CHARACTER.hipY, 0);
      const leg = box(
        CHARACTER.leg.width,
        CHARACTER.leg.height,
        CHARACTER.leg.depth,
        trousersMat,
        0,
        -CHARACTER.leg.height / 2,
        0
      );
      const knee = box(CHARACTER.leg.width * 0.72, 0.13, 0.012, trouserLightMat, 0, -CHARACTER.leg.height * 0.48, -CHARACTER.leg.depth / 2 - 0.007);
      const kneeSeam = box(CHARACTER.leg.width * 0.56, 0.012, 0.014, hoodieDarkMat, 0, -CHARACTER.leg.height * 0.48 - 0.035, -CHARACTER.leg.depth / 2 - 0.009);
      const shoeY = -CHARACTER.leg.height + 0.03;
      const shoeZ = -0.03;
      const shoe = box(CHARACTER.leg.width + 0.02, 0.09, CHARACTER.leg.depth + 0.06, shoeMat, 0, shoeY, shoeZ);
      const sole = box(CHARACTER.leg.width + 0.026, 0.028, CHARACTER.leg.depth + 0.066, soleMat, 0, shoeY - 0.052, shoeZ);
      const stripe = box(CHARACTER.leg.width + 0.024, 0.018, CHARACTER.leg.depth + 0.064, accentMat, 0, -CHARACTER.leg.height + 0.075, shoeZ);
      const laceFront = shoeZ - (CHARACTER.leg.depth + 0.06) / 2 - 0.006;
      const lace1 = box(CHARACTER.leg.width * 0.5, 0.012, 0.01, laceMat, 0, shoeY + 0.015, laceFront);
      const lace2 = box(CHARACTER.leg.width * 0.5, 0.012, 0.01, laceMat, 0, shoeY - 0.012, laceFront);
      pivot.add(leg, knee, kneeSeam, shoe, sole, stripe, lace1, lace2);
      return pivot;
    };
    const leftLeg = makeLeg(-1);
    const rightLeg = makeLeg(1);
    root.add(leftLeg, rightLeg);

    // ---- 第一人稱可見的手臂／手掌（view model） ----
    // 只做「低頭看得到」的小前臂與胸口：站直時整組在視錐外，
    // 不會像舊版一樣變成佔住畫面下緣的兩塊大方塊。
    const fpHands = new THREE.Group();
    fpHands.name = "player-first-person-view-model";
    fpHands.userData.kind = "player";
    const makeFpArm = (side: -1 | 1) => {
      const pivot = new THREE.Group();
      // 手肘在畫面外下方，手掌略往前；座標由 VIEW_MODEL 統一。
      pivot.position.set(side * VIEW_MODEL.arm.x, VIEW_MODEL.arm.y, VIEW_MODEL.arm.z);
      // 往畫面中央收 22°、略抬：低頭時看到的是自己的前臂，而不是兩根垂直方塊。
      pivot.rotation.set(-0.55, side * -0.34, side * 0.16);
      const sleeve = box(VIEW_MODEL.arm.width, VIEW_MODEL.arm.width, VIEW_MODEL.arm.length, hoodieMat, 0, 0, -0.075);
      const cuff = box(VIEW_MODEL.arm.width + 0.008, VIEW_MODEL.arm.width + 0.008, 0.026, hoodieMat, 0, 0, -0.176);
      const hand = box(0.066, 0.07, 0.09, skinMat, 0, 0, -0.232);
      const thumb = box(0.024, 0.028, 0.038, skinMat, side * -0.034, 0.024, -0.222);
      pivot.add(sleeve, cuff, hand, thumb);
      pivot.traverse((o) => {
        o.userData.kind = "player";
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        }
      });
      return pivot;
    };
    const fpArms = new THREE.Group();
    fpArms.add(makeFpArm(-1), makeFpArm(1));
    const chestGeom = new THREE.BoxGeometry(VIEW_MODEL.chest.width, VIEW_MODEL.chest.height, VIEW_MODEL.chest.depth);
    // 第一人稱軀幹用純色連帽布（不貼 hoodieFront 的抽繩貼圖：整片放大會變成兩條白色寬帶）。
    const fpChest = new THREE.Mesh(chestGeom, hoodieMat);
    fpChest.castShadow = false;
    fpChest.receiveShadow = false;
    fpChest.userData.kind = "player";
    // 領口＋拉鍊：讓低頭看到的胸口有可讀細節（不新增材質）
    const collar = box(VIEW_MODEL.chest.width * 0.58, 0.034, 0.034, hoodieDarkMat, 0, VIEW_MODEL.chest.height / 2 - 0.008, -VIEW_MODEL.chest.depth / 2 + 0.018);
    const fpZipper = box(0.012, VIEW_MODEL.chest.height * 0.5, 0.012, hoodieLightMat, 0, -0.025, -VIEW_MODEL.chest.depth / 2 - 0.01);
    const fpBadge = box(0.055, 0.06, 0.012, patchMat, -VIEW_MODEL.chest.width * 0.28, 0.02, -VIEW_MODEL.chest.depth / 2 - 0.01);
    const fpBadgePage = box(0.008, 0.038, 0.008, laceMat, -VIEW_MODEL.chest.width * 0.28, 0.02, -VIEW_MODEL.chest.depth / 2 - 0.019);
    for (const part of [collar, fpZipper, fpBadge, fpBadgePage]) {
      part.userData.kind = "player";
      part.castShadow = false;
      part.receiveShadow = false;
    }
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, VIEW_MODEL.chest.y, VIEW_MODEL.chest.z);
    chestGroup.rotation.x = VIEW_MODEL.chest.tilt;
    fpChest.position.set(0, 0, 0);
    collar.position.set(0, VIEW_MODEL.chest.height / 2 - 0.008, -VIEW_MODEL.chest.depth / 2 + 0.018);
    chestGroup.add(fpChest, collar, fpZipper, fpBadge, fpBadgePage);
    fpHands.add(chestGroup, fpArms);
    api.camera.add(fpHands);

    partsRef.current = { leftArm, rightArm, leftLeg, rightLeg, fpHands, fpArms, fpChest: chestGroup };

    // 第一人稱：頭部隱藏，避免相機在頭顱內穿模。
    head.visible = viewMode === "third";

    const cameraWorld = new THREE.Vector3();
    const chestWorld = new THREE.Vector3();
    const removeFrame = api.addFrameCallback((dt) => {
      const pose = playerRef.current;
      root.visible = !!pose?.visible;
      if (!pose) return;
      const frameDt = Math.max(0, Math.min(dt, 0.05));
      const moving = pose.moving && !pose.seated;
      const moveTarget = moving ? 1 : 0;
      const moveResponse = 1 - Math.exp(-frameDt * (moveTarget > moveWeightRef.current ? 14 : 9));
      moveWeightRef.current += (moveTarget - moveWeightRef.current) * moveResponse;
      const sprintTarget = moving && pose.sprinting ? 1 : 0;
      sprintWeightRef.current += (sprintTarget - sprintWeightRef.current) * (1 - Math.exp(-frameDt * 10));
      gaitPhaseRef.current += frameDt * (1.6 + moveWeightRef.current * (7.6 + sprintWeightRef.current * 5.1));

      if (!pose.onGround) {
        wasAirborneRef.current = true;
        landingRef.current = 0;
      } else if (wasAirborneRef.current) {
        wasAirborneRef.current = false;
        landingRef.current = 1;
      } else {
        landingRef.current *= Math.exp(-frameDt * 8);
      }

      const targetAnim = characterAnim({
        phase: gaitPhaseRef.current,
        moving,
        sprinting: sprintWeightRef.current > 0.5,
        moveWeight: moveWeightRef.current,
        sprintWeight: sprintWeightRef.current,
        airborne: !pose.onGround,
        seated: pose.seated,
        holding: !!pose.holding,
        pitch: -pose.pitch,
        landing: landingRef.current,
      });
      const previousAnim = smoothAnimRef.current;
      if (!previousAnim) {
        smoothAnimRef.current = { ...targetAnim };
      } else {
        const transition = 1 - Math.exp(-frameDt * 14);
        for (const key of Object.keys(targetAnim) as Array<keyof CharacterAnim>) {
          previousAnim[key] = THREE.MathUtils.lerp(previousAnim[key], targetAnim[key], transition);
        }
      }
      const anim = smoothAnimRef.current!;
      const scale = Math.max(0.72, Math.min(1.35, pose.eyeY / CHARACTER.eyeHeight));
      root.scale.setScalar(scale);
      root.rotation.y = -pose.yaw;
      root.position.set(pose.x, Math.max(0, pose.jumpOffset) + anim.bodyDrop, pose.z);

      // 第三人稱撞牆／家具時相機會被拉到 0.55 m 內，此時淡化角色避免整個畫面被身體擋住。
      let bodyOpacity = 1;
      if (viewModeRef.current === "third") {
        api.camera.getWorldPosition(cameraWorld);
        chestWorld.set(pose.x, root.position.y + 1.18 * scale, pose.z);
        const dist = cameraWorld.distanceTo(chestWorld);
        bodyOpacity = 0.12 + 0.88 * Math.max(0, Math.min(1, (dist - 0.55) / 0.75));
        head.visible = viewModeRef.current === "third" && dist > 0.9;
      }
      for (const material of materials) {
        const m = material as THREE.MeshStandardMaterial;
        if (!m.transparent) {
          m.transparent = true;
          m.needsUpdate = true;
        }
        if (Math.abs(m.opacity - bodyOpacity) > 0.004) m.opacity = bodyOpacity;
      }

      const parts = partsRef.current;
      if (!parts) return;
      const firstPerson = viewModeRef.current === "first";
      const vm = firstPersonViewVisibility(pose.pitch, !!pose.holding);
      parts.fpHands.visible = firstPerson && (vm.arms || vm.chest);
      parts.fpArms.visible = firstPerson && vm.arms && !pose.holding;
      parts.fpChest.visible = firstPerson && vm.chest;
      parts.leftArm.visible = !firstPerson;
      parts.rightArm.visible = !firstPerson;
      if (bodyRef.current) bodyRef.current.visible = !firstPerson;
      if (torsoRef.current) torsoRef.current.scale.set(1, anim.torsoScaleY, 1);

      // 第一人稱 view model 與第三人稱肢體共用平滑步態；跳躍落地有短促的緩衝。
      const strideSway = Math.sin(gaitPhaseRef.current) * moveWeightRef.current;
      const bob = anim.torsoBob + landingRef.current * 0.012;
      parts.fpHands.position.set(strideSway * 0.006, pose.onGround ? bob : 0.025, 0);
      parts.fpHands.rotation.x = pose.onGround ? Math.cos(gaitPhaseRef.current) * moveWeightRef.current * 0.012 : -0.025;
      parts.fpHands.rotation.z = strideSway * (0.018 + sprintWeightRef.current * 0.012);
      parts.leftLeg.rotation.x = anim.leftLeg;
      parts.rightLeg.rotation.x = anim.rightLeg;
      parts.leftArm.rotation.set(anim.leftArm, 0, anim.leftArmZ);
      parts.rightArm.rotation.set(anim.rightArm, 0, anim.rightArmZ);
      body.position.y = anim.torsoBob;
      body.rotation.set(anim.torsoLean, 0, anim.torsoRoll);
      head.rotation.set(anim.headPitch * 0.65, anim.headYaw, anim.headRoll);
    });

    return () => {
      removeFrame();
      api.camera.remove(fpHands);
      api.scene.remove(root);
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
      headRef.current = null;
      torsoRef.current = null;
      bodyRef.current = null;
      partsRef.current = null;
    };
    // 模型只建一次；視角切換由下面的 effect 控制頭部可見性。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, playerRef]);

  useEffect(() => {
    viewModeRef.current = viewMode;
    if (headRef.current) headRef.current.visible = viewMode === "third";
    if (partsRef.current) {
      // 實際可見性由每幀的 pitch 決定；切換視角時先收起，避免殘影。
      partsRef.current.fpHands.visible = viewMode === "first";
      partsRef.current.fpArms.visible = false;
      partsRef.current.fpChest.visible = false;
      partsRef.current.leftArm.visible = viewMode === "third";
      partsRef.current.rightArm.visible = viewMode === "third";
    }
  }, [viewMode]);

  return null;
};
