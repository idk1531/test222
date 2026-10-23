import type { PlayerPose } from "./room3d";

export type RoomRole = "owner" | "editor" | "reader" | "pending";
export type GuestRole = Extract<RoomRole, "editor" | "reader">;

export interface RoomParticipant {
  id: string;
  name: string;
  role: RoomRole;
}

export interface HelloMessage {
  v: 1;
  type: "hello";
  participantId: string;
  name: string;
  role: "owner" | "pending";
  guestRole?: GuestRole;
}

export interface RoleMessage {
  v: 1;
  type: "role";
  participantId: string;
  role: GuestRole;
}

export interface PoseMessage {
  v: 1;
  type: "pose";
  participantId: string;
  pose: PlayerPose;
}

export type CollaborationMessage = HelloMessage | RoleMessage | PoseMessage;

export const MAX_COLLABORATION_MESSAGE_LENGTH = 8_192;

export function sanitizeDisplayNameInput(value: string): string {
  return Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "")).slice(0, 24).join("");
}

export function normalizeDisplayName(value: string): string {
  return sanitizeDisplayNameInput(value).trim() || "書房夥伴";
}

export function createParticipantId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // The fallback is only a temporary peer label, not a credential.
  }
  return `peer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function isGuestRole(role: unknown): role is GuestRole {
  return role === "editor" || role === "reader";
}

function isParticipantId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

export function normalizeRemotePose(value: unknown): PlayerPose | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const numericKeys = ["x", "z", "eyeY", "jumpOffset", "yaw", "pitch"] as const;
  if (numericKeys.some((key) => typeof candidate[key] !== "number" || !Number.isFinite(candidate[key]))) return null;
  if (["moving", "onGround", "seated", "visible"].some((key) => typeof candidate[key] !== "boolean")) return null;
  const clamp = (number: number, min: number, max: number) => Math.max(min, Math.min(max, number));
  return {
    x: clamp(candidate.x as number, -5, 5),
    z: clamp(candidate.z as number, -4, 4),
    eyeY: clamp(candidate.eyeY as number, 0.3, 4),
    jumpOffset: clamp(candidate.jumpOffset as number, 0, 3),
    yaw: clamp(candidate.yaw as number, -Math.PI * 8, Math.PI * 8),
    pitch: clamp(candidate.pitch as number, -Math.PI / 2, Math.PI / 2),
    moving: candidate.moving as boolean,
    onGround: candidate.onGround as boolean,
    seated: candidate.seated as boolean,
    visible: candidate.visible as boolean,
    holding: candidate.holding === true,
  };
}

export function parseCollaborationMessage(raw: unknown): CollaborationMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_COLLABORATION_MESSAGE_LENGTH) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (value.v !== 1 || !isParticipantId(value.participantId)) return null;

  if (value.type === "hello") {
    if (typeof value.name !== "string" || value.name.length > 256) return null;
    if (value.role !== "owner" && value.role !== "pending") return null;
    if (value.guestRole !== undefined && !isGuestRole(value.guestRole)) return null;
    return {
      v: 1,
      type: "hello",
      participantId: value.participantId,
      name: normalizeDisplayName(value.name),
      role: value.role,
      ...(isGuestRole(value.guestRole) ? { guestRole: value.guestRole } : {}),
    };
  }

  if (value.type === "role") {
    if (!isGuestRole(value.role)) return null;
    return { v: 1, type: "role", participantId: value.participantId, role: value.role };
  }

  if (value.type === "pose") {
    const pose = normalizeRemotePose(value.pose);
    if (!pose) return null;
    return { v: 1, type: "pose", participantId: value.participantId, pose };
  }

  return null;
}

export function serializeCollaborationMessage(message: CollaborationMessage): string {
  return JSON.stringify(message);
}
