import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "scinotes-collaboration-editing-test-"));
const modulePath = join(temporaryDirectory, "collaborationEditing.mjs");
const source = await readFile(new URL("../src/lib/collaborationEditing.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
await writeFile(modulePath, compiled, "utf8");
const editing = await import(pathToFileURL(modulePath).href);

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

function createEngine(actorId, baseline, outbound = [], updates = []) {
  return new editing.CollaborativeTextEngine({
    actorId,
    getBaseline: () => baseline,
    send: (message) => {
      outbound.push(message);
      return true;
    },
    onUpdate: (update) => updates.push(update),
  });
}

test("collects editable text leaves with stable array identity and excludes metadata/enums", () => {
  const before = {
    id: "card-a",
    title: "Old title",
    reasoningShape: "A",
    cardTags: ["[有分支]"],
    thoughtPoints: [{ id: "tp-a", question: "Old question", passed: false }],
  };
  const afterValue = {
    ...before,
    title: "New title",
    reasoningShape: "B",
    cardTags: ["[連續鏈]"],
    thoughtPoints: [{ id: "tp-a", question: "New question", passed: true }],
  };

  assert.deepEqual(editing.collectCollaborativeTextChanges(before, afterValue), [
    { path: "/title", previousValue: "Old title", value: "New title" },
    { path: "/thoughtPoints/@tp-a/question", previousValue: "Old question", value: "New question" },
  ]);
  assert.deepEqual(editing.stripCollaborativeTextFields(before), editing.stripCollaborativeTextFields({
    ...before,
    title: "Different title",
    thoughtPoints: [{ id: "tp-a", question: "Different question", passed: false }],
  }));
  assert.notDeepEqual(editing.stripCollaborativeTextFields(before), editing.stripCollaborativeTextFields(afterValue));
});

test("stable text paths survive list reorder and safely create optional object branches", () => {
  const card = {
    id: "card-a",
    whatData: { readings: [{ id: "read-a", name: "第一讀法" }, { id: "read-b", name: "第二讀法" }] },
  };
  const path = "/whatData/readings/@read-a/name";
  assert.equal(editing.getCollaborativeTextAtPath(card, path), "第一讀法");
  assert.equal(editing.hasCollaborativeTextPathStructure(card, path), true);
  assert.equal(editing.hasCollaborativeTextPathStructure(card, "/whatData/readings/@missing/name"), false);
  const reordered = { ...card, whatData: { readings: [...card.whatData.readings].reverse() } };
  const updated = editing.setCollaborativeTextAtPath(reordered, path, "已即時合併");
  assert.equal(editing.getCollaborativeTextAtPath(updated, path), "已即時合併");

  const optional = editing.setCollaborativeTextAtPath({ id: "card-b" }, "/candidate/requirement", "從要求開始");
  assert.equal(optional.candidate.requirement, "從要求開始");
});

test("concurrent insertions at the same position converge without losing either edit", () => {
  const hostMessages = [];
  const guestMessages = [];
  const host = createEngine("peer-a", "ab", hostMessages);
  const guest = createEngine("peer-b", "ab", guestMessages);
  const cardId = "card-a";
  const path = "/title";

  host.applyLocalChange(cardId, path, "ab", "aXb");
  guest.applyLocalChange(cardId, path, "ab", "aYb");
  assert.equal(hostMessages.length, 1);
  assert.equal(guestMessages.length, 1);
  assert.ok(host.receive(guestMessages[0], "peer-b"));
  assert.ok(guest.receive(hostMessages[0], "peer-a"));

  const hostText = host.getSnapshot(cardId)[0].value;
  const guestText = guest.getSnapshot(cardId)[0].value;
  assert.equal(hostText, guestText);
  assert.equal(hostText.length, 4);
  assert.ok(hostText.includes("X"));
  assert.ok(hostText.includes("Y"));
  assert.ok(hostText.startsWith("a") && hostText.endsWith("b"));
  const hostCursorAnchor = host.getCursorAnchor(cardId, path, 2);
  assert.equal(guest.resolveCursorPosition(cardId, path, hostCursorAnchor, 0), 2);
  host.stop();
  guest.stop();
});

test("concurrent insertion and deletion merge at character granularity", () => {
  const hostMessages = [];
  const guestMessages = [];
  const hostUpdates = [];
  const guestUpdates = [];
  const host = createEngine("peer-a", "abc", hostMessages, hostUpdates);
  const guest = createEngine("peer-b", "abc", guestMessages, guestUpdates);

  host.applyLocalChange("card-a", "/title", "abc", "aXbc");
  guest.applyLocalChange("card-a", "/title", "abc", "ac");
  host.receive(guestMessages[0], "peer-b");
  guest.receive(hostMessages[0], "peer-a");
  assert.equal(host.getSnapshot("card-a")[0].value, "aXc");
  assert.equal(guest.getSnapshot("card-a")[0].value, "aXc");
  assert.equal(hostUpdates.at(-1).value, "aXc");
  assert.equal(guestUpdates.at(-1).value, "aXc");
  host.stop();
  guest.stop();
});

test("Unicode insertions and code-point cursor offsets are preserved", () => {
  const messages = [];
  const host = createEngine("peer-a", "A🧠B", messages);
  host.applyLocalChange("card-a", "/title", "A🧠B", "A✍️🧠B");
  assert.equal(host.getSnapshot("card-a")[0].value, "A✍️🧠B");
  assert.equal(editing.toCodePointOffset("A🧠B", 3), 2);
  assert.equal(editing.humanizeCollaborativeTextPath("/whatData/readings/@read-a/description"), "描述");
  host.stop();
});

test("editing message parser rejects forged actor atom IDs and non-text paths", () => {
  const valid = editing.makeTextOperationsMessage("peer-a", "card-a", "/title", "A", [{
    kind: "insert",
    id: "text:peer-a:1",
    after: null,
    value: "B",
    counter: 1,
  }]);
  assert.ok(valid);
  assert.deepEqual(editing.parseCollaborativeEditingMessage(JSON.stringify(valid)), valid);
  assert.equal(editing.parseCollaborativeEditingMessage(JSON.stringify({
    ...valid,
    operations: [{ ...valid.operations[0], id: "text:peer-b:1" }],
  })), null);
  assert.equal(editing.makeTextOperationsMessage("peer-a", "card-a", "/workspaceId", "", valid.operations), null);
  assert.equal(editing.parseCollaborativeEditingMessage("x".repeat(5_000_001)), null);
});

test("editing presence validates field paths, cursor bounds, anchor identity, and typing state", () => {
  const presence = {
    v: 1,
    type: "editing-presence",
    actorId: "peer-a",
    cardId: "card-a",
    path: "/whatData/summary",
    position: 4,
    selectionEnd: 7,
    anchorId: "text:peer-a:3",
    typing: true,
    active: true,
  };
  assert.deepEqual(editing.parseCollaborativeEditingMessage(JSON.stringify(presence)), presence);
  assert.equal(editing.parseCollaborativeEditingMessage(JSON.stringify({ ...presence, path: "/workspaceId" })), null);
  assert.equal(editing.parseCollaborativeEditingMessage(JSON.stringify({ ...presence, position: -1 })), null);
  assert.equal(editing.parseCollaborativeEditingMessage(JSON.stringify({ ...presence, typing: "yes" })), null);
});

test("long initial text uses bounded chunks which reassemble out of order", () => {
  const message = editing.makeTextOperationsMessage("peer-a", "card-a", "/title", "字".repeat(15_000), [{
    kind: "insert",
    id: "text:peer-a:1",
    after: null,
    value: "新",
    counter: 1,
  }]);
  assert.ok(message);
  const frames = editing.serializeCollaborativeEditingMessage(message);
  assert.ok(frames.length > 1);
  assert.ok(frames.every((frame) => frame.length <= 8_192));
  const assembler = new editing.CollaborativeEditingChunkAssembler();
  let reassembled;
  for (const frame of frames.slice().reverse()) {
    const result = assembler.accept(frame);
    if (result.message) reassembled = result.message;
  }
  assert.deepEqual(editing.parseCollaborativeEditingMessage(reassembled), message);
});
