import type { PlayerPose } from "./room3d";

const REMOTE_POSE_SMOOTHING_RATE = 24;

function lerpAngle(current: number, target: number, amount: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * amount;
}

/**
 * Smooth the rendered remote avatar toward the newest received pose. This only
 * affects presentation; collision and protocol state continue to use raw poses.
 */
export function smoothRemotePose(current: PlayerPose, target: PlayerPose, deltaSeconds: number): PlayerPose {
  if (!target.visible || !current.visible) return { ...target };

  const delta = Math.max(0, Math.min(deltaSeconds, 0.05));
  const amount = 1 - Math.exp(-REMOTE_POSE_SMOOTHING_RATE * delta);
  const currentFloor = current.floorY ?? 0;
  const targetFloor = target.floorY ?? 0;

  return {
    ...target,
    x: current.x + (target.x - current.x) * amount,
    z: current.z + (target.z - current.z) * amount,
    eyeY: current.eyeY + (target.eyeY - current.eyeY) * amount,
    floorY: currentFloor + (targetFloor - currentFloor) * amount,
    jumpOffset: current.jumpOffset + (target.jumpOffset - current.jumpOffset) * amount,
    yaw: lerpAngle(current.yaw, target.yaw, amount),
    pitch: current.pitch + (target.pitch - current.pitch) * amount,
  };
}
