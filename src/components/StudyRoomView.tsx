"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowUp, ArrowDown, BookOpen, Library, RotateCcw, Tags, X } from "lucide-react";
import { DeskWorkView } from "./DeskWorkView";
import { StudyScene, type StudySceneApi } from "./StudyScene";
import { RoomGeometry } from "./RoomGeometry";
import { WindowLight } from "./WindowLight";
import { Book3D, type DeskBookModel } from "./Book3D";
import { HeldBook } from "./HeldBook";
import { ShelfDecor } from "./ShelfDecor";
import { RoomFurniture, type RoomFurnitureRig } from "./RoomFurniture";
import { CameraRig, type CameraRigHandle, type CameraRigInteractionState, type RoomActionMeta } from "./CameraRig";
import { Joystick, type JoystickVector } from "./Joystick";
import { StudyCategoryPanel } from "./StudyCategoryPanel";
import type { InfiniteCanvasProps } from "./InfiniteCanvas";
import type { CardData } from "./KnowledgeCardNode";
import { useWorkspaceState, actions } from "@/lib/store";
import {
  computeShelfLayout,
  DESK,
  detectQuality,
  shelfBookDims,
  type SceneQuality,
  type ShelfBookPlacement,
} from "@/lib/room3d";
import { resolveSpineColor, desaturateColor, type StudyCamera, type StudyBookLayout } from "@/lib/study";
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

/**
 * v8.1 全景書房：three.js 3D 房間 + 真實 HTML 浮層。
 * WebGL：房間/窗景/日光/書桌/書架/3D 書本。HTML：InfiniteCanvas、書封預覽、HUD、分類面板、搖桿。
 * 手勢分流：房間空白拖曳環顧；點桌面進俯視工作視角；工作視角 100% 交 InfiniteCanvas；
 * HUD/搖桿/預覽一律 [data-no-orbit]，WASD 對輸入框/IME 不作用。
 */
export const StudyRoomView: React.FC<StudyRoomViewProps> = (props) => {
  const state = useWorkspaceState();
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
            <RoomGeometry
              api={api}
              objects={state.canvasObjects as any[]}
              cards={state.cards as CardData[]}
              shelfRows={layout.rows.length}
            />
            <WindowLight api={api} />
            <Book3D api={api} layout={layout} deskBooks={deskBookModels} heldCardId={heldCardId} titleOf={titleOf} />
            <HeldBook api={api} cardId={heldCardId} placement={heldBookPlacement} title={titleOf(heldCardId || "")} />
            <ShelfDecor api={api} layout={layout} />
            <RoomFurniture api={api} chairRigRef={chairRigRef} />
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
          {pointerLocked && (
            <div aria-hidden="true" className="study-room-reticle pointer-events-none absolute inset-0 z-30 grid place-items-center print:hidden">
              <span className="h-[3px] w-[3px] rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.8),0_0_4px_rgba(0,0,0,0.8)]" />
            </div>
          )}
          <div
            className="absolute right-3 top-3 z-40 flex items-center gap-1.5 rounded-xl border border-stone-300/75 bg-[#faf5ea]/94 p-1.5 shadow-lg backdrop-blur-md sm:right-4 sm:top-4"
            data-no-orbit="true"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="hidden rounded-lg bg-white/70 px-2 py-1.5 text-[11px] font-medium text-stone-700 sm:inline">
              拖曳環顧 · WASD 走動 · E 拿書
            </span>
            <button
              type="button"
              onClick={() => {
                const c = { ...cameraRef.current, yaw: -20, pitch: -2, x: 0.9, z: 1.55, height: 1.5 };
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
          <div className="absolute bottom-4 right-3 z-20 rounded-lg bg-[#faf5ea]/80 px-2.5 py-1.5 text-[10px] text-stone-600 shadow-sm backdrop-blur-sm sm:bottom-5 sm:right-5">
            <span>{pointerLocked ? "準心已鎖定 · Esc 解除 · " : "桌機點擊鎖定準心 · Esc 解除 · "}</span>
            點書本直接開卡 · Shift+點擊／右鍵／長按預覽 · 點紙面進工作視角
          </div>
          {roomHint
            ? <div role="status" aria-live="polite" className="pointer-events-none absolute bottom-14 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-stone-900/90 px-3 py-2 text-xs font-semibold text-white shadow-lg">{roomHint}</div>
            : heldCardId && <div className="pointer-events-none absolute bottom-14 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-amber-300 bg-[#faf5ea]/92 px-3 py-2 text-xs font-semibold text-stone-800 shadow-lg">手持「{titleOf(heldCardId)}」· 對準桌面點擊／E 放下 · Q 回架</div>}
          <Joystick onChange={(v) => { joystickRef.current = v; }} />
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
    </div>
  );
};
