"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { AMBIENT, PALETTE, ROOM, SHELF, SHELF_INWARD, SHELF_WASH, SUN, SUN_SHADOW_CAMERA, WINDOW, WINDOW_FILL } from "@/lib/room3d";
import { attachPhotoMap } from "@/lib/roomTextures";

/**
 * 窗景綠植＋溫和日光：分層天空、樹冠、灌木、草地；窗框/窗櫺以真實幾何投下軟影。
 * 桌機可選光柱與 ≤200 顆塵埃；手機自動關閉，保留陰影／綠植／天空層次。
 */
export const WindowLight: React.FC<{ api: StudySceneApi }> = ({ api }) => {
  useEffect(() => {
    const g = new THREE.Group();
    api.scene.add(g);
    const disposers: Array<() => void> = [];
    const wallZ = -ROOM.depth / 2;
    const outsideZ = wallZ - 1.3;

    // ---- 室內柔和環境光 + 單一淡金主光 ----
    const hemi = new THREE.HemisphereLight(
      AMBIENT.hemisphereSky,
      AMBIENT.hemisphereGround,
      AMBIENT.hemisphereIntensity
    );
    g.add(hemi);
    const ambient = new THREE.AmbientLight(AMBIENT.ambientColor, AMBIENT.ambientIntensity);
    g.add(ambient);
    // 天花不另外加點光源：近距離點光會在平頂打出不自然的光斑（實測），
    // 亮度交給半球光與窗光。

    // 日光源放於窗洞內側少許，確保光線能穿過窗洞入室；窗框實體形成地板/桌面影條。
    const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
    sun.position.copy(SUN.position);
    sun.target.position.copy(SUN.target);
    sun.castShadow = true;
    sun.shadow.mapSize.set(api.quality.shadowMap, api.quality.shadowMap);
    // v8.3：光源改由東側進光（書牆在西牆），陰影視錐涵蓋整個房間對角
    sun.shadow.camera.left = SUN_SHADOW_CAMERA.left;
    sun.shadow.camera.right = SUN_SHADOW_CAMERA.right;
    sun.shadow.camera.top = SUN_SHADOW_CAMERA.top;
    sun.shadow.camera.bottom = SUN_SHADOW_CAMERA.bottom;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 18;
    sun.shadow.bias = -0.00022;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = api.quality.mobile ? SUN.shadowRadius.mobile : SUN.shadowRadius.desktop;
    g.add(sun, sun.target);

    // v8.5：窗外柔光補光（無陰影）。附圖是「大面亮窗把光灑進來」的柔和感，
    // 不是單一硬直射光；手機只留一盞以省成本。
    const fill = new THREE.DirectionalLight(WINDOW_FILL.color, api.quality.mobile ? WINDOW_FILL.intensityMobile : WINDOW_FILL.intensityDesktop);
    fill.position.set(WINDOW_FILL.position.x, WINDOW_FILL.position.y, WINDOW_FILL.position.z);
    fill.position.copy(WINDOW_FILL.position);
    fill.target.position.copy(WINDOW_FILL.target);
    fill.castShadow = false;
    g.add(fill, fill.target);

    // 嵌燈：向下投射的窄角 SpotLight，照亮桌面與椅子，避免點光源在天花打出白斑。
    const downlightCount = api.quality.mobile ? 1 : 2;
    for (let i = 0; i < downlightCount; i++) {
      const spot = new THREE.SpotLight(
        "#ffe4c2",
        api.quality.mobile ? 0.5 : 0.72,
        ROOM.height * 1.18,
        Math.PI / 4.2,
        0.92,
        1.4
      );
      const lightX = -ROOM.width * 0.12 + i * ROOM.width * 0.24;
      const lightZ = i % 2 === 0 ? -ROOM.depth * 0.15 : ROOM.depth * 0.23;
      spot.position.set(lightX, ROOM.height - 0.8, lightZ);
      spot.target.position.set(lightX * 0.85, ROOM.height * 0.3, lightZ + ROOM.depth * 0.25);
      spot.castShadow = false;
      g.add(spot, spot.target);
    }

    // v8.5：書牆暖色洗牆光（附圖層板下的 LED 溢光）。
    const washIntensity = api.quality.mobile ? SHELF_WASH.intensityMobile : SHELF_WASH.intensityDesktop;
    for (const z of SHELF_WASH.z) {
      const wash = new THREE.PointLight(SHELF_WASH.color, washIntensity, SHELF_WASH.distance, 2);
      wash.position.set(SHELF.xBack + SHELF_INWARD * SHELF_WASH.xOffset, SHELF_WASH.y, z);
      wash.castShadow = false;
      g.add(wash);
    }

    // ---- 窗外景片：天空遠景、遠樹冠、中景樹、近灌木、草地 ----
    // v8.3：窗景「近過曝」——純白底色＋toneMapped:false，讓窗外突破 1.0 拉開明暗對比
    const skyMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    // v8.6：窗外要比室內亮一階（參考照的庭園是透光的晨霧綠），維持 toneMapped:false 直接拉高 albedo。
    skyMat.color.setRGB(1.16, 1.2, 1.12);
    // 以庭園照片作為主要窗景；尺寸與位置讓窗洞剛好看到「草坪＋綠籬＋樹林」，
    // 不再用低面數球體擋在照片前面（實際預覽看起來像卡通樹）。
    // v8.6：窗加寬到 4.9 m 後，原本 6 m 寬的景片不再覆蓋整個窗洞，
    // 左側會露出空白（實際預覽是窗內一片死白）。景片必須比窗洞寬、也更高。
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.width + 12, WINDOW.top - WINDOW.sill + 6), skyMat);
    sky.position.set(WINDOW.cx, (WINDOW.top + WINDOW.sill) / 2, outsideZ - 1.2);
    g.add(sky);
    // v8.2：遠景換照片級庭園（單張、不平貼）。分層樹冠／灌木景片留在前方提供視差與投影。
    const skyDisposer = attachPhotoMap(skyMat, "garden", {
      tileable: false,
      tint: "#ffffff", // 晨霧庭園原圖已偏亮，不再壓暗
      anisotropy: Math.min(8, api.renderer.capabilities.getMaxAnisotropy()),
      // 只取原圖下緣（草坪＋綠籬＋樹林），窗外才不會對到整片深色樹冠。
      uv: { repeat: [1, 0.58], offset: [0, 0.02] },
    });
    disposers.push(skyDisposer);
    const farMat = new THREE.MeshStandardMaterial({ color: "#8fb08a", roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: "#5d8459", roughness: 0.92 });
    const leafLight = new THREE.MeshStandardMaterial({ color: "#7d9e6a", roughness: 0.95 });
    const shrubMat = new THREE.MeshStandardMaterial({ color: "#63835a", roughness: 0.96 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#7d5f42", roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#9aa87a", roughness: 0.94 });
    const groundMat = new THREE.MeshStandardMaterial({ color: "#b6b291", roughness: 0.98 });
    const mats = [farMat, leafMat, leafLight, shrubMat, trunkMat, grassMat, groundMat];
    disposers.push(() => { skyMat.dispose(); mats.forEach((m) => m.dispose()); });

    // 窗外只留照片景片＋最底層草地；照片本身有足夠的層次與視差，
    // 低面數樹冠會破壞附圖的寫實感（實測會擋住整片窗景）。
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.width + 12, ROOM.depth + 8), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(WINDOW.cx, -0.03, outsideZ + 0.6);
    ground.receiveShadow = false;
    g.add(ground);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.width + 8, 3.4), grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.set(WINDOW.cx, -0.018, outsideZ + 0.35);
    grass.receiveShadow = false;
    g.add(grass);

    // ---- 桌機光柱：淡金半透明羽化片（不放在操作焦點前方） ----
    if (api.quality.lightShafts) {
      const shafts = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const material = new THREE.MeshBasicMaterial({
          color: PALETTE.sun,
          transparent: true,
          opacity: 0.032 - i * 0.006,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.4 + i * 0.12, 2.1), material);
        plane.position.set(
          WINDOW.cx + (i - 1) * WINDOW.width * 0.13,
          1.04,
          -ROOM.depth / 2 + ROOM.depth * (0.38 + i * 0.026)
        );
        plane.rotation.x = -0.31;
        plane.rotation.z = -0.13;
        shafts.add(plane);
        disposers.push(() => material.dispose());
      }
      g.add(shafts);
      // ≤200 顆低亮塵埃粒子，只桌機開啟
      const count = 70;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = WINDOW.cx - WINDOW.width * 0.3 + Math.random() * WINDOW.width * 0.5;
        positions[i * 3 + 1] = 0.75 + Math.random() * 1.7;
        positions[i * 3 + 2] = -ROOM.depth / 2 + ROOM.depth * (0.4 + Math.random() * 0.36);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: "#fff3d6",
        size: 0.012,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      });
      const dust = new THREE.Points(geo, mat);
      // 粒子只用來做光柱塵埃，不參與 raycast（否則相機旁會出現大量距離 0 的命中）。
      dust.raycast = () => {};
      g.add(dust);
      disposers.push(() => { geo.dispose(); mat.dispose(); });
      const unbind = api.addFrameCallback((_dt, t) => {
        dust.rotation.y = Math.sin(t * 0.12) * 0.04;
        dust.position.y = Math.sin(t * 0.4) * 0.025;
      });
      disposers.push(unbind);
    }

    return () => {
      disposers.forEach((dispose) => dispose());
      api.scene.remove(g);
    };
  }, [api]);

  return null;
};
