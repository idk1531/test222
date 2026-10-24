"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowUp, ArrowDown, BookOpen, Box, Eye, Hand, Layers, Library, RotateCcw, Tags, X } from "lucide-react";
import { DeskWorkView } from "./DeskWorkView";
import { StudyScene, type StudySceneApi } from "./StudyScene";
import { RoomGeometry } from "./RoomGeometry";
import { NestedCityGeometry } from "./NestedCityGeometry";
import { WindowLight } from "./WindowLight";
import { Book3D, type DeskBookModel } from "./Book3D";
import { HeldBook } from "./HeldBook";
import { ShelfDecor } from "./ShelfDecor";
import { RoomFurniture, type RoomFurnitureRig } from "./RoomFurniture";
import { CameraRig, type CameraRigHandle, type CameraRigInteractionState, type RoomActionMeta } from "./CameraRig";
import { VoxelCharacter } from "./VoxelCharacter";
import { RemotePlayerLabel } from "./RemotePlayerLabel";
import { RemotePoseSmoother } from "./RemotePoseSmoother";
import { Joystick, type JoystickVector } from "./Joystick";
import { StudyCategoryPanel } from "./StudyCategoryPanel";
import type { InfiniteCanvasProps } from "./InfiniteCanvas";
import type { CardData } from "./KnowledgeCardNode";
import { useWorkspaceState, actions } from "@/lib/store";
import { useCollaboration } from "@/components/CollaborationProvider";
import {
  computeShelfLayout,
  DESK,
  detectQuality,
  nestedCityFloorLabel,
  shelfBookDims,
  type NestedCityView,
  type PlayerPose,
  type SceneQuality,
  type ShelfBookPlacement,
  type ViewMode,
} from "@/lib/room3d";
import { DEFAULT_CAMERA, resolveSpineColor, desaturateColor, type StudyCamera, type StudyBookLayout } from "@/lib/study";
import type { RoomAction } from "@/lib/roomActions";

export type StudyRoomViewProps = Omit<InfiniteCanvasProps, "backgroundConfig" | "apiRef"> & {
  cardModalOpen?: boolean;
};

interface BookPreview {
  cardId: string;
  x: number;
  y: number;
  from: "shelf" | "desk";
}

const HIDDEN_REMOTE_POSE: PlayerPose = {
  x: 0,
  z: 0,
  eyeY: 1.5,
  floorY: 0,
  jumpOffset: 0,
  yaw: 0,
  pitch: 0,
  moving: false,
  onGround: true,
  seated: false,
  visible: false,
  holding: false,
};

/**
 * 嵌套之城書房：three.js 多層挑空建築 + 真實 HTML 浮層。
 * WebGL：房間/窗景/日光/書桌/書架/3D 書本。HTML：InfiniteCanvas、書封預覽、HUD、分類面板、搖桿。
 * 手勢分流：房間空白拖曳環顧；點桌面進俯視工作視角；工作視角 100% 交 InfiniteCanvas；
 * HUD/搖桿/預覽一律 [data-no-orbit]，WASD 對輸入框/IME 不作用。
 */
export const StudyRoomView: React.FC<StudyRoomViewProps> = (props) => {
  const state = useWorkspaceState();
  const { snapshot: collaborationSnapshot, localRole, remoteParticipant, remotePoseRef, publishPose } = useCollaboration();
  const [quality] = useState<SceneQuality>(() => detectQuality());
  const sceneApiRef = useRef<StudySceneApi | null>(null);
  const rigRef = useRef<CameraRigHandle | null>(null);
  const chairRigRef = useRef<RoomFurnitureRig | null>(null);
  const cameraRef = useRef<StudyCamera>(state.studyLayout.camera);
  const joystickRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const interactionRef = useRef<CameraRigInteractionState>({
    heldCardId: null,
    seated: false,
    chairInTrigger: false,
    uiOpen: false,
  });
  const canvasApiRef = useRef<{ focusCard: (cardId: string) => void } | null>(null);
  const pendingFocusRef = useRef<string | null>(null);
  const [workMode, setWorkMode] = useState(false);
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [previewSnapshot, setPreview] = useState<BookPreview | null>(null);
  const [heldCardId, setHeldCardId] = useState<string | null>(null);
  const [seated, setSeated] = useState(false);
  const [chairInTrigger, setChairInTrigger] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("first");
  const [inspectionView, setInspectionView] = useState<NestedCityView | null>(null);
  const [whiteModel, setWhiteModel] = useState(false);
  const [floorLabel, setFloorLabel] = useState(() => nestedCityFloorLabel(state.studyLayout.camera.floorY ?? 0));
  const floorLabelRef = useRef(floorLabel);
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const playerRef = useRef<PlayerPose>({
    x: state.studyLayout.camera.x ?? 0.9,
    z: state.studyLayout.camera.z ?? 1.55,
    eyeY: state.studyLayout.camera.height ?? 1.5,
    floorY: state.studyLayout.camera.floorY ?? 0,
    jumpOffset: 0,
    yaw: (state.studyLayout.camera.yaw * Math.PI) / 180,
    pitch: (state.studyLayout.camera.pitch * Math.PI) / 180,
    moving: false,
    onGround: true,
    seated: false,
    visible: false,
  });
  const remoteRenderPoseRef = useRef<PlayerPose>({ ...HIDDEN_REMOTE_POSE });
  const [roomHint, setRoomHint] = useState("");
  const hintTimeoutRef = useRef<number | null>(null);
  const cardModalOpen = !!props.cardModalOpen;
  const setHeldTransient = useCallback((cardId: string | null) => {
    interactionRef.current.heldCardId = cardId;
    setHeldCardId(cardId);
  }, []);
  const showRoomHint = useCallback((message: string) => {
    setRoomHint(message);
    if (hintTimeoutRef.current !== null) window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => setRoomHint(""), 1800);
  }, []);

  useEffect(() => { cameraRef.current = state.studyLayout.camera; }, [state.studyLayout.camera]);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(query.matches || navigator.maxTouchPoints > 0);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  useEffect(() => () => {
    if (hintTimeoutRef.current !== null) window.clearTimeout(hintTimeoutRef.current);
  }, []);

  const accentOf = useCallback((cardId: string) => {
    const object = state.canvasObjects.find((o: any) => o.cardId === cardId);
    return object?.style?.accentColor as string | undefined;
  }, [state.canvasObjects]);
  const layout = useMemo(() => computeShelfLayout(
    state.studyCategories,
    state.studyBooks,
    state.cards as CardData[],
    (book, card) => desaturateColor(resolveSpineColor(book, accentOf(card.id), card.reasoningShape), 0.4)
  ), [state.studyCategories, state.studyBooks, state.cards, accentOf]);

  // Keep preview content anchored to IDs, never a stale copy of store data.
  const previewCard = previewSnapshot
    ? (state.cards as CardData[]).find((card) => card.id === previewSnapshot.cardId)
    : undefined;
  const previewBook: StudyBookLayout | undefined = previewSnapshot
    ? state.studyBooks.find((book) => book.cardId === previewSnapshot.cardId)
    : undefined;
  const preview = previewSnapshot && previewCard && previewBook
    ? { ...previewSnapshot, card: previewCard, book: previewBook }
    : null;

  const roomUiOpen = !!(cardModalOpen || previewSnapshot || showCatalog || showCategoryPanel);
  useEffect(() => {
    interactionRef.current = {
      ...interactionRef.current,
      heldCardId,
      seated,
      chairInTrigger,
      uiOpen: roomUiOpen,
    };
  }, [heldCardId, seated, chairInTrigger, roomUiOpen]);

  useEffect(() => {
    const api = sceneApiRef.current;
    api?.setActive(!workMode && !cardModalOpen);
    if ((roomUiOpen || workMode) && document.pointerLockElement) document.exitPointerLock();
  }, [roomUiOpen, cardModalOpen, workMode]);

  useEffect(() => {
    if (layout.rows.length !== state.studyLayout.shelfRows) {
      actions.updateStudyLayout({ shelfRows: layout.rows.length });
    }
  }, [layout.rows.length, state.studyLayout.shelfRows]);

  const persistCamera = useCallback((camera: StudyCamera) => {
    cameraRef.current = camera;
    actions.updateStudyLayout({ camera });
  }, []);

  const handleEnterWork = useCallback(() => {
    setHeldTransient(null);
    setWorkMode(true);
    const target = pendingFocusRef.current;
    if (target) {
      window.setTimeout(() => {
        canvasApiRef.current?.focusCard(target);
        pendingFocusRef.current = null;
      }, 20);
    }
  }, [setHeldTransient]);
  const handleExitWork = useCallback(() => {
    setWorkMode(false);
    joystickRef.current = { x: 0, y: 0 };
  }, []);

  const toggleViewMode = useCallback(() => {
    const next: ViewMode = viewMode === "first" ? "third" : "first";
    setViewMode(next);
    showRoomHint(next === "third"
      ? "第三人稱 · V／按鈕切回第一人稱"
      : "第一人稱 · V／按鈕切換第三人稱");
  }, [viewMode, showRoomHint]);

  const toggleWhiteModel = useCallback(() => {
    const next = !whiteModel;
    setWhiteModel(next);
    showRoomHint(next ? "白模結構檢視 · 書房資料與互動不變" : "已恢復木／石材質");
  }, [showRoomHint, whiteModel]);

  const selectStructureView = useCallback((view: NestedCityView | null) => {
    if (view && document.pointerLockElement) document.exitPointerLock();
    setInspectionView(view);
  }, []);

  const handlePoseChange = useCallback((pose: PlayerPose) => {
    publishPose(pose);
    const nextLabel = nestedCityFloorLabel(pose.floorY ?? 0);
    if (nextLabel.full !== floorLabelRef.current.full) {
      floorLabelRef.current = nextLabel;
      setFloorLabel(nextLabel);
    }
  }, [publishPose]);

  const handleOpenCard = (card: CardData) => {
    setPreview(null);
    sceneApiRef.current?.setActive(false);
    props.onOpenCardDetail(card);
  };

  const titleOf = useCallback((id: string) =>
    (state.cards as CardData[]).find((c) => c.id === id)?.title || "（未命名）",
  [state.cards]);

  const buildBookPlacement = useCallback((
    book: StudyBookLayout,
    card: CardData,
    position: { x: number; y: number; z: number }
  ): ShelfBookPlacement => {
    const dims = shelfBookDims(card);
    const category = state.studyCategories.find((entry) => entry.id === book.categoryId);
    const categoryHex = book.categoryId && book.categoryId !== "cat-uncategorized" ? category?.color || null : null;
    return {
      cardId: book.cardId,
      categoryId: book.categoryId,
      spineHex: desaturateColor(resolveSpineColor(book, accentOf(card.id), card.reasoningShape), 0.4),
      categoryHex,
      shapeHex: resolveSpineColor(undefined, undefined, card.reasoningShape),
      thickness: dims.thickness,
      height: dims.height,
      ...position,
    };
  }, [accentOf, state.studyCategories]);

  const deskBookModels = useMemo<DeskBookModel[]>(() => state.studyBooks.flatMap((book) => {
    if (book.place !== "desk" || !book.desk) return [];
    const card = (state.cards as CardData[]).find((entry) => entry.id === book.cardId);
    if (!card) return [];
    const dims = shelfBookDims(card);
    return [{
      placement: buildBookPlacement(book, card, {
        x: book.desk.x,
        y: DESK.top + dims.thickness / 2 + 0.002,
        z: book.desk.z,
      }),
      yawDeg: book.desk.yawDeg,
    }];
  }), [state.studyBooks, state.cards, buildBookPlacement]);

  const heldBookPlacement = useMemo(() => {
    if (!heldCardId) return null;
    const book = state.studyBooks.find((entry) => entry.cardId === heldCardId);
    const card = (state.cards as CardData[]).find((entry) => entry.id === heldCardId);
    return book && card ? buildBookPlacement(book, card, { x: 0, y: 0, z: 0 }) : null;
  }, [heldCardId, state.studyBooks, state.cards, buildBookPlacement]);

  const openBookPreview = (cardId: string) => {
    const card = (state.cards as CardData[]).find((c) => c.id === cardId);
    const book = state.studyBooks.find((entry) => entry.cardId === cardId);
    const api = sceneApiRef.current;
    if (!card || !book || !api) return;
    const shelfPlacement = layout.rows.flatMap((row) => row.boards.flatMap((board) => board.books))
      .find((entry) => entry.cardId === cardId);
    const anchor = book.place === "desk" && book.desk
      ? new THREE.Vector3(book.desk.x, DESK.top + 0.025, book.desk.z)
      : shelfPlacement
        ? new THREE.Vector3(shelfPlacement.x - 0.1, shelfPlacement.y, shelfPlacement.z)
        : null;
    if (!anchor) return;
    const point = api.projectToScreen(anchor);
    setPreview({ cardId, x: point.x, y: point.y, from: book.place === "desk" ? "desk" : "shelf" });
    setShowCatalog(false);
  };

  const handleRoomAction = (action: RoomAction, meta: RoomActionMeta) => {
    if (action.type === "noop") {
      if (interactionRef.current.heldCardId && (meta.key === "click" || meta.key === "KeyE") && !meta.hitDeskSurface) {
        showRoomHint("把準心對準桌面");
      } else if (!interactionRef.current.heldCardId && meta.key === "KeyE" && meta.hit !== "book") {
        showRoomHint("把準心對準書本再按拿起");
      }
      return;
    }
    // Both shelf/desk sources stop at CardDetailModal; this path never flies or focuses the canvas.
    if (action.type === "openCard") {
      const card = (state.cards as CardData[]).find((entry) => entry.id === action.cardId);
      if (card) handleOpenCard(card);
    } else if (action.type === "openPreview") {
      openBookPreview(action.cardId);
    } else if (action.type === "pickUp") {
      setHeldTransient(action.cardId);
      setPreview(null);
    } else if (action.type === "putOnDesk") {
      const cardId = interactionRef.current.heldCardId;
      if (!cardId) return;
      actions.setBookPlace(cardId, "desk", { x: action.x, z: action.z, yawDeg: action.yawDeg });
      setHeldTransient(null);
      showRoomHint("已放到桌面");
    } else if (action.type === "returnToShelf") {
      const cardId = interactionRef.current.heldCardId;
      if (!cardId) return;
      actions.setBookPlace(cardId, "shelf");
      setHeldTransient(null);
      showRoomHint("已放回書架");
    } else if (action.type === "enterWorkView") {
      // Release pointer lock before the existing camera flight; keep beginFlight itself unchanged.
      if (document.pointerLockElement) document.exitPointerLock();
      // Work view never inherits a transient hand-held prop; the stored book placement is untouched.
      setHeldTransient(null);
      setPreview(null);
      setShowCatalog(false);
      setShowCategoryPanel(false);
      rigRef.current?.enterWorkView();
    } else if (action.type === "sit") {
      setSeated(true);
      showRoomHint("已坐下 · WASD／搖桿可移動 · F／Esc 起立");
    } else if (action.type === "stand") {
      setSeated(false);
      showRoomHint("已起立");
    }
  };

  const locateBook = (cardId: string) => {
    if (document.pointerLockElement) document.exitPointerLock();
    pendingFocusRef.current = cardId;
    setHeldTransient(null);
    setPreview(null);
    setShowCatalog(false);
    rigRef.current?.enterWorkView();
  };

  const moveBook = (cardId: string, direction: -1 | 1) => {
    const current = state.studyBooks.find((b) => b.cardId === cardId);
    if (!current) return;
    const categoryId = current.categoryId;
    const bucket = state.studyBooks
      .filter((b) => (b.categoryId ?? "cat-uncategorized") === (categoryId ?? "cat-uncategorized"))
      .sort((a, b) => a.orderInShelf - b.orderInShelf);
    const index = bucket.findIndex((b) => b.cardId === cardId);
    actions.reorderBook(cardId, categoryId, index + direction);
  };

  return (
    <div className="study-room-view relative h-full w-full overflow-hidden bg-[#e6ded2]">
      <StudyScene quality={quality} apiRef={sceneApiRef}>
        {(api) => (
          <>
            {inspectionView ? (
              <NestedCityGeometry api={api} structureOnly />
            ) : (
              <>
                <RoomGeometry
                  api={api}
                  objects={state.canvasObjects as any[]}
                  cards={state.cards as CardData[]}
                  shelfRows={layout.rows.length}
                />
                <NestedCityGeometry api={api} whiteModel={whiteModel} />
                <WindowLight api={api} />
                <Book3D api={api} layout={layout} deskBooks={deskBookModels} heldCardId={heldCardId} titleOf={titleOf} />
                <HeldBook api={api} cardId={heldCardId} placement={heldBookPlacement} title={titleOf(heldCardId || "")} viewMode={viewMode} playerRef={playerRef} />
                <ShelfDecor api={api} layout={layout} />
                <RoomFurniture api={api} chairRigRef={chairRigRef} />
                <VoxelCharacter api={api} playerRef={playerRef} viewMode={viewMode} />
                {collaborationSnapshot.phase === "open" && remoteParticipant && (
                  <>
                    <RemotePoseSmoother
                      key={remoteParticipant.id}
                      api={api}
                      sourcePoseRef={remotePoseRef}
                      renderedPoseRef={remoteRenderPoseRef}
                    />
                    <VoxelCharacter api={api} playerRef={remoteRenderPoseRef} viewMode="third" />
                    <RemotePlayerLabel api={api} poseRef={remoteRenderPoseRef} name={remoteParticipant.name} />
                  </>
                )}
              </>
            )}
            <CameraRig
              api={api}
              initialCamera={state.studyLayout.camera}
              joystickRef={joystickRef}
              onEnterWork={handleEnterWork}
              onExitWork={handleExitWork}
              persistCamera={persistCamera}
              rigRef={rigRef}
              interactionRef={interactionRef}
              chairRigRef={chairRigRef}
              onRoomAction={handleRoomAction}
              onPointerLockChange={setPointerLocked}
              onChairTriggerChange={setChairInTrigger}
              onFocusChange={setFocusedCardId}
              onPoseChange={handlePoseChange}
              movementEnabled={collaborationSnapshot.phase !== "open" || localRole === "owner" || localRole === "editor"}
              viewMode={viewMode}
              onToggleView={toggleViewMode}
              inspectionView={inspectionView}
              playerRef={playerRef}
              otherPlayerRef={remotePoseRef}
            />
          </>
        )}
      </StudyScene>

      {/* Fullscreen HTML 工作畫布保持掛載，房間模式下隱藏；純仿射座標。 */}
      <DeskWorkView
        active={workMode}
        onReturn={() => rigRef.current?.exitWorkView()}
        objects={props.objects}
        cards={props.cards}
        relations={props.relations}
        onUpdateObjects={props.onUpdateObjects}
        onDeleteObject={props.onDeleteObject}
        onSelectCard={props.onSelectCard}
        onOpenPreview={props.onOpenPreview}
        onRunAudit={props.onRunAudit}
        onExpansionTest={props.onExpansionTest}
        onOpenEditRelation={props.onOpenEditRelation}
        onImageTextIndependenceTest={props.onImageTextIndependenceTest}
        onOpenCardDetail={props.onOpenCardDetail}
        fontFamily={props.fontFamily}
        apiRef={canvasApiRef}
      />

      {/* 房間 HUD */}
      {!workMode && (
        <>
          {inspectionView ? (
            <div
              className="absolute left-3 top-3 z-40 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white/95 p-2 shadow-lg backdrop-blur-sm sm:left-4 sm:top-4"
              data-no-orbit="true"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="嵌套之城結構驗收視角"
            >
              <span className="mr-1 flex items-center gap-1 px-1.5 text-[11px] font-bold text-slate-700 sm:text-xs">
                <Layers aria-hidden="true" className="h-4 w-4" />純色結構檢視
              </span>
              {([
                ["main", "主視角"],
                ["top", "俯視"],
                ["side", "側視"],
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => selectStructureView(view)}
                  className={`touch-target min-h-9 rounded-lg px-3 py-1.5 text-xs font-semibold ${inspectionView === view ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                  aria-pressed={inspectionView === view}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => selectStructureView(null)}
                className="touch-target min-h-9 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                aria-label="返回可互動書房"
              >
                漫遊書房
              </button>
            </div>
          ) : (
            <>
          {/* 準心在房間模式一律顯示：桌機按 E 是以畫面中心射線拾取，
              若只在 Pointer Lock 時顯示，玩家會不知道 E 到底對準哪裡。 */}
          <div aria-hidden="true" className="study-room-reticle pointer-events-none absolute inset-0 z-30 grid place-items-center print:hidden">
            <span className={`grid place-items-center rounded-full border border-white/55 bg-black/10 shadow-[0_0_4px_rgba(0,0,0,0.55)] ${pointerLocked || viewMode === "third" || isTouch ? "h-5 w-5" : "h-3.5 w-3.5"}`}>
              <span className="h-[3px] w-[3px] rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.85)]" />
            </span>
          </div>
          <div
            className="absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-xl border border-stone-300/75 bg-[#faf5ea]/94 p-1.5 shadow-lg backdrop-blur-md sm:right-4 sm:top-4"
            data-no-orbit="true"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label={`目前所在樓層：${floorLabel.full}`}
              title={`目前所在樓層：${floorLabel.full}`}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-white/70 px-2 py-1.5 text-[10px] font-semibold text-stone-700 sm:text-[11px]"
            >
              <Layers aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="sm:hidden">{floorLabel.compact}</span>
              <span className="hidden sm:inline">{floorLabel.full}</span>
            </div>
            {collaborationSnapshot.phase === "open" && localRole === "reader" && (
              <span className="rounded-lg bg-amber-100 px-2 py-1.5 text-[11px] font-bold text-amber-900">唯讀</span>
            )}
            <span className="hidden rounded-lg bg-white/70 px-2 py-1.5 text-[11px] font-medium text-stone-700 sm:inline">
              {viewMode === "third" ? "第三人稱" : "第一人稱"} · 拖曳環顧 · WASD · E 拿書 · V 視角
              {collaborationSnapshot.phase === "open" && remoteParticipant
                ? ` · 同室：${remoteParticipant.name}${localRole === "reader" ? "（唯讀）" : ""}`
                : ""}
            </span>
            {isTouch && (
              <button
                type="button"
                onClick={toggleViewMode}
                className="touch-target flex min-h-10 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200/70"
                title={viewMode === "first" ? "切換第三人稱" : "切換第一人稱"}
                aria-pressed={viewMode === "third"}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{viewMode === "first" ? "第三人稱" : "第一人稱"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // 重置必須回到與首次進房相同的參考圖取景；
                // 舊版在此硬編碼 yaw -20，與 DEFAULT_CAMERA 脫鉤。
                const c = { ...cameraRef.current, ...DEFAULT_CAMERA };
                persistCamera(c);
                // Reset 透過事件交給 rig 保持相機內部狀態一致。
                window.dispatchEvent(new CustomEvent("study-room-reset-camera", { detail: c }));
              }}
              className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200/70"
              title="重置房間視角"
            >
              <RotateCcw className="h-3.5 w-3.5" /><span className="hidden sm:inline">重置</span>
            </button>
            <button
              type="button"
              onClick={() => selectStructureView("main")}
              className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200/70"
              title="開啟三重框架固定驗收視角"
            >
              <Layers className="h-3.5 w-3.5" /><span className="hidden sm:inline">結構</span>
            </button>
            <button
              type="button"
              onClick={toggleWhiteModel}
              className={`touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ${whiteModel ? "bg-stone-200 text-stone-900" : "text-stone-700 hover:bg-stone-200/70"}`}
              aria-label={whiteModel ? "關閉白模檢視" : "檢視白模結構"}
              aria-pressed={whiteModel}
              title={whiteModel ? "恢復木／石材質" : "切換結構白模（書本與房間資料不變）"}
            >
              <Box className="h-3.5 w-3.5" /><span className="hidden sm:inline">{whiteModel ? "材質" : "白模"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCatalog((v) => !v)}
              className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200/70"
              aria-expanded={showCatalog}
              title="書架目錄（鍵盤可操作）"
            >
              <Library className="h-3.5 w-3.5" /><span className="hidden sm:inline">書架</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryPanel((v) => !v)}
              className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-200/70"
              style={showCategoryPanel ? { backgroundColor: "#e7d3ae", color: "#6b4a1f" } : undefined}
              aria-expanded={showCategoryPanel}
              title="分類管理"
            >
              <Tags className="h-3.5 w-3.5" /><span className="hidden sm:inline">分類</span>
            </button>
          </div>
          <div className="absolute bottom-4 right-3 z-20 hidden rounded-lg bg-[#faf5ea]/80 px-2.5 py-1.5 text-[10px] text-stone-600 shadow-sm backdrop-blur-sm sm:bottom-5 sm:right-5 sm:block">
            <span>{pointerLocked ? "準心已鎖定 · Esc 解除 · " : "桌機點擊鎖定準心 · Esc 解除 · "}</span>
            V 切換第一／第三人稱 · 點書本開卡 · Shift+點擊／右鍵／長按預覽
          </div>
          {roomHint
            ? <div role="status" aria-live="polite" className="pointer-events-none absolute bottom-14 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-stone-900/90 px-3 py-2 text-xs font-semibold text-white shadow-lg">{roomHint}</div>
            : heldCardId && <div className={`pointer-events-none absolute left-1/2 z-30 w-max max-w-[min(92vw,460px)] -translate-x-1/2 rounded-lg border border-amber-300 bg-[#faf5ea]/95 px-3 py-2 text-center text-xs font-semibold text-stone-800 shadow-lg ${isTouch ? "top-[max(76px,calc(env(safe-area-inset-top)+76px))] sm:top-auto sm:bottom-14" : "bottom-14"}`}>
              <Hand className="mr-1 inline h-3.5 w-3.5" />
              手持「{titleOf(heldCardId)}」· {isTouch ? "對準桌面按「放到桌上」· 「放回書架」可回架" : "對準桌面 E／點擊放下 · Q 回架"}
            </div>}
          {focusedCardId && !heldCardId && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute bottom-[max(196px,calc(env(safe-area-inset-bottom)+196px))] left-1/2 z-40 w-max max-w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border border-amber-300 bg-[#faf5ea]/95 px-3 py-1.5 text-center text-xs font-semibold text-stone-800 shadow-lg sm:bottom-24"
            >
              《{titleOf(focusedCardId)}》· {isTouch ? "按右側「拿起」" : "E 拿起 · 點擊開卡"}
            </div>
          )}
          {isTouch && !heldCardId && !focusedCardId && (
            <div className="pointer-events-none absolute bottom-[max(196px,calc(env(safe-area-inset-bottom)+196px))] left-1/2 z-20 w-max max-w-[92vw] -translate-x-1/2 rounded-md bg-stone-900/45 px-2 py-1 text-center text-[10px] font-medium text-white/90">
              拖曳環顧 · 搖桿走動 · 準心對書再按「拿起」
            </div>
          )}
          <Joystick onChange={(v) => { joystickRef.current = v; }} />
          {isTouch && heldCardId && (
            <div
              data-no-orbit="true"
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute right-3 bottom-[max(96px,calc(env(safe-area-inset-bottom)+96px))] z-40 flex w-[116px] flex-col gap-1.5"
            >
              <p className="rounded-md bg-stone-900/70 px-2 py-1 text-center text-[10px] font-semibold text-white">手持中</p>
              <button
                type="button"
                onClick={() => rigRef.current?.performRoomKey?.("KeyE")}
                className="touch-target flex min-h-10 items-center justify-center gap-1 rounded-xl border border-amber-300 bg-[#faf5ea]/96 px-2 py-2 text-xs font-bold text-stone-800 shadow-lg"
              >
                <Hand className="h-4 w-4" />放到桌上
              </button>
              <button
                type="button"
                onClick={() => rigRef.current?.performRoomKey?.("KeyQ")}
                className="touch-target flex min-h-10 items-center justify-center gap-1 rounded-xl border border-stone-300 bg-white/95 px-2 py-2 text-xs font-bold text-stone-700 shadow-lg"
              >
                <Library className="h-4 w-4" />放回書架
              </button>
            </div>
          )}
          {isTouch && !heldCardId && (
            <button
              type="button"
              data-no-orbit="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => rigRef.current?.performRoomKey?.("KeyE")}
              className="touch-target absolute right-3 bottom-[max(96px,calc(env(safe-area-inset-bottom)+96px))] z-40 flex min-h-10 w-[116px] items-center justify-center gap-1 rounded-xl border border-amber-300 bg-[#faf5ea]/95 px-3 py-2 text-xs font-bold text-stone-800 shadow-lg"
              aria-label="拿起準心對準的書本"
            >
              <BookOpen className="h-4 w-4" />拿起
            </button>
          )}
          {isTouch && !seated && (
            <button
              type="button"
              data-no-orbit="true"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => rigRef.current?.jump?.()}
              className="touch-target absolute bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-40 flex h-16 w-16 min-h-10 flex-col items-center justify-center rounded-full border border-white/80 bg-[#faf5ea]/90 text-stone-800 shadow-[0_8px_22px_rgba(40,30,20,.22)] backdrop-blur-sm active:bg-amber-100"
              aria-label="跳躍"
            >
              <ArrowUp className="h-5 w-5" />
              <span className="text-[10px] font-bold leading-none">跳躍</span>
            </button>
          )}
          {(chairInTrigger || seated) && (
            <button
              type="button"
              data-no-orbit="true"
              onClick={() => rigRef.current?.interactWithChair?.()}
              className="touch-target absolute bottom-32 left-1/2 z-40 min-h-10 -translate-x-1/2 rounded-xl border border-stone-300 bg-[#faf5ea]/95 px-4 py-2 text-xs font-bold text-stone-800 shadow-lg backdrop-blur"
              aria-label={seated ? "起立" : "坐下"}
            >
              {seated ? "起立 · F／Esc" : "坐下 · F"}
            </button>
          )}
          {showCatalog && (
            <section
              className="fixed right-3 top-16 z-50 max-h-[62vh] w-[min(310px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-stone-300/80 bg-[#faf5ea]/96 p-3 shadow-2xl backdrop-blur-md sm:absolute sm:right-4"
              data-no-orbit="true"
              aria-label="書架目錄"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-800">書架目錄</h2>
                <button type="button" onClick={() => setShowCatalog(false)} className="touch-target flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200" aria-label="關閉書架目錄"><X className="h-4 w-4" /></button>
              </div>
              {state.studyCategories.map((category) => {
                const entries = state.studyBooks
                  .filter((book) => (book.categoryId ?? "cat-uncategorized") === category.id)
                  .sort((a, b) => a.orderInShelf - b.orderInShelf);
                return (
                  <div key={category.id} className="mb-2">
                    <h3 className="mb-1 rounded px-2 py-1 text-[10px] font-bold text-white" style={{ backgroundColor: category.color }}>{category.name} · {entries.length}</h3>
                    {entries.length ? entries.map((book) => {
                      const card = (state.cards as CardData[]).find((c) => c.id === book.cardId);
                      if (!card) return null;
                      return <button key={book.cardId} type="button" onClick={() => openBookPreview(book.cardId)} className="touch-target mb-1 flex min-h-10 w-full items-center rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-left text-xs font-medium text-stone-800 hover:border-amber-400 hover:bg-amber-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600">{card.title || "（未命名）"}</button>;
                    }) : <p className="px-2 py-1 text-[10px] text-stone-500">這個櫃板還沒有書</p>}
                  </div>
                );
              })}
            </section>
          )}
          {showCategoryPanel && <StudyCategoryPanel onClose={() => setShowCategoryPanel(false)} />}
          {preview && (
            <div
              className="study-book-preview absolute z-[60] w-[min(286px,calc(100vw-24px))] rounded-2xl border border-amber-200/90 bg-[#faf5ea] p-3.5 shadow-2xl"
              data-no-orbit="true"
              style={{
                left: `${Math.max(12, Math.min(window.innerWidth - 298, preview.x + 14))}px`,
                top: `${Math.max(14, Math.min(window.innerHeight - 258, preview.y - 18))}px`,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={`書本預覽：${preview.card.title}`}
            >
              <div className="h-1 w-full rounded-full" style={{ backgroundColor: desaturateColor(resolveSpineColor(preview.book, accentOf(preview.card.id), preview.card.reasoningShape)) }} />
              <h3 className="mt-2 text-sm font-bold text-stone-800">{preview.card.title || "（未命名）"}</h3>
              <p className="mt-1 text-[11px] text-stone-600">{preview.card.domain || "未分類領域"} · {preview.card.reasoningShape}</p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">
                {String(preview.card.whatData?.summary || preview.card.backgroundDescription || "（尚未撰寫摘要）").slice(0, 110)}
              </p>
              <label className="mt-3 block text-[10px] font-semibold text-stone-600">
                分類櫃板
                <select
                  value={preview.book.categoryId ?? "cat-uncategorized"}
                  onChange={(e) => actions.assignCardCategory(preview.card.id, e.target.value === "cat-uncategorized" ? null : e.target.value)}
                  className="mt-1 block min-h-9 w-full rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-800"
                  aria-label="移動書本到分類櫃板"
                >
                  {state.studyCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </label>
              <div className="mt-3 flex items-center gap-1.5">
                <button type="button" onClick={() => moveBook(preview.card.id, -1)} className="touch-target flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700" aria-label="書本上移排序"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveBook(preview.card.id, 1)} className="touch-target flex h-9 w-9 items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700" aria-label="書本下移排序"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => handleOpenCard(preview.card)} className="touch-target flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-800 px-2 py-2 text-[11px] font-semibold text-amber-50"><BookOpen className="h-3.5 w-3.5" />開啟筆記卡</button>
              </div>
              {preview.from === "shelf" && <button type="button" onClick={() => locateBook(preview.card.id)} className="touch-target mt-1.5 w-full rounded-lg border border-amber-300 bg-white px-2 py-2 text-[11px] font-semibold text-amber-900 hover:bg-amber-50">在畫布定位</button>}
              <button type="button" onClick={() => setPreview(null)} className="mt-2 w-full rounded py-1 text-[10px] text-stone-500 hover:text-stone-800">關閉預覽</button>
            </div>
          )}
            </>
          )}
        </>
      )}
    </div>
  );
};
