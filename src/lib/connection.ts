/**
 * Browser-native WebRTC signaling and DataChannel lifecycle only.
 * No application messages are defined or sent by this module.
 */

export const DEFAULT_STUN_SERVER = "stun:stun.cloudflare.com:3478";
export const ICE_GATHERING_TIMEOUT_MS = 60_000;
export const CONNECTION_TIMEOUT_MS = 60_000;
const MAX_SIGNALING_TEXT_LENGTH = 1_000_000;

export type ConnectionRole = "initiator" | "joiner" | null;
export type ConnectionPhase =
  | "idle"
  | "creating-offer"
  | "waiting-answer"
  | "creating-answer"
  | "waiting-peer"
  | "applying-answer"
  | "connecting"
  | "open"
  | "disconnected"
  | "failed";

export interface CandidateTypeCounts {
  host: number;
  srflx: number;
  relay: number;
  prflx: number;
  other: number;
}

export type SelectedCandidatePairState = "checking" | "succeeded" | "failed" | "not-reported";

export interface ConnectionSnapshot {
  role: ConnectionRole;
  phase: ConnectionPhase;
  peerConnectionState: RTCPeerConnectionState | "unavailable";
  iceConnectionState: RTCIceConnectionState | "unavailable";
  iceGatheringState: RTCIceGatheringState | "unavailable";
  signalingState: RTCSignalingState | "unavailable";
  dataChannelState: RTCDataChannelState | "unavailable";
  localDescriptionSet: boolean;
  remoteDescriptionSet: boolean;
  hasRemoteCandidateInformation: boolean;
  localCandidateTypes: CandidateTypeCounts | null;
  remoteCandidateTypes: CandidateTypeCounts | null;
  selectedCandidatePairState: SelectedCandidatePairState;
  connectionTimeoutActive: boolean;
  detail: string;
}

export type SnapshotListener = (snapshot: ConnectionSnapshot) => void;
export type PeerConnectionFactory = (configuration: RTCConfiguration) => RTCPeerConnection;

export class ConnectionCancelledError extends Error {
  constructor() {
    super("操作已取消。");
    this.name = "ConnectionCancelledError";
  }
}

const INITIAL_SNAPSHOT: ConnectionSnapshot = {
  role: null,
  phase: "idle",
  peerConnectionState: "unavailable",
  iceConnectionState: "unavailable",
  iceGatheringState: "unavailable",
  signalingState: "unavailable",
  dataChannelState: "unavailable",
  localDescriptionSet: false,
  remoteDescriptionSet: false,
  hasRemoteCandidateInformation: false,
  localCandidateTypes: null,
  remoteCandidateTypes: null,
  selectedCandidatePairState: "not-reported",
  connectionTimeoutActive: false,
  detail: "",
};

export function validateStunServer(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (value.length > 255 || !/^stuns?:[^\s]+$/i.test(value)) {
    throw new Error("STUN 位址格式不正確。請輸入 stun:主機名稱:連接埠 或 stuns:主機名稱:連接埠；本頁不接受 TURN 中繼位址。");
  }
  return value;
}

/** Parse the small, explicit JSON signaling envelope; never execute pasted content. */
export function parseSessionDescription(
  raw: string,
  expectedType: "offer" | "answer"
): RTCSessionDescriptionInit {
  const text = raw.trim();
  if (!text) throw new Error(`請貼上完整的 ${expectedType === "offer" ? "Offer" : "Answer"} JSON。`);
  if (text.length > MAX_SIGNALING_TEXT_LENGTH) {
    throw new Error("貼上的內容超過 1 MB，可能不是本頁產生的連線資訊。");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("內容不是有效 JSON。請從對方提供的連線資訊開頭到結尾完整複製貼上，不要只貼 SDP 片段。");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("連線資訊格式不正確；請貼上本頁產生的 JSON 內容。");
  }

  const candidate = parsed as { type?: unknown; sdp?: unknown };
  if (candidate.type !== expectedType) {
    const expectedName = expectedType === "offer" ? "Offer" : "Answer";
    const actualName = candidate.type === "offer" ? "Offer" : candidate.type === "answer" ? "Answer" : "未知內容";
    throw new Error(`這裡需要 ${expectedName}，但貼上的內容是${actualName}。請確認 A／B 的交換順序。`);
  }
  if (typeof candidate.sdp !== "string" || candidate.sdp.length > MAX_SIGNALING_TEXT_LENGTH) {
    throw new Error("連線資訊缺少有效的 SDP。請重新複製完整內容。");
  }

  // Keep the decoded SDP byte-for-byte (including CRLF and the final newline).
  // Do not trim, normalize line endings, or rewrite attributes such as
  // a=max-message-size:262144 before passing this RTCSessionDescriptionInit on.
  const sdp = candidate.sdp;
  if (/\r(?!\n)/.test(sdp) || sdp.includes("\0")) {
    throw new Error("SDP 的換行或控制字元格式不正確。請重新複製完整的 Offer／Answer JSON。");
  }
  const sdpLines = sdp.split(/\r\n|\n/);
  if (sdpLines[0] !== "v=0" || !sdpLines.some((line) => /^m=application\s/.test(line))) {
    throw new Error("SDP 不完整或不是 DataChannel 連線資訊。請重新產生並完整複製 Offer／Answer。");
  }
  if (!sdpLines.some((line) => /^a=(?:sctp-port|sctpmap):/.test(line))) {
    throw new Error("SDP 中找不到 DataChannel 協商欄位。請重新產生連線資訊。");
  }
  if (!sdpLines.some((line) => /^a=candidate:/.test(line))) {
    throw new Error("SDP 中沒有 ICE 候選位址，可能尚未完成收集。請等候收集完成後重新複製。");
  }
  const maxMessageSizeLines = sdpLines.filter((line) => line.startsWith("a=max-message-size"));
  if (maxMessageSizeLines.some((line) => !/^a=max-message-size:\d+$/.test(line))) {
    throw new Error("SDP 的 max-message-size 屬性格式不正確。請重新產生完整訊號，不要手動改寫 SDP。");
  }

  return { type: expectedType, sdp };
}

export function serializeSessionDescription(description: RTCSessionDescription | RTCSessionDescriptionInit): string {
  if ((description.type !== "offer" && description.type !== "answer") || !description.sdp) {
    throw new Error("瀏覽器沒有提供完整的 SDP。請中斷連線後重新建立邀請。");
  }
  return JSON.stringify({ type: description.type, sdp: description.sdp });
}

export interface PeerStatsSummary {
  localCandidateTypes: CandidateTypeCounts;
  remoteCandidateTypes: CandidateTypeCounts;
  selectedCandidatePairState: SelectedCandidatePairState;
}

interface CandidateStatsEntry {
  id?: string;
  type?: string;
  candidateType?: string;
  selected?: boolean;
  selectedCandidatePairId?: string;
  state?: string;
}

/** Aggregate only non-sensitive ICE stats; addresses and ports are never retained. */
export function summarizePeerStats(report: Pick<RTCStatsReport, "values">): PeerStatsSummary {
  const entries = Array.from(report.values()) as CandidateStatsEntry[];
  const emptyCounts = (): CandidateTypeCounts => ({ host: 0, srflx: 0, relay: 0, prflx: 0, other: 0 });
  const localCandidateTypes = emptyCounts();
  const remoteCandidateTypes = emptyCounts();
  const increment = (counts: CandidateTypeCounts, candidateType: string | undefined) => {
    switch (candidateType) {
      case "host": counts.host += 1; break;
      case "srflx": counts.srflx += 1; break;
      case "relay": counts.relay += 1; break;
      case "prflx": counts.prflx += 1; break;
      default: counts.other += 1; break;
    }
  };

  for (const entry of entries) {
    if (entry.type === "local-candidate") increment(localCandidateTypes, entry.candidateType);
    if (entry.type === "remote-candidate") increment(remoteCandidateTypes, entry.candidateType);
  }

  const selectedPairId = entries.find((entry) =>
    entry.type === "transport" && typeof entry.selectedCandidatePairId === "string"
  )?.selectedCandidatePairId;
  const selectedPair = entries.find((entry) =>
    entry.type === "candidate-pair" && (entry.id === selectedPairId || (!selectedPairId && entry.selected === true))
  );
  const pairState = selectedPair?.state;
  const selectedCandidatePairState: SelectedCandidatePairState = pairState === "succeeded"
    ? "succeeded"
    : pairState === "failed"
      ? "failed"
      : pairState === "checking" || pairState === "waiting" || pairState === "in-progress" || pairState === "frozen"
        ? "checking"
        : "not-reported";

  return { localCandidateTypes, remoteCandidateTypes, selectedCandidatePairState };
}

export function connectionPhaseLabel(phase: ConnectionPhase): string {
  switch (phase) {
    case "idle": return "尚未連線";
    case "creating-offer": return "正在建立邀請";
    case "waiting-answer": return "等待對方回覆";
    case "creating-answer": return "正在協商";
    case "waiting-peer": return "正在協商";
    case "applying-answer": return "正在協商";
    case "connecting": return "正在連線";
    case "open": return "DataChannel 已開啟";
    case "disconnected": return "連線中斷";
    case "failed": return "連線失敗";
  }
}

export function peerConnectionStateLabel(state: ConnectionSnapshot["peerConnectionState"]): string {
  switch (state) {
    case "unavailable": return "尚未建立";
    case "new": return "新建";
    case "connecting": return "連線中";
    case "connected": return "已連線";
    case "disconnected": return "中斷";
    case "failed": return "失敗";
    case "closed": return "已關閉";
  }
}

export function iceConnectionStateLabel(state: ConnectionSnapshot["iceConnectionState"]): string {
  switch (state) {
    case "unavailable": return "尚未建立";
    case "new": return "新建";
    case "checking": return "檢查路徑中";
    case "connected": return "已建立候選路徑";
    case "completed": return "候選檢查完成";
    case "disconnected": return "暫時中斷";
    case "failed": return "失敗";
    case "closed": return "已關閉";
  }
}

export function iceGatheringStateLabel(state: ConnectionSnapshot["iceGatheringState"]): string {
  switch (state) {
    case "unavailable": return "尚未開始";
    case "new": return "尚未開始";
    case "gathering": return "收集候選位址中";
    case "complete": return "收集完成";
  }
}

export function signalingStateLabel(state: ConnectionSnapshot["signalingState"]): string {
  switch (state) {
    case "unavailable": return "尚未建立";
    case "stable": return "stable（穩定）";
    case "have-local-offer": return "have-local-offer（等待 Answer）";
    case "have-remote-offer": return "have-remote-offer（等待本機 Answer）";
    case "have-local-pranswer": return "have-local-pranswer";
    case "have-remote-pranswer": return "have-remote-pranswer";
    case "closed": return "closed";
  }
}

export function dataChannelStateLabel(state: ConnectionSnapshot["dataChannelState"]): string {
  switch (state) {
    case "unavailable": return "尚未建立";
    case "connecting": return "等待開啟";
    case "open": return "已開啟";
    case "closing": return "關閉中";
    case "closed": return "已關閉";
  }
}

function safeMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

/** Return a privacy-safe explanation; never echo browser errors that may contain SDP or ICE. */
function remoteOfferFailureMessage(error: unknown, sdp: string): string {
  const browserMessage = error instanceof Error ? error.message : "";
  if (/a=max-message-size/i.test(browserMessage)) {
    if (/^a=max-message-size:\d+$/m.test(sdp)) {
      return "加入端瀏覽器拒絕 SDP 中的 a=max-message-size 屬性。JSON 解碼後的 SDP 已原樣交給 setRemoteDescription；程式未刪除或改寫該行。請確認雙端瀏覽器版本相容，勿手動刪除此屬性。";
    }
    return "瀏覽器回報 max-message-size，但貼上訊號解碼後未找到有效屬性行。請從發起端重新產生並完整複製 Offer；頁面不會改寫 SDP。";
  }
  return "加入端瀏覽器無法解析 Offer 的 SDP。JSON 格式與必要 DataChannel／ICE 欄位已通過檢查；請確認完整複製、未額外加入文字，並更新雙端瀏覽器。";
}

function waitForIceGatheringComplete(
  peer: RTCPeerConnection,
  timeoutMs: number,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return Promise.reject(new ConnectionCancelledError());
  if (peer.iceGatheringState === "complete") return Promise.resolve();

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const cleanup = () => {
      peer.removeEventListener("icegatheringstatechange", onGatheringChange);
      peer.removeEventListener("connectionstatechange", onConnectionChange);
      signal.removeEventListener("abort", onAbort);
      if (timeout !== null) clearTimeout(timeout);
    };
    const finish = (error?: Error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onGatheringChange = () => {
      if (peer.iceGatheringState === "complete") finish();
    };
    const onConnectionChange = () => {
      if (peer.connectionState === "closed") finish(new Error("連線已在 ICE 收集完成前關閉。請重新建立邀請。"));
    };
    const onAbort = () => finish(new ConnectionCancelledError());

    peer.addEventListener("icegatheringstatechange", onGatheringChange);
    peer.addEventListener("connectionstatechange", onConnectionChange);
    signal.addEventListener("abort", onAbort, { once: true });
    timeout = setTimeout(() => finish(new Error("收集 ICE 候選位址逾時。請檢查網路與 STUN 設定，或稍後重新建立邀請。")), timeoutMs);
    // Guard against state changes between the first check and listener registration.
    onGatheringChange();
    if (signal.aborted) onAbort();
  });
}

export class WebRTCConnectionManager {
  private readonly peerConnectionFactory: PeerConnectionFactory;
  private snapshot: ConnectionSnapshot = { ...INITIAL_SNAPSHOT };
  private readonly listeners = new Set<SnapshotListener>();
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private busy = false;
  private operationId = 0;
  private operationController: AbortController | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private diagnosticsSessionId = 0;
  private statsRequestSequence = 0;
  private latestAppliedStatsSequence = 0;

  constructor(peerConnectionFactory?: PeerConnectionFactory) {
    this.peerConnectionFactory = peerConnectionFactory ?? ((configuration) => {
      if (typeof RTCPeerConnection === "undefined") {
        throw new Error("這個瀏覽器不支援 WebRTC。請改用最新版 Chrome、Edge、Firefox 或 Safari，並使用 HTTPS 網址。");
      }
      return new RTCPeerConnection(configuration);
    });
  }

  getState(): ConnectionSnapshot {
    return {
      ...this.snapshot,
      localCandidateTypes: this.snapshot.localCandidateTypes ? { ...this.snapshot.localCandidateTypes } : null,
      remoteCandidateTypes: this.snapshot.remoteCandidateTypes ? { ...this.snapshot.remoteCandidateTypes } : null,
    };
  }

  subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Return the channel only after the browser reports readyState === "open". */
  getDataChannel(): RTCDataChannel | null {
    return this.channel?.readyState === "open" ? this.channel : null;
  }

  async createOffer(stunInput: string): Promise<string> {
    this.assertIdle();
    const stunServer = validateStunServer(stunInput);
    const operation = this.beginOperation();
    this.publish({ role: "initiator", phase: "creating-offer", detail: "正在建立瀏覽器原生 PeerConnection 與 DataChannel。" });

    try {
      const peer = this.createPeer(stunServer);
      this.channel = peer.createDataChannel("p2p-connection", { ordered: true });
      this.attachChannel(this.channel);

      const offer = await peer.createOffer();
      this.assertOperation(operation.id, peer);
      await peer.setLocalDescription(offer);
      this.assertOperation(operation.id, peer);
      await waitForIceGatheringComplete(peer, ICE_GATHERING_TIMEOUT_MS, operation.signal);
      this.assertOperation(operation.id, peer);
      if (peer.connectionState === "closed") throw new Error("連線在建立邀請時已關閉，請重新嘗試。");
      if (!peer.localDescription) throw new Error("瀏覽器未產生本機 SDP。請中斷後重新建立邀請。");

      const signalingText = serializeSessionDescription(peer.localDescription);
      this.publish({
        phase: "waiting-answer",
        detail: "邀請已備妥。請私下將完整 Offer 傳給加入端；ICE 收集完成不代表兩端已連線。",
      });
      return signalingText;
    } catch (error) {
      if (error instanceof ConnectionCancelledError || operation.id !== this.operationId) {
        throw new ConnectionCancelledError();
      }
      const message = safeMessage(error, "無法建立 Offer。請確認瀏覽器支援 WebRTC、網路可用，再重新嘗試。");
      this.finish("failed", message);
      throw new Error(message);
    } finally {
      this.endOperation(operation.id);
    }
  }

  async createAnswer(offerText: string, stunInput: string): Promise<string> {
    this.assertIdle();
    const offer = parseSessionDescription(offerText, "offer");
    const stunServer = validateStunServer(stunInput);
    const operation = this.beginOperation();
    this.publish({ role: "joiner", phase: "creating-answer", detail: "正在套用 Offer 並建立回覆。" });

    try {
      const peer = this.createPeer(stunServer);
      peer.ondatachannel = (event) => this.attachChannel(event.channel);

      try {
        await peer.setRemoteDescription(offer);
      } catch (error) {
        // Native browser errors can echo private ICE lines; surface only a safe diagnosis.
        throw new Error(remoteOfferFailureMessage(error, offer.sdp ?? ""));
      }
      this.assertOperation(operation.id, peer);
      const answer = await peer.createAnswer();
      this.assertOperation(operation.id, peer);
      await peer.setLocalDescription(answer);
      this.assertOperation(operation.id, peer);
      await waitForIceGatheringComplete(peer, ICE_GATHERING_TIMEOUT_MS, operation.signal);
      this.assertOperation(operation.id, peer);
      if (peer.connectionState === "closed") throw new Error("連線在建立回覆時已關閉，請重新貼上 Offer。");
      if (!peer.localDescription) throw new Error("瀏覽器未產生本機 SDP。請中斷後重新建立回覆。");

      const signalingText = serializeSessionDescription(peer.localDescription);
      this.publish({
        phase: "waiting-peer",
        detail: "回覆已備妥。請私下傳回發起端，等待對方套用 Answer；DataChannel 尚未開啟前不算連線成功。",
      });
      this.syncPeerState();
      this.assertOperation(operation.id, peer);
      return signalingText;
    } catch (error) {
      if (error instanceof ConnectionCancelledError || operation.id !== this.operationId) {
        throw new ConnectionCancelledError();
      }
      const message = safeMessage(error, "無法套用 Offer。請確認它完整、尚未使用，並來自目前這次配對。");
      this.finish("failed", message);
      throw new Error(message);
    } finally {
      this.endOperation(operation.id);
    }
  }

  /** The joiner starts the wait timeout only after manually returning its Answer. */
  confirmAnswerSent(): void {
    const canConfirm = this.snapshot.role === "joiner"
      && (this.snapshot.phase === "waiting-peer" || this.snapshot.phase === "connecting")
      && this.snapshot.localDescriptionSet
      && this.snapshot.remoteDescriptionSet;
    if (!canConfirm) throw new Error("請先成功套用 Offer 並產生 Answer，再確認已傳回發起端。");
    this.startConnectionTimeout();
    this.publish({ detail: "已確認 Answer 傳回發起端；現在開始等待 ICE 路徑與 DataChannel 開啟。" });
  }

  async completeWithAnswer(answerText: string): Promise<void> {
    if (this.snapshot.role !== "initiator" || this.snapshot.phase !== "waiting-answer" || !this.peer) {
      throw new Error("操作順序不正確。請先在發起端建立 Offer，並等候對方回覆。");
    }
    if (this.busy) throw new Error("上一個步驟仍在進行，請稍候再操作。");
    const answer = parseSessionDescription(answerText, "answer");
    const peer = this.peer;
    if (peer.signalingState !== "have-local-offer" || peer.remoteDescription) {
      throw new Error("這個 Answer 不適用於目前的邀請。請確認它來自同一個 Offer，或中斷後重新配對。");
    }

    const operation = this.beginOperation();
    this.publish({ phase: "applying-answer", detail: "正在套用 Answer，等待 ICE 與 DataChannel 狀態更新。" });
    try {
      await peer.setRemoteDescription(answer);
      this.assertOperation(operation.id, peer);
      this.publish({ phase: "connecting", detail: "Answer 已套用；等待 PeerConnection 與 DataChannel 真正連線。" });
      this.startConnectionTimeout();
      this.syncPeerState();
    } catch (error) {
      if (error instanceof ConnectionCancelledError || operation.id !== this.operationId) {
        throw new ConnectionCancelledError();
      }
      const message = "Answer 無法套用。請確認你貼上的是本次 Offer 對應的完整 Answer，且雙端沒有重複使用舊邀請。";
      this.finish("failed", message);
      throw new Error(message);
    } finally {
      this.endOperation(operation.id);
    }
  }

  /** Close all transient session data and return to a clean, reusable state. */
  disconnect(): void {
    this.diagnosticsSessionId += 1;
    this.cancelActiveOperation();
    this.disposeResources();
    this.publish({ ...INITIAL_SNAPSHOT });
  }

  private beginOperation(): { id: number; signal: AbortSignal } {
    this.busy = true;
    const id = ++this.operationId;
    const controller = new AbortController();
    this.operationController = controller;
    return { id, signal: controller.signal };
  }

  private assertOperation(id: number, peer: RTCPeerConnection): void {
    if (id !== this.operationId || peer !== this.peer) throw new ConnectionCancelledError();
  }

  private endOperation(id: number): void {
    if (id !== this.operationId) return;
    this.busy = false;
    this.operationController = null;
  }

  private cancelActiveOperation(): void {
    this.operationId += 1;
    const controller = this.operationController;
    this.operationController = null;
    this.busy = false;
    controller?.abort();
  }

  private assertIdle(): void {
    if (this.busy) throw new Error("操作仍在進行中，請稍候。");
    if (this.peer || this.snapshot.phase !== "idle") {
      throw new Error("目前已有一組連線流程。請先按「中斷連線」再建立新的配對。");
    }
  }

  private createPeer(stunServer: string | null): RTCPeerConnection {
    const configuration: RTCConfiguration = {
      iceServers: stunServer ? [{ urls: stunServer }] : [],
    };
    this.diagnosticsSessionId += 1;
    this.latestAppliedStatsSequence = 0;
    this.peer = this.peerConnectionFactory(configuration);
    this.peer.onconnectionstatechange = () => this.syncPeerState();
    this.peer.oniceconnectionstatechange = () => this.syncPeerState();
    this.peer.onicegatheringstatechange = () => this.syncPeerState();
    this.peer.onsignalingstatechange = () => this.syncPeerState();
    return this.peer;
  }

  private refreshPeerDiagnostics(peer: RTCPeerConnection): void {
    if (typeof peer.getStats !== "function") return;
    const sessionId = this.diagnosticsSessionId;
    const requestSequence = ++this.statsRequestSequence;

    try {
      void peer.getStats().then((report) => {
        if (sessionId !== this.diagnosticsSessionId || requestSequence < this.latestAppliedStatsSequence) return;
        const peerWasCleanedAfterFailure = peer !== this.peer
          && (this.snapshot.phase === "failed" || this.snapshot.phase === "disconnected");
        if (peer !== this.peer && !peerWasCleanedAfterFailure) return;

        this.latestAppliedStatsSequence = requestSequence;
        const summary = summarizePeerStats(report);
        const remoteSdp = peer.remoteDescription?.sdp ?? "";
        const hasRemoteStats = Object.values(summary.remoteCandidateTypes).some((count) => count > 0);
        this.publish({
          ...summary,
          hasRemoteCandidateInformation: /^a=candidate:/m.test(remoteSdp) || hasRemoteStats,
        });
      }).catch(() => {
        // Browser-specific getStats failures must not affect connection state or expose raw stats.
      });
    } catch {
      // Some older browser implementations may throw synchronously from getStats().
    }
  }

  private attachChannel(channel: RTCDataChannel): void {
    if (this.channel && this.channel !== channel) {
      // This page negotiates one channel only. Close unexpected extras rather than
      // inventing an application-level channel protocol.
      channel.close();
      return;
    }
    this.channel = channel;
    const markOpen = () => {
      if (channel.readyState !== "open") return;
      this.clearConnectionTimeout();
      this.publish({ phase: "open", detail: "DataChannel readyState 為 open；目前已確認資料通道開啟。" });
    };
    channel.onopen = markOpen;
    channel.onclose = () => {
      const wasOpen = this.snapshot.phase === "open" || this.snapshot.dataChannelState === "open";
      this.finish("disconnected", wasOpen
        ? "對方已關閉 DataChannel，連線已中斷。"
        : "DataChannel 在開啟前關閉。請確認對方完成協商，再重新配對。");
    };
    channel.onerror = () => {
      this.finish("failed", "DataChannel 發生錯誤。請雙端中斷目前配對，重新交換 Offer／Answer。");
    };
    this.publish({ detail: "已收到 DataChannel，等待其 readyState 變為 open。" });
    markOpen();
  }

  private syncPeerState(): void {
    const peer = this.peer;
    if (!peer) return;
    this.publish({});
    this.refreshPeerDiagnostics(peer);

    if (peer.connectionState === "failed" || peer.iceConnectionState === "failed") {
      const failedStates = [
        peer.iceConnectionState === "failed" ? "ICE connection state=failed" : "",
        peer.connectionState === "failed" ? "PeerConnection state=failed" : "",
      ].filter(Boolean).join("、");
      this.finish("failed", `瀏覽器回報 ${failedStates}；此狀態本身無法區分訊號、ICE 候選或傳輸層原因。請比較雙端 Signaling 與候選診斷，並先在同一 Wi-Fi 測試，再比較不同網路。`);
      return;
    }
    if (peer.connectionState === "closed") {
      this.finish("disconnected", "PeerConnection 已關閉。請按「中斷連線」清除資訊後重新配對。");
      return;
    }
    if (peer.connectionState === "disconnected" || peer.iceConnectionState === "disconnected") {
      if (this.snapshot.phase !== "disconnected") {
        this.publish({ phase: "disconnected", detail: "目前網路路徑中斷；瀏覽器可能自動恢復，若持續中斷可重新配對。" });
      }
      return;
    }
    if (this.channel?.readyState === "open") {
      this.clearConnectionTimeout();
      this.publish({ phase: "open", detail: "DataChannel readyState 為 open；目前已確認資料通道開啟。" });
      return;
    }
    if (peer.connectionState === "connecting" || peer.iceConnectionState === "checking" || peer.connectionState === "connected") {
      if (this.snapshot.phase !== "waiting-answer" && this.snapshot.phase !== "creating-answer") {
        this.publish({ phase: "connecting", detail: "正在檢查可用的點對點路徑，等待 DataChannel 開啟。" });
      }
      if (this.snapshot.role === "joiner" && this.snapshot.connectionTimeoutActive && this.snapshot.phase !== "creating-answer") {
        this.startConnectionTimeout();
      }
    }
  }

  private startConnectionTimeout(): void {
    if (this.connectionTimer !== null) return;
    this.connectionTimer = setTimeout(() => {
      this.connectionTimer = null;
      if (this.snapshot.phase === "open" || this.snapshot.phase === "idle") return;
      this.finish("failed", "等待 DataChannel 開啟逾時。請確認雙端已完成 Offer／Answer 交換，並先比對 ICE 與候選診斷；這個逾時本身不表示一定是 NAT 或 TURN 問題。");
    }, CONNECTION_TIMEOUT_MS);
    this.publish({ connectionTimeoutActive: true });
  }

  private clearConnectionTimeout(): void {
    const wasActive = this.connectionTimer !== null || this.snapshot.connectionTimeoutActive;
    if (this.connectionTimer !== null) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (wasActive) this.publish({ connectionTimeoutActive: false });
  }

  private finish(phase: "disconnected" | "failed", detail: string): void {
    const peer = this.peer;
    const channel = this.channel;
    if (peer) this.refreshPeerDiagnostics(peer);
    const terminalDiagnostics = {
      peerConnectionState: peer?.connectionState ?? this.snapshot.peerConnectionState,
      iceConnectionState: peer?.iceConnectionState ?? this.snapshot.iceConnectionState,
      iceGatheringState: peer?.iceGatheringState ?? this.snapshot.iceGatheringState,
      signalingState: peer?.signalingState ?? this.snapshot.signalingState,
      dataChannelState: channel?.readyState ?? this.snapshot.dataChannelState,
      localDescriptionSet: Boolean(peer?.localDescription) || this.snapshot.localDescriptionSet,
      remoteDescriptionSet: Boolean(peer?.remoteDescription) || this.snapshot.remoteDescriptionSet,
      hasRemoteCandidateInformation: Boolean(peer?.remoteDescription?.sdp && /^a=candidate:/m.test(peer.remoteDescription.sdp))
        || this.snapshot.hasRemoteCandidateInformation,
      connectionTimeoutActive: false,
    };
    this.cancelActiveOperation();
    this.disposeResources();
    this.publish({ phase, detail, ...terminalDiagnostics });
  }

  private disposeResources(): void {
    this.clearConnectionTimeout();
    const channel = this.channel;
    const peer = this.peer;
    this.channel = null;
    this.peer = null;

    if (channel) {
      channel.onopen = null;
      channel.onclose = null;
      channel.onerror = null;
      try {
        if (channel.readyState !== "closed") channel.close();
      } catch {
        // Closing an already-terminated browser object is harmless.
      }
    }
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.onicegatheringstatechange = null;
      peer.onsignalingstatechange = null;
      peer.ondatachannel = null;
      try {
        if (peer.signalingState !== "closed") peer.close();
      } catch {
        // Closing an already-terminated browser object is harmless.
      }
    }
  }

  private publish(patch: Partial<ConnectionSnapshot>): void {
    const peer = this.peer;
    const channel = this.channel;
    const remoteSdp = peer?.remoteDescription?.sdp ?? "";
    const remoteCandidateTypes = patch.remoteCandidateTypes ?? this.snapshot.remoteCandidateTypes;
    const hasRemoteStats = remoteCandidateTypes
      ? Object.values(remoteCandidateTypes).some((count) => count > 0)
      : false;
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      peerConnectionState: peer?.connectionState ?? patch.peerConnectionState ?? this.snapshot.peerConnectionState,
      iceConnectionState: peer?.iceConnectionState ?? patch.iceConnectionState ?? this.snapshot.iceConnectionState,
      iceGatheringState: peer?.iceGatheringState ?? patch.iceGatheringState ?? this.snapshot.iceGatheringState,
      signalingState: peer?.signalingState ?? patch.signalingState ?? this.snapshot.signalingState,
      dataChannelState: channel?.readyState ?? patch.dataChannelState ?? this.snapshot.dataChannelState,
      localDescriptionSet: peer
        ? Boolean(peer.localDescription)
        : patch.localDescriptionSet ?? this.snapshot.localDescriptionSet,
      remoteDescriptionSet: peer
        ? Boolean(peer.remoteDescription)
        : patch.remoteDescriptionSet ?? this.snapshot.remoteDescriptionSet,
      hasRemoteCandidateInformation: peer
        ? /^a=candidate:/m.test(remoteSdp) || hasRemoteStats
        : patch.hasRemoteCandidateInformation ?? this.snapshot.hasRemoteCandidateInformation,
    };
    const current = this.getState();
    this.listeners.forEach((listener) => listener(current));
  }
}
