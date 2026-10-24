import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, TRANSPORT_CONFIG } from "./config";

const encoder = new TextEncoder();

function requireWebCrypto(): Crypto {
  if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
    throw new Error("此瀏覽器不支援安全加密；請使用 HTTPS 或 localhost。");
  }
  return globalThis.crypto;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export function normalizeRoomCode(input: string): string {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== ROOM_CODE_LENGTH || Array.from(code).some((character) => !ROOM_CODE_ALPHABET.includes(character))) {
    throw new Error("配對碼格式不正確；請輸入 16 個英數字元。");
  }
  return code;
}

export function createRoomCode(): string {
  const cryptoApi = requireWebCrypto();
  const random = cryptoApi.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  // The alphabet has exactly 32 symbols, so taking the low five bits is unbiased.
  return Array.from(random, (byte) => ROOM_CODE_ALPHABET[byte & 31]).join("");
}

export function createSecureId(prefix = "msg"): string {
  const random = requireWebCrypto().getRandomValues(new Uint8Array(16));
  return `${prefix}_${bytesToBase64Url(random)}`;
}

export async function deriveRoomKey(codeInput: string): Promise<CryptoKey> {
  const code = normalizeRoomCode(codeInput);
  const cryptoApi = requireWebCrypto();
  const baseKey = await cryptoApi.subtle.importKey(
    "raw",
    encoder.encode(code),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return cryptoApi.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(TRANSPORT_CONFIG.pbkdf2Salt),
      iterations: TRANSPORT_CONFIG.pbkdf2Iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function deriveRoomTopic(codeInput: string): Promise<{ topic: string; hash: string }> {
  const code = normalizeRoomCode(codeInput);
  const digest = await requireWebCrypto().subtle.digest("SHA-256", encoder.encode(code));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { topic: `${TRANSPORT_CONFIG.topicPrefix}/${hash}`, hash };
}

export async function encryptRoomMessage(key: CryptoKey, plaintext: unknown): Promise<string> {
  const cryptoApi = requireWebCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const serialized = JSON.stringify(plaintext);
  if (typeof serialized !== "string") throw new Error("訊息內容無法序列化。");
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(serialized)
  );
  return JSON.stringify({
    v: 1,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  });
}

export async function decryptRoomMessage(key: CryptoKey, packet: string): Promise<unknown | null> {
  if (packet.length > TRANSPORT_CONFIG.relayMaxPacketBytes) return null;
  let envelope: unknown;
  try {
    envelope = JSON.parse(packet);
  } catch {
    return null;
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return null;
  const candidate = envelope as Record<string, unknown>;
  if (candidate.v !== 1 || typeof candidate.iv !== "string" || typeof candidate.ciphertext !== "string") return null;

  try {
    const iv = base64UrlToBytes(candidate.iv);
    if (iv.byteLength !== 12) return null;
    const ciphertext = base64UrlToBytes(candidate.ciphertext);
    const plaintext = await requireWebCrypto().subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext)
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as unknown;
  } catch {
    // Invalid ciphertext, IV, or authentication tag is silently discarded.
    return null;
  }
}

