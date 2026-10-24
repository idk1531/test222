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

await compileModule("../src/lib/secureRoomTransport/config.ts", "config.mjs");
const crypto = await compileModule(
  "../src/lib/secureRoomTransport/crypto.ts",
  "crypto.mjs",
  [["./config", "./config.mjs"]]
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
