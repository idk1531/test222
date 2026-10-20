// v8.5：原創 voxel 風格人物（不使用任何外部角色 skin）。
// 幾何比例、配色與動作都是本專案自製；此檔為純資料／純函式，SSR 安全、可單測。

/** 以「眼睛高度 1.62 m」為 1 的单位的角色尺寸（公尺）。 */
export const CHARACTER = {
  eyeHeight: 1.62,
  totalHeight: 1.80,
  headSize: 0.42,
  torso: { width: 0.46, height: 0.58, depth: 0.26 },
  arm: { width: 0.13, height: 0.58, depth: 0.19 },
  leg: { width: 0.17, height: 0.76, depth: 0.21 },
  hipY: 0.76,
  shoulderY: 1.28,
  headBaseY: 1.34,
  colors: {
    skin: "#d9a46f",
    hair: "#2f2723",
    hoodie: "#2f6f6a",
    hoodieDark: "#245753",
    trousers: "#333b4a",
    shoe: "#d9d2c4",
    shoeAccent: "#c8703d",
    eye: "#21262b",
    mouth: "#8a4a3c",
  },
  idleSway: 0.035,
  walkSwing: 0.62,
  runSwing: 0.85,
};

export interface CharacterAnim {
  leftLeg: number;
  rightLeg: number;
  leftArm: number;
  rightArm: number;
  torsoBob: number;
  torsoLean: number;
  headPitch: number;
  bodyDrop: number;
}

/**
 * 待機／行走／跳躍／坐下四種姿勢的關節角度（rad）。
 * 只回傳角度與位移，Three.js 元件每幀套用，避免擴成完整動畫系統。
 */
export function characterAnim(input: {
  phase: number;
  moving: boolean;
  sprinting?: boolean;
  airborne?: boolean;
  seated?: boolean;
  holding?: boolean;
  pitch?: number;
}): CharacterAnim {
  const { phase, moving, sprinting = false, airborne = false, seated = false, holding = false, pitch = 0 } = input;
  const swing = moving ? Math.sin(phase) * (sprinting ? CHARACTER.runSwing : CHARACTER.walkSwing) : 0;
  const idle = Math.sin(phase * 0.55) * CHARACTER.idleSway;
  if (seated) {
    return {
      leftLeg: 1.28,
      rightLeg: 1.22,
      leftArm: 0.42,
      rightArm: 0.34,
      torsoBob: 0,
      torsoLean: 0.08,
      headPitch: Math.max(-0.5, Math.min(0.4, pitch)),
      bodyDrop: -0.3,
    };
  }
  if (airborne) {
    return {
      leftLeg: 0.32,
      rightLeg: -0.22,
      leftArm: -0.55,
      rightArm: -0.5,
      torsoBob: 0,
      torsoLean: 0.04,
      headPitch: Math.max(-0.6, Math.min(0.4, pitch)),
      bodyDrop: 0,
    };
  }
  if (holding) {
    // 雙手把書端在胸前；仍保留一點行走擺動，不擴成完整動畫系統。
    return {
      leftLeg: swing,
      rightLeg: -swing,
      leftArm: -0.5 + swing * 0.14,
      rightArm: -1.15 + swing * 0.1,
      torsoBob: moving ? Math.abs(Math.sin(phase)) * 0.01 : Math.sin(phase * 0.55) * 0.004,
      torsoLean: moving ? 0.02 : 0,
      headPitch: Math.max(-0.5, Math.min(0.3, pitch)) - 0.08,
      bodyDrop: 0,
    };
  }
  return {
    leftLeg: swing,
    rightLeg: -swing,
    leftArm: -swing * 0.75 + (moving ? 0 : idle),
    rightArm: swing * 0.75 - (moving ? 0 : idle),
    torsoBob: moving ? Math.abs(Math.sin(phase)) * 0.014 : Math.sin(phase * 0.55) * 0.006,
    torsoLean: moving ? 0.035 : 0,
    headPitch: Math.max(-0.6, Math.min(0.4, pitch)),
    bodyDrop: 0,
  };
}
