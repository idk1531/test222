"use client";

import React, { useState, useMemo } from "react";
import { Search, X, Layers, ArrowRight, Tag, BookOpen, AlertTriangle } from "lucide-react";
import { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";

interface OmniSearchModalProps {
  cards: CardData[];
  onClose: () => void;
  onSelectCard: (cardId: string) => void;
}

export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  cards,
  onClose,
  onSelectCard,
}) => {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const quickFilters = [
    { key: "all", label: "全部" },
    { key: "uncompiled", label: "⋯ 未編譯 HOW" },
    { key: "blindspot", label: "▲ 盲區" },
    { key: "prove", label: "⊢證 演繹證明" },
    { key: "inductive", label: "⊢歸 經驗歸納" },
    { key: "approx", label: "⊢近[框架] 近似" },
    { key: "axiom", label: "⊢公設[框架]" },
    { key: "conflict", label: "⚡ 框架衝突" },
  ];

  const results = useMemo(() => {
    return cards.filter((card) => {
      const q = query.toLowerCase();

      // Quick filters
      if (activeFilter === "uncompiled") {
        const hasUncompiled =
          card.howData?.status === "uncompiled" ||
          card.howData?.steps?.some((s) => !s.isCompiled);
        if (!hasUncompiled) return false;
      }
      if (activeFilter === "prove") {
        if (!card.claims?.some((c) => c.epistemicMark === "⊢證")) return false;
      }
      if (activeFilter === "inductive") {
        if (!card.claims?.some((c) => c.epistemicMark === "⊢歸")) return false;
      }
      if (activeFilter === "approx") {
        if (!card.claims?.some((c) => c.epistemicMark === "⊢近")) return false;
      }
      if (activeFilter === "axiom") {
        if (!card.claims?.some((c) => c.epistemicMark === "⊢公設")) return false;
      }

      if (!query.trim()) return true;

      // Text matches across WHAT, WHY, HOW, WHEN, ORIGIN, Claims, Assumptions
      const matchTitle = card.title.toLowerCase().includes(q);
      const matchDomain = card.domain.toLowerCase().includes(q);
      const matchWhat = card.whatData?.summary.toLowerCase().includes(q);
      const matchWhy =
        card.whyData?.fullReasoning.toLowerCase().includes(q) ||
        card.whyData?.closedBookDraft.toLowerCase().includes(q);
      const matchHow = card.howData?.steps?.some(
        (s) => s.title.toLowerCase().includes(q) || s.action.toLowerCase().includes(q)
      );
      const matchWhen = card.whenData?.triggers?.some(
        (t) => t.cue.toLowerCase().includes(q) || t.check.toLowerCase().includes(q)
      );
      const matchOrigin = card.originData?.conflict.toLowerCase().includes(q);
      const matchClaims = card.claims?.some((c) => c.text.toLowerCase().includes(q));

      return (
        matchTitle ||
        matchDomain ||
        matchWhat ||
        matchWhy ||
        matchHow ||
        matchWhen ||
        matchOrigin ||
        matchClaims
      );
    });
  }, [cards, query, activeFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 pt-8 sm:pt-16 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Bar Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="全域語義檢索：輸入概念、公式、WHY推理、HOW步驟、⊢認識論或線索..."
            className="flex-1 bg-transparent text-sm text-slate-800 outline-none font-medium placeholder:text-slate-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Filter Pills */}
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {quickFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">未找到符合條件的理科知識卡片</p>
              <p className="text-[11px]">可嘗試切換上方標籤或擴大關鍵詞</p>
            </div>
          ) : (
            results.map((card) => (
              <div
                key={card.id}
                onClick={() => {
                  onSelectCard(card.id);
                  onClose();
                }}
                className="pt-3 first:pt-0 cursor-pointer group hover:bg-slate-50/80 p-2 rounded-xl transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                      {card.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-mono text-[10px]">
                      {card.reasoningShape}型
                    </span>
                    <span className="text-[10px] text-slate-400">{card.domain}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 group-hover:text-blue-600 text-xs font-semibold">
                    <span>檢視卡片</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                  <MathText text={card.whatData?.summary || ""} />
                </p>

                {/* Sub features badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {card.claims?.map((c, cIdx) => (
                    <span
                      key={cIdx}
                      className="text-[9px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono"
                    >
                      {c.epistemicMark}
                    </span>
                  ))}
                  {card.howData?.status === "uncompiled" && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                      ⋯ 未編譯步驟
                    </span>
                  )}
                  {card.howData?.status === "compiled" && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                      ✓展 已編譯
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
