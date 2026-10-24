export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 16;

export const TRANSPORT_CONFIG = {
  // Public WSS MQTT brokers. Each room uses the same single topic on every broker.
  brokers: [
    { id: "emqx", label: "EMQX", url: "wss://broker.emqx.io:8084/mqtt" },
    { id: "hivemq", label: "HiveMQ", url: "wss://broker.hivemq.com:8884/mqtt" },
    { id: "mosquitto", label: "Mosquitto test", url: "wss://test.mosquitto.org:8081" },
  ],
  topicPrefix: "scinotes/room/v1",
  pbkdf2Iterations: 100_000,
  pbkdf2Salt: "scinotes-secure-room-v1",
  mqttConnectTimeoutMs: 12_000,
  mqttPublishTimeoutMs: 10_000,
  relayMaxPacketBytes: 100_000,
  helloIntervalMs: 3_000,
  peerExpiryMs: 10_000,
  peerSweepIntervalMs: 1_000,
  deduplicationTtlMs: 120_000,
  deduplicationMaxEntries: 4_096,
} as const;

export type BrokerId = (typeof TRANSPORT_CONFIG.brokers)[number]["id"];
