"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { CHARACTER, characterAnim } from "@/lib/character";
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

/** 自製像素臉：深色頭髮、兩顆眼睛、嘴與腮紅（無任何外部角色 skin）。 */
function makeFaceTexture(): THREE.CanvasTexture {
  return pixelTexture((ctx) => {
    const { skin, hair, eye, mouth } = CHARACTER.colors;
    ctx.fillStyle = skin;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = hair;
    ctx.fillRect(0, 0, 16, 4);
    ctx.fillRect(0, 4, 2, 6);
    ctx.fillRect(14, 4, 2, 6);
    // 瀏海鋸齒
    for (let x = 1; x < 15; x += 3) ctx.fillRect(x, 4, 2, 2);
    ctx.fillStyle = eye;
    ctx.fillRect(3, 7, 2, 2);
    ctx.fillRect(11, 7, 2, 2);
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(4, 7, 1, 1);
    ctx.fillRect(12, 7, 1, 1);
    ctx.fillStyle = "#b27a52";
    ctx.fillRect(1, 10, 2, 1);
    ctx.fillRect(13, 10, 2, 1);
    ctx.fillStyle = mouth;
    ctx.fillRect(6, 12, 4, 1);
  });
}

/** 連帽外套正面：口袋、拉鍊、抽繩。 */
function makeHoodieTexture(): THREE.CanvasTexture {
  return pixelTexture((ctx) => {
    const { hoodie, hoodieDark } = CHARACTER.colors;
    ctx.fillStyle = hoodie;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = hoodieDark;
    ctx.fillRect(0, 0, 16, 1);
    ctx.fillRect(7, 1, 2, 15);
    ctx.fillRect(4, 10, 8, 4);
    ctx.fillStyle = "#e8e1d3";
    ctx.fillRect(5, 3, 1, 4);
    ctx.fillRect(10, 3, 1, 4);
    ctx.fillStyle = "#cfc5b4";
    ctx.fillRect(5, 7, 1, 1);
    ctx.fillRect(10, 7, 1, 1);
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
    const fringe = box(headSize + 0.012, 0.09, 0.06, hairMat, 0, headSize - 0.01, -headSize / 2 + 0.03);
    head.add(fringe);
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
      const hand = box(CHARACTER.arm.width + 0.01, 0.09, CHARACTER.arm.depth + 0.01, skinMat, 0, -CHARACTER.arm.height + 0.01, 0);
      hand.name = side === 1 ? "player-right-hand" : "player-left-hand";
      pivot.add(arm, hand);
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
      const shoe = box(CHARACTER.leg.width + 0.02, 0.09, CHARACTER.leg.depth + 0.06, shoeMat, 0, -CHARACTER.leg.height + 0.03, -0.03);
      const stripe = box(CHARACTER.leg.width + 0.024, 0.018, CHARACTER.leg.depth + 0.064, accentMat, 0, -CHARACTER.leg.height + 0.075, -0.03);
      pivot.add(leg, shoe, stripe);
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
    for (const part of [collar]) {
      part.userData.kind = "player";
      part.castShadow = false;
      part.receiveShadow = false;
    }
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, VIEW_MODEL.chest.y, VIEW_MODEL.chest.z);
    chestGroup.rotation.x = VIEW_MODEL.chest.tilt;
    fpChest.position.set(0, 0, 0);
    collar.position.set(0, VIEW_MODEL.chest.height / 2 - 0.008, -VIEW_MODEL.chest.depth / 2 + 0.018);
    chestGroup.add(fpChest, collar);
    fpHands.add(chestGroup, fpArms);
    api.camera.add(fpHands);

    partsRef.current = { leftArm, rightArm, leftLeg, rightLeg, fpHands, fpArms, fpChest: chestGroup };

    // 第一人稱：頭部隱藏，避免相機在頭顱內穿模。
    head.visible = viewMode === "third";

    const cameraWorld = new THREE.Vector3();
    const chestWorld = new THREE.Vector3();
    const removeFrame = api.addFrameCallback((_dt, tNow) => {
      const pose = playerRef.current;
      root.visible = !!pose?.visible;
      if (!pose) return;
      const scale = Math.max(0.72, Math.min(1.35, pose.eyeY / CHARACTER.eyeHeight));
      root.scale.setScalar(scale);
      root.rotation.y = -pose.yaw;
      const drop = pose.seated ? 0.2 : 0;
      root.position.set(pose.x, Math.max(0, pose.jumpOffset) - drop, pose.z);

      // 第三人稱撞牆／家具時相機會被拉到 0.55 m 內，此時淡化角色避免整個畫面被身體擋住。
      let bodyOpacity = 1;
      if (viewModeRef.current === "third") {
        api.camera.getWorldPosition(cameraWorld);
        chestWorld.set(pose.x, root.position.y + 1.18 * scale, pose.z);
        const dist = cameraWorld.distanceTo(chestWorld);
        // 貼牆時相機會被拉近；先在 0.55 m 內淡出，避免整個畫面只剩後腦勺。
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

      const phase = tNow * (pose.moving ? 9.2 : 2.1);
      const anim = characterAnim({
        phase,
        moving: pose.moving,
        airborne: !pose.onGround,
        seated: pose.seated,
        holding: !!pose.holding,
        pitch: -pose.pitch,
      });
      const parts = partsRef.current;
      if (!parts) return;
      const firstPerson = viewModeRef.current === "first";
      const vm = firstPersonViewVisibility(pose.pitch, !!pose.holding);
      parts.fpHands.visible = firstPerson && (vm.arms || vm.chest);
      // 手持書時由 HeldBook 的手掌／前臂負責，不再另外伸出 view model 手臂。
      parts.fpArms.visible = firstPerson && vm.arms && !pose.holding;
      parts.fpChest.visible = firstPerson && vm.chest;
      // 第一人稱看不到自己的上臂／垂放的手臂：那會變成貼在鏡頭兩側的方塊牆。
      // 手臂的視覺由相機上的 view model（前臂＋手掌）負責，第三人稱仍完整顯示。
      parts.leftArm.visible = !firstPerson;
      parts.rightArm.visible = !firstPerson;
      // 第一人稱：真實身體（頭／軀幹／手臂）全部隱藏，改由相機上的 view model
      // （胸口＋前臂＋手掌）呈現「看見自己的身體」，避免相機在模型內部穿模。
      // 第三人稱：完整模型；兩者共用同一組動畫角度與碰撞。
      if (bodyRef.current) bodyRef.current.visible = !firstPerson;
      if (torsoRef.current) torsoRef.current.scale.set(1, 1, 1);
      // 走動時手臂微幅上下（view model 的搖擺，不影響碰撞與射線）。
      const bob = pose.moving ? Math.sin(phase) * 0.012 : Math.sin(phase * 0.5) * 0.004;
      parts.fpHands.position.set(0, pose.onGround ? bob : 0.03, 0);
      parts.fpHands.rotation.z = pose.moving ? Math.sin(phase * 0.5) * 0.02 : 0;
      parts.leftLeg.rotation.x = anim.leftLeg;
      parts.rightLeg.rotation.x = anim.rightLeg;
      parts.leftArm.rotation.x = anim.leftArm;
      parts.rightArm.rotation.x = anim.rightArm;
      body.position.y = anim.torsoBob;
      body.rotation.x = anim.torsoLean;
      head.rotation.x = anim.headPitch * 0.65;
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
