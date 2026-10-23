import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";
import ts from "typescript";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "scinotes-webrtc-test-"));
const modulePath = join(temporaryDirectory, "connection.mjs");
const source = await readFile(new URL("../src/lib/connection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
await writeFile(modulePath, compiled, "utf8");
const connection = await import(pathToFileURL(modulePath).href);

after(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

const SDP = [
  "v=0",
  "o=- 12345 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=sctp-port:5000",
  "a=candidate:1 1 UDP 2122260223 192.0.2.1 5000 typ host",
  "",
].join("\r\n");

class FakeDataChannel {
  label = "p2p-connection";
  readyState = "connecting";
  onopen = null;
  onclose = null;
  onerror = null;

  open() {
    this.readyState = "open";
    this.onopen?.(new Event("open"));
  }

  close() {
    this.readyState = "closed";
    this.onclose?.(new Event("close"));
  }
}

class FakePeerConnection {
  connectionState = "new";
  iceConnectionState = "new";
  iceGatheringState = "new";
  signalingState = "stable";
  localDescription = null;
  remoteDescription = null;
  onconnectionstatechange = null;
  oniceconnectionstatechange = null;
  onicegatheringstatechange = null;
  ondatachannel = null;
  channel = null;
  listeners = new Map();
  configuration;

  constructor(configuration) {
    this.configuration = configuration;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    const event = new Event(type);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    const handler = this[`on${type}`];
    handler?.(event);
  }

  createDataChannel() {
    this.channel = new FakeDataChannel();
    return this.channel;
  }

  async createOffer() {
    return { type: "offer", sdp: SDP };
  }

  async createAnswer() {
    return { type: "answer", sdp: SDP };
  }

  async setLocalDescription(description) {
    if (this.signalingState === "closed") throw new Error("PeerConnection is closed");
    this.localDescription = description;
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
    this.iceGatheringState = "complete";
    this.dispatch("icegatheringstatechange");
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
    this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
    if (description.type === "offer") {
      this.channel = new FakeDataChannel();
      this.ondatachannel?.({ channel: this.channel });
    }
    this.connectionState = "connecting";
    this.iceConnectionState = "checking";
    this.dispatch("connectionstatechange");
    this.dispatch("iceconnectionstatechange");
  }

  close() {
    this.signalingState = "closed";
    this.connectionState = "closed";
    this.iceConnectionState = "closed";
    this.iceGatheringState = "complete";
    this.dispatch("connectionstatechange");
  }
}

function makeManager() {
  let peer;
  const manager = new connection.WebRTCConnectionManager((configuration) => {
    peer = new FakePeerConnection(configuration);
    return peer;
  });
  return { manager, getPeer: () => peer };
}

test("STUN input accepts editable STUN URLs, blank disables it, and rejects TURN or malformed input", () => {
  assert.equal(connection.validateStunServer(connection.DEFAULT_STUN_SERVER), connection.DEFAULT_STUN_SERVER);
  assert.equal(connection.validateStunServer("  stun:example.net:3478  "), "stun:example.net:3478");
  assert.equal(connection.validateStunServer(""), null);
  assert.throws(() => connection.validateStunServer("turn:relay.example.net:3478"), /不接受 TURN/);
  assert.throws(() => connection.validateStunServer("https://example.net"), /STUN 位址格式/);
});

test("signaling parser validates JSON, role order, DataChannel SDP, and complete ICE candidates", () => {
  const validOffer = JSON.stringify({ type: "offer", sdp: SDP });
  assert.deepEqual(connection.parseSessionDescription(validOffer, "offer"), { type: "offer", sdp: SDP.trim() });
  assert.throws(() => connection.parseSessionDescription("not-json", "offer"), /有效 JSON/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "answer", sdp: SDP }), "offer"), /需要 Offer/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: "v=0\r\nm=application 9\r\n" }), "offer"), /DataChannel/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP.replace(/^a=candidate:.*\r?\n/m, "") }), "offer"), /ICE 候選/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP }), "answer"), /需要 Answer/);
});

test("A/B exchange only reports success when the DataChannel is actually open", async () => {
  const a = makeManager();
  const b = makeManager();

  const offerText = await a.manager.createOffer(connection.DEFAULT_STUN_SERVER);
  const offer = JSON.parse(offerText);
  assert.equal(offer.type, "offer");
  assert.match(offer.sdp, /a=candidate:/);
  assert.equal(a.manager.getState().phase, "waiting-answer");
  assert.equal(a.manager.getState().iceGatheringState, "complete");
  assert.equal(a.manager.getState().dataChannelState, "connecting");
  assert.equal(a.manager.getDataChannel(), null);
  assert.deepEqual(a.getPeer().configuration.iceServers, [{ urls: connection.DEFAULT_STUN_SERVER }]);

  const answerText = await b.manager.createAnswer(offerText, "stun:example.net:3478");
  const answer = JSON.parse(answerText);
  assert.equal(answer.type, "answer");
  assert.equal(b.manager.getState().phase, "connecting");
  assert.equal(b.manager.getState().dataChannelState, "connecting");
  assert.equal(b.manager.getDataChannel(), null);
  assert.deepEqual(b.getPeer().configuration.iceServers, [{ urls: "stun:example.net:3478" }]);

  await a.manager.completeWithAnswer(answerText);
  assert.notEqual(a.manager.getState().phase, "open");
  assert.equal(a.manager.getDataChannel(), null);

  a.getPeer().channel.open();
  b.getPeer().channel.open();
  assert.equal(a.manager.getState().phase, "open");
  assert.equal(b.manager.getState().phase, "open");
  assert.equal(a.manager.getDataChannel().readyState, "open");
  assert.equal(b.manager.getDataChannel().readyState, "open");

  b.getPeer().channel.close();
  assert.equal(b.manager.getState().phase, "disconnected");
  assert.equal(b.manager.getDataChannel(), null);

  a.manager.disconnect();
  b.manager.disconnect();
  assert.equal(a.manager.getState().phase, "idle");
  assert.equal(b.manager.getState().phase, "idle");
  assert.equal(a.getPeer().signalingState, "closed");
  assert.equal(b.getPeer().signalingState, "closed");
});

test("invalid operation order and duplicate pairing are rejected without replacing the active session", async () => {
  const idle = makeManager();
  await assert.rejects(idle.manager.completeWithAnswer(JSON.stringify({ type: "answer", sdp: SDP })), /操作順序不正確/);
  await assert.rejects(idle.manager.createAnswer(JSON.stringify({ type: "answer", sdp: SDP }), connection.DEFAULT_STUN_SERVER), /需要 Offer/);

  const { manager } = makeManager();
  await manager.createOffer(connection.DEFAULT_STUN_SERVER);
  await assert.rejects(manager.createOffer(connection.DEFAULT_STUN_SERVER), /已有一組連線流程/);
  await assert.rejects(manager.createAnswer(JSON.stringify({ type: "offer", sdp: SDP }), connection.DEFAULT_STUN_SERVER), /已有一組連線流程/);
  assert.equal(manager.getState().phase, "waiting-answer");
  manager.disconnect();
});

test("disconnect cancels an in-progress ICE gathering operation and leaves the manager reusable", async () => {
  let releaseLocalDescription;
  let enteredLocalDescription;
  const entered = new Promise((resolve) => { enteredLocalDescription = resolve; });
  const gate = new Promise((resolve) => { releaseLocalDescription = resolve; });
  let peer;
  const manager = new connection.WebRTCConnectionManager((configuration) => {
    peer = new FakePeerConnection(configuration);
    const normalSetLocalDescription = peer.setLocalDescription.bind(peer);
    peer.setLocalDescription = async (description) => {
      enteredLocalDescription();
      await gate;
      return normalSetLocalDescription(description);
    };
    return peer;
  });

  const pendingOffer = manager.createOffer(connection.DEFAULT_STUN_SERVER);
  await entered;
  manager.disconnect();
  releaseLocalDescription();
  await assert.rejects(pendingOffer, connection.ConnectionCancelledError);
  assert.equal(manager.getState().phase, "idle");
  assert.equal(peer.signalingState, "closed");
});
