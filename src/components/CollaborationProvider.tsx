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
import type { PlayerPose } from "@/lib/room3d";
import {
  createParticipantId,
  normalizeDisplayName,
  sanitizeDisplayNameInput,
  parseCollaborationMessage,
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
}: {
  snapshot: ConnectionSnapshot;
  localRole: RoomRole | null;
  remoteParticipant: RoomParticipant | null;
  contentSyncStatus: SharedContentSyncStatus;
}) {
  const pathname = usePathname();
  if (pathname?.replace(/\/+$/, "").endsWith("/connect") || snapshot.phase === "idle") return null;

  const connected = snapshot.phase === "open";
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
        <p className="text-sm font-bold">{connected ? `P2P 已連線 · ${participantLabel}` : `P2P 連線：${connectionPhaseLabel(snapshot.phase)}`}</p>
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

export function CollaborationProvider({ children }: { children: React.ReactNode }) {
  const [manager] = useState(() => new WebRTCConnectionManager());
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(() => manager.getState());
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
  const sessionParticipantIdRef = useRef<string | null>(null);
  const guestRoleRef = useRef<GuestRole>("editor");
  const localRoleRef = useRef<RoomRole | null>(null);
  const remoteParticipantRef = useRef<RoomParticipant | null>(null);
  const [signalingDrafts, setSignalingDrafts] = useState<SignalingDrafts>({ ...EMPTY_SIGNALING_DRAFTS });
  const lastPoseSentAtRef = useRef(0);
  const lastRemotePoseAtRef = useRef(0);

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
      snapshotRef.current = next;
      setSnapshot(next);
    });
    return () => {
      unsubscribe();
      // Only the root provider owns the connection lifetime. Route changes do not unmount it.
      manager.disconnect();
    };
  }, [manager]);

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
      && contentSyncStatus !== "synced"
      && contentSyncStatus !== "error";
    setCollaborationReadOnly(snapshot.phase === "open" && (
      localRole === "reader" || waitingForHostRole || contentSyncInProgress
    ));
  }, [snapshot.phase, localRole, contentSyncStatus]);

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
    lastRemotePoseAtRef.current = 0;
  }, [remotePoseRef, resetCollaborativeEditing]);

  const disconnect = useCallback(() => {
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
    setSessionParticipantId(null);
    setAssignedGuestRole(null);
    setRemoteParticipantState(null);
    setSignalingDrafts({ ...EMPTY_SIGNALING_DRAFTS });
    remotePoseRef.current = { ...HIDDEN_POSE };
    lastPoseSentAtRef.current = 0;
    lastRemotePoseAtRef.current = 0;
  }, [manager, remotePoseRef, resetCollaborativeEditing]);

  useEffect(() => {
    if (snapshot.phase !== "open" || !snapshot.role || !sessionParticipantId) return;
    const role: "owner" | "pending" = snapshot.role === "initiator" ? "owner" : "pending";
    const message: CollaborationMessage = {
      v: 1,
      type: "hello",
      participantId: sessionParticipantId,
      name: normalizeDisplayName(displayName),
      role,
      ...(snapshot.role === "initiator" ? { guestRole } : {}),
    };
    manager.sendDataMessage(serializeCollaborationMessage(message));
  }, [manager, snapshot.phase, snapshot.role, sessionParticipantId, displayName, guestRole]);

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
          if (!manager.sendDataMessage(frame)) return false;
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
  }, [manager, restoreCollaborativeTextSnapshots, snapshot.phase, snapshot.role, sessionParticipantId]);

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
          if (!manager.sendDataMessage(frame)) return false;
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
  }, [manager, snapshot.phase, sessionParticipantId]);

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
      if (currentSnapshot.role === "initiator" && message.role !== "pending") return;
      if (currentSnapshot.role === "joiner" && message.role !== "owner") return;
      if (currentSnapshot.role !== "initiator" && currentSnapshot.role !== "joiner") return;
      const currentGuestRole = guestRoleRef.current;
      const participant: RoomParticipant = {
        id: message.participantId,
        name: message.name,
        role: currentSnapshot.role === "initiator" ? currentGuestRole : "owner",
      };
      remoteParticipantRef.current = participant;
      setRemoteParticipantState(participant);
      if (currentSnapshot.role === "initiator") {
        manager.sendDataMessage(serializeCollaborationMessage({
          v: 1,
          type: "role",
          participantId: currentParticipantId,
          role: currentGuestRole,
        }));
      } else if (message.guestRole) {
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

      if (message.type === "pose" && remoteParticipantRef.current?.id === message.participantId) {
        remotePoseRef.current = message.pose;
        lastRemotePoseAtRef.current = Date.now();
      }
    };

    const unsubscribe = manager.subscribeDataMessages((raw) => {
      const chunk = contentChunkAssemblerRef.current.accept(raw);
      if (chunk.handled) {
        if (chunk.message) handlePayload(chunk.message);
        return;
      }
      handlePayload(raw);
    });
    return unsubscribe;
  }, [manager, notifyRemoteEditingListeners, remotePoseRef, restoreCollaborativeTextSnapshots]);

  useEffect(() => {
    if (snapshot.phase !== "open") return;
    const timer = window.setInterval(() => {
      if (lastRemotePoseAtRef.current && Date.now() - lastRemotePoseAtRef.current > REMOTE_POSE_STALE_MS) {
        remotePoseRef.current = { ...remotePoseRef.current, moving: false, visible: false };
      }
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [snapshot.phase, remotePoseRef]);

  const sendDataMessage = useCallback(
    (data: string) => manager.sendDataMessage(data),
    [manager]
  );
  const subscribeDataMessages = useCallback(
    (listener: DataChannelMessageListener) => manager.subscribeDataMessages(listener),
    [manager]
  );
  const publishPose = useCallback((pose: PlayerPose) => {
    if (snapshot.phase !== "open" || !sessionParticipantId) return;
    const now = performance.now();
    if (now - lastPoseSentAtRef.current < POSE_SEND_INTERVAL_MS) return;
    lastPoseSentAtRef.current = now;
    manager.sendDataMessage(serializeCollaborationMessage({
      v: 1,
      type: "pose",
      participantId: sessionParticipantId,
      pose: {
        x: pose.x,
        z: pose.z,
        eyeY: pose.eyeY,
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
  }, [manager, snapshot.phase, sessionParticipantId]);

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
      if (!manager.sendDataMessage(frame)) break;
    }
    lastEditingPresenceSentAtRef.current = performance.now();
  }, [canCollaborateOnText, manager, sessionParticipantId]);

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
    if (elapsed >= EDITING_PRESENCE_SEND_INTERVAL_MS) {
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
      }, Math.max(0, EDITING_PRESENCE_SEND_INTERVAL_MS - elapsed));
    }
  }, [canCollaborateOnText, sendPresenceMessage, sessionParticipantId]);

  const contextValue = useMemo(() => ({
    manager,
    snapshot,
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
  }), [manager, snapshot, displayName, setDisplayName, guestRole, localRole, remoteParticipant, contentSyncStatus, canCollaborateOnText, applyCollaborativeTextChange, getCollaborativeTextSnapshot, subscribeCollaborativeText, publishEditingPresence, getRemoteEditingPresence, subscribeRemoteEditing, remotePoseRef, signalingDrafts, setSignalingDraft, clearSignalingDrafts, preparePairing, disconnect, sendDataMessage, subscribeDataMessages, publishPose]);

  return (
    <CollaborationContext.Provider value={contextValue}>
      {children}
      <CrossPageConnectionNotice snapshot={snapshot} localRole={localRole} remoteParticipant={remoteParticipant} contentSyncStatus={contentSyncStatus} />
    </CollaborationContext.Provider>
  );
}
