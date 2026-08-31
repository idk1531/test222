"use client";

import React from "react";
import { MathText } from "./MathText";
import { Maximize2, Eye } from "lucide-react";
import { resolveFont } from "@/lib/fonts";
import { SHAPE_DEFS } from "./ShapeClassifier";

export interface CardData {
  id: string;
  workspaceId: string;
  title: string;
  domain: string;
  granularity: string;
  backgroundDescription?: string;
  cardFont?: string;
  pageMode?: "single" | "paged";
  constructionThinking?: string; // v4: 邏輯觸發，與 ORIGIN 歷史觸發分開
  thoughtPoints?: Array<{
    id: string;
    modeName: string; // 思維模式名，如「反證法起手式」
    question: string;
    answer: string;
    passed: boolean; // ✓展
    note?: string;
    createdAt?: string;
  }>;
  thinkingPatterns?: Array<{
    id: string;
    modeName: string;
    description: string;
    occurrenceCount: number;
    sourceCardIds: string[];
  }>;
  // v4 新增：直覺陷阱（推導正確但直覺容易誤判）
  intuitionTraps?: Array<{
    id: string;
    description: string;
    whyMisleading: string;
    correctUnderstanding: string;
  }>;
  reasoningShape: string; // A|B|C|D|E|COMPOSITE
  compositeShapes?: string[];
  compositeNote?: string;
  shapeRationale?: string;
  shapeConfidence?: number;
  shapeAccepted?: boolean;
  whatData?: {
    summary: string;
    perspectives: Array<{ code: string; label: string; content: string }>;
    distinctionFromHow: string;
  };
  whyData?: {
    confidenceBefore: number;
    closedBookDraft: string;
    fullReasoning: string;
    confidenceAfter: number;
    perspective1?: { name: string; failureMode: string; content: string };
    perspective2?: { name: string; failureMode: string; content: string };
    subGoals?: Array<{
      id: string;
      goal: string;
      requiredParts: string[];
      whyNecessary: string;
      whySufficient: string;
    }>;
  };
  assumptions?: Array<{
    id: string;
    name: string;
    status: "locked" | "smuggled_candidate";
    description: string;
  }>;
  howData?: {
    steps: Array<{ id: string; title: string; action: string; isCompiled: boolean }>;
    status: "compiled" | "uncompiled";
    testNotes?: string;
  };
  whenData?: {
    triggers: Array<{ id: string; cue: string; check: string; keywords: string[] }>;
    // WHEN·可用（v4 新增）：通用技巧型才寫
    enables?: Array<{ id: string; trigger: string; capability: string }>;
    boundaryNotes?: string;
  };
  originData?: { conflict: string; historicalContext?: string };
  claims?: Array<{
    id: string;
    text: string;
    epistemicMark: "⊢證" | "⊢歸" | "⊢近" | "⊢約" | "⊢公設";
    frameworkNote?: string;
    anchor?: string; // v4：指回 WHY 具體段落的錨點（如「[見WHY視角2]」）
  }>;
  bloomLevel: string;
  soloLevel: string;
  soloData?: {
    declaredLevel: string;
    evidence: Array<{ id: string; level: string; text: string }>;
    autoSuggestedLevel?: string;
    autoRationale?: string;
    accepted?: boolean;
    history?: Array<{ at: string; from: string; to: string; reason: string }>;
  };
  blockageNotes?: string;
}

interface KnowledgeCardNodeProps {
  card: CardData;
  isSelected?: boolean;
  onSelect?: () => void;
  onOpenPreview?: (card: CardData) => void;
  onOpenDetail?: (card: CardData) => void;
  onRunAudit?: (card: CardData) => void;
  onExpansionTest?: (card: CardData) => void;
  onUpdateCard?: (updated: Partial<CardData>) => void;
  fontFamily?: string;
}

/** 顆粒度色帶 */
const GRANULARITY_STYLE: Record<string, string> = {
  L1: "bg-rose-100 text-rose-700 border-rose-200",
  L2: "bg-blue-100 text-blue-700 border-blue-200",
  L3: "bg-emerald-100 text-emerald-700 border-emerald-200",
  L4: "bg-slate-100 text-slate-600 border-slate-200",
};

export const KnowledgeCardNode: React.FC<KnowledgeCardNodeProps> = ({
  card,
  isSelected = false,
  onSelect,
  onOpenPreview,
  onOpenDetail,
  fontFamily,
}) => {
  // 每張卡片可獨立指定字體，未指定才用全域字體
  const ff = resolveFont(card.cardFont || fontFamily);

  const shapeDef = SHAPE_DEFS[card.reasoningShape] || SHAPE_DEFS.A;
  const isComposite = card.reasoningShape === "COMPOSITE";
  const gKey = (card.granularity || "L2").slice(0, 2);
  const gStyle = GRANULARITY_STYLE[gKey] || GRANULARITY_STYLE.L4;

  return (
    <div
      onClick={onSelect}
      className={`group flex flex-col h-full rounded-xl select-none overflow-hidden transition-all duration-150 bg-white ${
        isSelected ? "ring-2 ring-blue-500 shadow-lg" : "shadow-md hover:shadow-lg"
      }`}
      style={{
        fontFamily: ff,
        border: isSelected ? "2px solid #3b82f6" : "1px solid #e2e8f0",
      }}
    >
      {/* 顆粒度色帶 */}
      <div className={`h-1 w-full ${shapeDef.color}`} />

      <div className="flex-1 flex flex-col p-3.5 min-h-0">
        {/* 第一行：顆粒度 + 推理形狀 + 操作 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${gStyle}`}>
              {card.granularity}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${shapeDef.color}`}
              title={shapeDef.name}
            >
              {isComposite && card.compositeShapes?.length
                ? `複合 ${card.compositeShapes.join("+")}`
                : `${card.reasoningShape} ${shapeDef.name}`}
            </span>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 show-on-hover transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPreview?.(card); }}
              className="p-1.5 rounded hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 touch-target"
              title="預覽模式"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(card); }}
              className="p-1.5 rounded hover:bg-slate-100 active:bg-slate-200 text-slate-400 hover:text-slate-700 touch-target"
              title="編輯模式"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 知識點名稱 */}
        <h3
          className="text-lg font-bold text-slate-900 leading-snug mb-1 line-clamp-2"
          style={{ fontFamily: ff }}
        >
          {card.title}
        </h3>

        {/* 領域 */}
        <div className="text-[11px] text-slate-500 mb-2.5">{card.domain}</div>

        {/* 背景描述（摺疊態的核心資訊） */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            背景描述
          </div>
          <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-5">
            <MathText text={card.backgroundDescription || "（尚未填寫背景描述：此知識點座落於哪個框架？前置背景是什麼？向下支撐什麼？）"} />
          </p>
        </div>
      </div>

      {/* 底部：Bloom / SOLO / 追問點進度 / HOW 編譯狀態 */}
      <div className="px-3.5 py-2 border-t border-slate-100 flex items-center justify-between text-[9px] gap-1">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <span className="text-emerald-600 truncate">
            <span className="text-slate-400">Bloom </span>
            {card.bloomLevel}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-indigo-600 truncate">
            <span className="text-slate-400">SOLO </span>
            {card.soloData?.declaredLevel || card.soloLevel}
          </span>
          {/* v4：追問點進度 */}
          {card.thoughtPoints && card.thoughtPoints.length > 0 && (
            <>
              <span className="text-slate-300">·</span>
              <span
                className="truncate"
                title={`追問點：${card.thoughtPoints.filter((t) => t.passed).length}/${card.thoughtPoints.length} 已通過`}
              >
                <span className="text-slate-400">追問 </span>
                <span className={card.thoughtPoints.every((t) => t.passed) ? "text-emerald-600" : "text-amber-600"}>
                  {card.thoughtPoints.filter((t) => t.passed).length}/{card.thoughtPoints.length}
                </span>
              </span>
            </>
          )}
        </div>
        <span
          className={
            card.howData?.status === "compiled" ? "text-emerald-600" : "text-amber-600"
          }
          title={card.howData?.status === "compiled" ? "HOW 已編譯" : "HOW 未編譯（每次仍需臨場重推）"}
        >
          {card.howData?.status === "compiled" ? "✓HOW" : "⋯HOW"}
        </span>
      </div>
    </div>
  );
};
