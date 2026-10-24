"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  WebRTCConnectionManager,
  connectionPhaseLabel,
  type ConnectionSnapshot,
  type DataChannelMessageListener,
} from "@/lib/connection";
import { getSecureRoomTransport, type RoomTransportStatus } from "@/lib/secureRoomTransport";
import { LatestValueSendQueue } from "@/lib/latestValueSendQueue";
import type { PlayerPose } from "@/lib/room3d";
import {
  createParticipantId,
  getRemotePoseForParticipant,
  isPoseSequenceNewer,
  normalizeDisplayName,
  sanitizeDisplayNameInput,
  parseCollaborationMessage,
  resolveRemoteHello,
  serializeCollaborationMessage,
  type CollaborationMessage,
  type GuestRole,
  type RoomParticipant,
  type RoomRole,
} from "@/lib/collaborationProtocol";
import {
  SharedContentChunkAssembler,
  SharedContentReplicator,
  parseSharedContentMessage,
  serializeSharedContentMessage,
  type SharedContentSyncStatus,
} from "@/lib/sharedContent";
import {
  CollaborativeTextEngine,
  getCollaborativeTextAtPath,
  hasCollaborativeTextPathStructure,
  parseCollaborativeEditingMessage,
  serializeCollaborativeEditingMessage,
  type CollaborativeEditingMessage,
  type CollaborativeTextChange,
  type CollaborativeTextOperationsMessage,
  type RemoteEditingPresence,
} from "@/lib/collaborationEditing";
import {
  applyCollaborativeTextUpdate as applyTextUpdateToStore,
  applySharedContentOperations,
  getState,
  setCollaborationReadOnly,
  subscribe,
} from "@/lib/store";

export type { GuestRole, RoomParticipant, RoomRole } from "@/lib/collaborationProtocol";

export interface SignalingDrafts {
  offerOutput: string;
  offerInput: string;
  answerOutput: string;
  answerInput: string;
}

const EMPTY_SIGNALING_DRAFTS: SignalingDrafts = {
  offerOutput: "",
  offerInput: "",
  answerOutput: "",
  answerInput: "",
};

interface LocalEditingPresence {
  cardId: string;
  path: string;
  position: number;
  selectionEnd: number;
  typing: boolean;
  active: boolean;
}

interface CollaborationContextValue {
  manager: WebRTCConnectionManager;
  snapshot: ConnectionSnapshot;
  webrtcSnapshot: ConnectionSnapshot;
  relayRoomActive: boolean;
  transportMode: "webrtc" | "relay" | null;
  displayName: string;
  setDisplayName: (name: string) => void;
  guestRole: GuestRole;
  setGuestRole: (role: GuestRole) => void;
  localRole: RoomRole | null;
  remoteParticipant: RoomParticipant | null;
  contentSyncStatus: SharedContentSyncStatus;
  canCollaborateOnText: boolean;
  applyCollaborativeTextChange: (cardId: string, path: string, previousValue: string, nextValue: string) => string;
  getCollaborativeTextSnapshot: (cardId: string) => Array<{ path: string; value: string }>;
  subscribeCollaborativeText: (listener: (update: CollaborativeTextChange) => void) => () => void;
  publishEditingPresence: (presence: LocalEditingPresence) => void;
  getRemoteEditingPresence: () => RemoteEditingPresence[];
  subscribeRemoteEditing: (listener: () => void) => () => void;
  remotePoseRef: React.MutableRefObject<PlayerPose>;
  signalingDrafts: SignalingDrafts;
  setSignalingDraft: (key: keyof SignalingDrafts, value: string) => void;
  clearSignalingDrafts: () => void;
  preparePairing: () => void;
  disconnect: () => void;
  sendDataMessage: (data: string) => boolean;
  subscribeDataMessages: (listener: DataChannelMessageListener) => () => void;
  publishPose: (pose: PlayerPose) => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);
const PROFILE_STORAGE_KEY = "scinotes-collaboration-profile-v1";
const POSE_SEND_INTERVAL_MS = 50;
const RELAY_POSE_SEND_INTERVAL_MS = 50;
const MAX_RELAY_POSE_SENDS_IN_FLIGHT = 8;
const REMOTE_POSE_STALE_MS = 6_000;
const REMOTE_EDITING_STALE_MS = 8_000;
const EDITING_PRESENCE_SEND_INTERVAL_MS = 75;

const HIDDEN_POSE: PlayerPose = {
  x: 0,
  z: 0,
  eyeY: 1.5,
  jumpOffset: 0,
  yaw: 0,
  pitch: 0,
  moving: false,
  onGround: true,
  seated: false,
  visible: false,
  holding: false,
};

export function useCollaboration(): CollaborationContextValue {
  const context = useContext(CollaborationContext);
  if (!context) throw new Error("useCollaboration 必須在 CollaborationProvider 內使用。");
  return context;
}

function CrossPageConnectionNotice({
  snapshot,
  localRole,
  remoteParticipant,
  contentSyncStatus,
  transportMode,
}: {
  snapshot: ConnectionSnapshot;
  localRole: RoomRole | null;
  remoteParticipant: RoomParticipant | null;
  contentSyncStatus: SharedContentSyncStatus;
  transportMode: "webrtc" | "relay" | null;
}) {
  const pathname = usePathname();
  if (pathname?.replace(/\/+$/, "").endsWith("/connect") || snapshot.phase === "idle") return null;

  const connected = snapshot.phase === "open";
  const linkLabel = transportMode === "relay" ? "加密 relay" : "P2P";
  const roleLabel = (role: RoomRole | null) => role === "owner"
    ? "房主"
    : role === "reader"
      ? "唯讀"
      : role === "editor"
        ? "可編輯"
        : "等待權限";
  const participantLabel = remoteParticipant
    ? `${remoteParticipant.name} · ${roleLabel(remoteParticipant.role)}`
    : "等待對方資料";
  return (
    <aside
      className={`fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur ${
        connected ? "border-emerald-300 bg-emerald-50/95 text-emerald-950" : "border-sky-300 bg-white/95 text-slate-900"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold">{connected ? `${linkLabel} 已連線 · ${participantLabel}` : `${linkLabel}：${connectionPhaseLabel(snapshot.phase)}`}</p>
        <p className="truncate text-[11px] opacity-80">
          {connected
            ? `你是${roleLabel(localRole)}；書本／筆記卡與畫布位置${contentSyncStatus === "synced" ? "已同步" : contentSyncStatus === "error" ? "同步失敗" : "同步中"}；卡片文字可即時合併並顯示遠端游標。切換頁面不會中斷。`
            : "切換頁面不會取消目前配對流程。"}
        </p>
      </div>
      <Link href="/connect/" className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
        連線管理
      </Link>
    </aside>
  );
}

function isSharedCollaborationPayload(data: string): boolean {
  if (parseSharedContentMessage(data) || parseCollaborativeEditingMessage(data)) return true;
  try {
    return JSON.parse(data)?.type === "shared-chunk";
  } catch {
    return false;
  }
}

function makeRelaySnapshot(status: RoomTransportStatus): ConnectionSnapshot {
  return {
    role: status.localRole === "owner" ? "initiator" : "joiner",
    phase: status.connectedBrokerCount > 0 ? "open" : "disconnected",
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
    detail: status.connectedBrokerCount > 0
      ? "書樓協作目前透過加密 WSS relay 傳輸；這不是 WebRTC DataChannel 直連。"
      : "加密 relay 目前沒有可用 broker；書樓協作暫停。",
  };
}

export function CollaborationProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new WebRTCConnectionManager());
  const [webrtcSnapshot, setWebrtcSnapshot] = useState<ConnectionSnapshot>(() => manager.getState());
  const [relayTransport] = useState(() => getSecureRoomTransport());
  const [relayStatus, setRelayStatus] = useState<RoomTransportStatus>(() => relayTransport.getStatus());
  const relayRoomActive = relayStatus.roomReady && relayStatus.localRole !== null;
  const snapshot = useMemo(
    () => relayRoomActive ? makeRelaySnapshot(relayStatus) : webrtcSnapshot,
    [relayRoomActive, relayStatus, webrtcSnapshot]
  );
  const transportMode: "webrtc" | "relay" | null = relayRoomActive
    ? "relay"
    : webrtcSnapshot.phase === "idle"
      ? null
      : "webrtc";
  const [displayName, setDisplayNameState] = useState("書房夥伴");
  const [guestRole, setGuestRole] = useState<GuestRole>("editor");
  const [sessionParticipantId, setSessionParticipantId] = useState<string | null>(null);
  const [assignedGuestRole, setAssignedGuestRole] = useState<GuestRole | null>(null);
  const [remoteParticipantState, setRemoteParticipantState] = useState<RoomParticipant | null>(null);
  const [contentSyncStatus, setContentSyncStatus] = useState<SharedContentSyncStatus>("idle");
  // Stable imperative holders avoid React renders for frequent pose frames and DataChannel messages.
  const [remotePoseRef] = useState<React.MutableRefObject<PlayerPose>>(() => ({ current: { ...HIDDEN_POSE } }));
  const sharedContentSyncRef = useRef<SharedContentReplicator | null>(null);
  const collaborativeTextEngineRef = useRef<CollaborativeTextEngine | null>(null);
  const contentChunkAssemblerRef = useRef(new SharedContentChunkAssembler());
  const pendingSharedMessagesRef = useRef<string[]>([]);
  const pendingEditingMessagesRef = useRef<CollaborativeTextOperationsMessage[]>([]);
  const collaborativeTextListenersRef = useRef(new Set<(update: CollaborativeTextChange) => void>());
  const remoteEditingPresenceRef = useRef(new Map<string, RemoteEditingPresence>());
  const remoteEditingListenersRef = useRef(new Set<() => void>());
  const lastEditingPresenceSentAtRef = useRef(0);
  const pendingEditingPresenceRef = useRef<LocalEditingPresence | null>(null);
  const editingPresenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotRef = useRef(snapshot);
  const relaySendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [relayPoseSendQueue] = useState(() => new LatestValueSendQueue<string>(
    (pose) => relayTransport.send(pose, { route: "relay", acknowledgementPolicy: "first" }),
    MAX_RELAY_POSE_SENDS_IN_FLIGHT
  ));
  const relaySessionGenerationRef = useRef(0);
  const relaySessionActiveRef = useRef(false);
  const sessionParticipantIdRef = useRef<string | null>(null);
  const guestRoleRef = useRef<GuestRole>("editor");
  const localRoleRef = useRef<RoomRole | null>(null);
  const remoteParticipantRef = useRef<RoomParticipant | null>(null);
  const previousHelloProfileRef = useRef({ displayName, guestRole });
  const [signalingDrafts, setSignalingDrafts] = useState<SignalingDrafts>({ ...EMPTY_SIGNALING_DRAFTS });
  const lastPoseSentAtRef = useRef(0);
  const poseSequenceRef = useRef(0);
  const lastRemotePoseSequenceRef = useRef<number | null>(null);
  const lastRemotePoseAtRef = useRef(0);

  useEffect(() => {
    if (relayRoomActive) snapshotRef.current = snapshot;
  }, [relayRoomActive, snapshot]);

  const activeSession = snapshot.phase !== "idle" && snapshot.phase !== "failed" && snapshot.phase !== "disconnected";
  const localRole: RoomRole | null = !activeSession
    ? null
    : snapshot.role === "initiator"
      ? "owner"
      : snapshot.role === "joiner"
        ? assignedGuestRole ?? "pending"
        : null;
  const remoteParticipant = snapshot.phase === "open" ? remoteParticipantState : null;
  const canCollaborateOnText = snapshot.phase === "open"
    && contentSyncStatus === "synced"
    && (localRole === "owner" || localRole === "editor");

  const sendDataMessage = useCallback((data: string) => {
    const status = relayTransport.getStatus();
    if (status.roomReady && status.localRole) {
      if (status.connectedBrokerCount === 0 || status.state === "leaving") return false;
      const collaborationMessage = parseCollaborationMessage(data);
      if (collaborationMessage?.type === "pose") {
        if (!remoteParticipantRef.current || collaborationMessage.participantId !== sessionParticipantIdRef.current) return false;
        relayPoseSendQueue.enqueue(data);
        return true;
      }

      const generation = relaySessionGenerationRef.current;
      const queuedSend = relaySendQueueRef.current.then(async () => {
        const latestStatus = relayTransport.getStatus();
        if (generation !== relaySessionGenerationRef.current
          || !latestStatus.roomReady
          || !latestStatus.localRole
          || latestStatus.connectedBrokerCount === 0
          || latestStatus.state === "leaving") {
          throw new Error("relay session is no longer active");
        }
        await relayTransport.send(data, { route: "relay" });
      });
      relaySendQueueRef.current = queuedSend.catch(() => {
        if (generation === relaySessionGenerationRef.current && isSharedCollaborationPayload(data)) {
          setContentSyncStatus("error");
        }
      });
      return true;
    }
    return manager.sendDataMessage(data);
  }, [manager, relayPoseSendQueue, relayTransport]);

  const subscribeDataMessages = useCallback((listener: DataChannelMessageListener) => {
    const unsubscribeWebRTC = manager.subscribeDataMessages(listener);
    const unsubscribeRelay = relayTransport.on("message", (event) => listener(event.payload));
    return () => {
      unsubscribeWebRTC();
      unsubscribeRelay();
    };
  }, [manager, relayTransport]);

  const notifyRemoteEditingListeners = useCallback(() => {
    remoteEditingListenersRef.current.forEach((listener) => listener());
  }, []);
  const getRemoteEditingPresence = useCallback(() => Array.from(remoteEditingPresenceRef.current.values()), []);
  const subscribeRemoteEditing = useCallback((listener: () => void) => {
    remoteEditingListenersRef.current.add(listener);
    return () => { remoteEditingListenersRef.current.delete(listener); };
  }, []);
  const subscribeCollaborativeText = useCallback((listener: (update: CollaborativeTextChange) => void) => {
    collaborativeTextListenersRef.current.add(listener);
    return () => { collaborativeTextListenersRef.current.delete(listener); };
  }, []);
  const restoreCollaborativeTextSnapshots = useCallback(() => {
    const engine = collaborativeTextEngineRef.current;
    if (!engine) return;
    for (const card of getState().cards) {
      for (const update of engine.getSnapshot(card.id)) {
        const currentCard = getState().cards.find((item) => item.id === card.id);
        if (!currentCard || !hasCollaborativeTextPathStructure(currentCard, update.path)) continue;
        if (getCollaborativeTextAtPath(currentCard, update.path) !== update.value) {
          applyTextUpdateToStore(card.id, update.path, update.value);
        }
      }
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(PROFILE_STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved) as { name?: unknown };
        if (typeof parsed.name === "string") setDisplayNameState(normalizeDisplayName(parsed.name));
      } catch {
        // An invalid optional profile is ignored; no collaboration content is stored here.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setDisplayName = useCallback((value: string) => {
    const input = sanitizeDisplayNameInput(value);
    setDisplayNameState(input);
    try {
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: normalizeDisplayName(input) }));
    } catch {
      // The name is session-local if the browser blocks local storage.
    }
  }, []);

  const setSignalingDraft = useCallback((key: keyof SignalingDrafts, value: string) => {
    setSignalingDrafts((current) => ({ ...current, [key]: value }));
  }, []);
  const clearSignalingDrafts = useCallback(() => setSignalingDrafts({ ...EMPTY_SIGNALING_DRAFTS }), []);

  useEffect(() => {
    const unsubscribe = manager.subscribe((next) => {
      setWebrtcSnapshot(next);
      if (!relaySessionActiveRef.current) snapshotRef.current = next;
    });
    return () => {
      unsubscribe();
      // Only the root provider owns the connection lifetime. Route changes do not unmount it.
      manager.disconnect();
    };
  }, [manager]);

  useEffect(() => relayTransport.on("status", setRelayStatus), [relayTransport]);

  useEffect(() => {
    guestRoleRef.current = guestRole;
  }, [guestRole]);

  useEffect(() => {
    localRoleRef.current = localRole;
    remoteParticipantRef.current = remoteParticipantState;
    sharedContentSyncRef.current?.permissionsChanged();
  }, [localRole, remoteParticipantState]);

  useEffect(() => {
    const waitingForHostRole = snapshot.phase === "open" && localRole !== "owner" && localRole !== "editor" && localRole !== "reader";
    const contentSyncInProgress = snapshot.phase === "open"
      && remoteParticipant !== null
      && contentSyncStatus !== "synced"
      && contentSyncStatus !== "error";
    setCollaborationReadOnly(snapshot.phase === "open" && (
      localRole === "reader" || waitingForHostRole || contentSyncInProgress
    ));
  }, [snapshot.phase, localRole, remoteParticipant, contentSyncStatus]);

  useEffect(() => () => setCollaborationReadOnly(false), []);

  useEffect(() => {
    if (snapshot.phase !== "open") {
      remotePoseRef.current = { ...remotePoseRef.current, moving: false, visible: false };
      if (remoteEditingPresenceRef.current.size) {
        remoteEditingPresenceRef.current.clear();
        notifyRemoteEditingListeners();
      }
      return;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [actorId, presence] of remoteEditingPresenceRef.current) {
        if (now - presence.updatedAt > REMOTE_EDITING_STALE_MS) {
          remoteEditingPresenceRef.current.delete(actorId);
          changed = true;
        }
      }
      if (changed) notifyRemoteEditingListeners();
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot.phase, notifyRemoteEditingListeners, remotePoseRef]);

  const resetCollaborativeEditing = useCallback(() => {
    collaborativeTextEngineRef.current?.stop();
    collaborativeTextEngineRef.current = null;
    pendingEditingMessagesRef.current = [];
    remoteEditingPresenceRef.current.clear();
    pendingEditingPresenceRef.current = null;
    if (editingPresenceTimerRef.current) clearTimeout(editingPresenceTimerRef.current);
    editingPresenceTimerRef.current = null;
    notifyRemoteEditingListeners();
  }, [notifyRemoteEditingListeners]);

  const preparePairing = useCallback(() => {
    relaySessionGenerationRef.current += 1;
    relaySendQueueRef.current = Promise.resolve();
    relayPoseSendQueue.clear();
    sharedContentSyncRef.current?.stop();
    sharedContentSyncRef.current = null;
    resetCollaborativeEditing();
    contentChunkAssemblerRef.current.clear();
    pendingSharedMessagesRef.current = [];
    localRoleRef.current = null;
    remoteParticipantRef.current = null;
    setContentSyncStatus("idle");
    const participantId = createParticipantId();
    sessionParticipantIdRef.current = participantId;
    setSessionParticipantId(participantId);
    setAssignedGuestRole(null);
    setRemoteParticipantState(null);
    remotePoseRef.current = { ...HIDDEN_POSE };
    lastPoseSentAtRef.current = 0;
    poseSequenceRef.current = 0;
    lastRemotePoseSequenceRef.current = null;
    lastRemotePoseAtRef.current = 0;
  }, [remotePoseRef, relayPoseSendQueue, resetCollaborativeEditing]);

  const disconnect = useCallback(() => {
    relaySessionGenerationRef.current += 1;
    relaySendQueueRef.current = Promise.resolve();
    relayPoseSendQueue.clear();
    sharedContentSyncRef.current?.stop();
    sharedContentSyncRef.current = null;
    resetCollaborativeEditing();
    contentChunkAssemblerRef.current.clear();
    pendingSharedMessagesRef.current = [];
    localRoleRef.current = null;
    remoteParticipantRef.current = null;
    sessionParticipantIdRef.current = null;
    setContentSyncStatus("idle");
    manager.disconnect();
    void relayTransport.leave();
    setSessionParticipantId(null);
    setAssignedGuestRole(null);
    setRemoteParticipantState(null);
    setSignalingDrafts({ ...EMPTY_SIGNALING_DRAFTS });
    remotePoseRef.current = { ...HIDDEN_POSE };
    lastPoseSentAtRef.current = 0;
    poseSequenceRef.current = 0;
    lastRemotePoseSequenceRef.current = null;
    lastRemotePoseAtRef.current = 0;
  }, [manager, relayPoseSendQueue, relayTransport, remotePoseRef, resetCollaborativeEditing]);

  useEffect(() => {
    const wasActive = relaySessionActiveRef.current;
    if (relayRoomActive && !wasActive) {
      relaySessionActiveRef.current = true;
      manager.disconnect();
      preparePairing();
    } else if (!relayRoomActive && wasActive) {
      relaySessionActiveRef.current = false;
      disconnect();
    }
  }, [relayRoomActive, manager, preparePairing, disconnect]);

  useEffect(() => {
    const unsubscribe = relayTransport.on("peers", (peers) => {
      const status = relayTransport.getStatus();
      if (!relayRoomActive || !status.roomReady || !status.localRole || peers.length > 0 || !remoteParticipantRef.current) return;
      preparePairing();
    });
    return unsubscribe;
  }, [relayTransport, relayRoomActive, preparePairing]);

  const hasRemoteParticipant = remoteParticipant !== null;

  useEffect(() => {
    if (snapshot.phase !== "open" || !snapshot.role || !sessionParticipantId || hasRemoteParticipant) return;
    const sendHello = () => {
      const role: "owner" | "pending" = snapshot.role === "initiator" ? "owner" : "pending";
      const message: CollaborationMessage = {
        v: 1,
        type: "hello",
        participantId: sessionParticipantId,
        name: normalizeDisplayName(displayName),
        role,
        ...(snapshot.role === "initiator" ? { guestRole } : {}),
      };
      sendDataMessage(serializeCollaborationMessage(message));
    };
    sendHello();
    if (transportMode !== "relay") return;
    const timer = window.setInterval(sendHello, 3_000);
    return () => window.clearInterval(timer);
  }, [sendDataMessage, snapshot.phase, snapshot.role, sessionParticipantId, displayName, guestRole, transportMode, hasRemoteParticipant]);

  useEffect(() => {
    const previousProfile = previousHelloProfileRef.current;
    previousHelloProfileRef.current = { displayName, guestRole };
    if (!hasRemoteParticipant
      || (previousProfile.displayName === displayName && previousProfile.guestRole === guestRole)
      || snapshot.phase !== "open"
      || !snapshot.role
      || !sessionParticipantId) return;
    const role: "owner" | "pending" = snapshot.role === "initiator" ? "owner" : "pending";
    const message: CollaborationMessage = {
      v: 1,
      type: "hello",
      participantId: sessionParticipantId,
      name: normalizeDisplayName(displayName),
      role,
      ...(snapshot.role === "initiator" ? { guestRole } : {}),
    };
    sendDataMessage(serializeCollaborationMessage(message));
  }, [sendDataMessage, snapshot.phase, snapshot.role, sessionParticipantId, displayName, guestRole, hasRemoteParticipant]);

  useEffect(() => {
    if (snapshot.phase !== "open" || !snapshot.role || !sessionParticipantId) {
      sharedContentSyncRef.current?.stop();
      sharedContentSyncRef.current = null;
      contentChunkAssemblerRef.current.clear();
      pendingSharedMessagesRef.current = [];
      return;
    }

    const replicator = new SharedContentReplicator({
      actorId: sessionParticipantId,
      getState,
      subscribe,
      applyOperations: applySharedContentOperations,
      send: (message) => {
        const frames = serializeSharedContentMessage(message);
        if (!frames) return false;
        for (const frame of frames) {
          if (!sendDataMessage(frame)) return false;
        }
        return true;
      },
      getLocalRole: () => localRoleRef.current ?? "pending",
      getRemoteRole: () => remoteParticipantRef.current?.role ?? null,
      getRemoteActorId: () => remoteParticipantRef.current?.id ?? null,
      onStatus: setContentSyncStatus,
    });
    sharedContentSyncRef.current = replicator;
    replicator.start(snapshot.role === "initiator" ? "owner" : "joiner");
    for (const message of pendingSharedMessagesRef.current.splice(0)) replicator.handleRaw(message);
    restoreCollaborativeTextSnapshots();

    return () => {
      replicator.stop();
      if (sharedContentSyncRef.current === replicator) sharedContentSyncRef.current = null;
    };
  }, [sendDataMessage, restoreCollaborativeTextSnapshots, snapshot.phase, snapshot.role, sessionParticipantId]);

  useEffect(() => {
    if (snapshot.phase !== "open" || !sessionParticipantId) return;
    const engine = new CollaborativeTextEngine({
      actorId: sessionParticipantId,
      getBaseline: (cardId, path) => {
        const card = getState().cards.find((item) => item?.id === cardId);
        return getCollaborativeTextAtPath(card, path) ?? "";
      },
      send: (message) => {
        const frames = serializeCollaborativeEditingMessage(message);
        if (!frames) return false;
        for (const frame of frames) {
          if (!sendDataMessage(frame)) return false;
        }
        return true;
      },
      onUpdate: (update) => {
        const card = getState().cards.find((item) => item.id === update.cardId);
        if (card && hasCollaborativeTextPathStructure(card, update.path)) {
          applyTextUpdateToStore(update.cardId, update.path, update.value);
        }
        collaborativeTextListenersRef.current.forEach((listener) => listener(update));
      },
    });
    collaborativeTextEngineRef.current = engine;
    for (const message of pendingEditingMessagesRef.current.splice(0)) {
      const remote = remoteParticipantRef.current;
      if (remote && (remote.role === "owner" || remote.role === "editor")) engine.receive(message, remote.id);
    }

    return () => {
      engine.stop();
      if (collaborativeTextEngineRef.current === engine) collaborativeTextEngineRef.current = null;
    };
  }, [sendDataMessage, snapshot.phase, sessionParticipantId]);

  useEffect(() => {
    const handlePayload = (payload: unknown) => {
      const sync = sharedContentSyncRef.current;
      const sharedMessage = parseSharedContentMessage(payload);
      if (sync?.handleRaw(payload)) {
        if (sharedMessage) restoreCollaborativeTextSnapshots();
        return;
      }
      if (sharedMessage) {
        if (pendingSharedMessagesRef.current.length < 4 && typeof payload === "string") {
          pendingSharedMessagesRef.current.push(payload);
        }
        return;
      }

      const editingMessage = parseCollaborativeEditingMessage(payload);
      const currentSnapshot = snapshotRef.current;
      const currentParticipantId = sessionParticipantIdRef.current;
      const remote = remoteParticipantRef.current;
      if (editingMessage) {
        if (!currentParticipantId || editingMessage.actorId === currentParticipantId || currentSnapshot.phase !== "open") return;
        if (!remote || remote.id !== editingMessage.actorId || (remote.role !== "owner" && remote.role !== "editor")) return;
        if (editingMessage.type === "text-operations") {
          const engine = collaborativeTextEngineRef.current;
          if (engine) engine.receive(editingMessage, remote.id);
          else if (pendingEditingMessagesRef.current.length < 128) pendingEditingMessagesRef.current.push(editingMessage);
          return;
        }
        if (!editingMessage.active) {
          if (remoteEditingPresenceRef.current.delete(editingMessage.actorId)) notifyRemoteEditingListeners();
          return;
        }
        remoteEditingPresenceRef.current.set(editingMessage.actorId, {
          participantId: editingMessage.actorId,
          name: remote.name,
          cardId: editingMessage.cardId,
          path: editingMessage.path,
          position: collaborativeTextEngineRef.current?.resolveCursorPosition(
            editingMessage.cardId,
            editingMessage.path,
            editingMessage.anchorId,
            editingMessage.position
          ) ?? editingMessage.position,
          selectionEnd: editingMessage.selectionEnd,
          anchorId: editingMessage.anchorId,
          typing: editingMessage.typing,
          active: editingMessage.active,
          updatedAt: Date.now(),
        });
        notifyRemoteEditingListeners();
        return;
      }

      const message = parseCollaborationMessage(payload);
      if (!message || !currentParticipantId || message.participantId === currentParticipantId || currentSnapshot.phase !== "open") return;

    if (message.type === "hello") {
      if (currentSnapshot.role !== "initiator" && currentSnapshot.role !== "joiner") return;
      const currentGuestRole = guestRoleRef.current;
      const previousParticipant = remoteParticipantRef.current;
      const hello = resolveRemoteHello(currentSnapshot.role, currentGuestRole, previousParticipant, message);
      if (!hello) return;
      if (hello.didChange) {
        if (hello.isNewParticipant) {
          lastRemotePoseSequenceRef.current = null;
          lastRemotePoseAtRef.current = 0;
          remotePoseRef.current = { ...HIDDEN_POSE };
        }
        remoteParticipantRef.current = hello.participant;
        setRemoteParticipantState(hello.participant);
      }
      if (currentSnapshot.role === "initiator") {
        // Reply to repeated hello for handshake recovery; the replicator de-duplicates snapshots per peer.
        sendDataMessage(serializeCollaborationMessage({
          v: 1,
          type: "hello",
          participantId: currentParticipantId,
          name: normalizeDisplayName(displayName),
          role: "owner",
          guestRole: currentGuestRole,
        }));
        sendDataMessage(serializeCollaborationMessage({
          v: 1,
          type: "role",
          participantId: currentParticipantId,
          role: currentGuestRole,
        }));
        sharedContentSyncRef.current?.resendSnapshot();
      } else if (message.guestRole && localRoleRef.current !== message.guestRole) {
        localRoleRef.current = message.guestRole;
        setAssignedGuestRole(message.guestRole);
        sharedContentSyncRef.current?.permissionsChanged();
      }
      return;
    }

    if (message.type === "role") {
      if (currentSnapshot.role === "joiner" && remoteParticipantRef.current?.id === message.participantId) {
        localRoleRef.current = message.role;
        setAssignedGuestRole(message.role);
        sharedContentSyncRef.current?.permissionsChanged();
      }
      return;
    }

      const remotePose = getRemotePoseForParticipant(message, remoteParticipantRef.current?.id ?? null);
      if (remotePose) {
        if (message.type === "pose" && message.sequence !== undefined) {
          if (!isPoseSequenceNewer(message.sequence, lastRemotePoseSequenceRef.current)) return;
          lastRemotePoseSequenceRef.current = message.sequence;
        }
        remotePoseRef.current = remotePose;
        lastRemotePoseAtRef.current = Date.now();
      }
    };

    const unsubscribe = subscribeDataMessages((raw) => {
      const chunk = contentChunkAssemblerRef.current.accept(raw);
      if (chunk.handled) {
        if (chunk.message) handlePayload(chunk.message);
        return;
      }
      handlePayload(raw);
    });
    return unsubscribe;
  }, [subscribeDataMessages, sendDataMessage, displayName, notifyRemoteEditingListeners, remotePoseRef, restoreCollaborativeTextSnapshots]);

  useEffect(() => {
    if (snapshot.phase !== "open") return;
    const timer = window.setInterval(() => {
      if (lastRemotePoseAtRef.current && Date.now() - lastRemotePoseAtRef.current > REMOTE_POSE_STALE_MS) {
        remotePoseRef.current = { ...remotePoseRef.current, moving: false, visible: false };
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot.phase, remotePoseRef]);

  const publishPose = useCallback((pose: PlayerPose) => {
    if (snapshot.phase !== "open" || !sessionParticipantId || !remoteParticipantRef.current) return;
    const now = performance.now();
    const sendInterval = transportMode === "relay" ? RELAY_POSE_SEND_INTERVAL_MS : POSE_SEND_INTERVAL_MS;
    if (now - lastPoseSentAtRef.current < sendInterval) return;
    lastPoseSentAtRef.current = now;
    poseSequenceRef.current += 1;
    sendDataMessage(serializeCollaborationMessage({
      v: 1,
      type: "pose",
      participantId: sessionParticipantId,
      sequence: poseSequenceRef.current,
      pose: {
        x: pose.x,
        z: pose.z,
        eyeY: pose.eyeY,
        floorY: pose.floorY ?? 0,
        jumpOffset: pose.jumpOffset,
        yaw: pose.yaw,
        pitch: pose.pitch,
        moving: pose.moving,
        sprinting: pose.sprinting === true,
        onGround: pose.onGround,
        seated: pose.seated,
        visible: pose.visible,
        holding: !!pose.holding,
      },
    }));
  }, [sendDataMessage, snapshot.phase, sessionParticipantId, transportMode]);

  const applyCollaborativeTextChange = useCallback((cardId: string, path: string, previousValue: string, nextValue: string) => {
    if (!canCollaborateOnText) return nextValue;
    const engine = collaborativeTextEngineRef.current;
    if (!engine) return nextValue;
    const mergedValue = engine.applyLocalChange(cardId, path, previousValue, nextValue);
    applyTextUpdateToStore(cardId, path, mergedValue);
    return mergedValue;
  }, [canCollaborateOnText]);

  const getCollaborativeTextSnapshot = useCallback((cardId: string) =>
    collaborativeTextEngineRef.current?.getSnapshot(cardId) ?? [], []);

  const sendPresenceMessage = useCallback((presence: LocalEditingPresence) => {
    if (!canCollaborateOnText || !sessionParticipantId) return;
    const message: CollaborativeEditingMessage = {
      v: 1,
      type: "editing-presence",
      actorId: sessionParticipantId,
      cardId: presence.cardId,
      path: presence.path,
      position: Math.max(0, Math.floor(presence.position)),
      selectionEnd: Math.max(0, Math.floor(presence.selectionEnd)),
      anchorId: collaborativeTextEngineRef.current?.getCursorAnchor(presence.cardId, presence.path, presence.position) ?? null,
      typing: presence.typing,
      active: presence.active,
    };
    const frames = serializeCollaborativeEditingMessage(message);
    if (!frames) return;
    for (const frame of frames) {
      if (!sendDataMessage(frame)) break;
    }
    lastEditingPresenceSentAtRef.current = performance.now();
  }, [canCollaborateOnText, sendDataMessage, sessionParticipantId]);

  const publishEditingPresence = useCallback((presence: LocalEditingPresence) => {
    if (!canCollaborateOnText || !sessionParticipantId) return;
    if (!presence.active) {
      if (editingPresenceTimerRef.current) clearTimeout(editingPresenceTimerRef.current);
      editingPresenceTimerRef.current = null;
      pendingEditingPresenceRef.current = null;
      sendPresenceMessage(presence);
      return;
    }
    pendingEditingPresenceRef.current = presence;
    const elapsed = performance.now() - lastEditingPresenceSentAtRef.current;
    const sendInterval = transportMode === "relay" ? 250 : EDITING_PRESENCE_SEND_INTERVAL_MS;
    if (elapsed >= sendInterval) {
      pendingEditingPresenceRef.current = null;
      sendPresenceMessage(presence);
      return;
    }
    if (!editingPresenceTimerRef.current) {
      editingPresenceTimerRef.current = setTimeout(() => {
        editingPresenceTimerRef.current = null;
        const pending = pendingEditingPresenceRef.current;
        pendingEditingPresenceRef.current = null;
        if (pending) sendPresenceMessage(pending);
      }, Math.max(0, sendInterval - elapsed));
    }
  }, [canCollaborateOnText, sendPresenceMessage, sessionParticipantId, transportMode]);

  const contextValue = useMemo(() => ({
    manager,
    snapshot,
    webrtcSnapshot,
    relayRoomActive,
    transportMode,
    displayName,
    setDisplayName,
    guestRole,
    setGuestRole,
    localRole,
    remoteParticipant,
    contentSyncStatus,
    canCollaborateOnText,
    applyCollaborativeTextChange,
    getCollaborativeTextSnapshot,
    subscribeCollaborativeText,
    publishEditingPresence,
    getRemoteEditingPresence,
    subscribeRemoteEditing,
    remotePoseRef,
    signalingDrafts,
    setSignalingDraft,
    clearSignalingDrafts,
    preparePairing,
    disconnect,
    sendDataMessage,
    subscribeDataMessages,
    publishPose,
  }), [manager, snapshot, webrtcSnapshot, relayRoomActive, transportMode, displayName, setDisplayName, guestRole, localRole, remoteParticipant, contentSyncStatus, canCollaborateOnText, applyCollaborativeTextChange, getCollaborativeTextSnapshot, subscribeCollaborativeText, publishEditingPresence, getRemoteEditingPresence, subscribeRemoteEditing, remotePoseRef, signalingDrafts, setSignalingDraft, clearSignalingDrafts, preparePairing, disconnect, sendDataMessage, subscribeDataMessages, publishPose]);

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
      <CrossPageConnectionNotice snapshot={snapshot} localRole={localRole} remoteParticipant={remoteParticipant} contentSyncStatus={contentSyncStatus} transportMode={transportMode} />
    </CollaborationContext.Provider>
  );
}
