import type { RoomPeer } from "./types";

type PeerSummary = Pick<RoomPeer, "deviceId" | "nickname" | "joinedAt">;

/** Activity timestamps change on every packet, but only stable peer details merit UI updates. */
export function hasPeerSummaryChanged(previous: PeerSummary | undefined, next: PeerSummary): boolean {
  return !previous
    || previous.deviceId !== next.deviceId
    || previous.nickname !== next.nickname
    || previous.joinedAt !== next.joinedAt;
}
