"use client";

import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Crosshair } from "lucide-react";
import type { CardData } from "./KnowledgeCardNode";
import { SHAPE_DEFS } from "./ShapeClassifier";
import {
  bookHeightFor,
  bookThicknessFor,
  desaturateColor,
  firstSummaryLine,
  resolveSpineColor,
  type StudyBookLayout,
} from "@/lib/study";

/** 簡單 RGB 明暗微調（書脊圓柱光影；動態色一律 inline style） */
function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * factor);
  const g = clamp(((n >> 8) & 255) * factor);
  const b = clamp((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(2, "0")}`;
}

export interface BookSpineProps {
  card: CardData;
  layout: StudyBookLayout;
  /** 對應畫布物件的 style.accentColor（v7.2 節點色）；未設定時用形狀預設色 */
  accentColor?: string;
  /** 分類色（書脊上的分類標籤條）；null = 未分類 */
  categoryColor: string | null;
  /** 是否抽出（預覽中） */
  isOpen: boolean;
  /** 點擊書脊：未抽出 → 抽出預覽；已抽出 → 開啟筆記卡 */
  onToggle: () => void;
  /** hover（桌機）抽出 */
  onHoverOpen: () => void;
  onOpenCard: () => void;
  onLocate: () => void;
  /** 書本拖曳（重新排列／換櫃板）；由 BookshelfView 提供 */
  onDragPointerDown?: (e: React.PointerEvent) => void;
}

/**
 * 單本書：平時只顯示書脊（書名直排、分類色條、形狀色、厚度/高度微差異）。
 * 抽出時書脊前移（translateZ），並以 portal 顯示「書封預覽」固定卡
 * （portal 置於畫面座標層，避免書架 overflow 裁切、也不隨 CSS 3D 視角變形）。
 */
export const BookSpine: React.FC<BookSpineProps> = ({
  card,
  layout,
  accentColor,
  categoryColor,
  isOpen,
  onToggle,
  onHoverOpen,
  onOpenCard,
  onLocate,
  onDragPointerDown,
}) => {
  const spineRef = useRef<HTMLButtonElement | null>(null);
  // 抽出瞬間的螢幕座標（在事件處理中 setState；render 不碰 ref）
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);

  const captureRect = () => {
    const r = spineRef.current?.getBoundingClientRect();
    if (r) setRect({ left: r.left, top: r.top, width: r.width });
  };

  const thickness = bookThicknessFor(card);
  const height = bookHeightFor(card.id);
  // 書脊顏色優先序（§4）：spineColor → 節點 accentColor → 形狀預設色
  const spineHex = resolveSpineColor(layout, accentColor, card.reasoningShape);
  const base = desaturateColor(spineHex, 0.4);
  const shapeDef = SHAPE_DEFS[card.reasoningShape] || SHAPE_DEFS.A;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    captureRect();
    if (isOpen) onOpenCard();
    else onToggle();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    captureRect();
    onDragPointerDown?.(e);
  };

  const previewWidth = 236;

  return (
    <>
      <button
        ref={spineRef}
        type="button"
        data-book-spine="true"
        data-no-orbit="true"
        title={`${card.title}（${shapeDef.name}）`}
        aria-label={`書本：${card.title}`}
        aria-expanded={isOpen}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onMouseEnter={() => {
          captureRect();
          onHoverOpen();
        }}
        className={`study-book-spine relative flex-shrink-0 rounded-t-[3px] rounded-b-[1px] outline-none transition-transform duration-200 ${
          isOpen ? "z-20" : "z-10"
        } focus-visible:ring-2 focus-visible:ring-amber-700`}
        style={{
          width: `${thickness}px`,
          height: `${height}px`,
          // 圓柱光影：左暗→中亮→右暗；書本低飽和（desaturateColor）
          background: `linear-gradient(90deg, ${shade(base, 0.72)} 0%, ${base} 24%, ${shade(base, 1.12)} 55%, ${shade(base, 0.62)} 100%)`,
          borderLeft: `1px solid ${shade(base, 0.55)}`,
          borderRight: `1px solid ${shade(base, 0.5)}`,
          boxShadow: isOpen
            ? `0 10px 18px rgba(64, 42, 18, 0.32), 0 0 0 1px ${shade(base, 0.5)}`
            : `2px 3px 6px rgba(64, 42, 18, 0.22)`,
          transform: isOpen ? "translateZ(26px) translateX(4px)" : "translateZ(0)",
          touchAction: "pan-y",
          minHeight: "32px", // 可點擊面積下限
        }}
      >
        {/* 分類色條（紙膠帶感） */}
        {categoryColor && (
          <span
            className="absolute left-[2px] right-[2px] top-[10px] h-[5px] rounded-[2px]"
            style={{ backgroundColor: categoryColor, boxShadow: `0 1px 0 ${shade(categoryColor, 0.7)}` }}
          />
        )}
        {/* 書名（直排、可截斷） */}
        <span
          className="absolute inset-x-[3px] top-[22px] bottom-[16px] overflow-hidden text-left font-semibold leading-tight"
          style={{
            writingMode: "vertical-rl",
            fontSize: "11px",
            color: shade(base, 0.32),
            textShadow: "0 1px 0 rgba(255,255,255,0.28)",
            letterSpacing: "0.06em",
          }}
        >
          {card.title || "（未命名）"}
        </span>
        {/* 形狀色底線 */}
        <span
          className="absolute left-[3px] right-[3px] bottom-[5px] h-[4px] rounded-[2px]"
          style={{ backgroundColor: shapeDef.hex, opacity: 0.85 }}
        />
      </button>

      {/* 抽出預覽（書封卡）：portal 到畫面層，維持可讀、不被書架裁切 */}
      {isOpen &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            data-book-preview="true"
            data-no-orbit="true"
            className="study-book-preview fixed z-[95] rounded-xl border border-amber-200/80 bg-[#faf5ea] p-3 shadow-2xl"
            style={{
              width: `${previewWidth}px`,
              left: `${Math.max(12, Math.min(window.innerWidth - previewWidth - 12, rect.left + rect.width / 2 - previewWidth / 2))}px`,
              top: `${Math.max(12, rect.top - 12)}px`,
              transform: "translateY(-100%)",
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full rounded-full" style={{ backgroundColor: spineHex }} />
            <h4 className="mt-2 text-sm font-bold leading-snug text-stone-800 line-clamp-2">{card.title || "（未命名）"}</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="rounded bg-stone-200/70 px-1.5 py-0.5 text-[10px] text-stone-700">{card.domain || "未分類領域"}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: shapeDef.hex }}
              >
                {card.reasoningShape} {shapeDef.name}
              </span>
              {categoryColor && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: categoryColor }}
                >
                  分類色
                </span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-stone-600">
              {firstSummaryLine(card)}
            </p>
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCard();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="touch-target flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-800 px-2 py-1.5 text-[11px] font-semibold text-amber-50 transition-opacity hover:opacity-90"
              >
                <BookOpen className="h-3 w-3" />
                開啟筆記卡
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLocate();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="touch-target flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-50"
              >
                <Crosshair className="h-3 w-3" />
                在畫布定位
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
