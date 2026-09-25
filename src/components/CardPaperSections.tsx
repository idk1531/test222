"use client";

import React, { useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import {
  Lock,
  Lightbulb,
  HelpCircle,
  CheckCircle,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  OctagonAlert,
  ClipboardCheck,
  ShieldCheck,
  KeyRound,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  ArrowRight,
  GitBranch,
  Layers,
  FileCheck,
  Clock,
  Printer,
  Palette,
  Sliders,
} from "lucide-react";
import {
  epistemicLabel,
  relationLabelText,
  STATUS_COMPILED,
  STATUS_UNCOMPILED,
  ORIGIN_MARK,
  normalizeLogType,
} from "@/lib/inspect";
import { SHAPE_DEFS } from "./ShapeClassifier";
import type { CheckResult, FourPointReport } from "@/lib/inspect";
import { SOLO_LEVELS } from "./SoloAssessmentPanel";

const UI_FONT = "'Varela Round', sans-serif";

/** v6 主題配色設定結構 */
export interface CardPaperTheme {
  name: string;
  paperBg: string;
  textColor: string;
  mutedTextColor: string;
  headingColor: string;
  borderColor: string;
  boxBg: string;
  accentColor: string;
  gridLineColor: string;
  showGrid: boolean;
  gridSize: number; // px, 預設 20
}

/** 內建預設主題 */
export const THEME_PRESETS: Record<string, CardPaperTheme> = {
  classic_grid: {
    name: "經典米黃方格 (PDF 原版)",
    paperBg: "#FAF7EE",
    textColor: "#27272a",
    mutedTextColor: "#71717a",
    headingColor: "#18181b",
    borderColor: "#8c7d6b",
    boxBg: "rgba(255, 255, 255, 0.72)",
    accentColor: "#b45309",
    gridLineColor: "rgba(168, 145, 110, 0.22)",
    showGrid: true,
    gridSize: 20,
  },
  clean_white: {
    name: "極簡白方格",
    paperBg: "#FFFFFF",
    textColor: "#1e293b",
    mutedTextColor: "#64748b",
    headingColor: "#0f172a",
    borderColor: "#94a3b8",
    boxBg: "#f8fafc",
    accentColor: "#2563eb",
    gridLineColor: "rgba(148, 163, 184, 0.2)",
    showGrid: true,
    gridSize: 20,
  },
  blueprint_cyan: {
    name: "天青工學方格",
    paperBg: "#F0F7FA",
    textColor: "#164e63",
    mutedTextColor: "#0e7490",
    headingColor: "#155e75",
    borderColor: "#0891b2",
    boxBg: "rgba(255, 255, 255, 0.8)",
    accentColor: "#0284c7",
    gridLineColor: "rgba(6, 182, 212, 0.22)",
    showGrid: true,
    gridSize: 20,
  },
  vintage_kraft: {
    name: "復古牛皮紙",
    paperBg: "#F5ECD7",
    textColor: "#3e2723",
    mutedTextColor: "#5d4037",
    headingColor: "#271c19",
    borderColor: "#8d6e63",
    boxBg: "rgba(255, 255, 255, 0.6)",
    accentColor: "#c2410c",
    gridLineColor: "rgba(141, 110, 99, 0.26)",
    showGrid: true,
    gridSize: 20,
  },
  dark_slate: {
    name: "暗黑石墨方格",
    paperBg: "#1E293B",
    textColor: "#E2E8F0",
    mutedTextColor: "#94A3B8",
    headingColor: "#F8FAFC",
    borderColor: "#475569",
    boxBg: "rgba(15, 23, 42, 0.7)",
    accentColor: "#38bdf8",
    gridLineColor: "rgba(148, 163, 184, 0.16)",
    showGrid: true,
    gridSize: 20,
  },
};

export const DEFAULT_PAPER_THEME: CardPaperTheme = THEME_PRESETS.classic_grid;

/** 產生方格紙背景 CSS */
export function getGridPaperStyle(theme: CardPaperTheme) {
  if (!theme.showGrid) {
    return {
      backgroundColor: theme.paperBg,
      color: theme.textColor,
    };
  }
  const size = theme.gridSize || 20;
  return {
    backgroundColor: theme.paperBg,
    color: theme.textColor,
    backgroundImage: `linear-gradient(to right, ${theme.gridLineColor} 1px, transparent 1px), linear-gradient(to bottom, ${theme.gridLineColor} 1px, transparent 1px)`,
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: "0 0",
  };
}

/**
 * 左側貫穿頁面的「里程尺」（Milestone Vertical Track）
 * 包含 5 個主幹節點：背景、構造、WHY、WHAT、APPLY
 */
export function MilestoneRuler({
  activeKey,
  onSelectSection,
  theme = DEFAULT_PAPER_THEME,
}: {
  activeKey: "header" | "background" | "construction" | "why" | "what" | "apply" | "logs";
  onSelectSection?: (key: "header" | "background" | "construction" | "why" | "what" | "apply" | "logs") => void;
  theme?: CardPaperTheme;
}) {
  const NODES: Array<{
    key: "background" | "construction" | "why" | "what" | "apply";
    label: string;
    targetPage: number;
  }> = [
    { key: "background", label: "背景", targetPage: 1 },
    { key: "construction", label: "構造", targetPage: 2 },
    { key: "why", label: "WHY", targetPage: 3 },
    { key: "what", label: "WHAT", targetPage: 4 },
    { key: "apply", label: "APPLY", targetPage: 5 },
  ];

  return (
    <div className="w-9 flex-shrink-0 flex flex-col items-center py-6 select-none relative z-10 print:hidden">
      {/* 貫穿虛線軌道 */}
      <div
        className="absolute top-4 bottom-4 left-1/2 -translate-x-1/2 w-0.5 border-r border-dashed"
        style={{ borderColor: theme.borderColor, opacity: 0.55 }}
      />

      <div className="flex flex-col justify-between h-full relative z-10 py-2 w-full items-center gap-12 sm:gap-16">
        {NODES.map((n) => {
          const isActive = activeKey === n.key;
          return (
            <button
              key={n.key}
              onClick={() => onSelectSection?.(n.key)}
              title={`跳轉至【${n.label}】`}
              className="group flex flex-col items-center gap-1 focus:outline-none transition-transform hover:scale-110"
            >
              <div
                className={`w-3.5 h-3.5 rounded-full transition-all border-2 flex items-center justify-center ${
                  isActive ? "shadow-sm scale-110 ring-2 ring-offset-1" : "bg-white"
                }`}
                style={{
                  backgroundColor: isActive ? theme.accentColor : theme.paperBg,
                  borderColor: theme.accentColor,
                  color: isActive ? "#ffffff" : theme.textColor,
                }}
              />
              <span
                className={`text-[9px] font-bold tracking-tight writing-vertical transition-colors ${
                  isActive ? "font-extrabold" : "opacity-60 group-hover:opacity-100"
                }`}
                style={{
                  fontFamily: UI_FONT,
                  color: isActive ? theme.accentColor : theme.textColor,
                }}
              >
                {n.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 頁首標題欄（仿 PDF 線框方格） */
export function V6PageHeaderBox({
  title,
  subtitle,
  pageNumber,
  theme = DEFAULT_PAPER_THEME,
}: {
  title: string;
  subtitle?: string;
  pageNumber: string; // e.g. "1/7"
  theme?: CardPaperTheme;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="px-2.5 py-1 text-sm font-bold tracking-wider rounded-sm border"
            style={{
              borderColor: theme.borderColor,
              backgroundColor: theme.boxBg,
              color: theme.headingColor,
              fontFamily: UI_FONT,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <p className="text-[11px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
              {subtitle}
            </p>
          )}
        </div>
        <div
          className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm border flex-shrink-0"
          style={{
            borderColor: theme.borderColor,
            backgroundColor: theme.boxBg,
            color: theme.headingColor,
          }}
        >
          {pageNumber}
        </div>
      </div>
    </div>
  );
}

/** 頁腳標註（仿 PDF 底部字樣） */
export function V6PageFooter({
  note,
  theme = DEFAULT_PAPER_THEME,
}: {
  note: string;
  theme?: CardPaperTheme;
}) {
  return (
    <div
      className="mt-auto pt-3 border-t text-[10px] text-center tracking-tight leading-relaxed select-none"
      style={{
        borderColor: theme.borderColor,
        color: theme.mutedTextColor,
        fontFamily: UI_FONT,
        opacity: 0.85,
      }}
    >
      理科筆記卡片模板 v6 · A4/B5方格紙 · {note}
    </div>
  );
}

// =========================================================================
//  Page 1 / 7 : 【卡頭】 Overview · Relations · Bloom/SOLO · Table of Contents
// =========================================================================

export function V6Page1HeaderOverview({
  card,
  font,
  relations,
  cardTitles,
  theme = DEFAULT_PAPER_THEME,
  onNavigatePage,
}: {
  card: CardData;
  font: string;
  relations?: Array<any>;
  cardTitles?: Record<string, string>;
  theme?: CardPaperTheme;
  onNavigatePage?: (pageIdx: number) => void;
}) {
  const shapeDef = SHAPE_DEFS[card.reasoningShape] || SHAPE_DEFS.A;
  const isComposite = card.reasoningShape === "COMPOSITE";

  // 卡片標籤計算
  const hasBranches = (card.howData?.branches?.length || 0) > 1;
  const isContinuous = card.reasoningShape === "A";
  const isSeparable = card.reasoningShape === "B";
  const isFramework = card.reasoningShape === "D";
  const isConvention = card.reasoningShape === "E";

  const rels = (relations || []).filter((r: any) => r.fromCardId === card.id || r.toCardId === card.id);

  // Bloom 階梯
  const BLOOM_LEVELS = ["記憶", "理解", "應用", "分析", "評鑑", "創造"];
  const activeBloomIdx = BLOOM_LEVELS.indexOf(card.bloomLevel || "理解");

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="卡頭"
        subtitle="名稱｜領域｜顆粒度等級——關係邊、診斷標籤整頁併入卡頭，不另外分頁"
        pageNumber="1/7"
        theme={theme}
      />

      {/* 名稱 / 領域 / 顆粒度 */}
      <div
        className="p-3.5 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <div>
            <span className="text-[11px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
              名稱：
            </span>
            <span className="text-xl font-bold ml-1" style={{ color: theme.headingColor, fontFamily: font }}>
              <MathText text={card.title} />
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
              領域：
            </span>
            <span className="text-base font-semibold ml-1" style={{ color: theme.textColor, fontFamily: font }}>
              {card.domain || "未指定領域"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t" style={{ borderColor: theme.borderColor, opacity: 0.9 }}>
          <span className="text-[11px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            顆粒度：
          </span>
          <label className="flex items-center gap-1 text-xs cursor-default" style={{ fontFamily: UI_FONT }}>
            <span className="w-3.5 h-3.5 border rounded-xs inline-flex items-center justify-center text-[10px] bg-white font-mono" style={{ borderColor: theme.borderColor }}>
              {card.granularity?.startsWith("L1") || card.granularity?.startsWith("L2") ? "✓" : ""}
            </span>
            核心卡 ({card.granularity || "L2"})
          </label>
          <label className="flex items-center gap-1 text-xs cursor-default" style={{ fontFamily: UI_FONT }}>
            <span className="w-3.5 h-3.5 border rounded-xs inline-flex items-center justify-center text-[10px] bg-white font-mono" style={{ borderColor: theme.borderColor }}>
              {card.granularity?.startsWith("L3") || card.granularity?.startsWith("L4") ? "✓" : ""}
            </span>
            簡單標籤
          </label>
          <span
            className="text-[10px] px-2 py-0.5 rounded text-white font-medium ml-auto"
            style={{ backgroundColor: theme.accentColor }}
          >
            {isComposite && card.compositeShapes?.length
              ? `複合型 ${card.compositeShapes.join(" + ")}`
              : `${card.reasoningShape} ${shapeDef.name}`}
          </span>
        </div>
      </div>

      {/* 卡片標籤（可複選） & 互斥二選一 */}
      <div
        className="p-3 rounded-sm border space-y-1.5"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.headingColor }}>
            卡片標籤（可複選）
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "[有分支]", active: hasBranches },
            { label: "[連續鏈]", active: isContinuous },
            { label: "[存在性可分離]", active: isSeparable },
            { label: "[前提依賴]", active: isFramework || (rels.length > 0) },
            { label: "[純約定]", active: isConvention },
          ].map((tag, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded border text-[11px] transition-all ${
                tag.active ? "font-bold shadow-xs" : "opacity-45"
              }`}
              style={{
                borderColor: tag.active ? theme.accentColor : theme.borderColor,
                backgroundColor: tag.active ? `${theme.accentColor}18` : "transparent",
                color: tag.active ? theme.accentColor : theme.textColor,
              }}
            >
              {tag.label}
            </span>
          ))}
        </div>
        <div className="text-[11px] pt-1.5 flex flex-wrap items-center gap-2" style={{ color: theme.mutedTextColor }}>
          <span className="font-bold">互斥二選一：</span>
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${!card.omittedSlots?.some(s => s.slot === "WHAT") ? "font-bold text-emerald-800 border-emerald-400 bg-emerald-50" : "opacity-40"}`}>
            [通用技巧]（WHAT不能省）
          </span>
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${card.omittedSlots?.some(s => s.slot === "WHAT") ? "font-bold text-amber-800 border-amber-400 bg-amber-50" : "opacity-40"}`}>
            [一次性結論]（WHAT可省需註明原因）
          </span>
        </div>
      </div>

      {/* 摘要 · WHY / WHAT / APPLY（各一行） */}
      <div
        className="p-3 rounded-sm border space-y-1.5"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="text-[11px] font-bold tracking-tight" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
          摘要 · WHY / WHAT / APPLY（各一行，完整內容見對應頁）
        </div>
        <div className="text-[12px] space-y-1" style={{ fontFamily: font, color: theme.textColor }}>
          <div className="flex items-baseline gap-1">
            <span className="font-bold flex-shrink-0" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              WHY：
            </span>
            <span className="truncate">
              <MathText text={card.whyData?.closedBookDraft || card.whyData?.fullReasoning?.slice(0, 70) || "（見 WHY 頁深度推導）"} />
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-bold flex-shrink-0" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              視角①②③：
            </span>
            <span className="truncate">
              {(card.whatData?.perspectives || []).map((p) => p.label || p.code).join(" ； ") || "（見 WHAT 頁多視角展開）"}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-bold flex-shrink-0" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              CHECK/分支/CAN：
            </span>
            <span className="truncate">
              {card.howData?.checks?.length ? `CHECK: ${card.howData.checks[0].cue} → ` : ""}
              {card.howData?.branches?.map((b) => b.title || b.action?.slice(0, 15)).join(" / ") || "（見 APPLY 頁程序表）"}
            </span>
          </div>
        </div>
      </div>

      {/* 關係邊 RELATIONS (羅盤雷達 + 清單說明) */}
      <div
        className="p-3 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
            關係邊 RELATIONS —— 沒有邊＝孤島，自檢時第一個要抓
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* 左側羅盤示意圖 */}
          <div className="md:col-span-5 flex justify-center py-1">
            <div
              className="relative w-48 h-28 rounded-md border flex items-center justify-center p-1 text-[9px]"
              style={{ borderColor: theme.borderColor, backgroundColor: "rgba(255,255,255,0.4)", fontFamily: UI_FONT }}
            >
              <div className="absolute top-1 text-center font-bold text-blue-800">[前提]</div>
              <div className="absolute left-1 text-center font-bold text-slate-600">[表面相似:d=]</div>
              <div className="absolute left-1 bottom-1 font-bold text-amber-800">[對照:d=]</div>
              <div className="absolute right-1 text-center font-bold text-emerald-800">[結構類比:d=]</div>
              <div className="absolute bottom-1 font-bold text-rose-800">[正例]/[反例]</div>
              <div className="absolute right-1 bottom-1 font-bold text-purple-800">[歸屬母題]</div>

              {/* 中心節點與放射線 */}
              <div className="w-3.5 h-3.5 rounded-full bg-slate-800 flex items-center justify-center text-white text-[8px] font-bold shadow-xs">
                ●
              </div>
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                <line x1="50%" y1="50%" x2="50%" y2="15%" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="50%" y1="50%" x2="18%" y2="50%" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="50%" y1="50%" x2="82%" y2="50%" stroke="#1e293b" strokeDasharray="2 2" />
                <line x1="50%" y1="50%" x2="50%" y2="85%" stroke="#1e293b" strokeDasharray="2 2" />
              </svg>
            </div>
          </div>

          {/* 右側規則文字與現存關係邊 */}
          <div className="md:col-span-7 text-[10px] space-y-1 leading-relaxed" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            <p><b className="text-slate-800">[前提]</b>：A是B成立的必要基礎</p>
            <p><b className="text-slate-800">[結構類比:d]</b>：已過候選推理測試——由共享結構能否推出具體、可驗證的新預測</p>
            <p><b className="text-slate-800">[表面相似:d]</b>：感覺像但未驗證，不計入網絡整合度</p>
            <p><b className="text-slate-800">[對照:d] / [正反例] / [母題]</b>：對照須點名分歧維度；母題需≥3實例+雙達標</p>
            {rels.length > 0 && (
              <div className="mt-1.5 pt-1.5 border-t space-y-1" style={{ borderColor: theme.borderColor }}>
                <span className="font-bold text-slate-800">已連接的關係邊 ({rels.length})：</span>
                <div className="flex flex-wrap gap-1">
                  {rels.map((r, ri) => (
                    <span key={ri} className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px]">
                      {r.label || relationLabelText(r.relationType)} → {(cardTitles && cardTitles[r.toCardId]) || r.toTitle || r.toCardId}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 診斷標籤 BLOOM · SOLO */}
      <div
        className="p-3 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
          診斷標籤 BLOOM · SOLO —— 隔一陣子重新評估，不是造卡當下就定案
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Bloom 階梯 */}
          <div className="sm:col-span-6 space-y-1">
            <div className="flex items-end justify-between gap-1 h-14 pb-1 border-b" style={{ borderColor: theme.borderColor }}>
              {BLOOM_LEVELS.map((lvl, idx) => {
                const isActive = lvl === card.bloomLevel || idx === activeBloomIdx;
                const heightPercent = 20 + idx * 16;
                return (
                  <div key={lvl} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full rounded-t-xs transition-all"
                      style={{
                        height: `${heightPercent}%`,
                        backgroundColor: isActive ? theme.accentColor : "rgba(148,163,184,0.3)",
                      }}
                    />
                    <span
                      className={`text-[8px] mt-0.5 truncate ${isActive ? "font-bold" : "opacity-60"}`}
                      style={{ color: isActive ? theme.accentColor : theme.textColor, fontFamily: UI_FONT }}
                    >
                      {lvl}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-[9px] text-center" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
              當前 Bloom: <b style={{ color: theme.headingColor }}>{card.bloomLevel || "分析"}</b>
            </div>
          </div>

          {/* SOLO 整合度與判準 */}
          <div className="sm:col-span-6 text-[10px] leading-tight space-y-1" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">SOLO 整合度：</span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                {card.soloData?.declaredLevel || card.soloLevel || "Relational 關聯"}
              </span>
            </div>
            <p>
              判準：不是「邊多就算」，而是「這些邊能不能實際參與推理」——裝飾性連線不算，[表面相似]不算有效整合。
            </p>
          </div>
        </div>
      </div>

      {/* 頁數索引 (Table of Contents) */}
      <div
        className="p-3 rounded-sm border"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="text-[11px] font-bold mb-2" style={{ color: theme.headingColor }}>
          頁數索引 (點選直接跳頁)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
          {[
            { title: "背景", page: 2 },
            { title: "構造思路", page: 3 },
            { title: "WHY", page: 4 },
            { title: "WHAT", page: 5 },
            { title: "APPLY", page: 6 },
            { title: "過程日誌", page: 7 },
          ].map((item) => (
            <button
              key={item.title}
              onClick={() => onNavigatePage?.(item.page - 1)}
              className="flex items-center justify-between text-left hover:opacity-75 transition-opacity py-0.5 border-b border-dotted"
              style={{ borderColor: theme.borderColor }}
            >
              <span style={{ color: theme.textColor }}>{item.title} ·····</span>
              <span className="font-mono font-bold" style={{ color: theme.accentColor }}>
                {item.page} 頁
              </span>
            </button>
          ))}
        </div>
      </div>

      <V6PageFooter
        note="關係邊/診斷標籤整頁併入卡頭，不再單獨分頁；左側里程尺貫穿全部頁面"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 2 / 7 : 【背景】 Background (梯形收窄條)
// =========================================================================

export function V6Page2Background({
  card,
  font,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  theme?: CardPaperTheme;
}) {
  const bgData = card.backgroundData || {};
  const calib = card.constructionCalibration;

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="背景"
        subtitle="從寬泛情境，一層層收窄到精確問題——框變窄，不是變小，字照樣寫滿整框"
        pageNumber="2/7"
        theme={theme}
      />

      {/* 理解問題信心分打分 */}
      <div
        className="p-2.5 rounded-sm border flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: theme.headingColor }}>
            理解問題信心分（動筆前）：
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((num) => (
              <span
                key={num}
                className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold border ${
                  (calib?.confidenceBefore || 3) >= num
                    ? "bg-amber-400 text-amber-950 border-amber-500 shadow-xs"
                    : "bg-white text-slate-400 border-slate-300"
                }`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: theme.headingColor }}>
            寫完後重打一次：
          </span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((num) => (
              <span
                key={num}
                className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold border ${
                  (calib?.confidenceAfter || 4) >= num
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                    : "bg-white text-slate-400 border-slate-300"
                }`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 梯形收窄條：三段式 */}
      <div className="space-y-3 flex flex-col items-center w-full">
        {/* 第一段 · 情境（最寬 100%） */}
        <div
          className="w-full p-3.5 rounded-sm border transition-all"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              第一段 · 情境（最寬）
            </span>
          </div>
          <p className="text-[10px] mb-2 leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            給 1~2 個引出問題的具體情境。若給 2 個，第二個最好共用第一個的具體對象、只換一個變數對照。須選同一領域的對象，不牽扯出需要額外背景知識的領域。
          </p>
          <div className="text-sm leading-relaxed" style={{ color: theme.textColor, fontFamily: font }}>
            <MathText text={bgData.situation || card.backgroundDescription || "（尚未填寫情境）"} />
          </div>
        </div>

        {/* 第二段 · 精確對象 + 情境語言搭配（收窄 ~84%） */}
        <div
          className="w-full sm:w-[86%] p-3.5 rounded-sm border transition-all shadow-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              第二段 · 精確對象 + 情境語言搭配（收窄）
            </span>
          </div>
          <p className="text-[10px] mb-2 leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            寫成精確的數學對象/式子；一般化之後不能脫離情境語言。可精確寫出的形式，先給形式、再給動機。
          </p>
          <div className="text-sm leading-relaxed" style={{ color: theme.textColor, fontFamily: font }}>
            <MathText text={bgData.preciseObject || "（尚未填寫精確對象）"} />
          </div>
        </div>

        {/* 第三段 · 精確對應的問題（最窄 ~70%） */}
        <div
          className="w-full sm:w-[72%] p-3.5 rounded-sm border transition-all shadow-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              第三段 · 精確對應的問題（最窄）
            </span>
          </div>
          <p className="text-[10px] mb-2 leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            必須精確對應回第一段的具體對象，不能寫成脫離情境的泛問句。
          </p>
          <div className="text-sm leading-relaxed font-medium" style={{ color: theme.textColor, fontFamily: font }}>
            <MathText text={bgData.preciseQuestion || "（尚未填寫精確問題）"} />
          </div>
        </div>
      </div>

      {/* 第四段 · 歷史線 + 聯繫（另起一段 100%） */}
      <div
        className="w-full p-3.5 rounded-sm border"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
            第四段 · 歷史線 + 聯繫（不屬於收窄這條主線，另起一段）
          </span>
        </div>
        <p className="text-[10px] mb-2 leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          歷史線：具體到當時是誰、什麼年代、卡在哪個矛盾，標 [歷史起源]。聯繫：歷史事件跟第一段情境是不是同一困境的一次具體發生——挖不到有意義的聯繫就不寫，不用硬湊。
        </p>
        <div className="text-xs space-y-1.5 leading-relaxed" style={{ color: theme.textColor, fontFamily: font }}>
          {card.originData?.historicalContext && (
            <p>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[歷史起源] </b>
              <MathText text={card.originData.historicalContext} />
            </p>
          )}
          {card.originData?.conflict && (
            <p>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[矛盾焦點] </b>
              <MathText text={card.originData.conflict} />
            </p>
          )}
          {!card.originData?.historicalContext && !card.originData?.conflict && (
            <p className="italic" style={{ color: theme.mutedTextColor }}>（尚未填寫歷史起源與矛盾）</p>
          )}
        </div>
      </div>

      {/* 底部 PS 註記 */}
      <div
        className="p-2.5 rounded-sm border text-[11px] leading-relaxed"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        <b>PS · </b>四段合起來要讓讀者知道五件事：為什麼需要、為什麼出現、出現原因、如何被想出來、什麼情境下的問題逼出來的。
      </div>

      <V6PageFooter
        note="版式：梯形收窄條（三框依次收窄居中對齊，高度不變，字滿寫在框內）"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 3 / 7 : 【構造思路】 Construction Thinking (收斂漏斗)
// =========================================================================

export function V6Page3ConstructionThinking({
  card,
  font,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  theme?: CardPaperTheme;
}) {
  const candidate = card.candidate || {};
  const plan = card.plan || {};

  // 構造思路追問點
  const constructionProbes = (card.thoughtPoints || []).filter(
    (t) => t.placement === "construction" || !t.placement
  );
  const probe1 = constructionProbes[0];
  const probe2 = constructionProbes[1];

  const [openAnswer1, setOpenAnswer1] = useState(false);
  const [openAnswer2, setOpenAnswer2] = useState(false);

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="構造思路"
        subtitle="可選——僅當有巧妙構造/技法時才寫；多條追問路徑，最後收斂成同一個計畫"
        pageNumber="3/7"
        theme={theme}
      />

      {/* 判準說明 */}
      <div
        className="p-2.5 rounded-sm border text-[11px] leading-relaxed"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        <b style={{ color: theme.headingColor }}>判準（跟背景第四段區分）：</b>
        邏輯上可重複撞見的困境 → 構造思路；歷史上綁定人事時地 → 背景第四段。只有一條追問路徑時，右側追問②留空即可，不用硬湊第二條。
      </div>

      {/* 候選登場 (滿寬框) */}
      <div
        className="p-3.5 rounded-sm border space-y-1.5"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            候選登場
          </span>
        </div>
        <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          提出候選工具，交代「為什麼會想到測試它」，明確不下結論。必須往回追溯到已經確立的「要求」，說明怎麼摸索到這個具體候選形式的——不能讓候選人像是憑空被選中的。
        </p>
        <div className="text-sm space-y-1 leading-relaxed pt-1" style={{ color: theme.textColor, fontFamily: font }}>
          {candidate.requirement && (
            <p>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[已確立要求] </b>
              <MathText text={candidate.requirement} />
            </p>
          )}
          {candidate.candidateForm && (
            <p>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[候選工具形式] </b>
              <MathText text={candidate.candidateForm} />
            </p>
          )}
          {candidate.motivation && (
            <p>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[摸索動機] </b>
              <MathText text={candidate.motivation} />
            </p>
          )}
          {!candidate.requirement && !candidate.candidateForm && !candidate.motivation && (
            <p className="italic" style={{ color: theme.mutedTextColor }}>（尚未填寫候選登場摸索）</p>
          )}
        </div>
      </div>

      {/* 並排雙欄：② 路徑 · 追問① 與 追問② */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 左欄：追問① */}
        <div
          className="p-3.5 rounded-sm border space-y-2 flex flex-col"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            ② 路徑 · 追問①
          </span>
          <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            主動自問的啟發式問句，只記錄問過什麼、指向什麼方向，不放完整推導（推導挪去 WHY）
          </p>
          <div className="flex-1 space-y-2 pt-1">
            <div
              className="p-2 rounded border bg-amber-50/60 text-xs font-semibold"
              style={{ borderColor: theme.borderColor, color: theme.headingColor, fontFamily: font }}
            >
              【追問 · {probe1?.modeName || "啟發式問句"}】
              <div className="mt-1 font-normal text-slate-800">
                <MathText text={probe1?.question || "（自問核心思考障礙是什麼？）"} />
              </div>
            </div>

            <button
              onClick={() => setOpenAnswer1(!openAnswer1)}
              className="text-[11px] flex items-center gap-1 font-bold text-amber-800 hover:underline"
              style={{ fontFamily: UI_FONT }}
            >
              {openAnswer1 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {openAnswer1 ? "收合答案" : "→ (點擊揭曉答案，完整推導見 WHY)"}
            </button>

            {openAnswer1 && (
              <div
                className="p-2 rounded bg-white/90 border text-xs leading-relaxed"
                style={{ borderColor: theme.borderColor, color: theme.textColor, fontFamily: font }}
              >
                <MathText text={probe1?.answer || "（此追問指引了最終的收斂計畫）"} />
              </div>
            )}
          </div>
        </div>

        {/* 右欄：追問②（若有） */}
        <div
          className="p-3.5 rounded-sm border space-y-2 flex flex-col"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            ② 路徑 · 追問②（若有）
          </span>
          <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            同一份「要求」下摸索出的另一條問句，不是重複——不同問題指向同一個計畫
          </p>
          <div className="flex-1 space-y-2 pt-1">
            {probe2 ? (
              <>
                <div
                  className="p-2 rounded border bg-amber-50/60 text-xs font-semibold"
                  style={{ borderColor: theme.borderColor, color: theme.headingColor, fontFamily: font }}
                >
                  【追問 · {probe2.modeName || "思維模式"}】
                  <div className="mt-1 font-normal text-slate-800">
                    <MathText text={probe2.question} />
                  </div>
                </div>

                <button
                  onClick={() => setOpenAnswer2(!openAnswer2)}
                  className="text-[11px] flex items-center gap-1 font-bold text-amber-800 hover:underline"
                  style={{ fontFamily: UI_FONT }}
                >
                  {openAnswer2 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {openAnswer2 ? "收合答案" : "→ (點擊揭曉答案，完整推導見 WHY)"}
                </button>

                {openAnswer2 && (
                  <div
                    className="p-2 rounded bg-white/90 border text-xs leading-relaxed"
                    style={{ borderColor: theme.borderColor, color: theme.textColor, fontFamily: font }}
                  >
                    <MathText text={probe2.answer} />
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center border border-dashed rounded p-4 text-[11px] text-slate-400 italic">
                （單一追問路徑已足夠，右側追問②留空）
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 匯聚漏斗視覺圖形 (Convergence Funnel Arrow) */}
      <div className="flex flex-col items-center justify-center py-1 opacity-75">
        <svg width="120" height="28" viewBox="0 0 120 28" fill="none">
          <path d="M10 2 L60 22 L110 2" stroke={theme.accentColor} strokeWidth="2" strokeLinecap="round" />
          <path d="M55 16 L60 23 L65 16" fill={theme.accentColor} />
        </svg>
      </div>

      {/* 計畫（收尾——所有路徑收斂在這裡） */}
      <div
        className="p-3.5 rounded-sm border space-y-1.5 shadow-sm"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            計畫（收尾——所有路徑收斂在這裡）
          </span>
        </div>
        <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          打算證什麼、用什麼方法證、範圍劃在哪裡。必須說明為什麼是這個順序、為什麼這幾步合起來才夠——不是並列清單。
        </p>
        <div className="space-y-2 pt-1 text-xs" style={{ color: theme.textColor, fontFamily: font }}>
          {plan.steps && plan.steps.length > 0 ? (
            <div className="space-y-1.5">
              {plan.steps.map((st, si) => (
                <div key={st.id || si} className="flex items-start gap-2 bg-white/70 p-2 rounded border" style={{ borderColor: theme.borderColor }}>
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-mono flex-shrink-0">
                    {si + 1}
                  </span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900">
                      <MathText text={st.label} />
                    </div>
                    {st.rationale && (
                      <div className="text-[11px] text-slate-600 mt-0.5" style={{ fontFamily: UI_FONT }}>
                        ↳ 順序依賴：<MathText text={st.rationale} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="italic text-slate-400">（尚未填寫收斂計畫）</p>
          )}

          {plan.ranges && (
            <div className="text-[11px] p-2 rounded bg-amber-50/70 border border-amber-200 text-amber-900" style={{ fontFamily: UI_FONT }}>
              <b>範圍劃定（誠實標註）：</b>
              <MathText text={plan.ranges} />
            </div>
          )}
        </div>
      </div>

      <V6PageFooter
        note="版式：收斂漏斗（多條追問路徑並排，匯聚線收進同一個計畫方框）"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 4 / 7 : 【WHY】 Depth Reasoning (不對稱塔木德式)
// =========================================================================

export function V6Page4Why({
  card,
  font,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  theme?: CardPaperTheme;
}) {
  const whyData = card.whyData || { confidenceBefore: 3, confidenceAfter: 5, closedBookDraft: "", fullReasoning: "" };
  const claims = card.claims || [];
  const assumptions = card.assumptions || [];
  const whyProbes = (card.thoughtPoints || []).filter((t) => t.placement === "why");

  const [openWhyAnswer, setOpenWhyAnswer] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="WHY"
        subtitle="完整教學稿，不壓縮——同時服務「教會零基礎的人」和「複習加深理解」"
        pageNumber="4/7"
        theme={theme}
      />

      {/* 頂部信心分評估與核心指示 */}
      <div
        className="p-2.5 rounded-sm border flex flex-wrap items-center justify-between gap-2 text-xs leading-tight"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <p style={{ color: theme.mutedTextColor }}>
          落筆/寫完各打一次理解信心分 (1-5)。至少兩個失效模式不同的正交視角——每個視角的失效模式，必須能在 APPLY·CHECK 裡找到對應檢查項。推理走到關鍵轉折點插入追問點：問題→讀者自己想過一次→答案。
        </p>
      </div>

      {/* 不對稱塔木德式版面：左側主正文 72% + 右側 Margin 評注欄 28% */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 items-start">
        {/* 左側主正文 (72% 寬度, md:col-span-8) */}
        <div
          className="md:col-span-8 p-3.5 rounded-sm border space-y-3 shadow-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          {/* 正交視角 1 & 2 */}
          {(whyData.perspective1 || whyData.perspective2) && (
            <div className="space-y-2 pb-2 border-b" style={{ borderColor: theme.borderColor }}>
              {whyData.perspective1 && (
                <div className="p-2.5 rounded bg-white/70 border" style={{ borderColor: theme.borderColor }}>
                  <div className="flex items-center justify-between text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                    <span>視角 1 · {whyData.perspective1.name || "視角一"}</span>
                    {whyData.perspective1.failureMode && (
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        失效模式: {whyData.perspective1.failureMode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs leading-relaxed mt-1" style={{ color: theme.textColor, fontFamily: font }}>
                    <MathText text={whyData.perspective1.content} />
                  </div>
                </div>
              )}

              {whyData.perspective2 && (
                <div className="p-2.5 rounded bg-white/70 border" style={{ borderColor: theme.borderColor }}>
                  <div className="flex items-center justify-between text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                    <span>視角 2 · {whyData.perspective2.name || "視角二"}</span>
                    {whyData.perspective2.failureMode && (
                      <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        失效模式: {whyData.perspective2.failureMode}
                      </span>
                    )}
                  </div>
                  <div className="text-xs leading-relaxed mt-1" style={{ color: theme.textColor, fontFamily: font }}>
                    <MathText text={whyData.perspective2.content} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 完整論證推導主幹 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              完整論證與推導教學稿
            </span>
            <div className="text-sm leading-relaxed space-y-2" style={{ color: theme.textColor, fontFamily: font }}>
              <MathText text={whyData.fullReasoning || whyData.closedBookDraft || "（尚未填寫 WHY 完整論證）"} />
            </div>
          </div>

          {/* 關鍵轉折追問點 */}
          {whyProbes.length > 0 && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: theme.borderColor }}>
              <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                關鍵轉折追問點（Slamecka 測試效應）
              </span>
              {whyProbes.map((pr) => {
                const isOpen = openWhyAnswer[pr.id] || false;
                return (
                  <div key={pr.id} className="p-2 rounded bg-amber-50/70 border border-amber-200 text-xs">
                    <div className="font-bold text-amber-900" style={{ fontFamily: UI_FONT }}>
                      【追問 · {pr.modeName}】
                    </div>
                    <div className="mt-0.5 font-normal" style={{ color: theme.textColor, fontFamily: font }}>
                      <MathText text={pr.question} />
                    </div>
                    <button
                      onClick={() => setOpenWhyAnswer({ ...openWhyAnswer, [pr.id]: !isOpen })}
                      className="text-[10px] font-bold text-amber-800 hover:underline mt-1 block"
                      style={{ fontFamily: UI_FONT }}
                    >
                      {isOpen ? "收合答案" : "→ (讀者先想一次再點此揭曉答案)"}
                    </button>
                    {isOpen && (
                      <div className="mt-1 pt-1 border-t border-amber-200 text-xs text-slate-800" style={{ fontFamily: font }}>
                        <MathText text={pr.answer} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 子目標聲明 */}
          {whyData.subGoals && whyData.subGoals.length > 0 && (
            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: theme.borderColor }}>
              <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                子目標聲明（必要性與充分性）
              </span>
              <div className="space-y-1">
                {whyData.subGoals.map((sg, sgi) => (
                  <div key={sg.id || sgi} className="p-2 rounded bg-white/60 border text-xs" style={{ borderColor: theme.borderColor }}>
                    <div className="font-bold text-slate-900">{sg.goal}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5" style={{ fontFamily: UI_FONT }}>
                      必要性：{sg.whyNecessary} ｜ 充分性：{sg.whySufficient}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側 Margin 評注欄 (28% 寬度, md:col-span-4) */}
        <div className="md:col-span-4 space-y-2 text-xs">
          {/* 認識論地位錨點卡片 */}
          <div
            className="p-2.5 rounded-sm border space-y-1.5"
            style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
          >
            <div className="text-[10px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              認識論地位錨點格式
            </div>
            <div className="text-[10px] space-y-0.5 leading-tight font-mono" style={{ color: theme.mutedTextColor }}>
              <p>[地位:證明/歸納/近似(框架)/約定/公設(框架)]</p>
              <p>[見WHY視角＿]</p>
            </div>
            {claims.length > 0 && (
              <div className="pt-1.5 border-t space-y-1" style={{ borderColor: theme.borderColor }}>
                <span className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                  本卡認識論聲明：
                </span>
                {claims.map((cl) => (
                  <div key={cl.id} className="p-1.5 rounded bg-white/80 border text-[10px]" style={{ borderColor: theme.borderColor }}>
                    <span className="font-bold text-blue-800">[{cl.epistemicMark}] </span>
                    <span style={{ fontFamily: font }}>{cl.text}</span>
                    {cl.anchor && <div className="text-[9px] text-slate-500 mt-0.5">{cl.anchor}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 失效模式對應 APPLY·CHECK */}
          <div
            className="p-2.5 rounded-sm border space-y-1"
            style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
          >
            <div className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
              失效模式對應
            </div>
            <p className="text-[10px] text-slate-600" style={{ fontFamily: UI_FONT }}>
              APPLY · CHECK-1, CHECK-2
            </p>
          </div>

          {/* 來自構造思路 */}
          <div
            className="p-2.5 rounded-sm border space-y-1"
            style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
          >
            <div className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
              來自構造思路
            </div>
            <p className="text-[10px] text-slate-600" style={{ fontFamily: UI_FONT }}>
              路徑追問 ① 候選收斂
            </p>
          </div>

          {/* 視角寫作規則 */}
          <div
            className="p-2.5 rounded-sm border space-y-1 text-[10px]"
            style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
          >
            <div className="font-bold text-slate-800">視角 / 借鏡視角寫作規則：</div>
            <p>(1) 顯式對應表</p>
            <p>(2) 可核驗推論</p>
          </div>

          {/* 假設鎖定清單 */}
          {assumptions.length > 0 && (
            <div
              className="p-2.5 rounded-sm border space-y-1"
              style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
            >
              <div className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                假設鎖定清單
              </div>
              {assumptions.map((as) => (
                <div key={as.id} className="text-[10px] p-1 rounded bg-white/80 border" style={{ borderColor: theme.borderColor }}>
                  <span className="font-bold text-purple-800">[{as.kind || "假設"}] </span>
                  <span style={{ fontFamily: font }}>{as.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部自我檢查提示 */}
      <div
        className="p-2 rounded-sm border text-[10px] leading-relaxed"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        寫完跑八點自我檢查+符號綁定檢查（人名/零基礎/路徑/精確/具體化/工具選擇/證明鏈完整性/新角色登場）——其中⑦證明鏈完整性檢查最重要：貼[地位:證明]前，往回追溯每一步只能歸進「已確立結論/[前提]邊/已標公設或歸納」三類之一。
      </div>

      <V6PageFooter
        note="版式：不對稱塔木德式（正文占大部分寬度+窄margin評註欄）"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 5 / 7 : 【WHAT】 Parallel Perspectives (平行欄位)
// =========================================================================

export function V6Page5What({
  card,
  font,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  theme?: CardPaperTheme;
}) {
  const whatData = card.whatData || { summary: "", perspectives: [], distinctionFromHow: "" };
  const perspectives = whatData.perspectives || [];
  const extensions = whatData.extensions || {};

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="WHAT"
        subtitle="緊接 WHY 之後，換視角重講一次——至少三個視角，不設上限"
        pageNumber="5/7"
        theme={theme}
      />

      {/* WHY 到視角的發散關係連線圖示 */}
      <div className="flex items-center justify-center gap-3 py-1 text-xs" style={{ fontFamily: UI_FONT }}>
        <span className="px-2 py-0.5 rounded border font-bold" style={{ borderColor: theme.borderColor, color: theme.headingColor }}>
          WHY
        </span>
        <ArrowRight className="w-4 h-4" style={{ color: theme.accentColor }} />
        <span className="text-[11px] font-bold" style={{ color: theme.accentColor }}>
          平行多視角闡述
        </span>
      </div>

      {/* 平行欄位：視角①、②、③... */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {perspectives.length > 0 ? (
          perspectives.map((p, idx) => (
            <div
              key={p.code || idx}
              className="p-3 rounded-sm border space-y-2 flex flex-col shadow-xs"
              style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
            >
              <div className="flex items-center justify-between border-b pb-1" style={{ borderColor: theme.borderColor }}>
                <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
                  視角 {idx + 1} · {p.label || p.code}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                <span>□ 視角</span>
                <span>□ 借鏡視角</span>
              </div>
              <div className="text-[10px] font-mono p-1 rounded bg-white/70 border" style={{ borderColor: theme.borderColor }}>
                對應表：{p.code} ↔ {p.label}
              </div>
              <div className="text-xs leading-relaxed flex-1" style={{ color: theme.textColor, fontFamily: font }}>
                <MathText text={p.content || "（視角闡述內容）"} />
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-3 p-4 rounded border text-center text-xs italic" style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}>
            （尚未建立視角，建議至少撰寫 3 個不同視角）
          </div>
        )}
      </div>

      {/* 視角 vs 借鏡視角 判定與檢驗句 */}
      <div
        className="p-3 rounded-sm border text-[10px] leading-relaxed space-y-1"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        <p>
          <b style={{ color: theme.headingColor }}>視角（借外部工具箱重講自己）/ 借鏡視角（拿外部對象E，透過對應動作M，發現共享結構）</b>
          ——強烈建議每張卡至少寫一個，除非真的想不出來，想不出來要註明「已嘗試尋找，未找到」。
        </p>
        <p>
          <b style={{ color: theme.accentColor }}>檢驗句：「講完後讀者對誰的理解變多了？」</b>——兩種都要過寫作規則：(1)顯式列出對應表 (2)導出一個讀者能獨立核對的具體事實。
        </p>
      </div>

      {/* 五個方向延伸（推深 / 推淺 / 推廣 / 推窄 / 翻譯） */}
      <div
        className="p-3.5 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            五個方向延伸（推深 / 推淺 / 推廣 / 推窄 / 翻譯）
          </span>
        </div>
        <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          每個方向寫完自問洞見檢查——「拿掉這句話，讀者會不會真的損失理解？」純粹陳述一個事實不夠格，挖不到不用硬湊。⚠ 與 APPLY 強制分離，「知道原理」≠「會做題」。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1 text-xs">
          {[
            { label: "推深 (Deeper)", val: extensions.deeper, desc: "奠基在什麼更底層知識" },
            { label: "推淺 (Shallower)", val: extensions.shallower, desc: "能撐起什麼後果/應用" },
            { label: "推廣 (Generalize)", val: extensions.generalize, desc: "放寬條件會變成什麼" },
            { label: "推窄 (Specialize)", val: extensions.specialize, desc: "收緊條件會成什麼特例" },
            { label: "翻譯 (Translate)", val: extensions.translate, desc: "用此語言重講別的知識" },
          ].map((ext) => (
            <div
              key={ext.label}
              className="p-2 rounded bg-white/70 border flex flex-col justify-between"
              style={{ borderColor: theme.borderColor }}
            >
              <div>
                <div className="font-bold text-[10px] text-slate-800" style={{ fontFamily: UI_FONT }}>
                  {ext.label}
                </div>
                <div className="text-[9px] text-slate-400 mb-1" style={{ fontFamily: UI_FONT }}>
                  {ext.desc}
                </div>
              </div>
              <div className="text-xs leading-tight" style={{ color: theme.textColor, fontFamily: font }}>
                {ext.val ? <MathText text={ext.val} /> : <span className="text-slate-300 italic text-[10px]">（略）</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <V6PageFooter
        note="版式：平行欄位，視角彼此並列，不是誰包含誰"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 6 / 7 : 【APPLY】 (CHECK / 分支 / CAN)
// =========================================================================

export function V6Page6Apply({
  card,
  font,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  theme?: CardPaperTheme;
}) {
  const howData = card.howData;
  const checks = howData?.checks || [];
  const branches = howData?.branches || [];
  const cans = howData?.can || [];

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="APPLY"
        subtitle="能不能用 / 怎麼用 / 用了能幹嘛——每條內容句尾都要掛來源標籤 [源:＿＿＿]"
        pageNumber="6/7"
        theme={theme}
      />

      {/* 頂部流程圖示 (CHECK 關卡 -> 分支 -> CAN) */}
      <div
        className="p-2 rounded-sm border flex flex-col items-center justify-center gap-1 text-[10px]"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="flex items-center gap-3 font-semibold">
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
            ‖ CHECK 關卡
          </span>
          <span>──→</span>
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
            ⑂ 分支樹
          </span>
          <span>┄→</span>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
            ★ CAN 解鎖
          </span>
        </div>
        <p className="text-[9px] text-slate-500">
          ‖ = CHECK關卡（過不了不能往下選） →分岔=分支 ┄→CAN（選填，某能力只屬於該分支時寫在分支末端）
        </p>
      </div>

      {/* 並排雙欄：CHECK vs CAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 左欄：CHECK（必填） */}
        <div
          className="p-3.5 rounded-sm border space-y-2 flex flex-col"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              CHECK（必填）
            </span>
          </div>
          <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            不管走哪條分支都要先過的前置關卡。判準：眾多分歧裡多一種→歸分支；不管走哪條現在全都不能選→歸CHECK。允許兩段式：看到原始情境X→做變換/識別動作→變成能判斷的Y→檢查Y→結論
          </p>
          <div className="flex-1 space-y-1.5 pt-1 text-xs">
            {checks.length > 0 ? (
              checks.map((c, ci) => (
                <div key={c.id || ci} className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
                  <div className="font-bold text-blue-900">
                    看到：<MathText text={c.cue} />
                  </div>
                  <div className="font-bold text-emerald-900">
                    → 檢查：<MathText text={c.check} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5" style={{ fontFamily: UI_FONT }}>
                    來源 [源:定義/前置]
                  </div>
                </div>
              ))
            ) : (
              <p className="italic text-slate-400 text-xs">（尚未建立 CHECK 關卡）</p>
            )}
          </div>
        </div>

        {/* 右欄：CAN（選填） */}
        <div
          className="p-3.5 rounded-sm border space-y-2 flex flex-col"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              CAN（選填）
            </span>
          </div>
          <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            只問「下游解鎖了什麼原本做不到的具體問題」，跟卡片類型無關，挖不到不用硬湊。某能力只有特定分支才有，寫在該分支末端，不進CAN。
          </p>
          <div className="flex-1 space-y-1.5 pt-1 text-xs">
            {cans.length > 0 ? (
              cans.map((cn, cni) => (
                <div key={cn.id || cni} className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
                  <div className="font-bold text-purple-900">
                    看到 <MathText text={cn.trigger} /> → 就能 <MathText text={cn.capability} />
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5" style={{ fontFamily: UI_FONT }}>
                    來源 [源:HOW解鎖]
                  </div>
                </div>
              ))
            ) : (
              <p className="italic text-slate-400 text-xs">（尚未填寫 CAN 下游解鎖）</p>
            )}
          </div>
        </div>
      </div>

      {/* 分支（左觸發 · 中流程 · 右來源）表格 */}
      <div
        className="p-3.5 rounded-sm border space-y-2 shadow-xs"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
            分支（左觸發 · 中流程 · 右來源）
          </span>
        </div>
        <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          觸發點與流程左右並排對照，位置即配對，支持巢狀多流程（縮排表示流程內部子分支）；觸發點可能需要「構造」——遇到不像的新問題，主動想到把某東西設成認得的形式，須用兩段式寫出「當時怎麼想到」，沒有固定程序
        </p>

        {/* 三欄表頭 */}
        <div className="border rounded overflow-hidden text-xs" style={{ borderColor: theme.borderColor }}>
          <div
            className="grid grid-cols-12 py-1.5 px-2 font-bold border-b text-[10px]"
            style={{ borderColor: theme.borderColor, backgroundColor: "rgba(0,0,0,0.03)", fontFamily: UI_FONT, color: theme.headingColor }}
          >
            <div className="col-span-4">觸發（含構造兩段式）</div>
            <div className="col-span-6">流程 / 步驟</div>
            <div className="col-span-2 text-right">來源</div>
          </div>

          <div className="divide-y" style={{ borderColor: theme.borderColor }}>
            {branches.length > 0 ? (
              branches.map((b, bi) => (
                <div key={b.id || bi} className="grid grid-cols-12 py-2 px-2 items-start text-xs bg-white/60">
                  <div className="col-span-4 font-bold text-slate-900 pr-2">
                    【看到 {b.title || `分支 ${bi + 1}`}】
                    {b.isCompiled && <span className="ml-1 text-[9px] text-emerald-600 font-normal">✓已編譯</span>}
                  </div>
                  <div className="col-span-6 leading-relaxed pr-2" style={{ fontFamily: font }}>
                    <MathText text={b.action || "（執行步驟）"} />
                  </div>
                  <div className="col-span-2 text-right text-[10px] text-slate-500 font-mono">
                    [源:WHY/分支]
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-xs italic text-slate-400">
                （尚未建立分支步驟）
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部來源標籤規範 */}
      <div
        className="p-2 rounded-sm border text-[10px] leading-relaxed"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        來源標籤照實寫，不預先限定：[源:定義]∕[源:WHY-推導X]∕[源:視角X或借鏡視角:標題]∕[源:關係邊-X]——APPLY裡任何一條內容都不能憑空冒出來，要交代來處。
      </div>

      <V6PageFooter
        note="版式：CHECK/分支/CAN三方框圖例"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  Page 7 / 7 : 【過程日誌】 Process Logs (方格填色進度條)
// =========================================================================

export function V6Page7ProcessLogs({
  card,
  font,
  processLogs,
  theme = DEFAULT_PAPER_THEME,
}: {
  card: CardData;
  font: string;
  processLogs?: Array<any>;
  theme?: CardPaperTheme;
}) {
  const logs = (processLogs || []).filter((l) => !l.cardId || l.cardId === card.id);

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="過程日誌"
        subtitle="只增不改，帶時間戳——方格紙最原生的用法：發生一次就塗滿一格"
        pageNumber="7/7"
        theme={theme}
      />

      {/* 三大圖例語義說明 */}
      <div
        className="p-3 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 bg-slate-800 rounded-xs inline-block" />
              [增量] 塗滿一格
            </div>
            <p className="text-[10px] text-slate-600">
              新內容補充舊內容，舊的大體沒錯，只是不夠完整
            </p>
          </div>

          <div className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
            <div className="font-bold text-rose-800 flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 border border-rose-600 rounded-xs inline-flex items-center justify-center text-[10px] font-bold text-rose-600">
                ✕
              </span>
              [框架衝突] 打叉的格子
            </div>
            <p className="text-[10px] text-slate-600">
              跨時間，新舊矛盾，須並排寫清舊主張錯在哪
            </p>
          </div>

          <div className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
            <div className="font-bold text-amber-800 flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="w-2.5 h-3.5 bg-amber-600 rounded-xs inline-block" />
                <span className="w-2.5 h-3.5 bg-amber-600 rounded-xs inline-block" />
              </span>
              [同session矛盾] 相鄰兩格
            </div>
            <p className="text-[10px] text-slate-600">
              同一次講解裡當場前後打架，兩格緊挨著表示同時發生
            </p>
          </div>
        </div>
      </div>

      {/* 方格填色進度條 (4.2mm 網格視覺) */}
      <div
        className="p-3.5 rounded-sm border space-y-2"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
          <span>日期 → （每格 4.2mm，跟方格紙格線對齊，往右延伸）</span>
        </div>

        {/* 視覺方格矩陣 */}
        <div className="flex flex-wrap gap-1 p-2 bg-white/60 border rounded" style={{ borderColor: theme.borderColor }}>
          {Array.from({ length: Math.max(12, logs.length + 3) }).map((_, i) => {
            const hasLog = i < logs.length;
            const log = logs[i];
            const isConflict = log?.logType?.includes("⚡") || log?.logType?.includes("衝突");
            return (
              <div
                key={i}
                className="w-7 h-7 border rounded-xs flex items-center justify-center text-xs font-mono font-bold transition-all"
                style={{
                  borderColor: theme.borderColor,
                  backgroundColor: hasLog ? (isConflict ? "#fee2e2" : theme.accentColor) : "transparent",
                  color: hasLog ? (isConflict ? "#b91c1c" : "#ffffff") : "transparent",
                }}
                title={hasLog ? `${log.createdAt?.slice(0, 10)}: ${log.title}` : `格 ${i + 1}`}
              >
                {hasLog ? (isConflict ? "✕" : "■") : ""}
              </div>
            );
          })}
        </div>
      </div>

      {/* 詳細歷史條目清單 */}
      <div
        className="p-3.5 rounded-sm border space-y-2 flex-1 overflow-y-auto"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
          日誌歷史記錄 ({logs.length})
        </div>

        {logs.length > 0 ? (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="p-2.5 rounded bg-white/80 border text-xs space-y-1" style={{ borderColor: theme.borderColor }}>
                <div className="flex items-center justify-between font-bold" style={{ fontFamily: UI_FONT }}>
                  <span className="text-slate-900">{l.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{l.createdAt?.slice(0, 10)}</span>
                </div>
                {l.explanation && (
                  <p className="text-slate-700 leading-relaxed" style={{ fontFamily: font }}>
                    <MathText text={l.explanation} />
                  </p>
                )}
                {l.oldContent && (
                  <div className="text-[10px] p-1.5 rounded bg-rose-50 text-rose-900 border border-rose-200 line-through">
                    舊：{l.oldContent}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="italic text-slate-400 text-xs">（尚未記錄任何過程日誌）</p>
        )}
      </div>

      <V6PageFooter
        note="版式：方格填色進度條（塗滿/打叉/相鄰兩格，直接沿用方格紙格線，不額外畫圖）"
        theme={theme}
      />
    </div>
  );
}

// =========================================================================
//  連續一頁式模式 (Continuous Single Page View)
// =========================================================================

export function V6ContinuousPaper({
  card,
  font,
  relations,
  cardTitles,
  processLogs,
  theme = DEFAULT_PAPER_THEME,
  onNavigateSection,
}: {
  card: CardData;
  font: string;
  relations?: Array<any>;
  cardTitles?: Record<string, string>;
  processLogs?: Array<any>;
  theme?: CardPaperTheme;
  onNavigateSection?: (key: any) => void;
}) {
  return (
    <div className="space-y-12">
      <div id="section-header" className="pt-2">
        <V6Page1HeaderOverview
          card={card}
          font={font}
          relations={relations}
          cardTitles={cardTitles}
          theme={theme}
          onNavigatePage={(p) => onNavigateSection?.(p)}
        />
      </div>

      <div id="section-background" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page2Background card={card} font={font} theme={theme} />
      </div>

      <div id="section-construction" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page3ConstructionThinking card={card} font={font} theme={theme} />
      </div>

      <div id="section-why" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page4Why card={card} font={font} theme={theme} />
      </div>

      <div id="section-what" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page5What card={card} font={font} theme={theme} />
      </div>

      <div id="section-apply" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page6Apply card={card} font={font} theme={theme} />
      </div>

      <div id="section-logs" className="pt-6 border-t-2 border-dashed" style={{ borderColor: theme.borderColor }}>
        <V6Page7ProcessLogs card={card} font={font} processLogs={processLogs} theme={theme} />
      </div>
    </div>
  );
}

// =========================================================================
//  主題與樣式自訂面板 (Card Theme Customizer)
// =========================================================================

export function CardThemeCustomizer({
  currentTheme,
  onUpdateTheme,
  onClose,
}: {
  currentTheme: CardPaperTheme;
  onUpdateTheme: (theme: CardPaperTheme) => void;
  onClose: () => void;
}) {
  return (
    <div className="p-4 bg-white rounded-xl shadow-2xl border border-slate-200 w-80 space-y-4 select-none max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800" style={{ fontFamily: UI_FONT }}>
          <Palette className="w-4 h-4 text-blue-600" />
          卡片預覽主題與配色
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xs">
          ✕
        </button>
      </div>

      {/* 預設主題切換 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 block" style={{ fontFamily: UI_FONT }}>
          快速主題預設
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {Object.entries(THEME_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => onUpdateTheme(preset)}
              className="flex items-center justify-between p-2 rounded border hover:bg-slate-50 text-left text-xs transition-all"
              style={{
                borderColor: currentTheme.paperBg === preset.paperBg ? "#2563eb" : "#e2e8f0",
                backgroundColor: currentTheme.paperBg === preset.paperBg ? "#eff6ff" : "#ffffff",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border shadow-xs" style={{ backgroundColor: preset.paperBg, borderColor: preset.borderColor }} />
                <span className="font-medium text-slate-800">{preset.name}</span>
              </div>
              {currentTheme.paperBg === preset.paperBg && <span className="text-[10px] text-blue-600 font-bold">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 色彩微調選色器 */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-[11px] font-bold text-slate-600 block" style={{ fontFamily: UI_FONT }}>
          自訂色彩細節
        </label>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">紙張底色</span>
            <input
              type="color"
              value={currentTheme.paperBg.startsWith("#") ? currentTheme.paperBg : "#faf7ee"}
              onChange={(e) => onUpdateTheme({ ...currentTheme, paperBg: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">主要文字顏色</span>
            <input
              type="color"
              value={currentTheme.textColor.startsWith("#") ? currentTheme.textColor : "#27272a"}
              onChange={(e) => onUpdateTheme({ ...currentTheme, textColor: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">標題與強調色</span>
            <input
              type="color"
              value={currentTheme.accentColor.startsWith("#") ? currentTheme.accentColor : "#b45309"}
              onChange={(e) => onUpdateTheme({ ...currentTheme, accentColor: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer border border-slate-300"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">邊框線條顏色</span>
            <input
              type="color"
              value={currentTheme.borderColor.startsWith("#") ? currentTheme.borderColor : "#8c7d6b"}
              onChange={(e) => onUpdateTheme({ ...currentTheme, borderColor: e.target.value })}
              className="w-8 h-6 rounded cursor-pointer border border-slate-300"
            />
          </div>
        </div>
      </div>

      {/* 方格網線設定 */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-600" style={{ fontFamily: UI_FONT }}>
            顯示方格紙格線
          </label>
          <input
            type="checkbox"
            checked={currentTheme.showGrid}
            onChange={(e) => onUpdateTheme({ ...currentTheme, showGrid: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
          />
        </div>

        {currentTheme.showGrid && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500 text-[10px]">
              <span>網格尺寸</span>
              <span>{currentTheme.gridSize || 20} px</span>
            </div>
            <input
              type="range"
              min="14"
              max="32"
              step="2"
              value={currentTheme.gridSize || 20}
              onChange={(e) => onUpdateTheme({ ...currentTheme, gridSize: Number(e.target.value) })}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
//  相容性組件（保持舊匯出介面健全）
// =========================================================================

export function FourPointCheckPanel({ report, variant = "full" }: { report: FourPointReport; variant?: "full" | "compact" }) {
  if (variant === "compact") {
    const allPass = report.clean;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            allPass ? "bg-emerald-100 text-emerald-800" : report.failCount ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
          }`}
          style={{ fontFamily: UI_FONT }}
        >
          八點自我檢查 {allPass ? "全過" : `${report.failCount} 違規 / ${report.warnCount} 待確認`}
        </span>
        {report.checks.map((c) => (
          <span
            key={c.id}
            title={`${c.label}：${c.summary}`}
            className="text-[10px] px-1.5 py-0.5 rounded border font-bold bg-white text-slate-700"
          >
            {c.index}{c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "!"}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-slate-600" />
        <span className="text-xs font-bold text-slate-800" style={{ fontFamily: UI_FONT }}>
          八點自我檢查報告
        </span>
      </div>
      <div className="space-y-1.5">
        {report.checks.map((c) => (
          <div key={c.id} className="p-2 rounded bg-slate-50 border border-slate-200 text-xs">
            <div className="font-bold text-slate-800">{c.index}. {c.label}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{c.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SectionHeader({ card, font }: { card: CardData; font: string }) {
  return <V6Page1HeaderOverview card={card} font={font} />;
}
export function SectionBackground({ card, font }: { card: CardData; font: string }) {
  return <V6Page2Background card={card} font={font} />;
}
export function SectionConstructionThinking({ card, font }: { card: CardData; font: string }) {
  return <V6Page3ConstructionThinking card={card} font={font} />;
}
export function SectionWhy({ card, font }: { card: CardData; font: string }) {
  return <V6Page4Why card={card} font={font} />;
}
export function SectionWhat({ card, font }: { card: CardData; font: string }) {
  return <V6Page5What card={card} font={font} />;
}
export function SectionHow({ card, font }: { card: CardData; font: string }) {
  return <V6Page6Apply card={card} font={font} />;
}
export function SectionOrigin({ card, font }: { card: CardData; font: string }) {
  return <V6Page2Background card={card} font={font} />;
}
export function SectionThoughtPoints({ card, font }: { card: CardData; font: string }) {
  return null;
}
export function SectionIntuitionTraps({ card, font }: { card: CardData; font: string }) {
  return null;
}
export function SectionClaims({ card, font }: { card: CardData; font: string }) {
  return null;
}
export function SectionDiagnostics({ card, font }: { card: CardData; font: string }) {
  return null;
}
export function SectionRelations({ card, font, relations, cardTitles }: any) {
  return <V6Page1HeaderOverview card={card} font={font} relations={relations} cardTitles={cardTitles} />;
}
export function SectionProcessLogs({ card, font, processLogs }: any) {
  return <V6Page7ProcessLogs card={card} font={font} processLogs={processLogs} />;
}
