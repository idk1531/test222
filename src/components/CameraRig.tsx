"use client";

// Three.js is an imperative external system; all mutations below occur only in effects,
// event handlers, or the rAF callback—not while React renders this component.
/* eslint-disable react-hooks/immutability, react-hooks/purity */

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { StudyCamera } from "@/lib/study";
import { normalizeYawDeg } from "@/lib/study";
import {
  CAMERA,
  DESK,
  easeInOutCubic,
  forwardFromYawPitch,
  clampHeight,
  clampPitchRad,
  clampRoomPosition,
  ROOM,
} from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";
import type { JoystickVector } from "./Joystick";

interface Pose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  fov: number;
  up: THREE.Vector3;
  yaw: number;
  pitch: number;
  x: number;
  z: number;
  height: number;
}

type CameraMode = "room" | "work";

export interface CameraRigHandle {
  enterWorkView: () => void;
  exitWorkView: () => void;
  mode: CameraMode;
  flying: boolean;
}

/**
 * 房間相機：WASD/方向鍵走動、滑鼠/觸控拖曳環顧、滾輪微調視高、搖桿走動。
 * 點畫布平面 → 0.52s ease-in-out 飛入俯視桌面；Esc/按鈕 → 飛回進入前精確 pose。
 * flight 中忽略輸入；可編輯浮層由 StudyRoomView 另行疊加，不經 WebGL 紋理化。
 */
export const CameraRig: React.FC<{
  api: StudySceneApi;
  initialCamera: StudyCamera;
  joystickRef: React.MutableRefObject<JoystickVector>;
  onEnterWork: () => void;
  onExitWork: () => void;
  rigRef?: React.MutableRefObject<CameraRigHandle | null>;
  persistCamera: (camera: StudyCamera) => void;
}> = ({ api, initialCamera, joystickRef, onEnterWork, onExitWork, rigRef, persistCamera }) => {
  const camera = api.camera;
  const initialPosition = clampRoomPosition(initialCamera.x ?? 0.9, initialCamera.z ?? 1.55);
  const stateRef = useRef({
    x: initialPosition.x,
    z: initialPosition.z,
    height: clampHeight(initialCamera.height ?? 1.5),
    yaw: THREE.MathUtils.degToRad(initialCamera.yaw),
    pitch: clampPitchRad(THREE.MathUtils.degToRad(initialCamera.pitch)),

    mode: "room" as CameraMode,
    flying: false,
  });
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const roomPoseRef = useRef<Pose | null>(null);
  const flightRef = useRef<{
    start: Pose;
    end: Pose;
    startedAt: number;
    duration: number;
    to: CameraMode;
  } | null>(null);
  const persistRef = useRef(persistCamera);
  const callbackRef = useRef({ onEnterWork, onExitWork });
  const modeRef = useRef<CameraMode>("room");
  const flyingRef = useRef(false);
  const wasMovingRef = useRef(false);
  useEffect(() => {
    persistRef.current = persistCamera;
    callbackRef.current = { onEnterWork, onExitWork };
  }, [persistCamera, onEnterWork, onExitWork]);

  const getPose = (): Pose => ({
    position: camera.position.clone(),
    quaternion: camera.quaternion.clone(),
    fov: camera.fov,
    up: camera.up.clone(),
    yaw: stateRef.current.yaw,
    pitch: stateRef.current.pitch,
    x: stateRef.current.x,
    z: stateRef.current.z,
    height: stateRef.current.height,
  });

  const applyPose = (p: Pose) => {
    camera.position.copy(p.position);
    camera.quaternion.copy(p.quaternion);
    camera.fov = p.fov;
    camera.up.copy(p.up);
    camera.updateProjectionMatrix();
    stateRef.current = { ...stateRef.current, x: p.x, z: p.z, height: p.height, yaw: p.yaw, pitch: p.pitch };
  };

  const pointRoomCamera = () => {
    const s = stateRef.current;
    const forward = forwardFromYawPitch(s.yaw, s.pitch);
    camera.up.set(0, 1, 0);
    camera.position.set(s.x, s.height, s.z);
    camera.lookAt(camera.position.clone().add(forward));
    camera.updateMatrixWorld();
  };

  const storeCamera = () => {
    const s = stateRef.current;
    persistRef.current({
      yaw: normalizeYawDeg(THREE.MathUtils.radToDeg(s.yaw)),
      pitch: THREE.MathUtils.radToDeg(s.pitch),
      x: s.x,
      z: s.z,
      height: s.height,
    });
  };

  const beginFlight = (to: CameraMode) => {
    if (flyingRef.current || modeRef.current === to) return;
    keysRef.current.clear();
    pointerRef.current = null;
    joystickRef.current = { x: 0, y: 0 };
    const start = getPose();
    let end: Pose;
    if (to === "work") {
      roomPoseRef.current = start;
      // 相機軸垂直桌面；screen-up 與房間北向一致（−Z）。
      camera.up.set(0, 0, -1);
      const deskZ = -ROOM.depth / 2 + ROOM.wall + DESK.depth / 2;
      camera.position.set(DESK.cx, DESK.top + 1.58, deskZ);
      camera.lookAt(DESK.cx, DESK.top, deskZ);
      camera.fov = 49;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      end = getPose();
      end.yaw = start.yaw;
      end.pitch = -Math.PI / 2;
      api.setActive(true);
    } else {
      const room = roomPoseRef.current;
      if (!room) return;
      end = room;
      // Reveal the return flight immediately; the HTML canvas must not cover it.
      callbackRef.current.onExitWork();
      api.setActive(true);
    }
    flightRef.current = { start, end, startedAt: performance.now(), duration: 520, to };
    flyingRef.current = true;
    stateRef.current.flying = true;
    if (rigRef) rigRef.current = { enterWorkView: () => beginFlight("work"), exitWorkView: () => beginFlight("room"), mode: modeRef.current, flying: true };
  };

  useEffect(() => {
    const canvas = api.dom;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const pick = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(api.scene.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData.kind) obj = obj.parent;
        if (!obj) continue;
        if (obj.userData.kind === "deskCanvas") {
          beginFlight("work");
          return;
        }
        if (obj.userData.kind === "book" && obj.userData.cardId) {
          window.dispatchEvent(new CustomEvent("study-room-book-click", { detail: { cardId: obj.userData.cardId, x: e.clientX, y: e.clientY } }));
          return;
        }
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-orbit],button,input,textarea,select,a,[contenteditable='true']")) return;
      if (modeRef.current !== "room" || flyingRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      pointerRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      canvas.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || p.id !== e.pointerId || modeRef.current !== "room" || flyingRef.current) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) p.moved = true;
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.moved) {
        stateRef.current.yaw -= dx * CAMERA.lookSensitivity;
        stateRef.current.pitch = clampPitchRad(stateRef.current.pitch - dy * CAMERA.lookSensitivity);
        pointRoomCamera();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || p.id !== e.pointerId) return;
      pointerRef.current = null;
      if (!p.moved && modeRef.current === "room" && !flyingRef.current) pick(e);
      else storeCamera();
    };
    const onPointerCancel = (e: PointerEvent) => {
      if (pointerRef.current?.id === e.pointerId) pointerRef.current = null;
    };
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el?.closest("input,textarea,select,[contenteditable='true'],[role='textbox']");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        modeRef.current !== "room" ||
        flyingRef.current ||
        isTypingTarget(e.target) ||
        !!target?.closest("[data-no-orbit],button,a,select")
      ) return;
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(key)) {
        keysRef.current.add(key);
        if (key.startsWith("arrow") || key.length === 1) e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      if (modeRef.current === "room" && !flyingRef.current) storeCamera();
    };
    const onFocusIn = () => {
      // A held movement key must not survive focus entering an editor/HUD.
      keysRef.current.clear();
      joystickRef.current = { x: 0, y: 0 };
    };
    const onBlur = () => {
      keysRef.current.clear();
      pointerRef.current = null;
      joystickRef.current = { x: 0, y: 0 };
      if (!flyingRef.current) storeCamera();
    };
    const onWheel = (e: WheelEvent) => {
      if (modeRef.current !== "room" || flyingRef.current) return;
      e.preventDefault();
      stateRef.current.height = clampHeight(stateRef.current.height + (e.deltaY > 0 ? -1 : 1) * CAMERA.wheelHeightStep);
      pointRoomCamera();
      storeCamera();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modeRef.current === "work") {
        e.stopPropagation();
        beginFlight("room");
      }
    };
    const onReset = (e: Event) => {
      if (modeRef.current !== "room" || flyingRef.current) return;
      const c = (e as CustomEvent<StudyCamera>).detail;
      if (!c) return;
      stateRef.current = {
        ...stateRef.current,
        x: c.x ?? 0.9,
        z: c.z ?? 1.55,
        height: c.height ?? 1.5,
        yaw: THREE.MathUtils.degToRad(c.yaw),
        pitch: THREE.MathUtils.degToRad(c.pitch),
      };
      pointRoomCamera();
      storeCamera();
    };

    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("study-room-reset-camera", onReset);

    const removeFrame = api.addFrameCallback((dt, t) => {
      const flight = flightRef.current;
      if (flight) {
        const p = Math.min(1, (performance.now() - flight.startedAt) / flight.duration);
        const eased = easeInOutCubic(p);
        camera.position.lerpVectors(flight.start.position, flight.end.position, eased);
        camera.quaternion.slerpQuaternions(flight.start.quaternion, flight.end.quaternion, eased);
        camera.up.lerpVectors(flight.start.up, flight.end.up, eased).normalize();
        camera.fov = THREE.MathUtils.lerp(flight.start.fov, flight.end.fov, eased);
        camera.updateProjectionMatrix();
        if (p >= 1) {
          applyPose(flight.end);
          flightRef.current = null;
          flyingRef.current = false;
          stateRef.current.flying = false;
          modeRef.current = flight.to;
          if (flight.to === "work") {
            callbackRef.current.onEnterWork();
            // 離開後只有 HTML 畫布互動，停掉 WebGL 循環節省電。
            api.setActive(false);
          } else {
            callbackRef.current.onExitWork();
            storeCamera();
          }
          if (rigRef) rigRef.current = { enterWorkView: () => beginFlight("work"), exitWorkView: () => beginFlight("room"), mode: modeRef.current, flying: false };
        }
        return;
      }
      if (modeRef.current !== "room") return;
      const keys = keysRef.current;
      let forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
      let side = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
      const joy = joystickRef.current;
      forward += joy.y;
      side += joy.x;
      const len = Math.hypot(forward, side);
      if (len > 1) { forward /= len; side /= len; }
      if (len > 0.02) {
        wasMovingRef.current = true;
        const speed = CAMERA.walkSpeed * (keys.has("shift") ? CAMERA.sprintMultiplier : 1) * dt;
        const yaw = stateRef.current.yaw;
        const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
        const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * side) * speed;
        const pos = clampRoomPosition(stateRef.current.x + dx, stateRef.current.z + dz);
        stateRef.current.x = pos.x;
        stateRef.current.z = pos.z;
        pointRoomCamera();
      } else if (wasMovingRef.current) {
        wasMovingRef.current = false;
        storeCamera();
      }
      // 微弱日光/陰影外觀由固定光源負責；此處只維持時間供其他效果使用。
      void t;
    });

    // 初始化：以持久化位置/朝向還原相機
    pointRoomCamera();
    if (rigRef) rigRef.current = { enterWorkView: () => beginFlight("work"), exitWorkView: () => beginFlight("room"), mode: "room", flying: false };

    return () => {
      removeFrame();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("study-room-reset-camera", onReset);
      if (rigRef) rigRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  return null;
};
