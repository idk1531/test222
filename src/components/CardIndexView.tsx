"use client";

import React, { useState } from "react";
import { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import {
  BookOpen,
  Plus,
  Sparkles,
  Maximize2,
  Trash2,
  Lock,
  Layers,
  ArrowRight,
  Filter,
} from "lucide-react";

interface CardIndexViewProps {
  cards: CardData[];
  onOpenCardDetail: (card: CardData) => void;
  onOpenPreview?: (card: CardData) => void;
  onRunAudit: (card: CardData) => void;
  onExpansionTest: (card: CardData) => void;
  onDeleteCard: (id: string) => void;
  onCreateCard: () => void;
  onJumpToCanvas: (cardId: string) => void;
}

export const CardIndexView: React.FC<CardIndexViewProps> = ({
  cards,
  onOpenCardDetail,
  onOpenPreview,
  onRunAudit,
  onExpansionTest,
  onDeleteCard,
  onCreateCard,
  onJumpToCanvas,
}) => {
  const [filterDomain, setFilterDomain] = useState<string>("all");
  const [filterShape, setFilterShape] = useState<string>("all");

  const domains = Array.from(new Set(cards.map((c) => c.domain)));

  const filtered = cards.filter((c) => {
    if (filterDomain !== "all" && c.domain !== filterDomain) return false;
    if (filterShape !== "all" && c.reasoningShape !== filterShape) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <h3 className="font-bold text-slate-900 text-sm truncate">理科知識卡片總庫 ({cards.length} 張)</h3>
          </div>
          <span className="hidden sm:inline text-[11px] text-slate-500">
            每張卡片嚴格保持 WHAT / WHY / HOW / WHEN / ORIGIN 五格與認知診斷
          </span>
        </div>
        <button
          onClick={onCreateCard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">新建知識卡片</span>
          <span className="sm:hidden">新建</span>
        </button>
      </div>

      {/* Filters */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-wrap items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">學科領域：</span>
          <select
            value={filterDomain}
            onChange={(e) => setFilterDomain(e.target.value)}
            className="p-1.5 rounded border border-slate-300 bg-white font-medium text-xs"
          >
            <option value="all">全部學科</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">內部推理形狀：</span>
          <select
            value={filterShape}
            onChange={(e) => setFilterShape(e.target.value)}
            className="p-1.5 rounded border border-slate-300 bg-white font-mono font-medium text-xs"
          >
            <option value="all">全部形狀 (A~E)</option>
            <option value="A">A 推導鏈型</option>
            <option value="B">B 存在性+技法型</option>
            <option value="C">C 判別程序型</option>
            <option value="D">D 前提/框架型</option>
            <option value="E">E 定義/約定型</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-6xl mx-auto w-full">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {card.granularity}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                    {card.reasoningShape === "COMPOSITE"
                      ? `複合型 ${(card.compositeShapes || []).join("+")}`
                      : `${card.reasoningShape}型`}
                  </span>
                  <span className="text-[11px] text-slate-500">{card.domain}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Bloom {card.bloomLevel}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    SOLO {card.soloData?.declaredLevel || card.soloLevel}
                  </span>
                </div>
              </div>

              <h4 className="font-bold text-slate-900 text-base mb-1.5">{card.title}</h4>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">背景描述</div>
              <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
                <MathText text={card.backgroundDescription || "（尚未填寫背景描述）"} />
              </p>

              {/* Slots pill preview */}
              <div className="grid grid-cols-5 gap-1.5 mt-3 pt-3 border-t border-slate-100 text-center text-[10px] font-bold">
                <div className="bg-slate-50 p-1.5 rounded text-slate-700 border">
                  WHAT: {card.whatData?.perspectives?.length || 1} 視角
                </div>
                <div className="bg-blue-50 p-1.5 rounded text-blue-800 border border-blue-200">
                  WHY: {card.whyData?.confidenceAfter}★
                </div>
                <div
                  className={`p-1.5 rounded border ${
                    card.howData?.status === "compiled"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  HOW: {card.howData?.status === "compiled" ? "✓展" : "⋯"}
                </div>
                <div className="bg-slate-50 p-1.5 rounded text-slate-700 border">
                  WHEN: {card.whenData?.triggers?.length || 0} 條
                </div>
                <div className="bg-amber-50 p-1.5 rounded text-amber-900 border border-amber-200">
                  ORIGIN: ↯
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenPreview?.(card)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  <span>預覽</span>
                </button>
                <button
                  onClick={() => onRunAudit(card)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>假懂審查</span>
                </button>
                <button
                  onClick={() => onExpansionTest(card)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                >
                  <span>展開測試</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onJumpToCanvas(card.id)}
                  className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
                >
                  <span>畫布定位</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onOpenCardDetail(card)}
                  className="p-1 text-slate-500 hover:text-slate-800"
                  title="詳細配置"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteCard(card.id)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                  title="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
