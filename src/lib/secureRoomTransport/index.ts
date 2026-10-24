export { SecureRoomTransport } from "./secureRoomTransport";
export type {
  BrokerStatus,
  ReceivedTransportMessage,
  RoomCreated,
  RoomLocalRole,
  RoomPeer,
  RoomTransportProgress,
  RoomTransportState,
  RoomTransportStatus,
  SendOptions,
  SendReceipt,
  TransportError,
  TransportRoute,
} from "./types";

import { SecureRoomTransport } from "./secureRoomTransport";

let instance: SecureRoomTransport | null = null;

/** Reuse the relay session across client-side navigation, without persisting keys. */
export function getSecureRoomTransport(): SecureRoomTransport {
  if (!instance) instance = new SecureRoomTransport();
  return instance;
}
