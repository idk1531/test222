"use client";

import { useEffect, useState, type MutableRefObject } from "react";
import type { PlayerPose } from "@/lib/room3d";
import { RemotePoseInterpolator } from "@/lib/remotePoseSmoothing";
import type { StudySceneApi } from "./StudyScene";

export function RemotePoseSmoother({
  api,
  sourcePoseRef,
  renderedPoseRef,
}: {
  api: StudySceneApi;
  sourcePoseRef: MutableRefObject<PlayerPose>;
  renderedPoseRef: MutableRefObject<PlayerPose>;
}) {
  const [interpolator] = useState(() => new RemotePoseInterpolator());

  useEffect(() => {
    interpolator.clear();
    renderedPoseRef.current = { ...sourcePoseRef.current };

    const removeFrame = api.addFrameCallback(() => {
      const target = sourcePoseRef.current;
      if (!target.visible) {
        interpolator.clear();
        renderedPoseRef.current = { ...target };
        return;
      }

      const now = performance.now();
      interpolator.push(target, now);
      const sample = interpolator.sample(now);
      if (sample) renderedPoseRef.current = sample;
    });
    return removeFrame;
  }, [api, interpolator, renderedPoseRef, sourcePoseRef]);

  return null;
}
