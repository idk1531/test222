import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "scinotes-collab-protocol-test-"));
const modulePath = join(temporaryDirectory, "collaborationProtocol.mjs");
const source = await readFile(new URL("../src/lib/collaborationProtocol.ts", import.meta.url), "utf8");
const dimensionsSource = await readFile(new URL("../src/lib/roomDimensions.ts", import.meta.url), "utf8");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const dimensionsModulePath = join(temporaryDirectory, "roomDimensions.mjs");
const dimensionsCompiled = ts.transpileModule(dimensionsSource, { compilerOptions }).outputText;
await writeFile(dimensionsModulePath, dimensionsCompiled, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions }).outputText
  .replaceAll('"./roomDimensions"', '"./roomDimensions.mjs"');
await writeFile(modulePath, compiled, "utf8");
const protocol = await import(pathToFileURL(modulePath).href);
const { ROOM_DIMENSIONS, ROOM_EDGE_MARGIN } = await import(pathToFileURL(dimensionsModulePath).href);

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const validPose = {
  x: 1.25,
  z: -2,
  eyeY: 1.5,
  floorY: 8,
  jumpOffset: 0.3,
  yaw: 0.7,
  pitch: -0.2,
  moving: true,
  sprinting: true,
  onGround: false,
  seated: false,
  visible: true,
  holding: true,
};

test("display names are normalized, bounded, and never treated as verified identity", () => {
  assert.equal(protocol.normalizeDisplayName("  小安\n  "), "小安");
  assert.equal(protocol.sanitizeDisplayNameInput("Alice "), "Alice ");
  assert.equal(protocol.normalizeDisplayName(""), "書房夥伴");
  assert.equal(Array.from(protocol.normalizeDisplayName("名".repeat(40))).length, 24);
});

test("versioned hello and role messages validate their roles and preserve only allowed fields", () => {
  const hello = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "hello",
    participantId: "peer-a",
    name: "  Alice\n",
    role: "owner",
    guestRole: "reader",
    extra: "ignored",
  }));
  assert.deepEqual(hello, {
    v: 1,
    type: "hello",
    participantId: "peer-a",
    name: "Alice",
    role: "owner",
    guestRole: "reader",
  });

  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "role",
    participantId: "peer-a",
    role: "admin",
  })), null);
  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({
    v: 2,
    type: "hello",
    participantId: "peer-a",
    name: "Alice",
    role: "owner",
  })), null);
});

test("repeated hello is idempotent and a visible pose is accepted only after its participant is known", () => {
  const joinerHello = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "hello",
    participantId: "peer-joiner",
    name: "Guest",
    role: "pending",
  }));
  const first = protocol.resolveRemoteHello("initiator", "editor", null, joinerHello);
  assert.deepEqual(first, {
    participant: { id: "peer-joiner", name: "Guest", role: "editor" },
    isNewParticipant: true,
    didChange: true,
  });

  const duplicate = protocol.resolveRemoteHello("initiator", "editor", first.participant, joinerHello);
  assert.equal(duplicate.isNewParticipant, false, "a duplicate hello must not start another snapshot transfer");
  assert.equal(duplicate.didChange, false, "identical hello must not replace participant state or restart effects");
  assert.equal(protocol.resolveRemoteHello("initiator", "editor", null, {
    ...joinerHello,
    role: "owner",
  }), null);

  const visiblePose = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "pose",
    participantId: "peer-joiner",
    pose: { ...validPose, visible: true },
  }));
  assert.equal(protocol.getRemotePoseForParticipant(visiblePose, null), null, "poses before hello are ignored");
  assert.equal(protocol.getRemotePoseForParticipant(visiblePose, "another-peer"), null);
  assert.equal(protocol.getRemotePoseForParticipant(visiblePose, first.participant.id).visible, true);

  const ownerHello = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "hello",
    participantId: "peer-owner",
    name: "Owner",
    role: "owner",
    guestRole: "reader",
  }));
  const joinerView = protocol.resolveRemoteHello("joiner", "editor", null, ownerHello);
  assert.deepEqual(joinerView.participant, { id: "peer-owner", name: "Owner", role: "owner" });
});

test("pose messages validate finite coordinates and clamp untrusted positions", () => {
  const parsed = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "pose",
    participantId: "peer-b",
    pose: { ...validPose, x: 500, z: -500, jumpOffset: 9 },
  }));
  assert.equal(parsed.type, "pose");
  assert.equal(parsed.pose.x, ROOM_DIMENSIONS.width / 2 - ROOM_EDGE_MARGIN);
  assert.equal(parsed.pose.z, -ROOM_DIMENSIONS.depth / 2 + ROOM_EDGE_MARGIN);
  assert.equal(parsed.pose.floorY, 8);
  assert.equal(parsed.pose.jumpOffset, 3);
  assert.equal(parsed.pose.holding, true);
  assert.equal(parsed.pose.sprinting, true);
  const legacyPose = { ...validPose };
  delete legacyPose.sprinting;
  delete legacyPose.floorY;
  const legacyParsed = protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "pose",
    participantId: "peer-old",
    pose: legacyPose,
  }));
  assert.equal(legacyParsed.pose.sprinting, false);
  assert.equal(legacyParsed.pose.floorY, 0);
  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "pose",
    participantId: "peer-b",
    pose: { ...validPose, sprinting: "fast" },
  })), null);

  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "pose",
    participantId: "peer-b",
    pose: { ...validPose, yaw: null },
  })), null);
});

test("malformed, oversized, and unknown messages are rejected", () => {
  assert.equal(protocol.parseCollaborationMessage(undefined), null);
  assert.equal(protocol.parseCollaborationMessage("not-json"), null);
  assert.equal(protocol.parseCollaborationMessage(" ".repeat(protocol.MAX_COLLABORATION_MESSAGE_LENGTH + 1)), null);
  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({ v: 1, type: "workspace", state: {} })), null);
  assert.equal(protocol.parseCollaborationMessage(JSON.stringify({
    v: 1,
    type: "hello",
    participantId: "",
    name: "Alice",
    role: "owner",
  })), null);
});

test("serialized room messages contain no signaling description", () => {
  const message = {
    v: 1,
    type: "hello",
    participantId: "peer-a",
    name: "Alice",
    role: "owner",
    guestRole: "editor",
  };
  const text = protocol.serializeCollaborationMessage(message);
  assert.deepEqual(JSON.parse(text), message);
  assert.doesNotMatch(text, /candidate:|a=max-message-size|sdp/i);
});
