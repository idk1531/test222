"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import type { PlayerPose } from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

export function RemotePlayerLabel({
  api,
  poseRef,
  name,
}: {
  api: StudySceneApi;
  poseRef: React.MutableRefObject<PlayerPose>;
  name: string;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => api.addFrameCallback(() => {
    const element = elementRef.current;
    if (!element) return;
    const pose = poseRef.current;
    if (!pose.visible) {
      element.style.visibility = "hidden";
      return;
    }
    const scale = Math.max(0.72, Math.min(1.35, pose.eyeY / 1.62));
    const y = pose.jumpOffset - (pose.seated ? 0.2 : 0) + 1.9 * scale;
    const point = api.projectToScreen(new THREE.Vector3(pose.x, y, pose.z));
    if (!point.visible) {
      element.style.visibility = "hidden";
      return;
    }
    element.style.visibility = "visible";
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -100%)`;
  }), [api, poseRef]);

  return (
    <div
      ref={elementRef}
      className="pointer-events-none absolute left-0 top-0 z-[35] rounded-full border border-white/70 bg-slate-950/75 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md backdrop-blur"
      style={{ visibility: "hidden" }}
      aria-hidden="true"
    >
      {name}
    </div>
  );
}
