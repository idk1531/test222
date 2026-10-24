import type { BrokerId } from "./config";

export type RoomTransportState = "idle" | "deriving-key" | "connecting" | "connected" | "partial" | "offline" | "leaving" | "failed";
export type BrokerConnectionState = "connecting" | "connected" | "offline";
export type TransportRoute = "auto" | "direct" | "relay";

export interface BrokerStatus {
  id: BrokerId;
  label: string;
  state: BrokerConnectionState;
}

export interface RoomPeer {
  deviceId: string;
  nickname: string;
  joinedAt: number;
  lastSeenAt: number;
}

export interface RoomTransportStatus {
  state: RoomTransportState;
  encrypted: boolean;
  roomReady: boolean;
  expiresAt: number | null;
  connectedBrokerCount: number;
  brokerCount: number;
  brokers: BrokerStatus[];
  peerCount: number;
}

export interface RoomTransportProgress {
  stage: "key-derivation" | "broker-connect" | "subscription" | "hello" | "ready" | "leaving";
  completed: number;
  total: number;
  message: string;
}

export interface TransportMessageMetadata {
  id: string;
  from: string;
  sentAt: number;
  route: "relay";
  encrypted: true;
}

export interface ReceivedTransportMessage {
  payload: unknown;
  metadata: TransportMessageMetadata;
}

export interface SendOptions {
  to?: string;
  route?: TransportRoute;
  reliable?: boolean;
}

export interface SendReceipt {
  id: string;
  route: "relay";
  publishedTo: BrokerId[];
  acknowledgedByBrokers: BrokerId[];
}

export interface RoomCreated {
  code: string;
  link: string;
  expiresAt: number | null;
}

export interface TransportError {
  code: string;
  message: string;
}

export interface RoomTransportEvents {
  status: RoomTransportStatus;
  peers: RoomPeer[];
  progress: RoomTransportProgress;
  message: ReceivedTransportMessage;
  error: TransportError;
}

export type RoomTransportEventName = keyof RoomTransportEvents;
export type RoomTransportListener<K extends RoomTransportEventName> = (event: RoomTransportEvents[K]) => void;
