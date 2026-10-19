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
  CHAIR,
  CHAIR_APPROACH_RADIUS,
  DESK,
  DESK_FOOTPRINT,
  easeInOutCubic,
  forwardFromYawPitch,
  clampHeight,
  clampPitchRad,
  clampRoomPosition,
  groundHeightAt,
  isWithinSitTrigger,
  JUMP,
  PLAYER_RADIUS,
  resolveCollision,
  ROOM,
  SIT,
  stepJump,
} from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";
import type { RoomFurnitureRig } from "./RoomFurniture";
import type { JoystickVector } from "./Joystick";
import { resolveAction, type HitKind, type InputKey, type RoomAction, type RoomActionCtx } from "@/lib/roomActions";

export interface CameraRigInteractionState {
  heldCardId: string | null;
  seated: boolean;
  chairInTrigger: boolean;
  uiOpen: boolean;
}

export interface RoomActionMeta {
  hit: HitKind;
  key: InputKey;
  cardId?: string;
  bookOnDesk: boolean;
  hitDeskSurface: boolean;
  worldPoint?: { x: number; y: number; z: number };
  screenPoint?: { x: number; y: number };
}

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
  interactWithChair?: () => void;
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
  interactionRef: React.MutableRefObject<CameraRigInteractionState>;
  chairRigRef: React.MutableRefObject<RoomFurnitureRig | null>;
  onRoomAction: (action: RoomAction, meta: RoomActionMeta) => void;
  onPointerLockChange?: (locked: boolean) => void;
  onChairTriggerChange?: (inTrigger: boolean) => void;
}> = ({ api, initialCamera, joystickRef, onEnterWork, onExitWork, rigRef, persistCamera, interactionRef, chairRigRef, onRoomAction, onPointerLockChange, onChairTriggerChange }) => {
  const camera = api.camera;
  const initialPosition = clampRoomPosition(initialCamera.x ?? 0.9, initialCamera.z ?? 1.55);
  const stateRef = useRef({
    x: initialPosition.x,
    z: initialPosition.z,
    height: clampHeight(initialCamera.height ?? 1.5),
    eyeHeight: clampHeight(initialCamera.height ?? 1.5),
    yaw: THREE.MathUtils.degToRad(initialCamera.yaw),
    pitch: clampPitchRad(THREE.MathUtils.degToRad(initialCamera.pitch)),
    jumpOffset: 0,
    jumpVelocity: 0,
    onGround: true,

    mode: "room" as CameraMode,
    flying: false,
  });
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef<{ id: number; x: number; y: number; moved: boolean; longPressFired: boolean } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
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
  const actionCallbackRef = useRef(onRoomAction);
  const pointerLockCallbackRef = useRef(onPointerLockChange);
  const chairTriggerCallbackRef = useRef(onChairTriggerChange);
  const previousChairTriggerRef = useRef(false);
  const interactWithChairRef = useRef<() => void>(() => {});
  const seatTransitionRef = useRef<{
    startedAt: number;
    duration: number;
    fromEyeY: number;
    toEyeY: number;
    fromFov: number;
    toFov: number;
    fromOpacity: number;
    toOpacity: number;
  } | null>(null);
  const lastLockedPersistRef = useRef(0);
  const modeRef = useRef<CameraMode>("room");
  const flyingRef = useRef(false);
  const wasMovingRef = useRef(false);
  useEffect(() => {
    persistRef.current = persistCamera;
    callbackRef.current = { onEnterWork, onExitWork };
    actionCallbackRef.current = onRoomAction;
    pointerLockCallbackRef.current = onPointerLockChange;
    chairTriggerCallbackRef.current = onChairTriggerChange;
  }, [persistCamera, onEnterWork, onExitWork, onRoomAction, onPointerLockChange, onChairTriggerChange]);
  const interactWithChair = () => interactWithChairRef.current();

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
    stateRef.current = {
      ...stateRef.current,
      x: p.x,
      z: p.z,
      height: p.height,
      eyeHeight: p.position.y - groundHeightAt(p.x, p.z) - stateRef.current.jumpOffset,
      yaw: p.yaw,
      pitch: p.pitch,
    };
  };

  const pointRoomCamera = () => {
    const s = stateRef.current;
    const forward = forwardFromYawPitch(s.yaw, s.pitch);
    camera.up.set(0, 1, 0);
    camera.position.set(s.x, groundHeightAt(s.x, s.z) + s.eyeHeight + s.jumpOffset, s.z);
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
    const chairTargetPosition = new THREE.Vector3();

    const findSemanticObject = (object: THREE.Object3D) => {
      let current: THREE.Object3D | null = object;
      let held: THREE.Object3D | null = null;
      let tagged: THREE.Object3D | null = null;
      while (current) {
        if (current.userData.kind === "heldBook") held = current;
        if (!tagged && ["book", "chair", "deskCanvas", "deskSurface"].includes(current.userData.kind)) {
          tagged = current;
        }
        current = current.parent;
      }
      return held || tagged;
    };

    const raycast = (clientX?: number, clientY?: number, forceCenter = false) => {
      const rect = canvas.getBoundingClientRect();
      // Pointer Lock freezes client coordinates; the reticle and raycast both stay at screen center.
      if (document.pointerLockElement || forceCenter || clientX === undefined || clientY === undefined) {
        pointer.set(0, 0);
      } else {
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      }
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(api.scene.children, true);
      let bookTarget: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
      let chairTarget: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
      let paperTarget: { object: THREE.Object3D; point: THREE.Vector3 } | null = null;
      let deskTarget: THREE.Vector3 | null = null;
      for (const intersection of hits) {
        const object = findSemanticObject(intersection.object);
        if (!object) continue;
        const kind = object.userData.kind;
        if ((kind === "book" || kind === "heldBook") && object.userData.cardId && !bookTarget) {
          bookTarget = { object, point: intersection.point };
        } else if (kind === "chair" && !chairTarget) {
          chairTarget = { object, point: intersection.point };
        } else if (kind === "deskCanvas" && !paperTarget) {
          paperTarget = { object, point: intersection.point };
        }
        if (kind === "deskCanvas" && !deskTarget) {
          deskTarget = intersection.point;
        } else if (kind === "deskSurface" && !deskTarget) {
          const normal = intersection.face?.normal.clone().transformDirection(intersection.object.matrixWorld);
          if (normal && normal.y > 0.5 && Math.abs(intersection.point.y - DESK.top) < 0.02) {
            deskTarget = intersection.point;
          }
        }
      }
      // A book wins over the coplanar desk paper so its click opens that card, not work view.
      const target = bookTarget || chairTarget || paperTarget;
      if (!target) {
        return {
          hit: "none" as HitKind,
          cardId: undefined,
          bookOnDesk: false,
          hitDeskSurface: !!deskTarget,
          deskPoint: deskTarget ? { x: deskTarget.x, z: deskTarget.z } : undefined,
          worldPoint: undefined,
        };
      }
      const kind = target.object.userData.kind;
      const hit: HitKind = kind === "heldBook" ? "heldBook"
        : kind === "book" ? "book"
        : kind === "chair" ? "chair"
        : "deskPaper";
      return {
        hit,
        cardId: target.object.userData.cardId as string | undefined,
        bookOnDesk: target.object.userData.place === "desk",
        hitDeskSurface: !!deskTarget,
        deskPoint: deskTarget ? { x: deskTarget.x, z: deskTarget.z } : undefined,
        worldPoint: { x: target.point.x, y: target.point.y, z: target.point.z },
      };
    };

    const beginSeatTransition = (toSeated: boolean) => {
      const current = stateRef.current;
      const shellMaterial = chairRigRef.current?.shellMaterial;
      const fromOpacity = shellMaterial?.opacity ?? (toSeated ? 1 : SIT.fadeOpacity);
      current.eyeHeight += current.jumpOffset;
      current.jumpOffset = 0;
      current.jumpVelocity = 0;
      current.onGround = true;
      seatTransitionRef.current = {
        startedAt: performance.now(),
        duration: 240,
        fromEyeY: current.eyeHeight,
        toEyeY: toSeated ? SIT.eyeY : clampHeight(current.height),
        fromFov: camera.fov,
        toFov: toSeated ? SIT.fov : CAMERA.fov,
        fromOpacity,
        toOpacity: toSeated ? SIT.fadeOpacity : 1,
      };
      if (shellMaterial) {
        shellMaterial.transparent = true;
        shellMaterial.depthWrite = false;
        shellMaterial.needsUpdate = true;
      }
    };
    const moveOutFromDeskBeforeStanding = () => {
      const s = stateRef.current;
      const overlap = SIT.seatY + 1.5 > DESK.top && DESK_FOOTPRINT.some((rect) =>
        s.x >= rect.minX - 0.3 && s.x <= rect.maxX + 0.3 &&
        s.z >= rect.minZ - 0.3 && s.z <= rect.maxZ + 0.3
      );
      if (!overlap) return;
      const safe = resolveCollision(s.x, s.z, 0.30, true);
      s.x = safe.x;
      s.z = safe.z;
      pointRoomCamera();
      storeCamera();
    };

    const performInteraction = (
      key: InputKey,
      clientX?: number,
      clientY?: number,
      forceCenter = false,
      hitOverride?: HitKind
    ) => {
      if (modeRef.current !== "room" || flyingRef.current || interactionRef.current.uiOpen) return;
      const target = raycast(clientX, clientY, forceCenter);
      const heldId = interactionRef.current.heldCardId;
      const actionHit = key === "KeyF" && interactionRef.current.seated
        ? "none"
        : heldId && key !== "KeyF"
          ? "heldBook"
          : hitOverride ?? target.hit;
      const context: RoomActionCtx = {
        mode: modeRef.current,
        flying: flyingRef.current,
        held: heldId,
        seated: interactionRef.current.seated,
        bookOnDesk: target.bookOnDesk,
        hitDeskSurface: target.hitDeskSurface,
        seatedCanStand: true,
        cardId: actionHit === "heldBook" ? heldId : target.cardId,
        deskPoint: target.deskPoint,
        playerYawDeg: THREE.MathUtils.radToDeg(stateRef.current.yaw),
        chairInTrigger: interactionRef.current.chairInTrigger,
      };
      const action = resolveAction(actionHit, key, context);
      if (action.type === "jump" && stateRef.current.onGround && !interactionRef.current.seated) {
        stateRef.current.jumpVelocity = JUMP.velocity;
        stateRef.current.onGround = false;
      } else if (action.type === "sit") {
        interactionRef.current.seated = true;
        beginSeatTransition(true);
      } else if (action.type === "stand") {
        moveOutFromDeskBeforeStanding();
        interactionRef.current.seated = false;
        beginSeatTransition(false);
      }
      actionCallbackRef.current(action, {
        hit: actionHit,
        key,
        cardId: actionHit === "heldBook" ? heldId ?? target.cardId : target.cardId,
        bookOnDesk: target.bookOnDesk,
        hitDeskSurface: target.hitDeskSurface,
        worldPoint: target.worldPoint,
        screenPoint: clientX !== undefined && clientY !== undefined ? { x: clientX, y: clientY } : undefined,
      });
    };
    interactWithChairRef.current = () => performInteraction("KeyF", undefined, undefined, true, "chair");

    const requestRoomPointerLock = () => {
      if (
        document.pointerLockElement === canvas ||
        typeof canvas.requestPointerLock !== "function" ||
        !window.matchMedia("(pointer:fine)").matches ||
        modeRef.current !== "room" ||
        flyingRef.current
      ) return;
      const request = canvas.requestPointerLock();
      void Promise.resolve(request).catch(() => {
        // Pointer Lock may reject when the browser/embedding context denies the gesture.
      });
    };
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      pointerLockCallbackRef.current?.(locked);
      if (!locked) storeCamera();
    };
    const onLockedMouseMove = (e: MouseEvent) => {
      if (
        document.pointerLockElement !== canvas ||
        modeRef.current !== "room" ||
        flyingRef.current ||
        interactionRef.current.uiOpen
      ) return;
      stateRef.current.yaw -= e.movementX * CAMERA.lockSensitivity;
      stateRef.current.pitch = clampPitchRad(stateRef.current.pitch - e.movementY * CAMERA.lockSensitivity, interactionRef.current.seated);
      pointRoomCamera();
      const now = performance.now();
      if (now - lastLockedPersistRef.current >= 150) {
        lastLockedPersistRef.current = now;
        storeCamera();
      }
    };

    const clearLongPress = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-orbit],button,input,textarea,select,a,[contenteditable='true']")) return;
      if (modeRef.current !== "room" || flyingRef.current || interactionRef.current.uiOpen || (e.pointerType === "mouse" && e.button !== 0)) return;
      const pointerState = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, longPressFired: false };
      pointerRef.current = pointerState;
      canvas.setPointerCapture?.(e.pointerId);
      if (e.pointerType === "touch") {
        longPressTimerRef.current = window.setTimeout(() => {
          if (pointerRef.current !== pointerState || pointerState.moved) return;
          pointerState.longPressFired = true;
          performInteraction("shiftClick", pointerState.x, pointerState.y);
        }, 450);
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (document.pointerLockElement) return;
      const p = pointerRef.current;
      if (!p || p.id !== e.pointerId || modeRef.current !== "room" || flyingRef.current) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        p.moved = true;
        clearLongPress();
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.moved && !p.longPressFired) {
        stateRef.current.yaw -= dx * CAMERA.lookSensitivity;
        stateRef.current.pitch = clampPitchRad(stateRef.current.pitch - dy * CAMERA.lookSensitivity, interactionRef.current.seated);
        pointRoomCamera();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const p = pointerRef.current;
      if (!p || p.id !== e.pointerId) return;
      clearLongPress();
      pointerRef.current = null;
      if (!p.moved && !p.longPressFired && modeRef.current === "room" && !flyingRef.current) {
        performInteraction(e.shiftKey ? "shiftClick" : "click", e.clientX, e.clientY);
        if (!flyingRef.current) requestRoomPointerLock();
      } else if (p.moved) {
        storeCamera();
      }
    };
    const onPointerCancel = (e: PointerEvent) => {
      clearLongPress();
      if (pointerRef.current?.id === e.pointerId) pointerRef.current = null;
    };
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-orbit],button,input,textarea,select,a,[contenteditable='true']")) return;
      if (modeRef.current !== "room" || flyingRef.current || interactionRef.current.uiOpen) return;
      e.preventDefault();
      performInteraction("rightClick", e.clientX, e.clientY);
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
        interactionRef.current.uiOpen ||
        isTypingTarget(e.target) ||
        !!target?.closest("[data-no-orbit],button,a,select")
      ) return;
      const key = e.key.toLowerCase();
      const actionKey: InputKey | null = key === "e" ? "KeyE"
        : key === "q" ? "KeyQ"
        : key === "f" ? "KeyF"
        : key === " " ? "Space"
        : null;
      if (actionKey) {
        if (e.repeat) return;
        if (actionKey === "Space" && interactionRef.current.seated) return;
        e.preventDefault();
        performInteraction(actionKey, undefined, undefined, true);
        return;
      }
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
      if (document.pointerLockElement === canvas) document.exitPointerLock();
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
      if (interactionRef.current.seated) {
        if (seatTransitionRef.current) seatTransitionRef.current.toEyeY = SIT.eyeY;
      } else if (seatTransitionRef.current) {
        seatTransitionRef.current.toEyeY = stateRef.current.height;
      } else {
        stateRef.current.eyeHeight = stateRef.current.height;
      }
      pointRoomCamera();
      storeCamera();
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modeRef.current === "work") {
        e.stopPropagation();
        beginFlight("room");
      } else if (modeRef.current === "room" && interactionRef.current.seated && !flyingRef.current) {
        performInteraction("KeyF", undefined, undefined, true);
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
        height: clampHeight(c.height ?? 1.5),
        eyeHeight: interactionRef.current.seated ? stateRef.current.eyeHeight : clampHeight(c.height ?? 1.5),
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
    canvas.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onLockedMouseMove);
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
          if (rigRef) rigRef.current = { enterWorkView: () => beginFlight("work"), exitWorkView: () => beginFlight("room"), interactWithChair, mode: modeRef.current, flying: false };
        }
        return;
      }
      if (modeRef.current !== "room") return;
      let seatChanged = false;
      const transition = seatTransitionRef.current;
      if (transition) {
        const progress = Math.min(1, (performance.now() - transition.startedAt) / transition.duration);
        const eased = easeInOutCubic(progress);
        stateRef.current.eyeHeight = THREE.MathUtils.lerp(transition.fromEyeY, transition.toEyeY, eased);
        camera.fov = THREE.MathUtils.lerp(transition.fromFov, transition.toFov, eased);
        camera.updateProjectionMatrix();
        const shellMaterial = chairRigRef.current?.shellMaterial;
        if (shellMaterial) {
          shellMaterial.opacity = THREE.MathUtils.lerp(transition.fromOpacity, transition.toOpacity, eased);
          if (progress >= 1) {
            shellMaterial.transparent = transition.toOpacity < 1;
            shellMaterial.depthWrite = transition.toOpacity >= 1;
            shellMaterial.needsUpdate = true;
          }
        }
        seatChanged = true;
        if (progress >= 1) seatTransitionRef.current = null;
      }
      const chairRig = chairRigRef.current;
      if (interactionRef.current.seated && chairRig) {
        chairTargetPosition.set(stateRef.current.x, CHAIR.y, stateRef.current.z);
        chairRig.group.position.lerp(chairTargetPosition, 0.18);
        chairRig.group.rotation.y = stateRef.current.yaw;
      }
      const chairX = chairRig?.group.position.x ?? CHAIR.x;
      const chairZ = chairRig?.group.position.z ?? CHAIR.z;
      const inChairTrigger = isWithinSitTrigger(stateRef.current.x, stateRef.current.z, chairX, chairZ);
      interactionRef.current.chairInTrigger = inChairTrigger;
      if (inChairTrigger !== previousChairTriggerRef.current) {
        previousChairTriggerRef.current = inChairTrigger;
        chairTriggerCallbackRef.current?.(inChairTrigger);
      }
      let jumpChanged = false;
      if (!interactionRef.current.seated) {
        const current = stateRef.current;
        const jump = stepJump(
          { offset: current.jumpOffset, velocity: current.jumpVelocity, onGround: current.onGround },
          Math.min(dt, 0.05)
        );
        jumpChanged = jump.offset !== current.jumpOffset || jump.onGround !== current.onGround;
        current.jumpOffset = jump.offset;
        current.jumpVelocity = jump.velocity;
        current.onGround = jump.onGround;
      }
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
        const seatedNow = interactionRef.current.seated;
        const speed = (seatedNow
          ? SIT.walkSpeed
          : CAMERA.walkSpeed * (keys.has("shift") ? CAMERA.sprintMultiplier : 1)) * dt;
        const yaw = stateRef.current.yaw;
        const dx = (Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed;
        const dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * side) * speed;
        const nextX = stateRef.current.x + dx;
        const nextZ = stateRef.current.z + dz;
        const chairX = chairRigRef.current?.group.position.x ?? CHAIR.x;
        const chairZ = chairRigRef.current?.group.position.z ?? CHAIR.z;
        const seatedApproach = Math.hypot(nextX - chairX, nextZ - chairZ) < CHAIR_APPROACH_RADIUS;
        const separated = resolveCollision(
          nextX,
          nextZ,
          PLAYER_RADIUS,
          seatedNow || seatedApproach,
          seatedNow,
          { x: chairX, z: chairZ }
        );
        const pos = clampRoomPosition(separated.x, separated.z);
        stateRef.current.x = pos.x;
        stateRef.current.z = pos.z;
        pointRoomCamera();
      } else {
        if (jumpChanged || seatChanged) pointRoomCamera();
        if (wasMovingRef.current) {
          wasMovingRef.current = false;
          storeCamera();
        }
      }
      // 微弱日光/陰影外觀由固定光源負責；此處只維持時間供其他效果使用。
      void t;
    });

    // 初始化：以持久化位置/朝向還原相機
    pointRoomCamera();
    if (rigRef) rigRef.current = { enterWorkView: () => beginFlight("work"), exitWorkView: () => beginFlight("room"), interactWithChair, mode: "room", flying: false };

    return () => {
      removeFrame();
      clearLongPress();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onLockedMouseMove);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
      pointerLockCallbackRef.current?.(false);
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
