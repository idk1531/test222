import { clampToDesk, DESK_SNAP } from "./room3d";

export type HitKind = "book" | "heldBook" | "deskPaper" | "chair" | "none";
export type InputKey = "click" | "shiftClick" | "rightClick" | "KeyE" | "KeyQ" | "KeyF" | "Space";

export interface RoomActionCtx {
  mode: "room" | "work";
  flying: boolean;
  held: string | null;
  seated: boolean;
  bookOnDesk: boolean;
  hitDeskSurface: boolean;
  seatedCanStand: boolean;
  /** Raycast target metadata; optional so the resolver stays usable for non-book hits. */
  cardId?: string | null;
  /** World-space ray/desk intersection, required to produce a putOnDesk action. */
  deskPoint?: { x: number; z: number } | null;
  /** Current room yaw in degrees; placement is quantized to 15-degree turns. */
  playerYawDeg?: number;
  /** Player is close enough to show the optional sit/stand HUD button. */
  chairInTrigger?: boolean;
}

export type RoomAction =
  | { type: "openCard"; cardId: string; from: "shelf" | "desk" }
  | { type: "openPreview"; cardId: string }
  | { type: "pickUp"; cardId: string }
  | { type: "putOnDesk"; x: number; z: number; yawDeg: number }
  | { type: "returnToShelf" }
  | { type: "enterWorkView" }
  | { type: "sit" }
  | { type: "stand" }
  | { type: "jump" }
  | { type: "noop" };

const NOOP: RoomAction = { type: "noop" };

function withCard<T extends "openCard" | "openPreview" | "pickUp">(
  type: T,
  cardId: string | null | undefined,
  ctx: RoomActionCtx
): RoomAction {
  if (!cardId) return NOOP;
  if (type === "openCard") {
    return { type, cardId, from: ctx.bookOnDesk ? "desk" : "shelf" };
  }
  return { type, cardId };
}

function putOnDesk(ctx: RoomActionCtx): RoomAction {
  if (!ctx.hitDeskSurface || !ctx.deskPoint) return NOOP;
  const { x, z } = ctx.deskPoint;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return NOOP;
  // Snap before clamping so even points at the L-shaped edge stay on the 4 cm grid.
  const snappedX = Math.round(x / DESK_SNAP) * DESK_SNAP;
  const snappedZ = Math.round(z / DESK_SNAP) * DESK_SNAP;
  const point = clampToDesk(snappedX, snappedZ);
  const yaw = Number.isFinite(ctx.playerYawDeg) ? ctx.playerYawDeg! : 0;
  return {
    type: "putOnDesk",
    x: point.x,
    z: point.z,
    yawDeg: Math.round(yaw / 15) * 15,
  };
}

/** Resolve every room click/key through the same pure interaction table. */
export function resolveAction(hit: HitKind, key: InputKey, ctx: RoomActionCtx): RoomAction {
  // Flight and work mode intentionally accept no room actions.
  if (ctx.mode === "work" || ctx.flying) return NOOP;

  // 坐下時 F 一律起立（即使手上拿著書、或準心對著另一本書）。
  if (ctx.seated && key === "KeyF") return { type: "stand" };

  // 手持書時的動作與「準心剛好打在手持書上」脫鉤：
  // Q／右鍵／Shift＝回架，E／點擊＝只有對準桌面才放下。
  // 舊版只要準心落在另一本書上，E 會直接換拿那一本（前一場實際預覽重現），
  // 且 Q 依賴射線命中手持書，錯過就默默失敗。
  if (ctx.held && hit !== "chair") {
    if (key === "KeyQ" || key === "rightClick" || key === "shiftClick") return { type: "returnToShelf" };
    if (key === "KeyE" || key === "click") return putOnDesk(ctx);
  }

  switch (hit) {
    case "book":
      if (key === "click") return withCard("openCard", ctx.cardId, ctx);
      if (key === "shiftClick" || key === "rightClick") return withCard("openPreview", ctx.cardId, ctx);
      if (key === "KeyE") return withCard("pickUp", ctx.cardId, ctx);
      return NOOP;

    case "heldBook":
      if (!ctx.held) return NOOP;
      if (key === "click" || key === "KeyE") return putOnDesk(ctx);
      if (key === "shiftClick" || key === "rightClick" || key === "KeyQ") {
        return { type: "returnToShelf" };
      }
      return NOOP;

    case "deskPaper":
      return key === "click" ? { type: "enterWorkView" } : NOOP;

    case "chair":
      if (key === "click" || key === "KeyF") {
        if (ctx.seated) return { type: "stand" };
        // CameraRig only reports chair hits that are within the shared four-metre player range.
        return { type: "sit" };
      }
      return NOOP;

    case "none":
      if (key === "KeyF" && ctx.seated) return { type: "stand" };
      if (key === "Space" && !ctx.seated) return { type: "jump" };
      return NOOP;
  }
}
