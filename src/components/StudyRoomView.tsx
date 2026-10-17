"use client";

import React, { useEffect, useRef, useState } from "react";
import { Hand, Orbit, RotateCcw, Tags } from "lucide-react";
import { InfiniteCanvasProps } from "./InfiniteCanvas";
import { DeskCanvas } from "./DeskCanvas";
import { BookshelfView } from "./BookshelfView";
import { StudyCategoryPanel } from "./StudyCategoryPanel";
import type { CardData } from "./KnowledgeCardNode";
import { useWorkspaceState, actions } from "@/lib/store";
import { clampCamera, DEFAULT_CAMERA } from "@/lib/study";

type StudyRoomViewProps = Omit<InfiniteCanvasProps, "backgroundConfig" | "apiRef">;

type OrbitSession = {
  active: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  yaw0: number;
  pitch0: number;
};

const YAW_PER_PX = 0.22;
const PITCH_PER_PX = 0.12;

/**
 * 虛擬書房外殼（半擬 3D，純 CSS 3D：perspective + preserve-3d + 分層平面；不用 three.js）。
 *
 * 空間結構：
 * - `.study-room-3d`（單一旋轉容器）：牆面、光源、地板、書架——環繞時只改這一個 transform（ref + rAF）。
 * - `.study-desk-fixed`（不旋轉、面向使用者）：書桌＋內嵌 InfiniteCanvas。
 *   畫布平面刻意不隨視角旋轉：CSS 3D 透視會讓 InfiniteCanvas 的
 *   getBoundingClientRect 仿射座標換算失準（拖卡會漂移），也讓文字變形；
 *   家具／牆／書架旋轉即可表達視角，畫布保持可讀、可操作（IME／輸入框正常）。
 *
 * 手勢衝突規則：
 * - 畫布區域（data-canvas-surface）：手勢全部交給 InfiniteCanvas（平移、框選、拖卡、雙指縮放）。
 * - 書房背景／家具：拖曳＝環繞視角（yaw ±28°、pitch −6°～+14°），可用「重置視角」回正。
 * - 「視角模式」切換：平移 ↔ 環繞；觸控裝置預設平移，避免手機一根手指被搶走。
 */
export const StudyRoomView: React.FC<StudyRoomViewProps> = (props) => {
  const state = useWorkspaceState();
  const roomRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // 視角：React state 只在「拖曳結束／重置／模式切換」更新；拖曳中走 ref + rAF 直改 transform。
  const [camera, setCamera] = useState(() => state.studyLayout.camera || DEFAULT_CAMERA);
  const cameraRef = useRef(camera);
  const orbitRef = useRef<OrbitSession>({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    yaw0: 0,
    pitch0: 0,
  });
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ yaw: number; pitch: number } | null>(null);

  // 觸控裝置預設「平移」（畫布/捲動優先）；桌機預設「環繞」
  const [viewMode, setViewMode] = useState<"orbit" | "pan">(() =>
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? "pan" : "orbit"
  );
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  const applyCamera = (yaw: number, pitch: number) => {
    const el = roomRef.current;
    if (!el) return;
    el.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
  };

  // 初始視角（含記住的上次視角）；只做 DOM 寫入，不觸發 setState
  useEffect(() => {
    applyCamera(cameraRef.current.yaw, cameraRef.current.pitch);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 分類面板：Esc 關閉
  useEffect(() => {
    if (!showCategoryPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCategoryPanel(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCategoryPanel]);

  const flushOrbitFrame = () => {
    rafRef.current = null;
    const p = pendingRef.current;
    if (p) applyCamera(p.yaw, p.pitch);
  };

  const handleOrbitMove = (e: PointerEvent) => {
    const s = orbitRef.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    const next = clampCamera(
      s.yaw0 + (e.clientX - s.startX) * YAW_PER_PX,
      s.pitch0 + (e.clientY - s.startY) * PITCH_PER_PX
    );
    pendingRef.current = next;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushOrbitFrame);
  };

  const handleOrbitEnd = (e: PointerEvent) => {
    const s = orbitRef.current;
    if (!s.active || e.pointerId !== s.pointerId) return;
    s.active = false;
    window.removeEventListener("pointermove", handleOrbitMove);
    window.removeEventListener("pointerup", handleOrbitEnd);
    window.removeEventListener("pointercancel", handleOrbitEnd);
    const next = pendingRef.current || cameraRef.current;
    cameraRef.current = next;
    setCamera(next);
    // 拖曳結束才寫入 store（記住上次視角）；拖曳中不重算 React state
    actions.updateStudyLayout({ camera: next });
  };

  /** 背景／家具拖曳 → 環繞視角；畫布與互動控制項完全不觸發（手勢衝突規則） */
  const handleShellPointerDown = (e: React.PointerEvent) => {
    if (viewMode !== "orbit") return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const t = e.target as HTMLElement | null;
    if (t && t.closest("[data-no-orbit], button, input, textarea, select, a")) return;
    orbitRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      yaw0: cameraRef.current.yaw,
      pitch0: cameraRef.current.pitch,
    };
    window.addEventListener("pointermove", handleOrbitMove);
    window.addEventListener("pointerup", handleOrbitEnd);
    window.addEventListener("pointercancel", handleOrbitEnd);
  };

  const resetCamera = () => {
    const next = { ...DEFAULT_CAMERA };
    cameraRef.current = next;
    setCamera(next);
    applyCamera(next.yaw, next.pitch);
    actions.updateStudyLayout({ camera: next });
  };

  // 「在畫布定位」：直接呼叫 InfiniteCanvas 的 focusCard（事件處理內 setState，安全）
  const canvasApiRef = useRef<{ focusCard: (cardId: string) => void } | null>(null);
  const handleLocateCard = (card: CardData) => {
    canvasApiRef.current?.focusCard(card.id);
  };

  return (
    <div
      ref={shellRef}
      className="study-room-view relative h-full w-full select-none overflow-hidden"
      onPointerDown={handleShellPointerDown}
    >
      {/* ===== 環繞容器：牆／光／地板／書架（單一 transform，ref + rAF） ===== */}
      <div
        ref={roomRef}
        className="study-room-3d absolute inset-0"
        style={{
          transform: `rotateX(${camera.pitch}deg) rotateY(${camera.yaw}deg)`,
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        {/* 牆面（米白 → 暖灰）：略放大避免環繞時露邊 */}
        <div className="study-back-wall" aria-hidden="true" />
        {/* 主光源（左上淡金）＋往右下的柔和陰影 */}
        <div className="study-light" aria-hidden="true" />
        {/* 地板：往後延伸的水平面 */}
        <div className="study-floor" aria-hidden="true" />
        {/* 書架（側板＋層板＋背板＋櫃板＋書本） */}
        <div className="study-shelf-anchor">
          <BookshelfView onOpenCard={props.onOpenCardDetail} onLocateCard={handleLocateCard} />
        </div>
      </div>

      {/* ===== 書桌（固定前景、面向使用者）：桌板＋前緣＋內嵌畫布 ===== */}
      <div className="study-desk-fixed">
        <DeskCanvas {...props} apiRef={canvasApiRef} />
      </div>

      {/* ===== HUD：視角控制（不旋轉、不擋操作） ===== */}
      <div
        className="absolute right-2 top-2 z-40 flex items-center gap-1 rounded-xl border border-stone-300/70 bg-[#faf5ea]/90 px-1.5 py-1 shadow-lg backdrop-blur-sm sm:right-3 sm:top-3"
        data-no-orbit="true"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setViewMode(viewMode === "orbit" ? "pan" : "orbit")}
          className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-200/70"
          style={viewMode === "orbit" ? { backgroundColor: "#e7d3ae", color: "#6b4a1f" } : undefined}
          title={viewMode === "orbit" ? "目前：拖曳背景環繞視角（點擊切換為平移模式）" : "目前：平移模式，畫布手勢優先（點擊切換為環繞視角）"}
          aria-pressed={viewMode === "orbit"}
        >
          {viewMode === "orbit" ? <Orbit className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{viewMode === "orbit" ? "環繞視角" : "平移模式"}</span>
        </button>
        <button
          type="button"
          onClick={resetCamera}
          className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-200/70"
          title="重置視角（回正）"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">重置視角</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCategoryPanel((v) => !v)}
          className="touch-target flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-200/70"
          style={showCategoryPanel ? { backgroundColor: "#e7d3ae", color: "#6b4a1f" } : undefined}
          title="分類管理（櫃板新增／改名／改色／排序／刪除）"
          aria-expanded={showCategoryPanel}
        >
          <Tags className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">分類</span>
        </button>
      </div>

      {/* 分類管理面板 */}
      {showCategoryPanel && <StudyCategoryPanel onClose={() => setShowCategoryPanel(false)} />}
    </div>
  );
};
