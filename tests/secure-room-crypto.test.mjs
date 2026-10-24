import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "scinotes-room-crypto-"));
const compileModule = async (sourcePath, outputName, replacements = []) => {
  let source = await readFile(new URL(sourcePath, import.meta.url), "utf8");
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const outputPath = join(temporaryDirectory, outputName);
  await writeFile(outputPath, compiled, "utf8");
  return import(pathToFileURL(outputPath).href);
};

const transportConfig = await compileModule("../src/lib/secureRoomTransport/config.ts", "config.mjs");
const protocol = await compileModule("../src/lib/secureRoomTransport/protocol.ts", "protocol.mjs");
const crypto = await compileModule(
  "../src/lib/secureRoomTransport/crypto.ts",
  "crypto.mjs",
  [["./config", "./config.mjs"]]
);
const publishAcknowledgements = await compileModule(
  "../src/lib/secureRoomTransport/publishAcknowledgements.ts",
  "publishAcknowledgements.mjs"
);

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

test("generates 16-character room codes and normalizes pasted separators", () => {
  const code = crypto.createRoomCode();
  assert.equal(code.length, 16);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/);
  assert.equal(crypto.normalizeRoomCode(`${code.slice(0, 4)} ${code.slice(4, 8)}-${code.slice(8)}`), code);
  assert.throws(() => crypto.normalizeRoomCode("not-a-room-code"), /配對碼格式不正確/);
});

test("derives a SHA-256 room topic without placing the pairing code in the topic", async () => {
  const code = "ABCDEFGHJKLMNPQR";
  const first = await crypto.deriveRoomTopic(code);
  const second = await crypto.deriveRoomTopic(code.toLowerCase());
  assert.equal(first.topic, second.topic);
  assert.equal(first.hash.length, 64);
  assert.ok(first.topic.endsWith(first.hash));
  assert.ok(!first.topic.includes(code));
});

test("AES-GCM packets conceal plaintext, use fresh IVs, and reject a wrong key", async () => {
  const code = "ABCDEFGHJKLMNPQR";
  const key = await crypto.deriveRoomKey(code);
  const wrongKey = await crypto.deriveRoomKey("BCDEFGHJKLMNPQRS");
  const message = { v: 1, type: "hello", nickname: "測試使用者", id: "msg-123" };
  const packet = await crypto.encryptRoomMessage(key, message);
  const secondPacket = await crypto.encryptRoomMessage(key, message);
  assert.ok(!packet.includes("測試使用者"));
  assert.ok(!packet.includes(code));
  assert.notEqual(packet, secondPacket);
  assert.deepEqual(await crypto.decryptRoomMessage(key, packet), message);
  assert.equal(await crypto.decryptRoomMessage(wrongKey, packet), null);
});

test("accepts Unicode peer nicknames up to 24 code points and legacy relay messages", () => {
  const base = { v: 1, id: "msg-1", from: "device-1", sentAt: 100 };
  const hello = {
    ...base,
    type: "hello",
    nickname: "😀".repeat(24),
    joinedAt: 100,
    expiresAt: null,
  };
  assert.equal(protocol.isRoomWireMessage(hello), true);
  assert.equal(protocol.isRoomWireMessage({ ...hello, nickname: "😀".repeat(25) }), false);

  const legacyAppMessage = { ...base, type: "app", payload: { kind: "string", data: "hello" } };
  assert.equal(protocol.isRoomWireMessage(legacyAppMessage), true);
  assert.equal(protocol.isRoomWireMessage({ ...legacyAppMessage, nickname: "😀".repeat(24) }), true);
  assert.equal(protocol.isRoomWireMessage({ ...legacyAppMessage, nickname: "😀".repeat(25) }), false);
});

test("repeats peer discovery hello every three seconds and expires peers after ten seconds", () => {
  assert.equal(transportConfig.TRANSPORT_CONFIG.helloIntervalMs, 3_000);
  assert.equal(transportConfig.TRANSPORT_CONFIG.peerExpiryMs, 10_000);
  assert.equal(transportConfig.TRANSPORT_CONFIG.peerSweepIntervalMs, 1_000);
});

test("latency-sensitive relay sends can proceed after the first broker PUBACK", async () => {
  let resolveSlowBroker;
  const slowBroker = new Promise((resolve) => { resolveSlowBroker = resolve; });
  const firstAck = await publishAcknowledgements.waitForPublishAcknowledgements([
    Promise.resolve("emqx"),
    slowBroker,
  ], "first");
  assert.deepEqual(firstAck, ["emqx"]);
  resolveSlowBroker("hivemq");
});

test("default relay sends still wait for every broker PUBACK", async () => {
  let resolveFirstBroker;
  let resolveSecondBroker;
  let settled = false;
  const allAcks = publishAcknowledgements.waitForPublishAcknowledgements([
    new Promise((resolve) => { resolveFirstBroker = resolve; }),
    new Promise((resolve) => { resolveSecondBroker = resolve; }),
  ]).then((result) => {
    settled = true;
    return result;
  });

  resolveFirstBroker("emqx");
  await Promise.resolve();
  assert.equal(settled, false);
  resolveSecondBroker("hivemq");
  assert.deepEqual(await allAcks, ["emqx", "hivemq"]);
});
