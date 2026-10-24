"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  CAMERA,
  roomFovFor,
  FIDELITY,
  type SceneQuality,
  projectToScreen,
} from "@/lib/room3d";
import { attachEnvironment } from "@/lib/roomTextures";

export type FrameCallback = (dt: number, elapsedSec: number) => void;

/**
 * three.js 場景核心（生命週期唯一入口）：
 * 建立 renderer/scene/camera、resize 觀察、渲染迴圈（rAF、失焦暫停）、
 * 3D→CSS 投影、卸載時完整 dispose。僅 client 掛載後建立（SSR 安全）。
 */
export interface StudySceneApi {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  dom: HTMLCanvasElement;
  container: HTMLDivElement;
  quality: SceneQuality;
  /** 註冊每幀回呼（回傳取消註冊函式）；渲染迴圈暫停時不呼叫 */
  addFrameCallback(fn: FrameCallback): () => void;
  /** 3D 世界座標 → 螢幕 CSS 座標（HTML 浮層錨點定位） */
  projectToScreen(v: THREE.Vector3): { x: number; y: number; visible: boolean };
  /** 暫停／恢復渲染迴圈（工作視角時暫停以省電） */
  setActive(active: boolean): void;
}

interface StudySceneProps {
  quality: SceneQuality;
  apiRef: React.MutableRefObject<StudySceneApi | null>;
  /** render-prop：api 建立後才渲染子元件（避免 stale closure） */
  children?: (api: StudySceneApi) => React.ReactNode;
}

export const StudyScene: React.FC<StudySceneProps> = ({
  quality,
  apiRef,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [api, setApi] = useState<StudySceneApi | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const internalRef = useRef<{
    frameCallbacks: Set<FrameCallback>;
    raf: number | null;
    last: number;
    paused: boolean;
    active: boolean;
  }>({
    frameCallbacks: new Set(),
    raf: null,
    last: 0,
    paused: false,
    active: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // ---- renderer ----
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96; // v8.6：中性曝光，保留木作暗部與窗光的層次

    // ---- scene / camera ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#cfc8bc");
    // 桌機以窗外山景全景產生低強度 PMREM envMap；手機略過以降低初始化成本。
    let disposeEnv: () => void = () => {};
    if (FIDELITY.envMap && !quality.mobile) {
      // 低環境強度避免室內牆面被窗外山景染色，同時保留石材極弱反射。
      scene.environmentIntensity = 0.12;
      disposeEnv = attachEnvironment(renderer, "garden", (env) => {
        scene.environment = env;
      });
    }
    const initialAspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(
      roomFovFor(initialAspect),
      initialAspect,
      CAMERA.near,
      CAMERA.far
    );
    camera.position.set(0.9, 1.5, 1.55);
    camera.lookAt(0, 1.2, -2);
    // 第一人稱手持書是 camera 的子物件；camera 必須在場景圖內才會被渲染。
    scene.add(camera);

    const st = internalRef.current;
    const tick = (now: number) => {
      st.raf = requestAnimationFrame(tick);
      if (st.paused || !st.active) {
        st.last = now;
        return;
      }
      const dt = Math.min(0.05, (now - st.last) / 1000 || 0.016);
      st.last = now;
      const t = now / 1000;
      st.frameCallbacks.forEach((fn) => {
        try {
          fn(dt, t);
        } catch (e) {
          console.error("[StudyScene] frame callback error", e);
        }
      });
      renderer.render(scene, camera);
    };
    st.raf = requestAnimationFrame(tick);

    // ---- resize ----
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        // 直式手機需要更寬的垂直視野，否則只看到窗戶的一小角。
        camera.fov = roomFovFor(camera.aspect);
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(container);

    // ---- 失焦暫停（省電） ----
    const onVis = () => {
      st.paused = typeof document !== "undefined" && document.hidden;
    };
    const onBlur = () => {
      st.paused = true;
    };
    const onFocus = () => {
      st.paused = typeof document !== "undefined" && document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // ---- WebGL 內容丟失：提示＋重載 ----
    const onLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // ---- api ----
    const frameCallbacks = st.frameCallbacks;
    const apiObj: StudySceneApi = {
      scene,
      camera,
      renderer,
      dom: canvas,
      container,
      quality,
      addFrameCallback(fn) {
        frameCallbacks.add(fn);
        return () => {
          frameCallbacks.delete(fn);
        };
      },
      projectToScreen(v) {
        return projectToScreen(v, camera, canvas);
      },
      setActive(active) {
        st.active = active;
        if (active) st.last = performance.now();
      },
    };
    apiRef.current = apiObj;
    setApi(apiObj);

    return () => {
      if (st.raf !== null) cancelAnimationFrame(st.raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      apiRef.current = null;

      // ---- dispose：共享 geometry/material/texture 各只釋放一次 ----
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      const disposedTextures = new Set<THREE.Texture>();
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry && !disposedGeometries.has(m.geometry)) {
          disposedGeometries.add(m.geometry);
          m.geometry.dispose();
        }
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => {
          if (!mat || disposedMaterials.has(mat)) return;
          disposedMaterials.add(mat);
          const texes = Object.values(mat).filter(
            (v): v is THREE.Texture => !!v && v instanceof THREE.Texture
          );
          texes.forEach((tex) => {
            if (disposedTextures.has(tex)) return;
            disposedTextures.add(tex);
            tex.dispose();
          });
          mat.dispose();
        });
      });
      disposeEnv();
      renderer.dispose();
      setApi(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
      {contextLost && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#e6ded2]/95"
          data-no-orbit="true"
        >
          <p className="text-sm font-semibold text-stone-700">
            3D 畫面中斷（WebGL context lost）
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="touch-target rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-900"
          >
            重新整理
          </button>
        </div>
      )}
      {api && children ? children(api) : null}
    </div>
  );
};
