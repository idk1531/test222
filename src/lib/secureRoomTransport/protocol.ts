export type PayloadEncoding =
  | { kind: "string"; data: string }
  | { kind: "json"; data: unknown }
  | { kind: "array-buffer"; data: string }
  | { kind: "blob"; data: string; mimeType: string };

export type RoomWireMessage =
  | { v: 1; id: string; type: "hello" | "heartbeat"; from: string; sentAt: number; nickname: string; joinedAt: number; expiresAt: number | null }
  | { v: 1; id: string; type: "leave"; from: string; sentAt: number }
  | { v: 1; id: string; type: "app"; from: string; sentAt: number; nickname?: string; to?: string; payload: PayloadEncoding };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isValidNickname(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length <= 24;
}

export function isRoomWireMessage(value: unknown): value is RoomWireMessage {
  if (!isRecord(value) || value.v !== 1 || typeof value.id !== "string" || value.id.length > 96) return false;
  if (typeof value.from !== "string" || value.from.length > 96 || typeof value.sentAt !== "number" || !Number.isFinite(value.sentAt)) return false;
  if (value.type === "hello" || value.type === "heartbeat") {
    return isValidNickname(value.nickname)
      && typeof value.joinedAt === "number"
      && Number.isFinite(value.joinedAt)
      && (value.expiresAt === null || (typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)));
  }
  if (value.type === "leave") return true;
  if (value.type === "app") {
    return (value.to === undefined || (typeof value.to === "string" && value.to.length <= 96))
      && (value.nickname === undefined || isValidNickname(value.nickname))
      && isRecord(value.payload)
      && typeof value.payload.kind === "string";
  }
  return false;
}
