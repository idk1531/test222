"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import type { StudySceneApi } from "./StudyScene";
import { AMBIENT, PALETTE, ROOM, SUN, WINDOW } from "@/lib/room3d";

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

    // 日光源放於窗洞內側少許，確保光線能穿過窗洞入室；窗框實體形成地板/桌面影條。
    const sun = new THREE.DirectionalLight(SUN.color, SUN.intensity);
    sun.position.set(-2.35, 2.6, wallZ - 1.1);
    sun.target.position.set(0.85, 0.12, 1.35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(api.quality.shadowMap, api.quality.shadowMap);
    sun.shadow.camera.left = -3.5;
    sun.shadow.camera.right = 3.5;
    sun.shadow.camera.top = 3.6;
    sun.shadow.camera.bottom = -2.7;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 14;
    sun.shadow.bias = -0.00022;
    sun.shadow.normalBias = 0.025;
    sun.shadow.radius = api.quality.mobile ? 3 : 5;
    g.add(sun, sun.target);

    // ---- 窗外景片：天空遠景、遠樹冠、中景樹、近灌木、草地 ----
    const skyMat = new THREE.MeshBasicMaterial({ color: "#c9e1ed" });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(15, 7), skyMat);
    sky.position.set(WINDOW.cx, 2.1, outsideZ - 3.1);
    g.add(sky);
    const farMat = new THREE.MeshStandardMaterial({ color: "#9dbb98", roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: "#6f966b", roughness: 0.92 });
    const leafLight = new THREE.MeshStandardMaterial({ color: "#91ae7e", roughness: 0.95 });
    const shrubMat = new THREE.MeshStandardMaterial({ color: "#769369", roughness: 0.96 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#8a6949", roughness: 0.95 });
    const grassMat = new THREE.MeshStandardMaterial({ color: "#b0b88b", roughness: 0.94 });
    const groundMat = new THREE.MeshStandardMaterial({ color: "#c7c19b", roughness: 0.98 });
    const mats = [farMat, leafMat, leafLight, shrubMat, trunkMat, grassMat, groundMat];
    disposers.push(() => { skyMat.dispose(); mats.forEach((m) => m.dispose()); });

    // 背景樹帶（遠景淡化）
    for (let i = 0; i < 9; i++) {
      const x = WINDOW.cx - 4.2 + i * 1.05;
      const y = 1.1 + Math.sin(i * 1.7) * 0.16;
      const r = 0.52 + (i % 3) * 0.11;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), farMat);
      mesh.position.set(x, y, outsideZ - 2.1 - (i % 2) * 0.24);
      mesh.scale.set(1.3, 0.82, 0.42);
      mesh.castShadow = false;
      g.add(mesh);
    }
    // 庭園樹：枝幹＋分層樹冠（柔和色差）
    for (let i = 0; i < 5; i++) {
      const x = WINDOW.cx - 2.8 + i * 1.38;
      const baseY = -0.02;
      const tall = 1.55 + (i % 3) * 0.25;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, tall * 0.68, 7), trunkMat);
      trunk.position.set(x, baseY + tall * 0.32, outsideZ - 0.35);
      trunk.castShadow = false;
      g.add(trunk);
      for (let j = 0; j < 4; j++) {
        const r = 0.38 + ((i + j) % 3) * 0.08;
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), j % 2 ? leafMat : leafLight);
        crown.position.set(
          x + Math.sin(j * 2.4 + i) * 0.27,
          baseY + tall * 0.62 + Math.cos(j * 1.8) * 0.21,
          outsideZ - 0.34 - (j % 2) * 0.16
        );
        crown.scale.set(1.1, 0.82, 0.85);
        crown.castShadow = false;
        g.add(crown);
      }
    }
    // 近景灌木與草地分層
    for (let i = 0; i < 13; i++) {
      const x = WINDOW.cx - 3.2 + i * 0.52;
      const shrub = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.26 + (i % 3) * 0.045, 1),
        i % 2 ? shrubMat : leafMat
      );
      shrub.position.set(x, 0.22 + (i % 3) * 0.055, outsideZ + 0.05);
      shrub.scale.set(1.4, 0.72, 0.62);
      shrub.castShadow = false;
      g.add(shrub);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(WINDOW.cx, -0.03, outsideZ + 0.6);
    ground.receiveShadow = false;
    g.add(ground);
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(12, 2.2), grassMat);
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
          opacity: 0.075 - i * 0.012,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.4 + i * 0.12, 2.1), material);
        plane.position.set(WINDOW.cx - 0.78 + i * 0.44, 1.04, -0.62 + i * 0.13);
        plane.rotation.x = -0.31;
        plane.rotation.z = -0.13;
        shafts.add(plane);
        disposers.push(() => material.dispose());
      }
      g.add(shafts);
      // ≤200 顆低亮塵埃粒子，只桌機開啟
      const count = 140;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = WINDOW.cx - 1.6 + Math.random() * 2.6;
        positions[i * 3 + 1] = 0.75 + Math.random() * 1.7;
        positions[i * 3 + 2] = -0.48 + Math.random() * 1.8;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: "#fff3d6",
        size: 0.012,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      });
      const dust = new THREE.Points(geo, mat);
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
