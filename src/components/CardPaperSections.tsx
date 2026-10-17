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
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
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
import { SOLO_LEVELS, SoloAssessmentPanel } from "./SoloAssessmentPanel";
import {
  EditableText,
  EditableList,
  EditableSelect,
  EditableToggle,
  EditableCheck,
  EditableRating,
  EditableSlider,
  EditableTagGroup,
  useCardEdit,
  newRowId,
  ReadOnlyBadge,
  ApplyBranchTree,
  type ApplyBranch,
} from "./CardPaperEditor";

export { CardEditContext, useCardEdit } from "./CardPaperEditor";

const UI_FONT = "'Varela Round', sans-serif";

/** v7.2：紙上編輯用的選項清單 */
const GRANULARITY_OPTIONS = [
  { value: "L1 核心原理", label: "L1 核心原理" },
  { value: "L2 定理/機制", label: "L2 定理/機制" },
  { value: "L3 例題/應用", label: "L3 例題/應用" },
  { value: "L4 名詞/標籤", label: "L4 名詞/標籤" },
];
const BLOOM_OPTIONS = ["記憶", "理解", "應用", "分析", "評鑑", "創造"].map((v) => ({ value: v, label: v }));
const SOLO_OPTIONS = SOLO_LEVELS.map((l) => ({ value: l.key, label: l.key }));
const SHAPE_OPTIONS = Object.entries(SHAPE_DEFS).map(([key, def]) => ({
  value: key,
  label: `${def.short} ${def.name}`,
}));
const EPISTEMIC_MARKS = ["⊢證", "⊢歸", "⊢近", "⊢約", "⊢公設"].map((v) => ({ value: v, label: v }));
const OMITTED_SLOT_OPTIONS = ["背景", "構造思路", "WHY", "WHAT", "APPLY", "關係邊", "過程日誌"].map((v) => ({
  value: v,
  label: v,
}));
const BRIDGE_TYPES = ["互通", "單向", "限定範圍", "走不通", "[未查]"].map((v) => ({ value: v, label: v }));
const BLOCKED_MARKS = ["[已證無橋]", "[未找到橋]"].map((v) => ({ value: v, label: v }));

function defaultCardCalibration(card: CardData) {
  return {
    confidenceBefore: card.constructionCalibration?.confidenceBefore ?? 3,
    confidenceAfter: card.constructionCalibration?.confidenceAfter ?? 4,
    ...card.constructionCalibration,
  };
}

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

  // v7.2：紙上編輯 context（預覽時為 null，所有 Editable* 都退回純顯示）
  const ed = useCardEdit();
  const [showSoloPanel, setShowSoloPanel] = useState(false);
  const tagOptions = [
    { label: "[有分支]", active: hasBranches },
    { label: "[連續鏈]", active: isContinuous },
    { label: "[存在性可分離]", active: isSeparable },
    { label: "[前提依賴]", active: isFramework || rels.length > 0 },
    { label: "[純約定]", active: isConvention },
  ];
  const activeTags = card.cardTags && card.cardTags.length > 0
    ? card.cardTags
    : tagOptions.filter((t) => t.active).map((t) => t.label);
  const declaredSolo = card.soloData?.declaredLevel || card.soloLevel || "關聯結構";

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
              <EditableText
                value={card.title}
                onChange={(v) => ed?.patch({ title: v })}
                placeholder="卡片名稱"
                inline
                className="text-xl font-bold"
                style={{ color: theme.headingColor, fontFamily: font }}
                ariaLabel="卡片名稱"
              />
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
              領域：
            </span>
            <span className="text-base font-semibold ml-1" style={{ color: theme.textColor, fontFamily: font }}>
              <EditableText
                value={card.domain || ""}
                onChange={(v) => ed?.patch({ domain: v })}
                placeholder="未指定領域"
                inline
                className="text-base font-semibold"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="領域"
              />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t" style={{ borderColor: theme.borderColor, opacity: 0.9 }}>
          <span className="text-[11px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
            顆粒度：
          </span>
          <EditableSelect
            value={card.granularity || "L2 定理/機制"}
            options={GRANULARITY_OPTIONS}
            onChange={(v) => ed?.patch({ granularity: v })}
            className="text-xs font-semibold"
            style={{ color: theme.textColor, fontFamily: UI_FONT }}
            controlClassName="rounded border border-amber-400/80 bg-white/95 px-1 py-0.5 text-[10px] font-semibold text-slate-900 shadow-sm outline-none print:hidden"
            ariaLabel="顆粒度"
          />
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

      {/* v7.2：內部推理形狀（紙上可選 / 可勾 / 可拖） */}
      {(ed?.editable || card.shapeRationale || card.compositeNote || card.shapeConfidence !== undefined) && (
        <div
          className="p-3 rounded-sm border space-y-1.5"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
              內部推理形狀
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <EditableSelect
                value={card.reasoningShape}
                options={SHAPE_OPTIONS}
                onChange={(v) => ed?.patch({ reasoningShape: v, shapeAccepted: true })}
                className="text-[11px] font-bold"
                style={{ color: theme.accentColor, fontFamily: UI_FONT }}
                controlClassName="rounded border border-amber-400/80 bg-white/95 px-1 py-0.5 text-[10px] font-bold text-slate-900 shadow-sm outline-none print:hidden max-w-[180px]"
                ariaLabel="推理形狀"
              />
              {(ed?.editable || card.shapeConfidence !== undefined) && (
                <>
                  <span className="text-[10px]" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>信心</span>
                  <EditableSlider
                    value={card.shapeConfidence ?? 0}
                    onChange={(v) => ed?.patch({ shapeConfidence: v })}
                    className="text-[10px]"
                  />
                </>
              )}
              <EditableCheck
                checked={!!card.shapeAccepted}
                onChange={(v) => ed?.patch({ shapeAccepted: v })}
                label="使用者已確認"
                checkedClassName="text-emerald-700"
              />
            </div>
          </div>

          {isComposite && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                複合型組成（至少 2 種）：
              </span>
              <EditableTagGroup
                options={(["A", "B", "C", "D", "E"] as const).map((k) => ({ value: k, label: `${k} ${SHAPE_DEFS[k].name}` }))}
                active={card.compositeShapes || []}
                onChange={(next) => ed?.patch({ compositeShapes: next })}
                activeStyle={{ backgroundColor: theme.accentColor, borderColor: theme.accentColor, color: "#ffffff" }}
                inactiveStyle={{ borderColor: theme.borderColor, color: theme.textColor, backgroundColor: "transparent" }}
              />
            </div>
          )}

          {(ed?.editable || card.shapeRationale) && (
            <div className="text-[11px] leading-relaxed" style={{ color: theme.textColor, fontFamily: font }}>
              <b style={{ color: theme.accentColor, fontFamily: UI_FONT }}>判型理由：</b>
              <EditableText
                value={card.shapeRationale || ""}
                onChange={(v) => ed?.patch({ shapeRationale: v })}
                multiline
                rows={2}
                placeholder="說明為什麼是這個形狀（可留空）"
                className="text-[11px]"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="AI 判型理由"
              />
            </div>
          )}

          {isComposite && (ed?.editable || card.compositeNote) && (
            <div className="text-[11px] leading-relaxed" style={{ color: theme.textColor, fontFamily: font }}>
              <b style={{ color: theme.accentColor, fontFamily: UI_FONT }}>組合說明：</b>
              <EditableText
                value={card.compositeNote || ""}
                onChange={(v) => ed?.patch({ compositeNote: v })}
                multiline
                rows={2}
                placeholder="哪一段是哪一型？缺了哪一段會出什麼錯？"
                className="text-[11px]"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="複合型組合說明"
              />
            </div>
          )}
        </div>
      )}

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
          {tagOptions.map((tag) => {
            const active = activeTags.includes(tag.label);
            const chipClass = `px-2 py-0.5 rounded border text-[11px] transition-all ${
              active ? "font-bold shadow-xs" : "opacity-45"
            }`;
            const chipStyle = {
              borderColor: active ? theme.accentColor : theme.borderColor,
              backgroundColor: active ? `${theme.accentColor}18` : "transparent",
              color: active ? theme.accentColor : theme.textColor,
            };
            if (!ed?.editable) {
              return (
                <span key={tag.label} className={chipClass} style={chipStyle}>
                  {tag.label}
                </span>
              );
            }
            return (
              <button
                key={tag.label}
                type="button"
                title="點擊切換此標籤"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = active
                    ? activeTags.filter((t) => t !== tag.label)
                    : [...activeTags, tag.label];
                  ed.patch({ cardTags: next });
                }}
                className={`${chipClass} print:hidden`}
                style={chipStyle}
              >
                {tag.label}
              </button>
            );
          })}
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

      {/* v7.2：省略聲明（省略本身也要交代理由） */}
      {(ed?.editable || (card.omittedSlots?.length || 0) > 0) && (
        <div
          className="p-3 rounded-sm border space-y-1.5"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
            省略聲明（省略哪一格／為什麼）
          </span>
          <EditableList
            items={card.omittedSlots || []}
            onChange={(next) => ed?.patch({ omittedSlots: next })}
            newItem={() => ({ slot: "WHY", reason: "" })}
            addLabel="新增省略聲明"
            emptyPlaceholder={null}
            renderItem={(o, i) => (
              <div className="flex flex-col sm:flex-row sm:items-start gap-1.5 rounded border p-1.5" style={{ borderColor: theme.borderColor }}>
                <EditableSelect
                  value={o.slot}
                  options={OMITTED_SLOT_OPTIONS}
                  onChange={(v) => {
                    const next = [...(card.omittedSlots || [])];
                    next[i] = { ...next[i], slot: v };
                    ed?.patch({ omittedSlots: next });
                  }}
                  className="text-[10px] font-bold text-slate-800"
                  controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[10px] print:hidden"
                  ariaLabel="省略的格子"
                />
                <EditableText
                  value={o.reason}
                  onChange={(v) => {
                    const next = [...(card.omittedSlots || [])];
                    next[i] = { ...next[i], reason: v };
                    ed?.patch({ omittedSlots: next });
                  }}
                  placeholder="省略理由"
                  multiline
                  rows={1}
                  className="flex-1 text-[10px]"
                  style={{ color: theme.textColor, fontFamily: UI_FONT }}
                  ariaLabel="省略理由"
                />
              </div>
            )}
          />
        </div>
      )}

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
          {(card.whatData?.readings || []).length > 0 && (
            <div className="flex items-baseline gap-1">
              <span className="font-bold flex-shrink-0" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
                讀法①②③：
              </span>
              <span className="truncate">
                {(card.whatData?.readings || []).map((r) => r.name).join(" ； ")}
              </span>
            </div>
          )}
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
          <ReadOnlyBadge label="唯讀：關係邊請在畫布上編輯" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* 左側羅盤示意圖 */}
          <div className="md:col-span-5 flex justify-center py-1">
            <div
              className="relative w-48 h-28 rounded-md border flex items-center justify-center p-1 text-[9px]"
              style={{ borderColor: theme.borderColor, backgroundColor: "rgba(255,255,255,0.4)", fontFamily: UI_FONT }}
            >
              <div className="absolute top-1 text-center font-bold text-blue-800">[前提] / [衍生]</div>
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
            <p><b className="text-slate-800">[前提]</b>：A是B成立的必要基礎（擦掉A，B的WHY斷在哪一步）</p>
            <p><b className="text-teal-800">[衍生]（v7 新增）</b>：A [衍生]→ B 表示 B 是用 A「造」出來的；<b>機械檢查</b>：B 那張卡必須有 [前提] 指回 A，兩邊對得上才算數</p>
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
                  <div
                    key={lvl}
                    role={ed?.editable ? "button" : undefined}
                    title={ed?.editable ? `設為 ${lvl}` : undefined}
                    onClick={() => ed?.patch({ bloomLevel: lvl })}
                    className={`flex-1 flex flex-col items-center justify-end h-full ${ed?.editable ? "cursor-pointer hover:opacity-80" : ""}`}
                  >
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
              <EditableSelect
                value={declaredSolo}
                options={SOLO_OPTIONS}
                onChange={(v) =>
                  ed?.patch({
                    soloLevel: v,
                    soloData: {
                      declaredLevel: v,
                      evidence: card.soloData?.evidence || [],
                      autoSuggestedLevel: card.soloData?.autoSuggestedLevel,
                      autoRationale: card.soloData?.autoRationale,
                      accepted: card.soloData?.accepted,
                      history: [
                        ...(card.soloData?.history || []),
                        { at: new Date().toISOString().slice(0, 10), from: declaredSolo, to: v, reason: "紙上編輯調整" },
                      ],
                    },
                  })
                }
                className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold text-[10px]"
                controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[10px] font-bold text-emerald-900 print:hidden"
                ariaLabel="SOLO 整合度"
              />
              <button
                type="button"
                onClick={() => setShowSoloPanel((v) => !v)}
                className="ml-auto text-[9px] underline text-slate-500 hover:text-slate-800 print:hidden"
              >
                {showSoloPanel ? "收合 SOLO 評估" : "展開 SOLO 評估"}
              </button>
            </div>
            <p>
              判準：不是「邊多就算」，而是「這些邊能不能實際參與推理」——裝飾性連線不算，[表面相似]不算有效整合。
            </p>
          </div>
        </div>
      </div>

      {showSoloPanel && (
        <div
          className="p-3 rounded-sm border print:hidden"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <SoloAssessmentPanel
            cardId={card.id}
            soloLevel={declaredSolo}
            soloData={card.soloData}
            bloomLevel={card.bloomLevel}
            editable={!!ed?.editable}
            onChange={(level, data) => ed?.patch({ soloLevel: level, soloData: data })}
          />
        </div>
      )}

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
  const ed = useCardEdit();
  const patchCalib = (p: Partial<NonNullable<CardData["constructionCalibration"]>>) =>
    ed?.patch({ constructionCalibration: { ...defaultCardCalibration(card), ...p } });

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
          <EditableRating
            value={calib?.confidenceBefore ?? 3}
            onChange={(v) => patchCalib({ confidenceBefore: v })}
            activeClassName="bg-amber-400 text-amber-950 border-amber-500 shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: theme.headingColor }}>
            寫完後重打一次：
          </span>
          <EditableRating
            value={calib?.confidenceAfter ?? 4}
            onChange={(v) => patchCalib({ confidenceAfter: v })}
            activeClassName="bg-emerald-500 text-white border-emerald-600 shadow-xs"
          />
        </div>
      </div>

      {(ed?.editable || calib?.blindSpotNote) && (
        <div
          className="p-2.5 rounded-sm border text-[11px] leading-relaxed"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
        >
          <b style={{ color: theme.accentColor }}>理解問題階段盲區：</b>
          <EditableText
            value={calib?.blindSpotNote || ""}
            onChange={(v) => patchCalib({ blindSpotNote: v })}
            multiline
            rows={2}
            placeholder="掉分時先記在這裡，不急著進構造思路／WHY"
            className="text-[11px]"
            style={{ color: theme.textColor, fontFamily: font }}
            ariaLabel="理解問題階段盲區"
          />
        </div>
      )}

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
            <EditableText
              value={bgData.situation || card.backgroundDescription || ""}
              onChange={(v) => ed?.patch({ backgroundData: { ...bgData, situation: v } })}
              multiline
              rows={3}
              placeholder="（尚未填寫情境）"
              className="text-sm leading-relaxed"
              style={{ color: theme.textColor, fontFamily: font }}
              ariaLabel="第一段·情境"
            />
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
            <EditableText
              value={bgData.preciseObject || ""}
              onChange={(v) => ed?.patch({ backgroundData: { ...bgData, preciseObject: v } })}
              multiline
              rows={3}
              placeholder="（尚未填寫精確對象）"
              className="text-sm leading-relaxed"
              style={{ color: theme.textColor, fontFamily: font }}
              ariaLabel="第二段·精確對象"
            />
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
            <EditableText
              value={bgData.preciseQuestion || ""}
              onChange={(v) => ed?.patch({ backgroundData: { ...bgData, preciseQuestion: v } })}
              multiline
              rows={2}
              placeholder="（尚未填寫精確問題）"
              className="text-sm leading-relaxed font-medium"
              style={{ color: theme.textColor, fontFamily: font }}
              ariaLabel="第三段·精確問題"
            />
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
          {(ed?.editable || card.originData?.historicalContext) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[歷史起源] </b>
              <EditableText
                value={card.originData?.historicalContext || ""}
                onChange={(v) =>
                  ed?.patch({ originData: { ...(card.originData || { conflict: "" }), historicalContext: v } })
                }
                multiline
                rows={2}
                placeholder="當時是誰、什麼年代、卡在哪個矛盾"
                className="text-xs"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="歷史起源"
              />
            </div>
          )}
          {(ed?.editable || card.originData?.conflict) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[矛盾焦點] </b>
              <EditableText
                value={card.originData?.conflict || ""}
                onChange={(v) =>
                  ed?.patch({ originData: { ...(card.originData || { conflict: "" }), conflict: v } })
                }
                multiline
                rows={2}
                placeholder="歷史事件跟第一段情境的共同困境"
                className="text-xs"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="矛盾焦點"
              />
            </div>
          )}
          {!ed?.editable && !card.originData?.historicalContext && !card.originData?.conflict && (
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
  const ed = useCardEdit();

  // 構造思路追問點
  type ThoughtPoint = NonNullable<CardData["thoughtPoints"]>[number];
  type IntuitionTrap = NonNullable<CardData["intuitionTraps"]>[number];
  const constructionProbes = (card.thoughtPoints || []).filter(
    (t) => t.placement === "construction" || !t.placement
  );

  const [openAnswers, setOpenAnswers] = useState<Record<string, boolean>>({});

  const setConstructionProbes = (next: ThoughtPoint[]) => {
    const whyProbes = (card.thoughtPoints || []).filter((t) => t.placement === "why");
    ed?.patch({ thoughtPoints: [...next, ...whyProbes] });
  };

  const patchPlan = (p: Partial<NonNullable<CardData["plan"]>>) =>
    ed?.patch({ plan: { ...plan, ...p } });

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

      {/* v7.2：構造思路主文（原本只在進階表單，現在紙上直接改） */}
      {(ed?.editable || card.constructionThinking) && (
        <div
          className="p-3.5 rounded-sm border space-y-1.5"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            構造思路（邏輯觸發，不是歷史線）
          </span>
          <EditableText
            value={card.constructionThinking || ""}
            onChange={(v) => ed?.patch({ constructionThinking: v })}
            multiline
            rows={4}
            placeholder="從需求出發：怎麼想到用哪個候選工具？"
            className="text-sm leading-relaxed"
            style={{ color: theme.textColor, fontFamily: font }}
            ariaLabel="構造思路"
          />
        </div>
      )}

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
        <div className="text-sm space-y-1.5 leading-relaxed pt-1" style={{ color: theme.textColor, fontFamily: font }}>
          {(ed?.editable || candidate.requirement) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[已確立要求] </b>
              <EditableText
                value={candidate.requirement || ""}
                onChange={(v) => ed?.patch({ candidate: { ...candidate, requirement: v } })}
                multiline
                rows={2}
                placeholder="往回追溯：構造思路已確立的要求"
                className="text-sm"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="已確立要求"
              />
            </div>
          )}
          {(ed?.editable || candidate.candidateForm) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[候選工具形式] </b>
              <EditableText
                value={candidate.candidateForm || ""}
                onChange={(v) => ed?.patch({ candidate: { ...candidate, candidateForm: v } })}
                multiline
                rows={2}
                placeholder="具體候選工具／building block 形式"
                className="text-sm"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="候選工具形式"
              />
            </div>
          )}
          {(ed?.editable || candidate.motivation) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[摸索動機] </b>
              <EditableText
                value={candidate.motivation || ""}
                onChange={(v) => ed?.patch({ candidate: { ...candidate, motivation: v } })}
                multiline
                rows={2}
                placeholder="為什麼偏偏是這個形式"
                className="text-sm"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="摸索動機"
              />
            </div>
          )}
          {(ed?.editable || candidate.expansion) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[擴展方案] </b>
              <EditableText
                value={candidate.expansion || ""}
                onChange={(v) => ed?.patch({ candidate: { ...candidate, expansion: v } })}
                multiline
                rows={2}
                placeholder="單一候選不足時的下一步"
                className="text-sm"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="擴展方案"
              />
            </div>
          )}
          {(ed?.editable || candidate.expansionOutOfScope) && (
            <div>
              <b style={{ fontFamily: UI_FONT, color: theme.accentColor }}>[超出本卡範圍] </b>
              <EditableText
                value={candidate.expansionOutOfScope || ""}
                onChange={(v) => ed?.patch({ candidate: { ...candidate, expansionOutOfScope: v } })}
                multiline
                rows={2}
                placeholder="牽涉更深獨立問題時老實標註"
                className="text-sm"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="超出本卡範圍"
              />
            </div>
          )}
          {!ed?.editable && !candidate.requirement && !candidate.candidateForm && !candidate.motivation && (
            <p className="italic" style={{ color: theme.mutedTextColor }}>（尚未填寫候選登場摸索）</p>
          )}
        </div>
      </div>

      {/* 並排雙欄：② 路徑 · 追問（可新增／刪除／排序） */}
      <EditableList<ThoughtPoint>
        items={constructionProbes}
        onChange={setConstructionProbes}
        newItem={() => ({
          id: newRowId("probe"),
          modeName: "",
          question: "",
          answer: "",
          passed: false,
          placement: "construction",
        })}
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
        itemClassName="min-w-0"
        addLabel="新增追問路徑"
        renderItem={(tp, pi) => {
          const key = tp.id || String(pi);
          const open = !!openAnswers[key] || !!ed?.editable;
          const patchProbe = (p: Partial<ThoughtPoint>) => {
            const next = constructionProbes.map((t, i) => (i === pi ? { ...t, ...p } : t));
            setConstructionProbes(next);
          };
          return (
            <div
              className="p-3.5 rounded-sm border space-y-2 flex flex-col h-full"
              style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
            >
              <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
                ② 路徑 · 追問{pi + 1}
              </span>
              <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                主動自問的啟發式問句，只記錄問過什麼、指向什麼方向，不放完整推導（推導挪去 WHY）
              </p>
              <div className="flex-1 space-y-2 pt-1">
                <div
                  className="p-2 rounded border bg-amber-50/60 text-xs font-semibold"
                  style={{ borderColor: theme.borderColor, color: theme.headingColor, fontFamily: font }}
                >
                  <span>【追問 · </span>
                  <EditableText
                    value={tp.modeName || ""}
                    onChange={(v) => patchProbe({ modeName: v })}
                    placeholder="思維模式名"
                    inline
                    className="font-semibold"
                    style={{ color: theme.headingColor, fontFamily: font }}
                    ariaLabel={`追問 ${pi + 1} 思維模式`}
                  />
                  <span>】</span>
                  <div className="mt-1 font-normal" style={{ color: theme.textColor }}>
                    <EditableText
                      value={tp.question || ""}
                      onChange={(v) => patchProbe({ question: v })}
                      multiline
                      rows={2}
                      placeholder="（自問核心思考障礙是什麼？）"
                      className="text-xs"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`追問 ${pi + 1} 問句`}
                    />
                  </div>
                  <EditableCheck
                    checked={!!tp.passed}
                    onChange={(v) => patchProbe({ passed: v })}
                    label="[已推出]"
                    className="mt-1.5"
                    checkedClassName="text-emerald-700"
                  />
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                  className="text-[11px] flex items-center gap-1 font-bold text-amber-800 hover:underline"
                  style={{ fontFamily: UI_FONT }}
                >
                  {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {open ? "收合答案" : "→ (點擊揭曉答案，完整推導見 WHY)"}
                </button>

                {open && (
                  <div
                    className="p-2 rounded bg-white/90 border text-xs leading-relaxed"
                    style={{ borderColor: theme.borderColor, color: theme.textColor, fontFamily: font }}
                  >
                    <EditableText
                      value={tp.answer || ""}
                      onChange={(v) => patchProbe({ answer: v })}
                      multiline
                      rows={2}
                      placeholder="（此追問指引了最終的收斂計畫）"
                      className="text-xs"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`追問 ${pi + 1} 答案`}
                    />
                  </div>
                )}

                {(ed?.editable || tp.note) && (
                  <div className="text-[10px]" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                    <b>卡住的點：</b>
                    <EditableText
                      value={tp.note || ""}
                      onChange={(v) => patchProbe({ note: v })}
                      multiline
                      rows={1}
                      placeholder="卡在哪一步"
                      className="text-[10px]"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`追問 ${pi + 1} 筆記`}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        }}
      />

      {/* v7.2：直覺陷阱（可新增／刪除／排序） */}
      {(ed?.editable || (card.intuitionTraps?.length || 0) > 0) && (
        <div
          className="p-3.5 rounded-sm border space-y-1.5"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            ③ 直覺陷阱（推導正確，但直覺容易誤判）
          </span>
          <EditableList<IntuitionTrap>
            items={card.intuitionTraps || []}
            onChange={(next) => ed?.patch({ intuitionTraps: next })}
            newItem={() => ({ id: newRowId("trap"), description: "", whyMisleading: "", correctUnderstanding: "", passed: false, note: "" })}
            addLabel="新增直覺陷阱"
            className="space-y-1.5"
            itemClassName=""
            emptyPlaceholder={null}
            renderItem={(trap, ti) => {
              const patchTrap = (p: Partial<IntuitionTrap>) => {
                const next = [...(card.intuitionTraps || [])];
                next[ti] = { ...next[ti], ...p };
                ed?.patch({ intuitionTraps: next });
              };
              return (
                <div className="rounded border bg-white/70 p-2 text-[11px] space-y-1" style={{ borderColor: theme.borderColor }}>
                  <div>
                    <b style={{ color: theme.accentColor, fontFamily: UI_FONT }}>常見誤判：</b>
                    <EditableText
                      value={trap.description || ""}
                      onChange={(v) => patchTrap({ description: v })}
                      multiline
                      rows={1}
                      placeholder="讀者大概會怎麼誤會"
                      className="text-[11px]"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`直覺陷阱 ${ti + 1} 誤判`}
                    />
                  </div>
                  <div>
                    <b style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>為什麼直覺會錯：</b>
                    <EditableText
                      value={trap.whyMisleading || ""}
                      onChange={(v) => patchTrap({ whyMisleading: v })}
                      multiline
                      rows={1}
                      placeholder="直覺在哪一步偷懶"
                      className="text-[11px]"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`直覺陷阱 ${ti + 1} 原因`}
                    />
                  </div>
                  <div>
                    <b style={{ color: theme.accentColor, fontFamily: UI_FONT }}>正確理解：</b>
                    <EditableText
                      value={trap.correctUnderstanding || ""}
                      onChange={(v) => patchTrap({ correctUnderstanding: v })}
                      multiline
                      rows={1}
                      placeholder="正確的理解方式"
                      className="text-[11px]"
                      style={{ color: theme.textColor, fontFamily: font }}
                      ariaLabel={`直覺陷阱 ${ti + 1} 正確理解`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <EditableCheck
                      checked={!!trap.passed}
                      onChange={(v) => patchTrap({ passed: v })}
                      label="[已推出]"
                      checkedClassName="text-emerald-700"
                    />
                    <EditableText
                      value={trap.note || ""}
                      onChange={(v) => patchTrap({ note: v })}
                      placeholder="筆記（選填）"
                      inline
                      className="text-[10px]"
                      style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}
                      ariaLabel={`直覺陷阱 ${ti + 1} 筆記`}
                    />
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}

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
          <EditableList
            items={plan.steps || []}
            onChange={(next) => patchPlan({ steps: next })}
            newItem={() => ({ id: newRowId("plan"), label: "", rationale: "" })}
            addLabel="新增計畫步驟"
            className="space-y-1.5"
            itemClassName=""
            emptyPlaceholder={<p className="italic text-slate-400">（尚未填寫收斂計畫）</p>}
            renderItem={(st, si) => {
              const patchStep = (p: Partial<{ id: string; label: string; rationale: string }>) => {
                const next = [...(plan.steps || [])];
                next[si] = { ...next[si], ...p };
                patchPlan({ steps: next });
              };
              return (
                <div className="flex items-start gap-2 bg-white/70 p-2 rounded border" style={{ borderColor: theme.borderColor }}>
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-mono flex-shrink-0">
                    {si + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <EditableText
                      value={st.label || ""}
                      onChange={(v) => patchStep({ label: v })}
                      placeholder="這一步打算證什麼／做什麼"
                      multiline
                      rows={1}
                      className="font-bold text-slate-900"
                      style={{ color: theme.headingColor, fontFamily: font }}
                      ariaLabel={`計畫步驟 ${si + 1}`}
                    />
                    <div className="text-[11px] text-slate-600 mt-0.5" style={{ fontFamily: UI_FONT }}>
                      ↳ 順序依賴：
                      <EditableText
                        value={st.rationale || ""}
                        onChange={(v) => patchStep({ rationale: v })}
                        placeholder="為什麼是這個順序"
                        inline
                        className="text-[11px]"
                        style={{ color: theme.textColor, fontFamily: font }}
                        ariaLabel={`計畫步驟 ${si + 1} 理由`}
                      />
                    </div>
                  </div>
                </div>
              );
            }}
          />

          {(ed?.editable || plan.ranges) && (
            <div className="text-[11px] p-2 rounded bg-amber-50/70 border border-amber-200 text-amber-900" style={{ fontFamily: UI_FONT }}>
              <b>範圍劃定（誠實標註）：</b>
              <EditableText
                value={plan.ranges || ""}
                onChange={(v) => patchPlan({ ranges: v })}
                multiline
                rows={1}
                placeholder="超出本卡範圍的部分"
                className="text-[11px]"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="範圍劃定"
              />
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
  const ed = useCardEdit();
  type WhyThoughtPoint = NonNullable<CardData["thoughtPoints"]>[number];
  type Claim = NonNullable<CardData["claims"]>[number];
  type Assumption = NonNullable<CardData["assumptions"]>[number];

  const [openWhyAnswer, setOpenWhyAnswer] = useState<Record<string, boolean>>({});

  const patchWhy = (p: Partial<NonNullable<CardData["whyData"]>>) =>
    ed?.patch({ whyData: { ...whyData, ...p } });
  const setWhyProbes = (next: WhyThoughtPoint[]) => {
    const others = (card.thoughtPoints || []).filter((t) => t.placement !== "why");
    ed?.patch({ thoughtPoints: [...others, ...next] });
  };

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

      {/* v7.2：WHY 信心校準（落筆前 / 寫完後） */}
      <div
        className="p-2.5 rounded-sm border flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: theme.headingColor }}>落筆前信心：</span>
          <EditableRating
            value={whyData.confidenceBefore ?? 3}
            onChange={(v) => patchWhy({ confidenceBefore: v })}
            activeClassName="bg-amber-400 text-amber-950 border-amber-500 shadow-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold" style={{ color: theme.headingColor }}>寫完後信心：</span>
          <EditableRating
            value={whyData.confidenceAfter ?? 4}
            onChange={(v) => patchWhy({ confidenceAfter: v })}
            activeClassName="bg-emerald-500 text-white border-emerald-600 shadow-xs"
          />
        </div>
      </div>

      {/* 不對稱塔木德式版面：左側主正文 72% + 右側 Margin 評注欄 28% */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 items-start">
        {/* 左側主正文 (72% 寬度, md:col-span-8) */}
        <div
          className="md:col-span-8 p-3.5 rounded-sm border space-y-3 shadow-xs"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          {/* 正交視角 1 & 2（紙上可改；沒有內容時預覽不佔位） */}
          {([1, 2] as const).map((n) => {
            const key = (n === 1 ? "perspective1" : "perspective2") as "perspective1" | "perspective2";
            const current = whyData[key];
            if (!ed?.editable && !current) return null;
            const val = current || { name: "", failureMode: "", content: "" };
            const patchPerspective = (p: Partial<{ name: string; failureMode: string; content: string }>) =>
              patchWhy({ [key]: { ...val, ...p } } as Partial<NonNullable<CardData["whyData"]>>);
            return (
              <div
                key={key}
                className="p-2.5 rounded bg-white/70 border"
                style={{ borderColor: theme.borderColor }}
              >
                <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                  <span>
                    視角 {n} ·{" "}
                    <EditableText
                      value={val.name || ""}
                      onChange={(v) => patchPerspective({ name: v })}
                      placeholder="視角名稱"
                      inline
                      className="font-bold"
                      style={{ color: theme.headingColor, fontFamily: UI_FONT }}
                      ariaLabel={`WHY 視角 ${n} 名稱`}
                    />
                  </span>
                  <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                    失效模式:{" "}
                    <EditableText
                      value={val.failureMode || ""}
                      onChange={(v) => patchPerspective({ failureMode: v })}
                      placeholder="這個視角會怎麼失效"
                      inline
                      className="text-[10px]"
                      style={{ color: "#9f1239", fontFamily: UI_FONT }}
                      ariaLabel={`WHY 視角 ${n} 失效模式`}
                    />
                  </span>
                </div>
                <div className="text-xs leading-relaxed mt-1" style={{ color: theme.textColor, fontFamily: font }}>
                  <EditableText
                    value={val.content || ""}
                    onChange={(v) => patchPerspective({ content: v })}
                    multiline
                    rows={3}
                    placeholder="這個正交視角怎麼重講一次"
                    className="text-xs"
                    style={{ color: theme.textColor, fontFamily: font }}
                    ariaLabel={`WHY 視角 ${n} 內容`}
                  />
                </div>
              </div>
            );
          })}

          {/* v7.2：閉卷草稿（先自己想一次） */}
          {(ed?.editable || whyData.closedBookDraft) && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                閉卷草稿（不查資料先寫一次）
              </span>
              <EditableText
                value={whyData.closedBookDraft || ""}
                onChange={(v) => patchWhy({ closedBookDraft: v })}
                multiline
                rows={3}
                placeholder="先用自己的話寫一次，再對照完整推導"
                className="text-sm leading-relaxed"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="WHY 閉卷草稿"
              />
            </div>
          )}

          {/* 完整論證推導主幹 */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
              完整論證與推導教學稿
            </span>
            <div className="text-sm leading-relaxed space-y-2" style={{ color: theme.textColor, fontFamily: font }}>
              <EditableText
                value={whyData.fullReasoning || whyData.closedBookDraft || ""}
                onChange={(v) => patchWhy({ fullReasoning: v })}
                multiline
                rows={6}
                placeholder="（尚未填寫 WHY 完整論證）"
                className="text-sm leading-relaxed"
                style={{ color: theme.textColor, fontFamily: font }}
                ariaLabel="WHY 完整論證"
              />
            </div>
          </div>

          {/* 關鍵轉折追問點（可新增／刪除／排序） */}
          {(ed?.editable || whyProbes.length > 0) && (
            <div className="pt-2 border-t space-y-2" style={{ borderColor: theme.borderColor }}>
              <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                關鍵轉折追問點（Slamecka 測試效應）
              </span>
              <EditableList<WhyThoughtPoint>
                items={whyProbes}
                onChange={setWhyProbes}
                newItem={() => ({
                  id: newRowId("why-probe"),
                  modeName: "",
                  question: "",
                  answer: "",
                  passed: false,
                  placement: "why",
                })}
                addLabel="新增 WHY 追問點"
                className="space-y-2"
                itemClassName=""
                emptyPlaceholder={null}
                renderItem={(pr, pi) => {
                  const key = pr.id || String(pi);
                  const isOpen = !!openWhyAnswer[key] || !!ed?.editable;
                  const patchProbe = (p: Partial<WhyThoughtPoint>) => {
                    const next = whyProbes.map((t, i) => (i === pi ? { ...t, ...p } : t));
                    setWhyProbes(next);
                  };
                  return (
                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-xs">
                      <div className="font-bold text-amber-900" style={{ fontFamily: UI_FONT }}>
                        【追問 ·{" "}
                        <EditableText
                          value={pr.modeName || ""}
                          onChange={(v) => patchProbe({ modeName: v })}
                          placeholder="思維模式名"
                          inline
                          className="font-bold"
                          style={{ color: "#78350f", fontFamily: UI_FONT }}
                          ariaLabel={`WHY 追問 ${pi + 1} 名稱`}
                        />
                        】
                      </div>
                      <div className="mt-0.5 font-normal" style={{ color: theme.textColor, fontFamily: font }}>
                        <EditableText
                          value={pr.question || ""}
                          onChange={(v) => patchProbe({ question: v })}
                          multiline
                          rows={2}
                          placeholder="讀者先自己想一次的問題"
                          className="text-xs"
                          style={{ color: theme.textColor, fontFamily: font }}
                          ariaLabel={`WHY 追問 ${pi + 1} 問題`}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenWhyAnswer((prev) => ({ ...prev, [key]: !prev[key] }));
                          }}
                          className="text-[10px] font-bold text-amber-800 hover:underline"
                          style={{ fontFamily: UI_FONT }}
                        >
                          {isOpen ? "收合答案" : "→ (讀者先想一次再點此揭曉答案)"}
                        </button>
                        <EditableCheck
                          checked={!!pr.passed}
                          onChange={(v) => patchProbe({ passed: v })}
                          label="[已推出]"
                          checkedClassName="text-emerald-700"
                        />
                      </div>
                      {isOpen && (
                        <div className="mt-1 pt-1 border-t border-amber-200 text-xs text-slate-800" style={{ fontFamily: font }}>
                          <EditableText
                            value={pr.answer || ""}
                            onChange={(v) => patchProbe({ answer: v })}
                            multiline
                            rows={2}
                            placeholder="答案"
                            className="text-xs"
                            style={{ color: theme.textColor, fontFamily: font }}
                            ariaLabel={`WHY 追問 ${pi + 1} 答案`}
                          />
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          )}

          {/* 子目標聲明（可新增／刪除／排序） */}
          {(ed?.editable || (whyData.subGoals?.length || 0) > 0) && (
            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: theme.borderColor }}>
              <span className="text-[11px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                子目標聲明（必要性與充分性）
              </span>
              <EditableList
                items={whyData.subGoals || []}
                onChange={(next) => patchWhy({ subGoals: next })}
                newItem={() => ({ id: newRowId("subgoal"), goal: "", requiredParts: [], whyNecessary: "", whySufficient: "" })}
                addLabel="新增子目標"
                className="space-y-1"
                itemClassName=""
                emptyPlaceholder={null}
                renderItem={(sg, sgi) => {
                  const patchSg = (p: Partial<{ id: string; goal: string; requiredParts: string[]; whyNecessary: string; whySufficient: string }>) => {
                    const next = [...(whyData.subGoals || [])];
                    next[sgi] = { ...next[sgi], ...p };
                    patchWhy({ subGoals: next });
                  };
                  return (
                    <div className="p-2 rounded bg-white/60 border text-xs" style={{ borderColor: theme.borderColor }}>
                      <EditableText
                        value={sg.goal || ""}
                        onChange={(v) => patchSg({ goal: v })}
                        placeholder="子目標"
                        multiline
                        rows={1}
                        className="font-bold text-slate-900"
                        style={{ color: theme.headingColor, fontFamily: font }}
                        ariaLabel={`子目標 ${sgi + 1}`}
                      />
                      <div className="text-[10px] text-slate-600 mt-0.5" style={{ fontFamily: UI_FONT }}>
                        必要性：
                        <EditableText
                          value={sg.whyNecessary || ""}
                          onChange={(v) => patchSg({ whyNecessary: v })}
                          placeholder="為什麼必要"
                          inline
                          className="text-[10px]"
                          style={{ color: theme.textColor, fontFamily: font }}
                          ariaLabel={`子目標 ${sgi + 1} 必要性`}
                        />
                        {" ｜ 充分性："}
                        <EditableText
                          value={sg.whySufficient || ""}
                          onChange={(v) => patchSg({ whySufficient: v })}
                          placeholder="為什麼充分"
                          inline
                          className="text-[10px]"
                          style={{ color: theme.textColor, fontFamily: font }}
                          ariaLabel={`子目標 ${sgi + 1} 充分性`}
                        />
                      </div>
                      {(ed?.editable || (sg.requiredParts || []).length > 0) && (
                        <div className="text-[9px] text-slate-500 mt-0.5" style={{ fontFamily: UI_FONT }}>
                          必要零件：
                          <EditableText
                            value={(sg.requiredParts || []).join("、")}
                            onChange={(v) => patchSg({ requiredParts: v.split(/[、,，;；]/).map((x) => x.trim()).filter(Boolean) })}
                            placeholder="用「、」分隔"
                            inline
                            className="text-[9px]"
                            style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}
                            ariaLabel={`子目標 ${sgi + 1} 必要零件`}
                          />
                        </div>
                      )}
                    </div>
                  );
                }}
              />
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
            {(ed?.editable || claims.length > 0) && (
              <div className="pt-1.5 border-t space-y-1" style={{ borderColor: theme.borderColor }}>
                <span className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                  本卡認識論聲明：
                </span>
                <EditableList<Claim>
                  items={claims}
                  onChange={(next) => ed?.patch({ claims: next })}
                  newItem={() => ({ id: newRowId("claim"), text: "", epistemicMark: "⊢證", frameworkNote: "", anchor: "" })}
                  addLabel="新增聲明"
                  className="space-y-1"
                  itemClassName=""
                  emptyPlaceholder={null}
                  renderItem={(cl, ci) => {
                    const patchClaim = (p: Partial<Claim>) => {
                      const next = [...claims];
                      next[ci] = { ...next[ci], ...p };
                      ed?.patch({ claims: next });
                    };
                    return (
                      <div className="p-1.5 rounded bg-white/80 border text-[10px]" style={{ borderColor: theme.borderColor }}>
                        <div className="flex flex-wrap items-center gap-1">
                          <EditableSelect
                            value={cl.epistemicMark}
                            options={EPISTEMIC_MARKS}
                            onChange={(v) => patchClaim({ epistemicMark: v as Claim["epistemicMark"] })}
                            className="font-bold text-blue-800"
                            controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[10px] font-bold text-blue-800 print:hidden"
                            ariaLabel="認識論標記"
                          />
                          <span className="flex-1 min-w-[8rem]">
                            <EditableText
                              value={cl.text || ""}
                              onChange={(v) => patchClaim({ text: v })}
                              placeholder="聲明內容"
                              inline
                              className="text-[10px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`聲明 ${ci + 1}`}
                            />
                          </span>
                        </div>
                        {(ed?.editable || cl.frameworkNote) && (
                          <div className="mt-0.5 text-[9px] text-slate-500">
                            框架註記：
                            <EditableText
                              value={cl.frameworkNote || ""}
                              onChange={(v) => patchClaim({ frameworkNote: v })}
                              placeholder="選填"
                              inline
                              className="text-[9px]"
                              style={{ color: theme.mutedTextColor, fontFamily: font }}
                              ariaLabel={`聲明 ${ci + 1} 框架註記`}
                            />
                          </div>
                        )}
                        {(ed?.editable || cl.anchor) && (
                          <div className="mt-0.5 text-[9px] text-slate-500">
                            錨點：
                            <EditableText
                              value={cl.anchor || ""}
                              onChange={(v) => patchClaim({ anchor: v })}
                              placeholder="[見WHY視角＿]"
                              inline
                              className="text-[9px]"
                              style={{ color: theme.mutedTextColor, fontFamily: font }}
                              ariaLabel={`聲明 ${ci + 1} 錨點`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
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
          {(ed?.editable || assumptions.length > 0) && (
            <div
              className="p-2.5 rounded-sm border space-y-1"
              style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
            >
              <div className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                假設鎖定清單
              </div>
              <EditableList<Assumption>
                items={assumptions}
                onChange={(next) => ed?.patch({ assumptions: next })}
                newItem={() => ({ id: newRowId("assumption"), name: "", status: "locked", description: "", kind: "situation" })}
                addLabel="新增假設"
                className="space-y-1"
                itemClassName=""
                emptyPlaceholder={null}
                renderItem={(as, ai) => {
                  const patchAssumption = (p: Partial<Assumption>) => {
                    const next = [...assumptions];
                    next[ai] = { ...next[ai], ...p };
                    ed?.patch({ assumptions: next });
                  };
                  return (
                    <div className="text-[10px] p-1 rounded bg-white/80 border" style={{ borderColor: theme.borderColor }}>
                      <div className="flex flex-wrap items-center gap-1">
                        <EditableSelect
                          value={as.kind || "situation"}
                          options={[
                            { value: "situation", label: "情境設定" },
                            { value: "scope", label: "適用範圍" },
                          ]}
                          onChange={(v) => patchAssumption({ kind: v as Assumption["kind"] })}
                          className="font-bold text-purple-800"
                          controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] print:hidden"
                          ariaLabel="假設種類"
                        />
                        <EditableSelect
                          value={as.status}
                          options={[
                            { value: "locked", label: "已鎖定" },
                            { value: "smuggled_candidate", label: "偷渡候選" },
                          ]}
                          onChange={(v) => patchAssumption({ status: v as Assumption["status"] })}
                          className="text-slate-500"
                          controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] print:hidden"
                          ariaLabel="假設狀態"
                        />
                        <span className="flex-1 min-w-[7rem]">
                          <EditableText
                            value={as.name || ""}
                            onChange={(v) => patchAssumption({ name: v })}
                            placeholder="假設名稱"
                            inline
                            className="text-[10px] font-bold"
                            style={{ color: theme.textColor, fontFamily: font }}
                            ariaLabel={`假設 ${ai + 1} 名稱`}
                          />
                        </span>
                      </div>
                      {(ed?.editable || as.description) && (
                        <div className="mt-0.5">
                          <EditableText
                            value={as.description || ""}
                            onChange={(v) => patchAssumption({ description: v })}
                            placeholder="這條假設是什麼、什麼時候成立"
                            multiline
                            rows={1}
                            className="text-[9px]"
                            style={{ color: theme.mutedTextColor, fontFamily: font }}
                            ariaLabel={`假設 ${ai + 1} 說明`}
                          />
                        </div>
                      )}
                    </div>
                  );
                }}
              />
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
  const readings = whatData.readings || [];
  const readingQuestions = whatData.readingQuestions || [];
  const readingBridges = whatData.readingBridges || [];
  const perspectives = whatData.perspectives || [];
  const extensions = whatData.extensions || {};
  const extQuestions = extensions.questions || {};
  const constructDetails = extensions.constructDetails || {};
  const readingNameMap = Object.fromEntries(readings.map((r) => [r.id, r.name]));
  const ed = useCardEdit();
  type Reading = NonNullable<NonNullable<CardData["whatData"]>["readings"]>[number];
  type ReadingQuestion = NonNullable<NonNullable<CardData["whatData"]>["readingQuestions"]>[number];
  type ReadingBridge = NonNullable<NonNullable<CardData["whatData"]>["readingBridges"]>[number];
  type Perspective = NonNullable<NonNullable<CardData["whatData"]>["perspectives"]>[number];

  const patchWhat = (p: Partial<NonNullable<CardData["whatData"]>>) =>
    ed?.patch({ whatData: { ...whatData, ...p } });
  const readingOptions = readings.map((r) => ({ value: r.id, label: r.name || r.id }));
  const patchExt = (key: string, value: string) =>
    patchWhat({
      extensions: { ...extensions, [key]: value } as NonNullable<CardData["whatData"]>["extensions"],
    });
  const patchExtQuestion = (key: string, value: string) =>
    patchWhat({
      extensions: {
        ...extensions,
        questions: { ...extQuestions, [key]: value },
      } as NonNullable<CardData["whatData"]>["extensions"],
    });
  const patchConstructDetails = (p: Partial<NonNullable<NonNullable<CardData["whatData"]>["extensions"]>["constructDetails"]>) =>
    patchWhat({
      extensions: {
        ...extensions,
        constructDetails: { ...constructDetails, ...p },
      } as NonNullable<CardData["whatData"]>["extensions"],
    });

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="WHAT"
        subtitle="緊接 WHY 之後：讀法（問題×讀法表＋橋）· 多視角重講（至少三個＋借鏡視角）· 六個方向延伸（含「造」與功能判準）"
        pageNumber="5/7"
        theme={theme}
      />

      {/* 若此卡為 v6 對照保留示範卡（如勒沙特列原理），顯示手冊 v7 前言註記 */}
      {whatData.v6DemoPreservedNote && (
        <div
          className="p-2.5 rounded-sm border text-[11px] leading-relaxed bg-amber-50/90 border-amber-300 text-amber-950"
          style={{ fontFamily: UI_FONT }}
        >
          <EditableText
            value={whatData.v6DemoPreservedNote || ""}
            onChange={(v) => patchWhat({ v6DemoPreservedNote: v })}
            multiline
            rows={2}
            placeholder="v6 對照示範卡註記"
            className="text-[11px]"
            style={{ fontFamily: UI_FONT, color: "#451a03" }}
            ariaLabel="v6 對照示範卡註記"
          />
        </div>
      )}

      {/* v7.2：WHAT 摘要與「與 APPLY 的區分」（紙上直接改） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-sm border space-y-1" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            WHAT 摘要
          </span>
          <EditableText
            value={whatData.summary || ""}
            onChange={(v) => patchWhat({ summary: v })}
            multiline
            rows={2}
            placeholder="一句話講這張卡是什麼"
            className="text-xs leading-relaxed"
            style={{ color: theme.textColor, fontFamily: font }}
            ariaLabel="WHAT 摘要"
          />
        </div>
        <div className="p-3 rounded-sm border space-y-1" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            與 APPLY 的區分
          </span>
          <EditableText
            value={whatData.distinctionFromHow || ""}
            onChange={(v) => patchWhat({ distinctionFromHow: v })}
            multiline
            rows={2}
            placeholder="WHAT 講「它是什麼」，APPLY 講「怎麼用」"
            className="text-xs leading-relaxed"
            style={{ color: theme.textColor, fontFamily: font }}
            ariaLabel="與 APPLY 的區分"
          />
        </div>
      </div>

      {/* =================================================================
          子節點 1：讀法（v7 新增：什麼算不同讀法 · 問題×讀法表 · 橋 · 機械檢查）
         ================================================================= */}
      {!whatData.v6DemoPreservedNote && (
        <div
          className="p-3.5 rounded-sm border space-y-3"
          style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-1.5" style={{ borderColor: theme.borderColor }}>
            <div>
              <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
                WHAT 第一子節點 · 讀法（v7 新增：取用知識的方式）
              </span>
              <p className="text-[10px] leading-tight mt-0.5" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                <b>什麼算不同讀法</b>：存在某個問題，在其中一種表述下明顯比另一種容易（沒有問題因此變容易＝只是換寫法，如 3×4=12 與 12=3×4）。
              </p>
            </div>
            {readings.length === 1 && (
              <span
                className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"
                style={{ fontFamily: UI_FONT }}
              >
                單一讀法，盲區未驗
              </span>
            )}
          </div>

          {/* 讀法清單（可新增／刪除／排序） */}
          <EditableList<Reading>
            items={readings}
            onChange={(next) => patchWhat({ readings: next })}
            newItem={() => ({ id: newRowId("reading"), name: "", description: "", linkedPerspective: "", onlyForUnderstanding: false })}
            addLabel="新增讀法"
            className="grid grid-cols-1 md:grid-cols-3 gap-2.5"
            itemClassName=""
            emptyPlaceholder={
              <div className="p-2.5 rounded bg-white/60 border text-xs italic text-slate-400" style={{ borderColor: theme.borderColor }}>
                （尚未建立讀法；若只有單一讀法請標「單一讀法，盲區未驗」）
              </div>
            }
            renderItem={(r, rIdx) => {
              const patchReading = (p: Partial<Reading>) => {
                const next = [...readings];
                next[rIdx] = { ...next[rIdx], ...p };
                patchWhat({ readings: next });
              };
              return (
                <div
                  className="p-2.5 rounded bg-white/80 border space-y-1 flex flex-col justify-between"
                  style={{ borderColor: theme.borderColor }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <EditableText
                        value={r.name || ""}
                        onChange={(v) => patchReading({ name: v })}
                        placeholder={`讀法${rIdx + 1}`}
                        inline
                        className="text-[11px] font-bold text-slate-900"
                        style={{ color: theme.headingColor, fontFamily: UI_FONT }}
                        ariaLabel={`讀法 ${rIdx + 1} 名稱`}
                      />
                      <EditableCheck
                        checked={!!r.onlyForUnderstanding}
                        onChange={(v) => patchReading({ onlyForUnderstanding: v })}
                        label="僅理解用"
                        checkedClassName="text-slate-700"
                      />
                    </div>
                    <div className="text-xs leading-relaxed mt-1" style={{ color: theme.textColor, fontFamily: font }}>
                      <EditableText
                        value={r.description || ""}
                        onChange={(v) => patchReading({ description: v })}
                        multiline
                        rows={2}
                        placeholder="讀法具體表述"
                        className="text-xs"
                        style={{ color: theme.textColor, fontFamily: font }}
                        ariaLabel={`讀法 ${rIdx + 1} 說明`}
                      />
                    </div>
                  </div>
                  {(ed?.editable || r.linkedPerspective) && (
                    <div className="text-[9px] text-indigo-700 font-medium pt-1 border-t border-dotted" style={{ borderColor: theme.borderColor, fontFamily: UI_FONT }}>
                      🔗{" "}
                      <EditableText
                        value={r.linkedPerspective || ""}
                        onChange={(v) => patchReading({ linkedPerspective: v })}
                        placeholder="可配視角（選填）"
                        inline
                        className="text-[9px]"
                        style={{ color: "#4338ca", fontFamily: UI_FONT }}
                        ariaLabel={`讀法 ${rIdx + 1} 搭配視角`}
                      />
                    </div>
                  )}
                </div>
              );
            }}
          />

          {/* 問題 × 讀法表（列可新增；每格可改；最便宜／看不見可勾） */}
          {readings.length > 0 && (ed?.editable || readingQuestions.length > 0) && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                  問題 × 讀法表（列＝問題，欄＝讀法，格＝在此讀法下需要幾步／多走哪一步／看不見）
                </span>
                <span className="text-[9px]" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                  ① 每讀法至少一題最便宜 ｜ ② 全欄都貴或看不見＝缺讀法徵兆
                </span>
              </div>
              <div className="overflow-x-auto border rounded" style={{ borderColor: theme.borderColor }}>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(0,0,0,0.04)", fontFamily: UI_FONT }}>
                      <th className="p-2 border-b border-r text-[10px] font-bold" style={{ borderColor: theme.borderColor, color: theme.headingColor }}>
                        問題 ＼ 讀法
                      </th>
                      {readings.map((r, rIdx) => (
                        <th key={r.id || rIdx} className="p-2 border-b border-r last:border-r-0 text-[10px] font-bold" style={{ borderColor: theme.borderColor, color: theme.accentColor }}>
                          {r.name || `讀法${rIdx + 1}`}
                        </th>
                      ))}
                      {ed?.editable && (
                        <th className="p-1 border-b text-[9px] font-bold print:hidden" style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}>
                          列
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: theme.borderColor }}>
                    {readingQuestions.map((rq, qIdx) => {
                      const patchQuestion = (p: Partial<ReadingQuestion>) => {
                        const next = [...readingQuestions];
                        next[qIdx] = { ...next[qIdx], ...p };
                        patchWhat({ readingQuestions: next });
                      };
                      const moveQuestion = (to: number) => {
                        if (to < 0 || to >= readingQuestions.length) return;
                        const next = [...readingQuestions];
                        const [row] = next.splice(qIdx, 1);
                        next.splice(to, 0, row);
                        patchWhat({ readingQuestions: next });
                      };
                      const removeQuestion = () => {
                        if (readingQuestions.length === 1) {
                          const ok = typeof window !== "undefined"
                            ? window.confirm("這是最後一列問題，刪除後問題×讀法表會變空。確定刪除嗎？")
                            : false;
                          if (!ok) return;
                        }
                        patchWhat({ readingQuestions: readingQuestions.filter((_, i) => i !== qIdx) });
                      };
                      return (
                        <tr key={rq.id || qIdx} className="bg-white/75">
                          <td className="p-2 border-r font-semibold text-slate-900 align-top" style={{ borderColor: theme.borderColor, fontFamily: font }}>
                            <EditableText
                              value={rq.question || ""}
                              onChange={(v) => patchQuestion({ question: v })}
                              multiline
                              rows={1}
                              placeholder="問題"
                              className="text-xs font-semibold"
                              style={{ color: theme.headingColor, fontFamily: font }}
                              ariaLabel={`問題 ${qIdx + 1}`}
                            />
                          </td>
                          {readings.map((r) => {
                            const cell = rq.cells?.[r.id] || { text: "" };
                            const isCheap = cell.isCheapest;
                            const isInv = cell.isInvisible || /看不見|看不见/.test(cell.text || "");
                            const patchCell = (p: Partial<typeof cell>) => {
                              const current = readingQuestions[qIdx];
                              const cells = { ...(current.cells || {}) };
                              cells[r.id] = { ...(cells[r.id] || { text: "" }), ...p };
                              patchQuestion({ cells });
                            };
                            return (
                              <td
                                key={r.id}
                                className={`p-2 border-r last:border-r-0 align-top ${
                                  isCheap
                                    ? "bg-emerald-50/80 font-semibold text-emerald-950"
                                    : isInv
                                    ? "bg-rose-50/60 text-rose-900"
                                    : "text-slate-700"
                                }`}
                                style={{ borderColor: theme.borderColor, fontFamily: font }}
                              >
                                <div className="flex flex-wrap items-center gap-1 mb-0.5" style={{ fontFamily: UI_FONT }}>
                                  <EditableCheck
                                    checked={!!isCheap}
                                    onChange={(v) => patchCell({ isCheapest: v })}
                                    label="★ 最便宜"
                                    checkedClassName="bg-emerald-600 text-white border-emerald-700"
                                  />
                                  <EditableCheck
                                    checked={!!isInv}
                                    onChange={(v) => patchCell({ isInvisible: v })}
                                    label="看不見"
                                    checkedClassName="bg-rose-200 text-rose-900 border-rose-300"
                                  />
                                  {!ed?.editable && isInv && cell.pointsToReadingId && readingNameMap[cell.pointsToReadingId] && (
                                    <span className="text-[9px] text-rose-700 font-medium">
                                      → 見 {readingNameMap[cell.pointsToReadingId]}
                                    </span>
                                  )}
                                  {ed?.editable && (
                                    <EditableSelect
                                      value={cell.pointsToReadingId || ""}
                                      options={[{ value: "", label: "（不指向）" }, ...readingOptions]}
                                      onChange={(v) => patchCell({ pointsToReadingId: v || undefined })}
                                      className="text-[9px] text-rose-700"
                                      controlClassName="max-w-[110px] rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] print:hidden"
                                      ariaLabel={`${r.name || "讀法"} 指向哪個讀法`}
                                    />
                                  )}
                                </div>
                                <EditableText
                                  value={cell.text || ""}
                                  onChange={(v) => patchCell({ text: v })}
                                  multiline
                                  rows={1}
                                  placeholder="—"
                                  className="text-xs"
                                  style={{ color: theme.textColor, fontFamily: font }}
                                  ariaLabel={`問題 ${qIdx + 1} × ${r.name || "讀法"} 單格`}
                                />
                              </td>
                            );
                          })}
                          {ed?.editable && (
                            <td className="p-1 align-top print:hidden">
                              <div className="flex flex-col items-center gap-0.5">
                                <button
                                  type="button"
                                  title="上移問題列"
                                  disabled={qIdx === 0}
                                  onClick={() => moveQuestion(qIdx - 1)}
                                  className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm hover:bg-slate-50 disabled:opacity-30"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="下移問題列"
                                  disabled={qIdx === readingQuestions.length - 1}
                                  onClick={() => moveQuestion(qIdx + 1)}
                                  className="rounded border border-slate-200 bg-white p-0.5 text-slate-500 shadow-sm hover:bg-slate-50 disabled:opacity-30"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  title="刪除問題列"
                                  onClick={removeQuestion}
                                  className="rounded border border-rose-200 bg-white p-0.5 text-rose-500 shadow-sm hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {ed?.editable && (
                <button
                  type="button"
                  onClick={() =>
                    patchWhat({
                      readingQuestions: [
                        ...readingQuestions,
                        { id: newRowId("reading-q"), question: "", cells: {} },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-1 rounded border border-dashed border-amber-400/80 bg-amber-50/50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100/70 print:hidden"
                >
                  <Plus className="h-3 w-3" />
                  新增問題列
                </button>
              )}
            </div>
          )}

          {/* 橋（可新增／刪除／排序；切換型別會顯示對應欄位） */}
          {(ed?.editable || readingBridges.length > 0) && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>
                橋 · 讀法之間的關係（四種：互通〔雙向推導〕／單向〔推導＋反向反例〕／限定範圍〔推導＋範圍條件＋範圍外反例〕／走不通〔理由＋[已證無橋]或[未找到橋]〕）
              </div>
              <EditableList<ReadingBridge>
                items={readingBridges}
                onChange={(next) => patchWhat({ readingBridges: next })}
                newItem={() => ({
                  id: newRowId("bridge"),
                  fromReadingId: readings[0]?.id || "",
                  toReadingId: readings[1]?.id || readings[0]?.id || "",
                  type: "互通",
                })}
                addLabel="新增橋"
                className="grid grid-cols-1 gap-2"
                itemClassName=""
                emptyPlaceholder={null}
                renderItem={(br, bIdx) => {
                  const patchBridge = (p: Partial<ReadingBridge>) => {
                    const next = [...readingBridges];
                    next[bIdx] = { ...next[bIdx], ...p };
                    patchWhat({ readingBridges: next });
                  };
                  const arrow =
                    br.type === "互通"
                      ? "↔"
                      : br.type === "單向"
                      ? "→"
                      : br.type === "限定範圍"
                      ? "⇄(限定)"
                      : br.type === "走不通"
                      ? "✕"
                      : "⋯";
                  const showForward = br.type === "互通" || br.type === "單向" || br.type === "限定範圍";
                  const showBackward = br.type === "互通";
                  const showCounter = br.type === "單向" || br.type === "限定範圍";
                  const showScope = br.type === "限定範圍";
                  const showBlocked = br.type === "走不通";
                  return (
                    <div
                      className="p-2.5 rounded bg-white/80 border text-xs space-y-1"
                      style={{ borderColor: theme.borderColor }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1" style={{ fontFamily: UI_FONT }}>
                        <span className="font-bold text-slate-900 text-[11px] flex flex-wrap items-center gap-1">
                          <EditableSelect
                            value={br.fromReadingId}
                            options={readingOptions}
                            onChange={(v) => patchBridge({ fromReadingId: v })}
                            className="font-bold text-[11px]"
                            controlClassName="max-w-[130px] rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[10px] print:hidden"
                            ariaLabel="橋的起點讀法"
                          />
                          <span>{arrow}</span>
                          <EditableSelect
                            value={br.toReadingId}
                            options={readingOptions}
                            onChange={(v) => patchBridge({ toReadingId: v })}
                            className="font-bold text-[11px]"
                            controlClassName="max-w-[130px] rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[10px] print:hidden"
                            ariaLabel="橋的終點讀法"
                          />
                        </span>
                        <span className="flex items-center gap-1">
                          <EditableSelect
                            value={br.type}
                            options={BRIDGE_TYPES}
                            onChange={(v) => patchBridge({ type: v as ReadingBridge["type"] })}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                              br.type === "互通"
                                ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                : br.type === "單向"
                                ? "bg-blue-100 text-blue-900 border-blue-300"
                                : br.type === "限定範圍"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : br.type === "走不通"
                                ? "bg-rose-100 text-rose-900 border-rose-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                            controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] font-bold text-slate-800 print:hidden"
                            ariaLabel="橋的型別"
                          />
                          {showBlocked && (
                            <EditableSelect
                              value={br.blockedMark || "[未找到橋]"}
                              options={BLOCKED_MARKS}
                              onChange={(v) => patchBridge({ blockedMark: v as ReadingBridge["blockedMark"] })}
                              className="text-[9px] text-rose-700"
                              controlClassName="rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] print:hidden"
                              ariaLabel="走不通標記"
                            />
                          )}
                        </span>
                      </div>
                      <div className="space-y-0.5 text-[11px] leading-relaxed" style={{ fontFamily: font, color: theme.textColor }}>
                        {showForward && (
                          <div>
                            <b style={{ fontFamily: UI_FONT }} className="text-slate-700">
                              {br.type === "互通" ? "正向推導：" : "推導："}
                            </b>
                            <EditableText
                              value={br.forwardProof || ""}
                              onChange={(v) => patchBridge({ forwardProof: v })}
                              multiline
                              rows={1}
                              placeholder="推導內容"
                              className="text-[11px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`橋 ${bIdx + 1} 推導`}
                            />
                          </div>
                        )}
                        {showBackward && (
                          <div>
                            <b style={{ fontFamily: UI_FONT }} className="text-slate-700">反向推導：</b>
                            <EditableText
                              value={br.backwardProof || ""}
                              onChange={(v) => patchBridge({ backwardProof: v })}
                              multiline
                              rows={1}
                              placeholder="反向推導"
                              className="text-[11px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`橋 ${bIdx + 1} 反向推導`}
                            />
                          </div>
                        )}
                        {showScope && (
                          <div>
                            <b style={{ fontFamily: UI_FONT }} className="text-amber-800">範圍條件：</b>
                            <EditableText
                              value={br.scopeCondition || ""}
                              onChange={(v) => patchBridge({ scopeCondition: v })}
                              multiline
                              rows={1}
                              placeholder="在什麼範圍內成立"
                              className="text-[11px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`橋 ${bIdx + 1} 範圍條件`}
                            />
                          </div>
                        )}
                        {showCounter && (
                          <div>
                            <b style={{ fontFamily: UI_FONT }} className="text-rose-800">反例：</b>
                            <EditableText
                              value={br.counterExample || ""}
                              onChange={(v) => patchBridge({ counterExample: v })}
                              multiline
                              rows={1}
                              placeholder="反例"
                              className="text-[11px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`橋 ${bIdx + 1} 反例`}
                            />
                          </div>
                        )}
                        {showBlocked && (
                          <div>
                            <b style={{ fontFamily: UI_FONT }} className="text-rose-800">走不通理由：</b>
                            <EditableText
                              value={br.blockedReason || ""}
                              onChange={(v) => patchBridge({ blockedReason: v })}
                              multiline
                              rows={1}
                              placeholder="為什麼走不通"
                              className="text-[11px]"
                              style={{ color: theme.textColor, fontFamily: font }}
                              ariaLabel={`橋 ${bIdx + 1} 走不通理由`}
                            />
                          </div>
                        )}
                        {br.type === "[未查]" && (
                          <div className="text-[10px] italic text-slate-500">尚未查這條橋（[未查]）。</div>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* WHY 到視角的發散關係連線圖示 */}
      <div className="flex items-center justify-center gap-3 py-1 text-xs" style={{ fontFamily: UI_FONT }}>
        <span className="px-2 py-0.5 rounded border font-bold" style={{ borderColor: theme.borderColor, color: theme.headingColor }}>
          WHY
        </span>
        <ArrowRight className="w-4 h-4" style={{ color: theme.accentColor }} />
        <span className="text-[11px] font-bold" style={{ color: theme.accentColor }}>
          平行多視角闡述（視角與讀法是兩條獨立的軸）
        </span>
      </div>

      {/* 平行欄位：視角①、②、③...（可新增／刪除／排序） */}
      <EditableList<Perspective>
        items={perspectives}
        onChange={(next) => patchWhat({ perspectives: next })}
        newItem={() => ({ code: `視角${perspectives.length + 1}`, label: "", content: "", kind: "perspective" })}
        addLabel="新增視角"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
        itemClassName=""
        emptyPlaceholder={
          <div className="col-span-3 p-4 rounded border text-center text-xs italic" style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}>
            （尚未建立視角，建議至少撰寫 3 個不同視角）
          </div>
        }
        renderItem={(p, idx) => {
          const isMirror = p.kind === "mirror" || /借鏡視角|借镜视角/.test(`${p.code || ""} ${p.label || ""}`);
          const patchP = (patch: Partial<Perspective>) => {
            const next = [...perspectives];
            next[idx] = { ...next[idx], ...patch };
            patchWhat({ perspectives: next });
          };
          return (
            <div
              className="p-3 rounded-sm border space-y-2 flex flex-col shadow-xs"
              style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
            >
              <div className="flex items-center justify-between border-b pb-1 gap-1" style={{ borderColor: theme.borderColor }}>
                <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
                  視角 {idx + 1} ·{" "}
                  <EditableText
                    value={p.label || ""}
                    onChange={(v) => patchP({ label: v })}
                    placeholder={p.code || "視角名稱"}
                    inline
                    className="font-bold"
                    style={{ color: theme.accentColor, fontFamily: UI_FONT }}
                    ariaLabel={`視角 ${idx + 1} 名稱`}
                  />
                </span>
                <EditableCheck
                  checked={!!p.isAlsoReading}
                  onChange={(v) => patchP({ isAlsoReading: v })}
                  label="同時為讀法"
                  checkedClassName="bg-sky-100 text-sky-900 border-sky-300"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px]" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
                <EditableCheck
                  checked={!isMirror}
                  onChange={(v) => patchP({ kind: v ? "perspective" : "mirror" })}
                  label="視角"
                  showWhenUnchecked
                  checkedClassName="font-bold text-slate-900"
                />
                <EditableCheck
                  checked={isMirror}
                  onChange={(v) => patchP({ kind: v ? "mirror" : "perspective" })}
                  label="借鏡視角"
                  showWhenUnchecked
                  checkedClassName="font-bold text-indigo-800"
                />
                {p.isAlsoReading && (
                  <EditableSelect
                    value={p.linkedReadingId || ""}
                    options={[{ value: "", label: "（未指定讀法）" }, ...readingOptions]}
                    onChange={(v) => patchP({ linkedReadingId: v || undefined })}
                    className="text-[9px] text-sky-800"
                    controlClassName="max-w-[120px] rounded border border-amber-400/80 bg-white px-1 py-0.5 text-[9px] print:hidden"
                    ariaLabel={`視角 ${idx + 1} 對應讀法`}
                  />
                )}
              </div>

              <div className="text-[10px] p-1.5 rounded bg-white/75 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
                <div className="font-bold text-slate-800" style={{ fontFamily: UI_FONT }}>
                  (1) 對應表：
                </div>
                <div style={{ fontFamily: font, color: theme.textColor }}>
                  <EditableText
                    value={p.mappingTable || ""}
                    onChange={(v) => patchP({ mappingTable: v })}
                    multiline
                    rows={1}
                    placeholder={`${p.code || "視角"} ↔ ${p.label || "本知識點角色"}`}
                    className="text-[10px]"
                    style={{ color: theme.textColor, fontFamily: font }}
                    ariaLabel={`視角 ${idx + 1} 對應表`}
                  />
                </div>
              </div>

              <div className="text-xs leading-relaxed flex-1" style={{ color: theme.textColor, fontFamily: font }}>
                <EditableText
                  value={p.content || ""}
                  onChange={(v) => patchP({ content: v })}
                  multiline
                  rows={3}
                  placeholder="（視角闡述內容）"
                  className="text-xs"
                  style={{ color: theme.textColor, fontFamily: font }}
                  ariaLabel={`視角 ${idx + 1} 內容`}
                />
              </div>

              {(ed?.editable || p.derivedFact) && (
                <div className="text-[10px] p-1.5 rounded bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-0.5">
                  <div className="font-bold text-emerald-800" style={{ fontFamily: UI_FONT }}>
                    (2) 導出可獨立核對的具體事實：
                  </div>
                  <div style={{ fontFamily: font }}>
                    <EditableText
                      value={p.derivedFact || ""}
                      onChange={(v) => patchP({ derivedFact: v })}
                      multiline
                      rows={1}
                      placeholder="用對應表導出可核對的事實"
                      className="text-[10px]"
                      style={{ color: "#022c22", fontFamily: font }}
                      ariaLabel={`視角 ${idx + 1} 導出事實`}
                    />
                  </div>
                </div>
              )}

              {(ed?.editable || p.code) && (
                <div className="text-[9px] text-slate-400" style={{ fontFamily: UI_FONT }}>
                  代號：
                  <EditableText
                    value={p.code || ""}
                    onChange={(v) => patchP({ code: v })}
                    placeholder="視角代號"
                    inline
                    className="text-[9px]"
                    style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}
                    ariaLabel={`視角 ${idx + 1} 代號`}
                  />
                </div>
              )}
            </div>
          );
        }}
      />

      {(ed?.editable || whatData.mirrorPerspectiveTriedNote) && (
        <div
          className="p-2 rounded border text-[11px] bg-slate-50 text-slate-700"
          style={{ borderColor: theme.borderColor, fontFamily: UI_FONT }}
        >
          <b>借鏡視角誠實標註：</b>
          <EditableText
            value={whatData.mirrorPerspectiveTriedNote || ""}
            onChange={(v) => patchWhat({ mirrorPerspectiveTriedNote: v })}
            multiline
            rows={1}
            placeholder="已嘗試尋找借鏡視角，未找到"
            className="text-[11px]"
            style={{ fontFamily: UI_FONT, color: "#334155" }}
            ariaLabel="借鏡視角誠實標註"
          />
        </div>
      )}

      {/* 視角 vs 讀法 兩條獨立軸 & 借鏡視角判定 */}
      <div
        className="p-3 rounded-sm border text-[10px] leading-relaxed space-y-1"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        <p>
          <b style={{ color: theme.headingColor }}>視角與讀法是兩條獨立的軸（v7）：</b>
          視角問「有沒有第二個對象、結構貼不貼」；讀法問「有沒有題變容易」——四種組合都存在（是視角也是讀法：天平支點；是視角不是讀法：純結構對應無題變快；是讀法不是視角：總和÷個數、偏差相消點；兩者都不是：3×4=12 改寫成 12=3×4）。
        </p>
        <p>
          <b style={{ color: theme.accentColor }}>外部工具視角寫作規則（v6/v7）：</b>
          (1) 顯式列出對應表（外部角色 ↔ 本知識點角色）；(2) 用對應表導出一個讀者能獨立核對對錯的具體事實。借鏡視角若真的想不出來，須註明「已嘗試尋找借鏡視角，未找到」。
        </p>
      </div>

      {/* 六個方向延伸（推深 / 推淺 / 推廣 / 推窄 / 翻譯 / 造） */}
      <div
        className="p-3.5 rounded-sm border space-y-2.5"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
            {whatData.v6DemoPreservedNote
              ? "五個方向延伸（v6 對照示範：推深 / 推淺 / 推廣 / 推窄 / 翻譯）"
              : "六個方向延伸（v7：推深 / 推淺 / 推廣 / 推窄 / 翻譯 / 造）"}
          </span>
        </div>
        <p className="text-[10px] leading-tight" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>
          <b>洞見檢查（v7 改為功能判準，取代 v4 感覺判準）：</b>每一句延伸附一道「拿掉這句就會答錯或做不出來」的題；寫不出，就刪掉這句。⚠ 與 APPLY 強制分離，「知道原理」≠「會做題」。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 text-xs">
          {[
            { key: "deeper", label: "1. 推深 (Deeper)", val: extensions.deeper, q: extQuestions.deeper, desc: "奠基在什麼更底層知識（開放方向，非重寫WHY）" },
            { key: "shallower", label: "2. 推淺 (Shallower)", val: extensions.shallower, q: extQuestions.shallower, desc: "能推出什麼純邏輯後果（不要求派上用場）" },
            { key: "generalize", label: "3. 推廣 (Generalize)", val: extensions.generalize, q: extQuestions.generalize, desc: "放寬條件／範疇會變成什麼" },
            { key: "specialize", label: "4. 推窄 (Specialize)", val: extensions.specialize, q: extQuestions.specialize, desc: "收緊條件會成什麼特例（無則從缺）" },
            { key: "translate", label: "5. 翻譯 (Translate)", val: extensions.translate, q: extQuestions.translate, desc: "用本概念語言重講別的現象（結構不完全貼合/對外部理解變多）" },
            ...(!whatData.v6DemoPreservedNote || extensions.construct
              ? [{ key: "construct", label: "6. 造 (Construct · v7新增)", val: extensions.construct, q: extQuestions.construct, desc: "用此概念當零件，經邏輯未強迫的選擇造出新量/對象/操作" }]
              : []),
          ].map((ext) => (
            <div
              key={ext.key}
              className={`p-2.5 rounded bg-white/80 border flex flex-col justify-between space-y-2 ${
                ext.key === "construct" ? "ring-1 ring-teal-500/40 bg-teal-50/30" : ""
              }`}
              style={{ borderColor: theme.borderColor }}
            >
              <div className="space-y-1">
                <div className="font-bold text-[10px] text-slate-900" style={{ fontFamily: UI_FONT }}>
                  {ext.label}
                </div>
                <div className="text-[9px] text-slate-500" style={{ fontFamily: UI_FONT }}>
                  {ext.desc}
                </div>
                <div className="text-xs leading-relaxed pt-0.5" style={{ color: theme.textColor, fontFamily: font }}>
                  <EditableText
                    value={ext.val || ""}
                    onChange={(v) => patchExt(ext.key, v)}
                    multiline
                    rows={3}
                    placeholder="（從缺）"
                    className="text-xs"
                    style={{ color: theme.textColor, fontFamily: font }}
                    ariaLabel={`${ext.label} 內容`}
                  />
                </div>

                {/* 若為第 6 方向「造」，顯示必寫的三件事 */}
                {ext.key === "construct" && (ed?.editable || constructDetails.choice || constructDetails.alternative || constructDetails.linkBack) && (
                  <div className="mt-1.5 pt-1.5 border-t border-teal-200 space-y-1 text-[10px]" style={{ fontFamily: font }}>
                    <div className="font-bold text-teal-900" style={{ fontFamily: UI_FONT }}>
                      造出新對象：
                      <EditableText
                        value={constructDetails.name || ""}
                        onChange={(v) => patchConstructDetails({ name: v })}
                        placeholder="新量／對象／操作名稱"
                        inline
                        className="font-bold text-[10px]"
                        style={{ color: "#134e4a", fontFamily: font }}
                        ariaLabel="造出新對象名稱"
                      />
                    </div>
                    <div>
                      <b className="text-teal-800" style={{ fontFamily: UI_FONT }}>① 選了什麼：</b>
                      <EditableText
                        value={constructDetails.choice || ""}
                        onChange={(v) => patchConstructDetails({ choice: v })}
                        multiline
                        rows={1}
                        placeholder="邏輯沒有逼你做的那個決定"
                        className="text-[10px]"
                        style={{ color: theme.textColor, fontFamily: font }}
                        ariaLabel="造 ① 選了什麼"
                      />
                    </div>
                    <div>
                      <b className="text-amber-800" style={{ fontFamily: UI_FONT }}>② 換一個選擇會怎樣：</b>
                      <EditableText
                        value={constructDetails.alternative || ""}
                        onChange={(v) => patchConstructDetails({ alternative: v })}
                        multiline
                        rows={1}
                        placeholder="至少寫出一個別的選擇和結果"
                        className="text-[10px]"
                        style={{ color: theme.textColor, fontFamily: font }}
                        ariaLabel="造 ② 換一個選擇"
                      />
                    </div>
                    <div>
                      <b className="text-indigo-800" style={{ fontFamily: UI_FONT }}>③ 連回對象（可核對式子）：</b>
                      <EditableText
                        value={constructDetails.linkBack || ""}
                        onChange={(v) => patchConstructDetails({ linkBack: v })}
                        multiline
                        rows={1}
                        placeholder="用可核對的式子或推導說明關係"
                        className="text-[10px]"
                        style={{ color: theme.textColor, fontFamily: font }}
                        ariaLabel="造 ③ 連回對象"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* v7 功能判準洞見檢查題 */}
              {(ed?.editable || ext.q) && (
                <div className="p-1.5 rounded bg-indigo-50/80 border border-indigo-200 text-[10px] text-indigo-950">
                  <span className="font-bold text-indigo-800" style={{ fontFamily: UI_FONT }}>
                    [功能判準題]{" "}
                  </span>
                  <span style={{ fontFamily: font }}>
                    <EditableText
                      value={ext.q || ""}
                      onChange={(v) => patchExtQuestion(ext.key, v)}
                      multiline
                      rows={1}
                      placeholder="拿掉這句就會答錯或做不出來的題"
                      className="text-[10px]"
                      style={{ color: "#1e1b4b", fontFamily: font }}
                      ariaLabel={`${ext.label} 功能判準題`}
                    />
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <V6PageFooter
        note="版式：讀法（問題×讀法表＋橋）· 平行視角欄 · 六向延伸（含「造」三要素與功能判準題）"
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
  const ed = useCardEdit();
  type HowCheck = NonNullable<NonNullable<CardData["howData"]>["checks"]>[number];
  type HowCan = NonNullable<NonNullable<CardData["howData"]>["can"]>[number];

  const patchHow = (p: Partial<NonNullable<CardData["howData"]>>) =>
    ed?.patch({ howData: { status: "uncompiled", ...howData, ...p } as CardData["howData"] });

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="APPLY"
        subtitle="能不能用 / 怎麼用 / 用了能幹嘛——每條內容句尾都要掛來源標籤 [源:＿＿＿]（含 [源:WHAT-讀法n]）"
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
          ‖ = CHECK關卡（過不了不能往下選） →分岔=分支（標明用哪個讀法 [源:WHAT-讀法n]） ┄→CAN（選填，某能力只屬於該分支時寫在分支末端）
        </p>
        <div className="flex items-center gap-1.5 text-[10px]" style={{ color: theme.mutedTextColor }}>
          <span className="font-bold" style={{ color: theme.headingColor }}>卡片編譯狀態：</span>
          <EditableToggle
            checked={howData?.status === "compiled"}
            onChange={(v) => patchHow({ status: v ? "compiled" : "uncompiled" })}
            onLabel="[已編譯]"
            offLabel="[未編譯]"
            onClassName="text-emerald-700"
            offClassName="text-amber-700"
            ariaLabel="APPLY 編譯狀態"
          />
        </div>
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
            <EditableList<HowCheck>
              items={checks}
              onChange={(next) => patchHow({ checks: next })}
              newItem={() => ({ id: newRowId("check"), cue: "", check: "" })}
              addLabel="新增 CHECK 關卡"
              className="space-y-1.5"
              itemClassName=""
              emptyPlaceholder={<p className="italic text-slate-400 text-xs">（尚未建立 CHECK 關卡）</p>}
              renderItem={(c, ci) => {
                const patchCheck = (p: Partial<HowCheck>) => {
                  const next = [...checks];
                  next[ci] = { ...next[ci], ...p };
                  patchHow({ checks: next });
                };
                return (
                  <div className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
                    <div className="font-bold text-blue-900">
                      看到：
                      <EditableText
                        value={c.cue || ""}
                        onChange={(v) => patchCheck({ cue: v })}
                        placeholder="觸發線索"
                        inline
                        className="text-xs font-bold"
                        style={{ color: "#1e3a8a", fontFamily: font }}
                        ariaLabel={`CHECK ${ci + 1} 線索`}
                      />
                    </div>
                    <div className="text-[11px] text-amber-900 bg-amber-50/80 px-1.5 py-0.5 rounded border border-amber-200">
                      <b>→ 兩段式變換／識別：</b>
                      <EditableText
                        value={c.twoStageTransform || ""}
                        onChange={(v) => patchCheck({ twoStageTransform: v })}
                        placeholder="先做什麼變換／識別（選填）"
                        inline
                        className="text-[11px]"
                        style={{ color: "#78350f", fontFamily: font }}
                        ariaLabel={`CHECK ${ci + 1} 兩段式變換`}
                      />
                    </div>
                    <div className="font-bold text-emerald-900">
                      → 檢查：
                      <EditableText
                        value={c.check || ""}
                        onChange={(v) => patchCheck({ check: v })}
                        placeholder="檢查什麼"
                        inline
                        className="text-xs font-bold"
                        style={{ color: "#064e3b", fontFamily: font }}
                        ariaLabel={`CHECK ${ci + 1} 檢查`}
                      />
                    </div>
                    <div className="text-[9px] text-indigo-700 font-mono mt-0.5" style={{ fontFamily: UI_FONT }}>
                      <EditableText
                        value={c.source || ""}
                        onChange={(v) => patchCheck({ source: v })}
                        placeholder="[源:定義/前置]"
                        inline
                        className="text-[9px] font-mono"
                        style={{ color: "#4338ca", fontFamily: "monospace" }}
                        ariaLabel={`CHECK ${ci + 1} 來源`}
                      />
                    </div>
                  </div>
                );
              }}
            />
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
            <EditableList<HowCan>
              items={cans}
              onChange={(next) => patchHow({ can: next })}
              newItem={() => ({ id: newRowId("can"), trigger: "", capability: "" })}
              addLabel="新增 CAN 解鎖"
              className="space-y-1.5"
              itemClassName=""
              emptyPlaceholder={<p className="italic text-slate-400 text-xs">（尚未填寫 CAN 下游解鎖）</p>}
              renderItem={(cn, cni) => {
                const patchCan = (p: Partial<HowCan>) => {
                  const next = [...cans];
                  next[cni] = { ...next[cni], ...p };
                  patchHow({ can: next });
                };
                return (
                  <div className="p-2 rounded bg-white/70 border space-y-0.5" style={{ borderColor: theme.borderColor }}>
                    <div className="font-bold text-purple-900">
                      看到{" "}
                      <EditableText
                        value={cn.trigger || ""}
                        onChange={(v) => patchCan({ trigger: v })}
                        placeholder="觸發"
                        inline
                        className="text-xs font-bold"
                        style={{ color: "#581c87", fontFamily: font }}
                        ariaLabel={`CAN ${cni + 1} 觸發`}
                      />{" "}
                      → 就能{" "}
                      <EditableText
                        value={cn.capability || ""}
                        onChange={(v) => patchCan({ capability: v })}
                        placeholder="解鎖的能力"
                        inline
                        className="text-xs font-bold"
                        style={{ color: "#581c87", fontFamily: font }}
                        ariaLabel={`CAN ${cni + 1} 能力`}
                      />
                    </div>
                    <div className="text-[9px] text-indigo-700 font-mono mt-0.5" style={{ fontFamily: UI_FONT }}>
                      <EditableText
                        value={cn.source || ""}
                        onChange={(v) => patchCan({ source: v })}
                        placeholder="[源:HOW解鎖]"
                        inline
                        className="text-[9px] font-mono"
                        style={{ color: "#4338ca", fontFamily: "monospace" }}
                        ariaLabel={`CAN ${cni + 1} 來源`}
                      />
                    </div>
                  </div>
                );
              }}
            />
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
            分支（左觸發 · 中流程 · 右來源 [源:WHAT-讀法n] 等）
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

          <ApplyBranchTree
            branches={branches as ApplyBranch[]}
            onChange={(next) => patchHow({ branches: next })}
            font={font}
            theme={theme}
          />
        </div>
      </div>

      {/* 底部來源標籤規範 */}
      <div
        className="p-2 rounded-sm border text-[10px] leading-relaxed"
        style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor, fontFamily: UI_FONT }}
      >
        來源標籤照實寫，不預先限定：[源:定義]／[源:WHY-推導X]／[源:WHAT-視角X或借鏡視角:標題]／[源:WHAT-讀法n]／[源:關係邊-X]——APPLY 裡任何一條內容都不能憑空冒出來，要交代來處；沒被任何分支用到的讀法須標「僅理解用」。
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border px-2.5 py-1.5" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, fontFamily: UI_FONT }}>
        <span className="text-[10px]" style={{ color: theme.mutedTextColor }}>
          過程日誌由工作區統一記錄，紙上僅供檢視；新增／修改請走「日誌」視圖。
        </span>
        <ReadOnlyBadge label="唯讀" />
      </div>

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
