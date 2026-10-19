"use client";

import React, { useEffect } from "react";
import * as THREE from "three";
import { makeBook, disposeBookModel } from "./Book3D";
import type { ShelfBookPlacement } from "@/lib/room3d";
import type { StudySceneApi } from "./StudyScene";

/** First-person prop: parented to the camera so it follows the view without a second yaw/pitch rig. */
export const HeldBook: React.FC<{
  api: StudySceneApi;
  cardId: string | null;
  placement: ShelfBookPlacement | null;
  title: string;
}> = ({ api, cardId, placement, title }) => {
  useEffect(() => {
    if (!cardId || !placement) return;
    const group = new THREE.Group();
    group.name = `held-book-${cardId}`;
    group.userData.kind = "heldBook";
    group.userData.cardId = cardId;
    group.userData.place = "held";
    group.position.set(0.24, -0.17, -0.42);
    group.rotation.set(-0.16, -0.32, 0.08);
    group.add(makeBook({ ...placement, x: 0, y: 0, z: 0 }, title, "held"));
    api.camera.add(group);

    const baseY = group.position.y;
    const removeFrame = api.addFrameCallback((_dt, t) => {
      group.position.y = baseY + Math.sin(t * 1.9) * 0.006;
    });
    return () => {
      removeFrame();
      api.camera.remove(group);
      disposeBookModel(group);
    };
  }, [api, cardId, placement, title]);

  return null;
};
