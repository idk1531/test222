"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";
import { InfiniteCanvas } from "./InfiniteCanvas";
import type { InfiniteCanvasProps } from "./InfiniteCanvas";

/**
 * 桌面工作視角 HTML 浮層：畫布本體完全沿用 InfiniteCanvas（唯一渲染路徑）。
 * 相機俯視桌面、光軸垂直桌面後，此固定螢幕平面與桌面平行；無 CSS 3D 透視，
 * getBoundingClientRect 的座標映射為純仿射，拖曳/框選/縮放/IME 不受影響。
 * 元件全程掛載（房間模式只隱藏），避免進出工作視角時重置畫布 zoom/pan。
 */
export const DeskWorkView: React.FC<
  Omit<InfiniteCanvasProps, "backgroundConfig"> & {
    active: boolean;
    onReturn: () => void;
  }
> = ({ active, onReturn, ...canvasProps }) => (
  <div
    className="study-work-overlay absolute inset-0 z-30 bg-[#faf7ee]"
    data-canvas-surface="true"
    data-no-orbit="true"
    aria-hidden={!active}
    style={{
      opacity: active ? 1 : 0,
      visibility: active ? "visible" : "hidden",
      pointerEvents: active ? "auto" : "none",
      transition: "opacity 120ms ease-out",
    }}
    onPointerDown={(e) => e.stopPropagation()}
    onKeyDown={(e) => e.stopPropagation()}
  >
    <InfiniteCanvas {...canvasProps} />
    {active && (
      <button
        type="button"
        data-no-orbit="true"
        onClick={onReturn}
        onPointerDown={(e) => e.stopPropagation()}
        className="touch-target absolute left-3 top-3 z-[80] flex items-center gap-1.5 rounded-xl border border-stone-300/80 bg-[#faf5ea]/95 px-3 py-2 text-xs font-semibold text-stone-800 shadow-lg backdrop-blur-sm hover:bg-white sm:left-4 sm:top-4"
        aria-label="回到房間"
        title="飛回進入前的房間視角（Esc）"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>回到房間</span>
      </button>
    )}
  </div>
);
