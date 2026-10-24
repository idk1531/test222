import type { PlayerPose } from "./room3d";

export const REMOTE_POSE_INTERPOLATION_DELAY_MS = 75;
const MAX_POSE_HISTORY_MS = 1_000;
const MAX_POSE_SAMPLES = 90;

interface TimedPose {
  pose: PlayerPose;
  receivedAt: number;
}

function lerpAngle(current: number, target: number, amount: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * amount;
}

function interpolatePose(before: PlayerPose, after: PlayerPose, amount: number): PlayerPose {
  const currentFloor = before.floorY ?? 0;
  const nextFloor = after.floorY ?? 0;
  return {
    ...after,
    x: before.x + (after.x - before.x) * amount,
    z: before.z + (after.z - before.z) * amount,
    eyeY: before.eyeY + (after.eyeY - before.eyeY) * amount,
    floorY: currentFloor + (nextFloor - currentFloor) * amount,
    jumpOffset: before.jumpOffset + (after.jumpOffset - before.jumpOffset) * amount,
    yaw: lerpAngle(before.yaw, after.yaw, amount),
    pitch: before.pitch + (after.pitch - before.pitch) * amount,
  };
}

/**
 * Keeps a short timestamped history of the latest remote poses sampled during
 * rendering, so the avatar can be drawn between updates instead of stepping.
 */
export class RemotePoseInterpolator {
  private readonly samples: TimedPose[] = [];

  constructor(private readonly delayMs = REMOTE_POSE_INTERPOLATION_DELAY_MS) {}

  push(pose: PlayerPose, receivedAt: number): void {
    if (!pose.visible || !Number.isFinite(receivedAt)) {
      this.clear();
      return;
    }
    const previous = this.samples[this.samples.length - 1];
    if (previous && receivedAt < previous.receivedAt) return;

    // Keep unchanged poses in the timeline too. They mark the held position
    // during idle periods so later movement is not interpolated across a stale gap.
    this.samples.push({ pose: { ...pose }, receivedAt });
    const oldestAllowed = receivedAt - MAX_POSE_HISTORY_MS;
    while (this.samples.length > 2 && this.samples[1].receivedAt < oldestAllowed) this.samples.shift();
    while (this.samples.length > MAX_POSE_SAMPLES) this.samples.shift();
  }

  sample(now: number): PlayerPose | null {
    if (!this.samples.length) return null;
    const targetTime = now - this.delayMs;
    if (targetTime <= this.samples[0].receivedAt) return { ...this.samples[0].pose };

    for (let index = 1; index < this.samples.length; index += 1) {
      const after = this.samples[index];
      if (targetTime > after.receivedAt) continue;
      const before = this.samples[index - 1];
      const span = after.receivedAt - before.receivedAt;
      const amount = span > 0 ? Math.max(0, Math.min(1, (targetTime - before.receivedAt) / span)) : 1;
      return interpolatePose(before.pose, after.pose, amount);
    }

    return { ...this.samples[this.samples.length - 1].pose };
  }

  clear(): void {
    this.samples.length = 0;
  }
}
