import mqtt, { type MqttClient } from "mqtt";
import { TRANSPORT_CONFIG, type BrokerId } from "./config";
import { isRoomWireMessage, type PayloadEncoding, type RoomWireMessage } from "./protocol";
import {
  createRoomCode,
  createSecureId,
  decryptRoomMessage,
  deriveRoomKey,
  deriveRoomTopic,
  encryptRoomMessage,
  normalizeRoomCode,
} from "./crypto";
import type {
  BrokerConnectionState,
  BrokerStatus,
  ReceivedTransportMessage,
  RoomCreated,
  RoomPeer,
  RoomTransportEventName,
  RoomTransportEvents,
  RoomTransportListener,
  RoomTransportProgress,
  RoomTransportState,
  RoomTransportStatus,
  SendOptions,
  SendReceipt,
  TransportError,
} from "./types";

interface BrokerDefinition {
  id: BrokerId;
  label: string;
  url: string;
}

const textEncoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function makeMqttClientId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(10));
  return `sn-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function normalizeNickname(value: string): string {
  const cleaned = Array.from(value.replace(/[\u0000-\u001f\u007f]/g, "").trim()).slice(0, 24).join("");
  return cleaned || "書房夥伴";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

async function encodePayload(payload: unknown): Promise<PayloadEncoding> {
  if (typeof payload === "string") return { kind: "string", data: payload };
  if (typeof Blob !== "undefined" && payload instanceof Blob) {
    return {
      kind: "blob",
      data: toBase64(new Uint8Array(await payload.arrayBuffer())),
      mimeType: payload.type,
    };
  }
  if (payload instanceof ArrayBuffer) return { kind: "array-buffer", data: toBase64(new Uint8Array(payload)) };
  if (ArrayBuffer.isView(payload)) {
    return {
      kind: "array-buffer",
      data: toBase64(new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)),
    };
  }
  try {
    const serialized = JSON.stringify(payload);
    if (typeof serialized !== "string") throw new Error("not serializable");
    return { kind: "json", data: JSON.parse(serialized) as unknown };
  } catch {
    throw new Error("訊息必須是字串、JSON、Blob 或 ArrayBuffer。");
  }
}

function decodePayload(value: unknown): unknown {
  if (!isRecord(value) || typeof value.kind !== "string") return null;
  if (value.kind === "string" && typeof value.data === "string") return value.data;
  if (value.kind === "json" && Object.prototype.hasOwnProperty.call(value, "data")) return value.data;
  if ((value.kind === "array-buffer" || value.kind === "blob") && typeof value.data === "string") {
    try {
      const bytes = fromBase64(value.data);
      const exactBytes = bytes.slice().buffer as ArrayBuffer;
      if (value.kind === "array-buffer") return exactBytes;
      if (typeof Blob === "undefined") return exactBytes;
      return new Blob([exactBytes], { type: typeof value.mimeType === "string" ? value.mimeType : "" });
    } catch {
      return null;
    }
  }
  return null;
}

function makePairingLink(code: string): string {
  if (typeof window === "undefined") return `#${code}`;
  // Use the URL fragment only; it is not included in HTTP requests or referrer headers.
  return `${window.location.origin}${window.location.pathname}#${code}`;
}

function safeErrorMessage(): string {
  return "無法連接中繼服務；請確認網路或稍後重試。";
}

export class SecureRoomTransport {
  private readonly listeners = new Map<RoomTransportEventName, Set<(event: never) => void>>();
  private readonly clients = new Map<BrokerId, MqttClient>();
  private readonly brokerStates = new Map<BrokerId, BrokerConnectionState>();
  private readonly peers = new Map<string, RoomPeer>();
  private readonly seenIds = new Map<string, number>();
  private key: CryptoKey | null = null;
  private topic: string | null = null;
  private deviceId = "";
  private nickname = "書房夥伴";
  private joinedAt = 0;
  private expiresAt: number | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private state: RoomTransportState = "idle";
  private roomReady = false;
  private helloTimer: ReturnType<typeof setInterval> | null = null;
  private peerSweepTimer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  on<K extends RoomTransportEventName>(event: K, listener: RoomTransportListener<K>): () => void {
    let listeners = this.listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(event, listeners);
    }
    listeners.add(listener as (event: never) => void);
    return () => listeners?.delete(listener as (event: never) => void);
  }

  getStatus(): RoomTransportStatus {
    const brokers = TRANSPORT_CONFIG.brokers.map((broker) => ({
      id: broker.id,
      label: broker.label,
      state: this.brokerStates.get(broker.id) ?? "offline",
    }));
    const connectedBrokerCount = brokers.filter((broker) => broker.state === "connected").length;
    return {
      state: this.state,
      encrypted: Boolean(this.key),
      roomReady: this.roomReady,
      expiresAt: this.expiresAt,
      connectedBrokerCount,
      brokerCount: brokers.length,
      brokers,
      peerCount: this.peers.size,
    };
  }

  getPeers(): RoomPeer[] {
    return Array.from(this.peers.values()).sort((left, right) => left.nickname.localeCompare(right.nickname));
  }

  async create(nickname: string, options: { expiresInMs?: number } = {}): Promise<RoomCreated> {
    const code = createRoomCode();
    const expiresInMs = options.expiresInMs;
    if (expiresInMs !== undefined && (!Number.isSafeInteger(expiresInMs) || expiresInMs <= 0)) {
      throw new Error("房間存活時間必須是大於 0 的有限數值。");
    }
    await this.openRoom(code, nickname, expiresInMs);
    return { code, link: makePairingLink(code), expiresAt: this.expiresAt };
  }

  async join(codeInput: string, nickname: string): Promise<void> {
    await this.openRoom(normalizeRoomCode(codeInput), nickname);
  }

  async leave(): Promise<void> {
    if (this.state === "idle" && this.clients.size === 0) return;
    this.state = "leaving";
    this.emitProgress({ stage: "leaving", completed: 0, total: 1, message: "正在離開加密房間…" });
    this.emitStatus();
    this.clearTimers();
    try {
      if (this.key && this.topic && this.deviceId) {
        await Promise.race([
          this.publishSystemMessage({ v: 1, id: createSecureId(), type: "leave", from: this.deviceId, sentAt: Date.now() }),
          new Promise<void>((resolve) => setTimeout(resolve, 500)),
        ]);
      }
    } catch {
      // Leave is best-effort; the peer heartbeat expires stale devices.
    }
    this.generation += 1;
    await this.closeClients();
    this.key = null;
    this.topic = null;
    this.deviceId = "";
    this.joinedAt = 0;
    this.expiresAt = null;
    this.roomReady = false;
    this.peers.clear();
    this.seenIds.clear();
    this.state = "idle";
    this.emitPeers();
    this.emitStatus();
  }

  async send(payload: unknown, options: SendOptions = {}): Promise<SendReceipt> {
    if (options.route === "direct") {
      throw new Error("直連傳送會在下一階段啟用；目前僅提供加密 relay。 ");
    }
    if (!this.key || !this.topic || !this.deviceId) throw new Error("尚未加入加密房間。");
    const activeBrokers = this.getConnectedClients();
    if (!activeBrokers.length) throw new Error("所有中繼 broker 目前都離線，訊息未送出。");

    const id = createSecureId();
    const encodedPayload = await encodePayload(payload);
    const wireMessage: RoomWireMessage = {
      v: 1,
      id,
      type: "app",
      from: this.deviceId,
      sentAt: Date.now(),
      nickname: this.nickname,
      ...(options.to ? { to: options.to } : {}),
      payload: encodedPayload,
    } as RoomWireMessage;
    const packet = await encryptRoomMessage(this.key, wireMessage);
    if (byteLength(packet) > TRANSPORT_CONFIG.relayMaxPacketBytes) {
      throw new Error("加密後的訊息超過中繼大小上限；請縮小內容或使用之後啟用的直連路由。");
    }

    const results = await Promise.all(activeBrokers.map(async ({ id: brokerId, client }) => {
      try {
        await this.publish(client, packet);
        return { brokerId, ok: true as const };
      } catch {
        return { brokerId, ok: false as const };
      }
    }));
    const acknowledgedByBrokers = results.filter((result) => result.ok).map((result) => result.brokerId);
    if (!acknowledgedByBrokers.length) throw new Error("中繼 broker 未確認訊息；訊息未送出。");
    return {
      id,
      route: "relay",
      publishedTo: activeBrokers.map((broker) => broker.id),
      acknowledgedByBrokers,
    };
  }

  private async openRoom(codeInput: string, nicknameInput: string, expiresInMs?: number): Promise<void> {
    if (typeof window === "undefined") throw new Error("加密房間只能在瀏覽器中使用。");
    const code = normalizeRoomCode(codeInput);
    if (this.state !== "idle" || this.clients.size) await this.leave();
    const generation = ++this.generation;
    this.state = "deriving-key";
    this.roomReady = false;
    this.nickname = normalizeNickname(nicknameInput);
    this.deviceId = createSecureId("device");
    this.joinedAt = Date.now();
    this.expiresAt = expiresInMs === undefined ? null : this.joinedAt + expiresInMs;
    this.peers.clear();
    this.seenIds.clear();
    this.brokerStates.clear();
    for (const broker of TRANSPORT_CONFIG.brokers) this.brokerStates.set(broker.id, "connecting");
    this.emitStatus();
    this.emitProgress({ stage: "key-derivation", completed: 0, total: 1, message: "正在導出房間加密金鑰…" });

    try {
      const [key, topicResult] = await Promise.all([deriveRoomKey(code), deriveRoomTopic(code)]);
      if (generation !== this.generation) throw new Error("房間流程已取消。");
      this.key = key;
      this.topic = topicResult.topic;
      this.state = "connecting";
      this.emitProgress({ stage: "broker-connect", completed: 0, total: TRANSPORT_CONFIG.brokers.length, message: "正在連接多個 WSS 中繼…" });
      this.emitStatus();

      let completed = 0;
      const results = await Promise.all(TRANSPORT_CONFIG.brokers.map(async (broker) => {
        const connected = await this.connectBroker(broker, topicResult.topic, generation);
        completed += 1;
        this.emitProgress({
          stage: "subscription",
          completed,
          total: TRANSPORT_CONFIG.brokers.length,
          message: connected ? `已連接並訂閱 ${broker.label}` : `${broker.label} 暫時無法連接`,
        });
        return connected;
      }));
      if (generation !== this.generation) throw new Error("房間流程已取消。");
      if (!results.some(Boolean) || this.getConnectedClients().length === 0) {
        this.emitError({ code: "BROKERS_OFFLINE", message: safeErrorMessage() });
        await this.closeClients();
        this.key = null;
        this.topic = null;
        this.deviceId = "";
        this.state = "failed";
        this.roomReady = false;
        this.emitStatus();
        throw new Error(safeErrorMessage());
      }

      this.roomReady = true;
      this.state = this.getConnectedClients().length === TRANSPORT_CONFIG.brokers.length ? "connected" : "partial";
      this.scheduleRoomExpiry();
      this.helloTimer = setInterval(() => {
        void this.publishSystemMessage(this.createHelloMessage());
      }, TRANSPORT_CONFIG.helloIntervalMs);
      this.peerSweepTimer = setInterval(() => this.expirePeers(), TRANSPORT_CONFIG.peerSweepIntervalMs);
      this.emitStatus();
      await this.publishSystemMessage(this.createHelloMessage());
      this.emitProgress({ stage: "hello", completed: 1, total: 1, message: "加密 hello 已送出，正在探索房間裝置…" });
      this.emitProgress({ stage: "ready", completed: 1, total: 1, message: "加密房間已就緒。" });
      this.emitStatus();
      return;
    } catch (error) {
      if (generation === this.generation) {
        this.clearTimers();
        await this.closeClients();
        this.key = null;
        this.topic = null;
        this.deviceId = "";
        this.joinedAt = 0;
        this.expiresAt = null;
        this.roomReady = false;
        this.peers.clear();
        this.seenIds.clear();
        this.state = "failed";
        this.emitPeers();
        this.emitStatus();
      }
      throw error instanceof Error ? error : new Error("無法建立加密房間。");
    }
  }

  private connectBroker(broker: BrokerDefinition, topic: string, generation: number): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false;
      let subscribed = false;
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(success);
      };
      const timeout = setTimeout(() => {
        this.setBrokerState(broker.id, "offline");
        const client = this.clients.get(broker.id);
        if (client) client.end(true);
        finish(false);
      }, TRANSPORT_CONFIG.mqttConnectTimeoutMs);
      this.setBrokerState(broker.id, "connecting");

      let client: MqttClient;
      try {
        client = mqtt.connect(broker.url, {
          clientId: makeMqttClientId(),
          clean: true,
          keepalive: 30,
          connectTimeout: TRANSPORT_CONFIG.mqttConnectTimeoutMs,
          reconnectPeriod: 0,
          resubscribe: false,
          protocolVersion: 4,
        });
      } catch {
        this.setBrokerState(broker.id, "offline");
        finish(false);
        return;
      }
      this.clients.set(broker.id, client);
      client.on("connect", () => {
        if (generation !== this.generation || client !== this.clients.get(broker.id) || subscribed) return;
        subscribed = true;
        client.subscribe(topic, { qos: 1 }, (error) => {
          if (generation !== this.generation || client !== this.clients.get(broker.id)) {
            finish(false);
            return;
          }
          if (error) {
            this.setBrokerState(broker.id, "offline");
            client.end(true);
            finish(false);
            return;
          }
          this.setBrokerState(broker.id, "connected");
          finish(true);
        });
      });
      client.on("message", (receivedTopic, packet, mqttPacket) => {
        if (receivedTopic !== topic || generation !== this.generation || mqttPacket.retain) return;
        void this.receivePacket(packet.toString());
      });
      client.on("close", () => {
        if (client !== this.clients.get(broker.id)) {
          finish(false);
          return;
        }
        this.setBrokerState(broker.id, "offline");
        if (!settled) finish(false);
      });
      client.on("error", () => {
        if (client !== this.clients.get(broker.id)) {
          finish(false);
          return;
        }
        this.setBrokerState(broker.id, "offline");
        if (!settled) finish(false);
      });
    });
  }

  private async receivePacket(packet: string): Promise<void> {
    const key = this.key;
    if (!key) return;
    const decrypted = await decryptRoomMessage(key, packet);
    if (!isRoomWireMessage(decrypted)) return;
    if (decrypted.from === this.deviceId || this.wasSeen(decrypted.id)) return;
    this.markSeen(decrypted.id);

    if (decrypted.type === "hello" || decrypted.type === "heartbeat") {
      if (decrypted.expiresAt !== null) {
        if (decrypted.expiresAt <= Date.now()) {
          this.expireRoom();
          return;
        }
        this.expiresAt = this.expiresAt === null ? decrypted.expiresAt : Math.min(this.expiresAt, decrypted.expiresAt);
        this.scheduleRoomExpiry();
      }
      const isNewPeer = !this.peers.has(decrypted.from);
      this.peers.set(decrypted.from, {
        deviceId: decrypted.from,
        nickname: normalizeNickname(decrypted.nickname),
        joinedAt: Number.isFinite(decrypted.joinedAt) ? decrypted.joinedAt : decrypted.sentAt,
        lastSeenAt: Date.now(),
      });
      this.emitPeers();
      this.emitStatus();
      if (isNewPeer) void this.publishSystemMessage(this.createHelloMessage());
      return;
    }
    if (decrypted.type === "leave") {
      if (this.peers.delete(decrypted.from)) {
        this.emitPeers();
        this.emitStatus();
      }
      return;
    }
    if (decrypted.type === "app") {
      if (decrypted.to && decrypted.to !== this.deviceId) return;
      const knownPeer = this.peers.get(decrypted.from);
      this.peers.set(decrypted.from, {
        deviceId: decrypted.from,
        nickname: typeof decrypted.nickname === "string"
          ? normalizeNickname(decrypted.nickname)
          : knownPeer?.nickname ?? "書房夥伴",
        joinedAt: knownPeer?.joinedAt ?? decrypted.sentAt,
        lastSeenAt: Date.now(),
      });
      this.emitPeers();
      this.emitStatus();
      const event: ReceivedTransportMessage = {
        payload: decodePayload(decrypted.payload),
        metadata: {
          id: decrypted.id,
          from: decrypted.from,
          sentAt: decrypted.sentAt,
          route: "relay",
          encrypted: true,
        },
      };
      this.emit("message", event);
    }
  }

  private createHelloMessage(): RoomWireMessage {
    return {
      v: 1,
      id: createSecureId(),
      type: "hello",
      from: this.deviceId,
      sentAt: Date.now(),
      nickname: this.nickname,
      joinedAt: this.joinedAt,
      expiresAt: this.expiresAt,
    };
  }

  private scheduleRoomExpiry(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    if (this.expiresAt === null) return;
    const remaining = this.expiresAt - Date.now();
    if (remaining <= 0) {
      this.expireRoom();
      return;
    }
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.scheduleRoomExpiry();
    }, Math.min(remaining, 2_147_000_000));
  }

  private expireRoom(): void {
    this.emitError({ code: "ROOM_EXPIRED", message: "房間已到期；本機已清除房間金鑰。" });
    void this.leave();
  }

  private async publishSystemMessage(message: RoomWireMessage): Promise<void> {
    if (!this.key || !this.topic) return;
    const activeBrokers = this.getConnectedClients();
    if (!activeBrokers.length) return;
    const packet = await encryptRoomMessage(this.key, message);
    await Promise.all(activeBrokers.map(({ client }) => this.publish(client, packet).catch(() => undefined)));
  }

  private publish(client: MqttClient, packet: string): Promise<void> {
    const topic = this.topic;
    if (!topic || !client.connected) return Promise.reject(new Error("broker offline"));
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("MQTT publish timeout")), TRANSPORT_CONFIG.mqttPublishTimeoutMs);
      client.publish(topic, packet, { qos: 1, retain: false }, (error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      });
    });
  }

  private getConnectedClients(): Array<{ id: BrokerId; client: MqttClient }> {
    return TRANSPORT_CONFIG.brokers.flatMap((broker) => {
      const client = this.clients.get(broker.id);
      return client?.connected ? [{ id: broker.id, client }] : [];
    });
  }

  private setBrokerState(id: BrokerId, state: BrokerConnectionState): void {
    this.brokerStates.set(id, state);
    const connectedCount = Array.from(this.brokerStates.values()).filter((value) => value === "connected").length;
    if (this.roomReady) {
      this.state = connectedCount === 0 ? "offline" : connectedCount === TRANSPORT_CONFIG.brokers.length ? "connected" : "partial";
    }
    this.emitStatus();
  }

  private expirePeers(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeenAt > TRANSPORT_CONFIG.peerExpiryMs) {
        this.peers.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.emitPeers();
      this.emitStatus();
    }
    for (const [id, seenAt] of this.seenIds) {
      if (now - seenAt > TRANSPORT_CONFIG.deduplicationTtlMs) this.seenIds.delete(id);
    }
  }

  private wasSeen(id: string): boolean {
    const seenAt = this.seenIds.get(id);
    if (seenAt === undefined) return false;
    if (Date.now() - seenAt > TRANSPORT_CONFIG.deduplicationTtlMs) {
      this.seenIds.delete(id);
      return false;
    }
    return true;
  }

  private markSeen(id: string): void {
    const now = Date.now();
    this.seenIds.set(id, now);
    while (this.seenIds.size > TRANSPORT_CONFIG.deduplicationMaxEntries) {
      const oldest = this.seenIds.keys().next().value as string | undefined;
      if (!oldest) break;
      this.seenIds.delete(oldest);
    }
  }

  private clearTimers(): void {
    if (this.helloTimer) clearInterval(this.helloTimer);
    if (this.peerSweepTimer) clearInterval(this.peerSweepTimer);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.helloTimer = null;
    this.peerSweepTimer = null;
    this.expiryTimer = null;
  }

  private async closeClients(): Promise<void> {
    const clients = Array.from(this.clients.values());
    this.clients.clear();
    this.brokerStates.clear();
    await Promise.all(clients.map((client) => new Promise<void>((resolve) => {
      try {
        client.end(true, {}, () => resolve());
        setTimeout(resolve, 250);
      } catch {
        resolve();
      }
    })));
  }

  private emitStatus(): void {
    this.emit("status", this.getStatus());
  }

  private emitPeers(): void {
    this.emit("peers", this.getPeers());
  }

  private emitProgress(progress: RoomTransportProgress): void {
    this.emit("progress", progress);
  }

  private emitError(error: TransportError): void {
    this.emit("error", error);
  }

  private emit<K extends RoomTransportEventName>(event: K, payload: RoomTransportEvents[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(payload as never);
      } catch {
        // Subscriber errors must not interrupt transport delivery.
      }
    }
  }
}
