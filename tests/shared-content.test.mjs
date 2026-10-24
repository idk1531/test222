import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "scinotes-shared-content-test-"));
const modulePath = join(temporaryDirectory, "sharedContent.mjs");
const source = await readFile(new URL("../src/lib/sharedContent.ts", import.meta.url), "utf8");
const editingSource = await readFile(new URL("../src/lib/collaborationEditing.ts", import.meta.url), "utf8");
const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
};
const compiledEditing = ts.transpileModule(editingSource, { compilerOptions }).outputText;
const compiled = ts.transpileModule(source, { compilerOptions }).outputText
  .replaceAll('"./collaborationEditing"', '"./collaborationEditing.mjs"');
await writeFile(join(temporaryDirectory, "collaborationEditing.mjs"), compiledEditing, "utf8");
await writeFile(modulePath, compiled, "utf8");
const shared = await import(pathToFileURL(modulePath).href);

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

function makeCard(id, title, workspaceId = "local-workspace") {
  return { id, title, workspaceId, updatedAt: "2026-10-23T00:00:00.000Z" };
}

function makeState(cardId, title, extra = {}) {
  return {
    workspace: { id: extra.workspaceId ?? "local-workspace", name: "Local workspace" },
    cards: [makeCard(cardId, title, extra.workspaceId)],
    canvasObjects: [{
      id: `node-${cardId}`,
      cardId,
      workspaceId: extra.workspaceId ?? "local-workspace",
      type: "card_node",
      x: extra.x ?? 10,
      y: 20,
      updatedAt: "2026-10-23T00:00:00.000Z",
    }, {
      id: "unrelated-math",
      cardId,
      type: "math",
      x: 500,
      y: 500,
    }],
    studyCategories: [{ id: "cat-uncategorized", name: "未分類", order: 0, color: "#888888" }],
    studyBooks: [{ cardId, categoryId: null, orderInShelf: 0, place: "shelf", updatedAt: "2026-10-23T00:00:00.000Z" }],
    relations: [{ id: `rel-${cardId}`, fromCardId: cardId, toCardId: "another-card" }],
    processLogs: [{ id: `log-${cardId}`, title: "local-only" }],
  };
}

class MemoryStore {
  constructor(state) {
    this.state = state;
    this.listeners = new Set();
  }

  getState = () => this.state;

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  mutate(recipe) {
    this.state = recipe(this.state);
    for (const listener of this.listeners) listener();
  }

  apply = (operations) => {
    this.mutate((state) => shared.applySharedContentOperationsToState(state, operations));
  };
}

function createPair({ hostState, guestState, guestRole = "editor", hostRemoteActorId = "peer-b" }) {
  const hostStore = new MemoryStore(hostState);
  const guestStore = new MemoryStore(guestState);
  const queue = [];
  let currentHostRemoteActorId = hostRemoteActorId;
  const hostAssembler = new shared.SharedContentChunkAssembler();
  const guestAssembler = new shared.SharedContentChunkAssembler();
  let host;
  let guest;

  const enqueue = (target, message) => {
    const frames = shared.serializeSharedContentMessage(message);
    if (!frames) return false;
    for (const raw of frames) queue.push({ target, raw });
    return true;
  };

  host = new shared.SharedContentReplicator({
    actorId: "peer-a",
    getState: hostStore.getState,
    subscribe: hostStore.subscribe,
    applyOperations: hostStore.apply,
    send: (message) => enqueue("guest", message),
    getLocalRole: () => "owner",
    getRemoteRole: () => guestRole,
    getRemoteActorId: () => currentHostRemoteActorId,
  });
  guest = new shared.SharedContentReplicator({
    actorId: "peer-b",
    getState: guestStore.getState,
    subscribe: guestStore.subscribe,
    applyOperations: guestStore.apply,
    send: (message) => enqueue("host", message),
    getLocalRole: () => guestRole,
    getRemoteRole: () => "owner",
    getRemoteActorId: () => "peer-a",
  });

  const drain = () => {
    let count = 0;
    while (queue.length) {
      assert.ok(count < 20_000, "message queue should settle");
      count += 1;
      const next = queue.shift();
      const target = next.target === "host" ? host : guest;
      const assembler = next.target === "host" ? hostAssembler : guestAssembler;
      const chunk = assembler.accept(next.raw);
      if (chunk.handled) {
        if (chunk.message) target.handleRaw(chunk.message);
      } else {
        target.handleRaw(next.raw);
      }
    }
  };

  return {
    host,
    guest,
    hostStore,
    guestStore,
    setHostRemoteActorId: (actorId) => { currentHostRemoteActorId = actorId; },
    start: () => {
      guest.start("joiner");
      host.start("owner");
      drain();
    },
    drain,
    queue,
  };
}

test("shared content selection includes cards, card nodes, categories, and books only", () => {
  const state = makeState("card-a", "A");
  state.studyBooks.push({ cardId: "orphan", categoryId: null, orderInShelf: 4 });
  const records = [...shared.extractSharedContentRecords(state).values()];
  assert.deepEqual(records.map(({ collection, id }) => `${collection}:${id}`).sort(), [
    "canvasObjects:node-card-a",
    "cards:card-a",
    "studyBooks:card-a",
    "studyCategories:cat-uncategorized",
  ]);
  assert.equal(records.some((record) => record.id === "unrelated-math"), false);
});

test("shared operation parser validates entity keys, actions, versions, and message bounds", () => {
  const valid = {
    v: 1,
    type: "shared-operations",
    actorId: "peer-a",
    operations: [{
      collection: "studyBooks",
      id: "card-a",
      action: "upsert",
      value: { cardId: "card-a", categoryId: "cat-1", orderInShelf: 3 },
      clock: 1,
      actorId: "peer-a",
    }],
  };
  assert.deepEqual(shared.parseSharedContentMessage(JSON.stringify(valid)), valid);
  assert.equal(shared.parseSharedContentMessage(JSON.stringify({
    ...valid,
    operations: [{ ...valid.operations[0], value: { cardId: "another-card" } }],
  })), null);
  assert.equal(shared.parseSharedContentMessage(JSON.stringify({
    ...valid,
    operations: [{ ...valid.operations[0], action: "delete", value: {} }],
  })), null);
  assert.equal(shared.parseSharedContentMessage(JSON.stringify({
    v: 1,
    type: "shared-snapshot",
    actorId: "peer-a",
    records: [{ collection: "cards", id: "card-a", value: makeCard("card-a", "Spoofed"), clock: 9, actorId: "other-peer" }],
    tombstones: [],
  })), null);
  assert.equal(shared.parseSharedContentMessage(JSON.stringify({
    v: 1,
    type: "shared-operations",
    actorId: "peer-a",
    operations: [{
      collection: "canvasObjects",
      id: "obj-a",
      action: "upsert",
      value: { id: "obj-a", cardId: "card-a", type: "math", x: 1, y: 1 },
      clock: 2,
      actorId: "peer-a",
    }],
  })), null);
  assert.equal(shared.parseSharedContentMessage("x".repeat(5_000_001)), null);
});

test("large Unicode snapshots split into bounded frames and reassemble out of order", () => {
  const value = { id: "card-large", body: "筆記📚🧠漢字".repeat(2_000) };
  const message = {
    v: 1,
    type: "shared-snapshot",
    actorId: "peer-a",
    records: [{ collection: "cards", id: value.id, value, clock: 0, actorId: "peer-a" }],
    tombstones: [],
  };
  const frames = shared.serializeSharedContentMessage(message);
  assert.ok(frames.length > 2);
  assert.ok(frames.every((frame) => frame.length <= shared.MAX_SHARED_CONTENT_CHUNK_LENGTH));

  const assembler = new shared.SharedContentChunkAssembler();
  let complete;
  for (const frame of [...frames].reverse()) {
    const result = assembler.accept(frame);
    if (result.message) complete = result.message;
  }
  assert.ok(complete);
  assert.deepEqual(shared.parseSharedContentMessage(complete), message);
});

test("applying remote records updates workspace-local ids and cascades card deletion without replacing unrelated state", () => {
  const state = makeState("card-a", "Old");
  const operations = [
    { collection: "cards", id: "card-a", action: "upsert", value: makeCard("card-a", "New", "remote-workspace"), clock: 1, actorId: "peer-b" },
    { collection: "canvasObjects", id: "node-card-a", action: "upsert", value: { id: "node-card-a", cardId: "card-a", workspaceId: "remote-workspace", type: "card_node", x: 90, y: 80 }, clock: 2, actorId: "peer-b" },
    { collection: "studyBooks", id: "card-a", action: "upsert", value: { cardId: "card-a", categoryId: "cat-new", orderInShelf: 3 }, clock: 3, actorId: "peer-b" },
    { collection: "studyCategories", id: "cat-new", action: "upsert", value: { id: "cat-new", name: "New shelf", order: 1 }, clock: 4, actorId: "peer-b" },
  ];
  const updated = shared.applySharedContentOperationsToState(state, operations);
  assert.equal(updated.cards[0].title, "New");
  assert.equal(updated.cards[0].workspaceId, "local-workspace");
  assert.equal(updated.canvasObjects.find((object) => object.id === "node-card-a").x, 90);
  assert.equal(updated.canvasObjects.find((object) => object.id === "node-card-a").workspaceId, "local-workspace");
  assert.equal(updated.studyBooks[0].orderInShelf, 3);
  assert.equal(updated.studyCategories.some((category) => category.id === "cat-new"), true);
  assert.equal(updated.processLogs[0].title, "local-only");

  const deleted = shared.applySharedContentOperationsToState(updated, [{
    collection: "cards", id: "card-a", action: "delete", clock: 5, actorId: "peer-b",
  }]);
  assert.equal(deleted.cards.length, 0);
  assert.equal(deleted.canvasObjects.some((object) => object.cardId === "card-a"), false);
  assert.equal(deleted.studyBooks.length, 0);
  assert.equal(deleted.relations.length, 0);
  assert.equal(deleted.processLogs.length, 1);
});

test("owner waits for hello before snapshot and ignores repeated hello resends for the same peer", () => {
  const pair = createPair({
    hostState: makeState("card-host", "Host card"),
    guestState: makeState("card-guest", "Guest card"),
    hostRemoteActorId: null,
  });

  pair.host.start("owner");
  assert.equal(pair.queue.length, 0, "an owner alone should not publish an unnecessary snapshot");
  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => ({ ...card, title: "Updated before join" })),
  }));
  assert.equal(pair.host.flushPendingOperations(), true);
  assert.equal(pair.queue.length, 0, "local edits wait for the initial snapshot instead of being sent to an empty room");

  pair.setHostRemoteActorId("peer-b"); // The provider sets this after accepting the joiner's hello.
  assert.equal(pair.host.resendSnapshot(), true);
  const firstSnapshotFrameCount = pair.queue.length;
  assert.ok(firstSnapshotFrameCount > 0);
  assert.equal(pair.host.resendSnapshot(), false, "duplicate hellos must not enqueue another snapshot");
  assert.equal(pair.queue.length, firstSnapshotFrameCount);

  pair.guest.start("joiner");
  pair.drain();

  assert.equal(pair.guestStore.getState().cards.some((card) => card.id === "card-host"), true);
  assert.equal(pair.guestStore.getState().cards.find((card) => card.id === "card-host").title, "Updated before join");
  assert.equal(pair.queue.length, 0);
  pair.host.stop();
  pair.guest.stop();
});

test("owner and editor merge initial books/cards, then sync edits, moves, ordering, and deletes", () => {
  const pair = createPair({
    hostState: makeState("card-host", "Host card", { x: 10 }),
    guestState: makeState("card-guest", "Guest card", { workspaceId: "guest-workspace", x: 30 }),
  });
  pair.start();

  const newCard = makeCard("card-new", "Created while connected");
  pair.hostStore.mutate((state) => ({
    ...state,
    cards: [...state.cards, newCard],
    canvasObjects: [...state.canvasObjects, { id: "node-card-new", cardId: "card-new", type: "card_node", x: 40, y: 60 }],
    studyBooks: [...state.studyBooks, { cardId: "card-new", categoryId: null, orderInShelf: 1 }],
  }));
  pair.host.flushPendingOperations();
  pair.drain();
  assert.equal(pair.guestStore.getState().cards.some((card) => card.id === "card-new"), true);
  assert.equal(pair.guestStore.getState().studyBooks.some((book) => book.cardId === "card-new"), true);

  for (const x of [100, 110, 125]) {
    pair.hostStore.mutate((state) => ({
      ...state,
      canvasObjects: state.canvasObjects.map((object) => object.id === "node-card-host" ? { ...object, x } : object),
    }));
  }
  pair.host.flushPendingOperations();
  assert.equal(pair.queue.length, 1, "coalesced card movement sends only its latest record");
  pair.drain();
  assert.equal(pair.guestStore.getState().canvasObjects.find((object) => object.id === "node-card-host").x, 125);

  for (const store of [pair.hostStore, pair.guestStore]) {
    assert.deepEqual(store.getState().cards.map((card) => card.id).sort(), ["card-guest", "card-host", "card-new"]);
    assert.deepEqual(store.getState().studyBooks.map((book) => book.cardId).sort(), ["card-guest", "card-host", "card-new"]);
    assert.equal(store.getState().canvasObjects.some((object) => object.id === "unrelated-math"), true);
    assert.equal(store.getState().processLogs[0].title, "local-only");
  }

  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => card.id === "card-host" ? { ...card, reasoningShape: "B", updatedAt: "2026-10-23T00:01:00.000Z" } : card),
    canvasObjects: state.canvasObjects.map((object) => object.id === "node-card-host" ? { ...object, x: 125, y: 220 } : object),
    studyBooks: state.studyBooks.map((book) => book.cardId === "card-host" ? {
      ...book,
      categoryId: "cat-new",
      orderInShelf: 2,
      place: "desk",
      desk: { x: 1.5, z: -0.5, yawDeg: 35 },
    } : book),
    studyCategories: [...state.studyCategories, { id: "cat-new", name: "Physics", order: 0, color: "#123456" }],
  }));
  pair.host.flushPendingOperations();
  pair.drain();

  for (const store of [pair.hostStore, pair.guestStore]) {
    assert.equal(store.getState().cards.find((card) => card.id === "card-host").reasoningShape, "B");
    assert.equal(store.getState().canvasObjects.find((object) => object.id === "node-card-host").x, 125);
    assert.equal(store.getState().studyBooks.find((book) => book.cardId === "card-host").orderInShelf, 2);
    assert.equal(store.getState().studyBooks.find((book) => book.cardId === "card-host").categoryId, "cat-new");
    assert.equal(store.getState().studyBooks.find((book) => book.cardId === "card-host").place, "desk");
    assert.deepEqual(store.getState().studyBooks.find((book) => book.cardId === "card-host").desk, { x: 1.5, z: -0.5, yawDeg: 35 });
    assert.equal(store.getState().studyCategories.some((category) => category.id === "cat-new"), true);
  }

  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => card.id === "card-host" ? { ...card, reasoningShape: "C" } : card),
  }));
  pair.host.flushPendingOperations();
  pair.drain();
  assert.equal(pair.guestStore.getState().cards.find((card) => card.id === "card-host").reasoningShape, "C");

  pair.guestStore.mutate((state) => ({
    ...state,
    cards: state.cards.filter((card) => card.id !== "card-host"),
    canvasObjects: state.canvasObjects.filter((object) => object.cardId !== "card-host"),
    studyBooks: state.studyBooks.filter((book) => book.cardId !== "card-host"),
  }));
  pair.guest.flushPendingOperations();
  pair.drain();
  for (const store of [pair.hostStore, pair.guestStore]) {
    assert.equal(store.getState().cards.some((card) => card.id === "card-host"), false);
    assert.equal(store.getState().studyBooks.some((book) => book.cardId === "card-host"), false);
    assert.equal(store.getState().canvasObjects.some((object) => object.cardId === "card-host"), false);
  }

  pair.host.stop();
  pair.guest.stop();
});

test("simultaneous non-text edits use deterministic per-record last-write-wins versions", () => {
  const pair = createPair({
    hostState: makeState("same-card", "initial"),
    guestState: makeState("same-card", "guest-offline"),
  });
  pair.start();
  const startHostTitle = pair.hostStore.getState().cards[0].title;
  const startGuestTitle = pair.guestStore.getState().cards[0].title;
  assert.equal(startHostTitle, startGuestTitle);

  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => ({ ...card, reasoningShape: "host simultaneous" })),
  }));
  pair.guestStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => ({ ...card, reasoningShape: "guest simultaneous" })),
  }));
  pair.host.flushPendingOperations();
  pair.guest.flushPendingOperations();
  pair.drain();
  assert.equal(pair.hostStore.getState().cards[0].reasoningShape, pair.guestStore.getState().cards[0].reasoningShape);
  assert.ok(["host simultaneous", "guest simultaneous"].includes(pair.hostStore.getState().cards[0].reasoningShape));
  pair.host.stop();
  pair.guest.stop();
});

test("text-only card changes are excluded from whole-record LWW; a non-text change still sends the latest full record", () => {
  const pair = createPair({
    hostState: {
      ...makeState("card-a", "Initial"),
      cards: [{ ...makeCard("card-a", "Initial"), reasoningShape: "A" }],
    },
    guestState: {
      ...makeState("card-a", "Initial"),
      cards: [{ ...makeCard("card-a", "Initial"), reasoningShape: "A" }],
    },
  });
  pair.start();

  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => ({ ...card, title: "Live text edit" })),
  }));
  pair.host.flushPendingOperations();
  assert.equal(pair.queue.length, 0, "CRDT text edits must not race as whole-card LWW operations");
  assert.equal(pair.guestStore.getState().cards[0].title, "Initial");

  pair.hostStore.mutate((state) => ({
    ...state,
    cards: state.cards.map((card) => ({ ...card, reasoningShape: "B" })),
  }));
  pair.host.flushPendingOperations();
  pair.drain();
  assert.equal(pair.guestStore.getState().cards[0].title, "Live text edit");
  assert.equal(pair.guestStore.getState().cards[0].reasoningShape, "B");
  pair.host.stop();
  pair.guest.stop();
});

test("reader receives host content but neither contributes local cards nor can mutate the host", () => {
  const pair = createPair({
    hostState: makeState("host-card", "Host"),
    guestState: makeState("reader-card", "Private local note", { workspaceId: "reader-workspace" }),
    guestRole: "reader",
  });
  pair.start();
  assert.equal(pair.guestStore.getState().cards.some((card) => card.id === "host-card"), true);
  assert.equal(pair.hostStore.getState().cards.some((card) => card.id === "reader-card"), false);

  const forged = {
    v: 1,
    type: "shared-operations",
    actorId: "peer-b",
    operations: [{
      collection: "cards",
      id: "forged-card",
      action: "upsert",
      value: makeCard("forged-card", "Must be rejected"),
      clock: 50,
      actorId: "peer-b",
    }],
  };
  pair.host.handleRaw(JSON.stringify(forged));
  assert.equal(pair.hostStore.getState().cards.some((card) => card.id === "forged-card"), false);
  pair.host.stop();
  pair.guest.stop();
});
