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
const clipboardModulePath = join(temporaryDirectory, "clipboard.mjs");
const clipboardSource = await readFile(new URL("../src/lib/clipboard.ts", import.meta.url), "utf8");
const clipboardCompiled = ts.transpileModule(clipboardSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
await writeFile(clipboardModulePath, clipboardCompiled, "utf8");
const clipboard = await import(pathToFileURL(clipboardModulePath).href);

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
  "a=max-message-size:262144",
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
    this.localDescription = {
      ...description,
      sdp: description.sdp.replace(/^a=candidate:.*(?:\r?\n)?/m, ""),
    };
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
    this.iceGatheringState = "gathering";
    setTimeout(() => {
      if (this.signalingState === "closed") return;
      this.localDescription = description;
      this.iceGatheringState = "complete";
      this.dispatch("icegatheringstatechange");
    }, 5);
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

  async getStats() {
    const stats = new Map([
      ["local-host", { id: "local-host", type: "local-candidate", candidateType: "host", address: "192.0.2.10" }],
      ["local-srflx", { id: "local-srflx", type: "local-candidate", candidateType: "srflx", address: "198.51.100.10" }],
    ]);
    if (this.remoteDescription) {
      stats.set("remote-host", { id: "remote-host", type: "remote-candidate", candidateType: "host", address: "192.0.2.20" });
      stats.set("transport", { id: "transport", type: "transport", selectedCandidatePairId: "pair" });
      stats.set("pair", { id: "pair", type: "candidate-pair", state: "in-progress", selected: true });
    }
    return stats;
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

const waitForStatsRefresh = () => new Promise((resolve) => setImmediate(resolve));

test("STUN input accepts editable STUN URLs, blank disables it, and rejects TURN or malformed input", () => {
  assert.equal(connection.validateStunServer(connection.DEFAULT_STUN_SERVER), connection.DEFAULT_STUN_SERVER);
  assert.equal(connection.validateStunServer("  stun:example.net:3478  "), "stun:example.net:3478");
  assert.equal(connection.validateStunServer(""), null);
  assert.throws(() => connection.validateStunServer("turn:relay.example.net:3478"), /不接受 TURN/);
  assert.throws(() => connection.validateStunServer("https://example.net"), /STUN 位址格式/);
});

test("clipboard rejection falls back to a selected field without losing text", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const setGlobal = (name, value) => Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
  const restoreGlobal = (name, descriptor) => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  };
  const makeField = () => {
    const calls = [];
    return {
      calls,
      field: {
        value: "complete Offer JSON",
        focus: () => calls.push("focus"),
        select: () => calls.push("select"),
        setSelectionRange: (start, end) => calls.push([start, end]),
      },
    };
  };

  try {
    let writtenText = "";
    let legacyCopyCalls = 0;
    setGlobal("navigator", { clipboard: { writeText: async (text) => { writtenText = text; } } });
    setGlobal("document", { execCommand: () => { legacyCopyCalls += 1; return true; } });
    const successField = makeField();
    assert.equal(await clipboard.copyTextWithFallback("complete Offer JSON", successField.field), "clipboard");
    assert.equal(writtenText, "complete Offer JSON");
    assert.deepEqual(successField.calls, []);
    assert.equal(legacyCopyCalls, 0);

    setGlobal("navigator", { clipboard: { writeText: async () => { throw new Error("NotAllowedError"); } } });
    setGlobal("document", { execCommand: () => false });
    const deniedField = makeField();
    assert.equal(await clipboard.copyTextWithFallback("complete Offer JSON", deniedField.field), "manual");
    assert.deepEqual(deniedField.calls, ["focus", "select", [0, "complete Offer JSON".length]]);
    assert.equal(deniedField.field.value, "complete Offer JSON");

    setGlobal("navigator", { clipboard: undefined });
    setGlobal("document", { execCommand: () => true });
    const legacyField = makeField();
    legacyField.field.value = "complete Answer JSON";
    assert.equal(await clipboard.copyTextWithFallback("complete Answer JSON", legacyField.field), "legacy-copy");
    assert.deepEqual(legacyField.calls, ["focus", "select", [0, "complete Answer JSON".length]]);
  } finally {
    restoreGlobal("navigator", originalNavigator);
    restoreGlobal("document", originalDocument);
  }
});

test("signaling parser validates JSON, role order, DataChannel SDP, and exact SDP characters", () => {
  const validOffer = JSON.stringify({ type: "offer", sdp: SDP });
  assert.deepEqual(connection.parseSessionDescription(validOffer, "offer"), { type: "offer", sdp: SDP });
  assert.match(connection.parseSessionDescription(validOffer, "offer").sdp, /^v=0\r\n/);
  assert.match(connection.parseSessionDescription(validOffer, "offer").sdp, /^a=max-message-size:262144$/m);

  const lfSdp = SDP.replaceAll("\r\n", "\n");
  assert.equal(connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: lfSdp }), "offer").sdp, lfSdp);
  const unicodeSdp = SDP.replace("s=-", "s=測試 ✓");
  assert.equal(connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: unicodeSdp }), "offer").sdp, unicodeSdp);

  assert.throws(() => connection.parseSessionDescription("not-json", "offer"), /有效 JSON/);
  assert.throws(() => connection.parseSessionDescription(validOffer.slice(0, -2), "offer"), /有效 JSON/);
  assert.throws(() => connection.parseSessionDescription(`${validOffer} trailing text`, "offer"), /有效 JSON/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify(validOffer), "offer"), /格式不正確/);
  const doubleEscapedSdp = SDP.replaceAll("\r\n", "\\r\\n");
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: doubleEscapedSdp }), "offer"), /SDP 不完整/);
  const truncatedSdp = SDP.slice(0, SDP.indexOf("a=candidate:"));
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: truncatedSdp }), "offer"), /ICE 候選/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP.replaceAll("\r\n", "\r") }), "offer"), /換行或控制字元/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP.replace("a=max-message-size:262144", "a=max-message-size:262144x") }), "offer"), /max-message-size/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "answer", sdp: SDP }), "offer"), /需要 Offer/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: "v=0\r\nm=application 9\r\n" }), "offer"), /DataChannel/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP.replace(/^a=candidate:.*\r?\n/m, "") }), "offer"), /ICE 候選/);
  assert.throws(() => connection.parseSessionDescription(JSON.stringify({ type: "offer", sdp: SDP }), "answer"), /需要 Answer/);
});

test("Offer and Answer JSON serialization round-trips preserve the full SDP exactly", () => {
  for (const type of ["offer", "answer"]) {
    const description = { type, sdp: SDP };
    const serialized = connection.serializeSessionDescription(description);
    assert.equal(serialized, JSON.stringify(description));
    assert.ok(serialized.includes("a=max-message-size:262144\\r\\n"));
    assert.equal(serialized.includes("a=max-message-size:262144\r\n"), false);
    const parsed = connection.parseSessionDescription(serialized, type);
    assert.equal(parsed.type, type);
    assert.equal(parsed.sdp, SDP);
    assert.equal(parsed.sdp.includes("a=max-message-size:262144\r\n"), true);
  }
});

test("candidate diagnostics aggregate types and selected-pair state without retaining addresses", () => {
  const report = new Map([
    ["local-host", { id: "local-host", type: "local-candidate", candidateType: "host", address: "192.0.2.1" }],
    ["local-srflx", { id: "local-srflx", type: "local-candidate", candidateType: "srflx", address: "198.51.100.1" }],
    ["local-relay", { id: "local-relay", type: "local-candidate", candidateType: "relay", address: "203.0.113.1" }],
    ["remote-host", { id: "remote-host", type: "remote-candidate", candidateType: "host", address: "192.0.2.2" }],
    ["remote-prflx", { id: "remote-prflx", type: "remote-candidate", candidateType: "prflx", address: "198.51.100.2" }],
    ["transport", { id: "transport", type: "transport", selectedCandidatePairId: "pair" }],
    ["pair", { id: "pair", type: "candidate-pair", state: "succeeded", selected: true }],
  ]);
  const summary = connection.summarizePeerStats(report);
  assert.deepEqual(summary.localCandidateTypes, { host: 1, srflx: 1, relay: 1, prflx: 0, other: 0 });
  assert.deepEqual(summary.remoteCandidateTypes, { host: 1, srflx: 0, relay: 0, prflx: 1, other: 0 });
  assert.equal(summary.selectedCandidatePairState, "succeeded");
  assert.equal(JSON.stringify(summary).includes("192.0.2.1"), false);
});

test("A/B exchange only reports success when the DataChannel is actually open", async () => {
  const a = makeManager();
  const b = makeManager();

  const offerText = await a.manager.createOffer(connection.DEFAULT_STUN_SERVER);
  await waitForStatsRefresh();
  const offer = JSON.parse(offerText);
  assert.equal(a.manager.getState().signalingState, "have-local-offer");
  assert.equal(a.manager.getState().localDescriptionSet, true);
  assert.equal(a.manager.getState().remoteDescriptionSet, false);
  assert.equal(a.manager.getState().hasRemoteCandidateInformation, false);
  assert.deepEqual(a.manager.getState().localCandidateTypes, { host: 1, srflx: 1, relay: 0, prflx: 0, other: 0 });
  assert.equal(JSON.stringify(a.manager.getState()).includes("192.0.2.10"), false);
  assert.equal(offer.type, "offer");
  assert.equal(offer.sdp, SDP);
  assert.match(offer.sdp, /a=candidate:/);
  assert.match(offer.sdp, /^a=max-message-size:262144$/m);
  assert.equal(a.manager.getState().phase, "waiting-answer");
  assert.equal(a.manager.getState().iceGatheringState, "complete");
  assert.equal(a.manager.getState().dataChannelState, "connecting");
  assert.equal(a.manager.getDataChannel(), null);
  assert.deepEqual(a.getPeer().configuration.iceServers, [{ urls: connection.DEFAULT_STUN_SERVER }]);

  const answerText = await b.manager.createAnswer(offerText, "stun:example.net:3478");
  await waitForStatsRefresh();
  const answer = JSON.parse(answerText);
  assert.equal(b.manager.getState().signalingState, "stable");
  assert.equal(b.manager.getState().localDescriptionSet, true);
  assert.equal(b.manager.getState().remoteDescriptionSet, true);
  assert.equal(b.manager.getState().hasRemoteCandidateInformation, true);
  assert.deepEqual(b.manager.getState().remoteCandidateTypes, { host: 1, srflx: 0, relay: 0, prflx: 0, other: 0 });
  assert.equal(b.manager.getState().selectedCandidatePairState, "checking");
  assert.equal(answer.type, "answer");
  assert.equal(answer.sdp, SDP);
  assert.deepEqual(b.getPeer().remoteDescription, { type: "offer", sdp: SDP });
  assert.equal(b.manager.getState().phase, "connecting");
  assert.equal(b.manager.getState().connectionTimeoutActive, false);
  assert.equal(b.manager.getState().dataChannelState, "connecting");
  assert.equal(b.manager.getDataChannel(), null);
  assert.deepEqual(b.getPeer().configuration.iceServers, [{ urls: "stun:example.net:3478" }]);

  await a.manager.completeWithAnswer(answerText);
  await waitForStatsRefresh();
  assert.equal(a.manager.getState().connectionTimeoutActive, true);
  assert.equal(a.manager.getState().signalingState, "stable");
  assert.equal(a.manager.getState().localDescriptionSet, true);
  assert.equal(a.manager.getState().remoteDescriptionSet, true);
  assert.equal(a.manager.getState().hasRemoteCandidateInformation, true);
  assert.deepEqual(a.getPeer().remoteDescription, { type: "answer", sdp: SDP });
  assert.notEqual(a.manager.getState().phase, "open");
  assert.equal(a.manager.getDataChannel(), null);

  a.getPeer().channel.open();
  b.getPeer().channel.open();
  assert.equal(a.manager.getState().phase, "open");
  assert.equal(b.manager.getState().phase, "open");
  assert.equal(a.manager.getState().connectionTimeoutActive, false);
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

test("joiner timeout starts only after confirming the Answer was returned", async () => {
  const { manager } = makeManager();
  const offerText = connection.serializeSessionDescription({ type: "offer", sdp: SDP });
  await manager.createAnswer(offerText, connection.DEFAULT_STUN_SERVER);
  assert.equal(manager.getState().connectionTimeoutActive, false);

  manager.confirmAnswerSent();
  assert.equal(manager.getState().connectionTimeoutActive, true);
  manager.disconnect();
  assert.equal(manager.getState().connectionTimeoutActive, false);
});

test("terminal diagnostics retain pre-cleanup ICE and signaling states", async () => {
  const { manager, getPeer } = makeManager();
  await manager.createOffer(connection.DEFAULT_STUN_SERVER);
  const peer = getPeer();
  peer.connectionState = "failed";
  peer.iceConnectionState = "failed";
  peer.dispatch("iceconnectionstatechange");
  await waitForStatsRefresh();

  const snapshot = manager.getState();
  assert.equal(snapshot.phase, "failed");
  assert.equal(snapshot.peerConnectionState, "failed");
  assert.equal(snapshot.iceConnectionState, "failed");
  assert.equal(snapshot.signalingState, "have-local-offer");
  assert.equal(snapshot.localDescriptionSet, true);
  assert.equal(snapshot.remoteDescriptionSet, false);
  assert.equal(snapshot.dataChannelState, "connecting");
  assert.deepEqual(snapshot.localCandidateTypes, { host: 1, srflx: 1, relay: 0, prflx: 0, other: 0 });
  assert.equal(snapshot.hasRemoteCandidateInformation, false);
  assert.equal(peer.connectionState, "closed");
  assert.equal(peer.signalingState, "closed");
  manager.disconnect();
});

test("failure detail distinguishes PeerConnection failure from ICE failure", async () => {
  const { manager, getPeer } = makeManager();
  await manager.createOffer(connection.DEFAULT_STUN_SERVER);
  const peer = getPeer();
  peer.connectionState = "failed";
  peer.iceConnectionState = "connected";
  peer.dispatch("connectionstatechange");

  const detail = manager.getState().detail;
  assert.match(detail, /PeerConnection state=failed/);
  assert.doesNotMatch(detail, /ICE connection state=failed/);
  manager.disconnect();
});

test("setRemoteDescription receives unchanged SDP and reports parser errors without exposing SDP or ICE", async () => {
  let peer;
  const manager = new connection.WebRTCConnectionManager((configuration) => {
    peer = new FakePeerConnection(configuration);
    peer.setRemoteDescription = async (description) => {
      peer.remoteDescription = description;
      throw new Error(`Invalid SDP line a=max-message-size:262144; private SDP: ${description.sdp}`);
    };
    return peer;
  });

  const offerText = connection.serializeSessionDescription({ type: "offer", sdp: SDP });
  await assert.rejects(
    manager.createAnswer(offerText, connection.DEFAULT_STUN_SERVER),
    /加入端瀏覽器拒絕 SDP 中的 a=max-message-size 屬性/
  );
  assert.deepEqual(peer.remoteDescription, { type: "offer", sdp: SDP });
  const detail = manager.getState().detail;
  assert.match(detail, /a=max-message-size/);
  assert.equal(detail.includes("262144"), false);
  assert.equal(detail.includes("192.0.2.1"), false);
  assert.equal(detail.includes(SDP), false);
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
