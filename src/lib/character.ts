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
    hoodieLight: "#67948b",
    patch: "#e7b875",
    trousers: "#333b4a",
    trouserLight: "#4a5260",
    shoe: "#d9d2c4",
    shoeSole: "#51483f",
    shoeLace: "#f2e8d5",
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
  leftArmZ: number;
  rightArmZ: number;
  torsoBob: number;
  torsoLean: number;
  torsoRoll: number;
  torsoScaleY: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  bodyDrop: number;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const clampPitch = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * 待機／行走／衝刺／跳躍／坐下／持書姿態。數值是關節角度（rad）與微小位移；
 * moveWeight、sprintWeight 與 landing 讓轉場可以平滑漸變，不依賴 React state。
 */
export function characterAnim(input: {
  phase: number;
  moving: boolean;
  sprinting?: boolean;
  moveWeight?: number;
  sprintWeight?: number;
  airborne?: boolean;
  seated?: boolean;
  holding?: boolean;
  pitch?: number;
  landing?: number;
}): CharacterAnim {
  const {
    phase,
    moving,
    sprinting = false,
    moveWeight = moving ? 1 : 0,
    sprintWeight = sprinting ? 1 : 0,
    airborne = false,
    seated = false,
    holding = false,
    pitch = 0,
    landing = 0,
  } = input;
  const move = clamp01(moveWeight);
  const sprint = clamp01(sprintWeight);
  const impact = clamp01(landing);
  const swing = Math.sin(phase) * (CHARACTER.walkSwing + (CHARACTER.runSwing - CHARACTER.walkSwing) * sprint) * move;
  const idle = Math.sin(phase * 0.55) * CHARACTER.idleSway * (1 - move);
  const breath = Math.sin(phase * 0.55) * 0.004 * (1 - move);
  const head = clampPitch(pitch, -0.6, 0.4);
  const torsoScaleY = 1 - impact * 0.055;

  if (seated) {
    return {
      leftLeg: 1.2,
      rightLeg: 1.16,
      leftArm: holding ? 0.78 : 0.34,
      rightArm: holding ? 1.08 : 0.28,
      leftArmZ: holding ? -0.08 : -0.04,
      rightArmZ: holding ? 0.1 : 0.04,
      torsoBob: breath * 0.65,
      torsoLean: 0.065,
      torsoRoll: Math.sin(phase * 0.35) * 0.008,
      torsoScaleY,
      headPitch: clampPitch(head - 0.08, -0.55, 0.35),
      headYaw: Math.sin(phase * 0.28) * 0.02,
      headRoll: 0,
      bodyDrop: -0.2,
    };
  }

  if (holding) {
    // 書貼近胸前；正 X 旋轉會讓垂下手臂朝角色正前方（-Z）抬起。
    const legSwing = Math.sin(phase) * 0.24 * move;
    return {
      leftLeg: airborne ? 0.38 : legSwing,
      rightLeg: airborne ? 0.32 : -legSwing,
      leftArm: 0.82 + legSwing * 0.08,
      rightArm: 1.15 + legSwing * 0.06,
      leftArmZ: -0.08,
      rightArmZ: 0.12,
      torsoBob: move ? Math.abs(Math.sin(phase * 2)) * 0.009 : breath,
      torsoLean: move ? 0.025 + sprint * 0.025 : 0.01,
      torsoRoll: Math.sin(phase) * 0.012 * move,
      torsoScaleY,
      headPitch: clampPitch(head - 0.08, -0.5, 0.3),
      headYaw: Math.sin(phase * 0.35) * 0.018,
      headRoll: -Math.sin(phase) * 0.012 * move,
      bodyDrop: 0,
    };
  }

  if (airborne) {
    return {
      leftLeg: 0.46 + Math.sin(phase) * 0.06,
      rightLeg: 0.34 - Math.sin(phase) * 0.05,
      leftArm: -0.12,
      rightArm: -0.1,
      leftArmZ: -2.05,
      rightArmZ: 2.05,
      torsoBob: 0.008,
      torsoLean: -0.065,
      torsoRoll: 0,
      torsoScaleY: 1 + impact * 0.025,
      headPitch: clampPitch(head, -0.6, 0.4),
      headYaw: 0,
      headRoll: 0,
      bodyDrop: 0,
    };
  }

  const runLean = 0.035 + sprint * 0.065;
  const armSwing = swing * 0.72;
  const bob = Math.abs(Math.sin(phase * 2)) * (0.005 + move * (0.009 + sprint * 0.006));
  const torsoRoll = Math.sin(phase) * 0.022 * move + idle * 0.2;
  return {
    leftLeg: swing,
    rightLeg: -swing,
    leftArm: -armSwing + idle,
    rightArm: armSwing - idle,
    leftArmZ: -Math.cos(phase) * 0.035 * move,
    rightArmZ: Math.cos(phase) * 0.035 * move,
    torsoBob: bob + breath,
    torsoLean: move * runLean,
    torsoRoll,
    torsoScaleY: torsoScaleY + Math.abs(Math.sin(phase * 2)) * move * 0.006,
    headPitch: clampPitch(head - move * runLean * 0.5, -0.6, 0.4),
    headYaw: Math.sin(phase * 0.5) * 0.025 * move,
    headRoll: -torsoRoll * 0.45,
    bodyDrop: 0,
  };
}
