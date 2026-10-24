"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { PlayerPose } from "@/lib/room3d";
import { smoothRemotePose } from "@/lib/remotePoseSmoothing";
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
  const initializedRef = useRef(false);

  useEffect(() => {
    renderedPoseRef.current = { ...sourcePoseRef.current };
    const removeFrame = api.addFrameCallback((deltaSeconds) => {
      const target = sourcePoseRef.current;
      if (!target.visible) {
        renderedPoseRef.current = { ...target };
        initializedRef.current = false;
        return;
      }

      const current = renderedPoseRef.current;
      if (!initializedRef.current || !current.visible) {
        renderedPoseRef.current = { ...target };
        initializedRef.current = true;
        return;
      }
      renderedPoseRef.current = smoothRemotePose(current, target, deltaSeconds);
    });
    return removeFrame;
  }, [api, renderedPoseRef, sourcePoseRef]);

  return null;
}
