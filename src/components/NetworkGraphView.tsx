"use client";

import React, { useState, useRef, useEffect } from "react";
import { CardData } from "./KnowledgeCardNode";
import {
  Share2,
  AlertTriangle,
  FileCheck2,
  HelpCircle,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowRight,
  Filter,
} from "lucide-react";

interface RelationData {
  id: string;
  workspaceId: string;
  fromCardId: string;
  toCardId: string;
  relationType: string;
  distance?: number;
  label?: string;
  status: string;
  candidatePrediction?: string;
  verificationResult?: string;
  notes?: string;
}

interface NetworkGraphViewProps {
  cards: CardData[];
  relations: RelationData[];
  processLogs: any[];
  blindSpots: any[];
  motherTopics: any[];
  onSelectCard: (cardId: string) => void;
  onOpenAddRelation: () => void;
  onEditRelation: (rel: RelationData) => void;
}

export const NetworkGraphView: React.FC<NetworkGraphViewProps> = ({
  cards,
  relations,
  processLogs,
  blindSpots,
  motherTopics,
  onSelectCard,
  onOpenAddRelation,
  onEditRelation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(cards[0]?.id || null);
  const [filterType, setFilterType] = useState<string>("all");

  // Health Metrics calculations
  const connectedCardIds = new Set<string>();
  relations.forEach((r) => {
    connectedCardIds.add(r.fromCardId);
    connectedCardIds.add(r.toCardId);
  });
  const islandCount = cards.filter((c) => !connectedCardIds.has(c.id)).length;
  const uncompiledCount = cards.filter(
    (c) => c.howData?.status === "uncompiled" || c.howData?.steps?.some((s) => !s.isCompiled)
  ).length;
  const openBlindSpotsCount = blindSpots.filter((b) => b.status === "open").length;
  const unverifiedAnalogiesCount = relations.filter(
    (r) => r.relationType === "analogy_unverified"
  ).length;
  const frameworkConflictsCount = processLogs.filter((l) => l.logType === "⚡").length;
  const motherTopicsCount = motherTopics.length;
  const relationDensity = cards.length > 0 ? (relations.length / cards.length).toFixed(2) : "0.00";

  // Force layout coordinates for cards
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    // Initial circular or radial layout with spacing
    const pos: Record<string, { x: number; y: number }> = {};
    const count = cards.length;
    const centerX = 400;
    const centerY = 300;
    const radius = Math.min(240, Math.max(140, count * 35));

    cards.forEach((card, idx) => {
      const angle = (idx / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2;
      pos[card.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
    setNodePositions(pos);
  }, [cards.length]);

  // Render Canvas Graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background subtle dots
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, w, h);

    // 1. Draw Edges
    relations.forEach((rel) => {
      const from = nodePositions[rel.fromCardId];
      const to = nodePositions[rel.toCardId];
      if (!from || !to) return;

      const isAnalogy = rel.relationType.includes("analogy");
      const isUnverified = rel.relationType === "analogy_unverified";
      const isContrast = rel.relationType === "contrast";

      ctx.save();
      ctx.beginPath();
      if (isUnverified) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "#f59e0b"; // amber
        ctx.lineWidth = 1.5;
      } else if (isContrast) {
        ctx.strokeStyle = "#ef4444"; // red
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "#6366f1"; // indigo
        ctx.lineWidth = 2;
      }

      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();

      // Arrow or midpoint badge
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;

      let symbol = "→";
      if (rel.relationType === "analogy_verified") symbol = "≈";
      if (rel.relationType === "analogy_unverified") symbol = "~";
      if (rel.relationType === "contrast") symbol = "⇄";
      if (rel.relationType === "positive_example") symbol = "⊨";
      if (rel.relationType === "counter_example") symbol = "⊭";
      if (rel.relationType === "special_case") symbol = "⊂";
      if (rel.relationType === "generalization") symbol = "⊃";
      if (rel.relationType === "motif_instance") symbol = "∈[母題]";

      // Draw badge pill
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(midX, midY, 12, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isUnverified ? "#d97706" : "#4338ca";
      ctx.font = "bold 11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(symbol, midX, midY);

      ctx.restore();
    });

    // 2. Draw Nodes
    cards.forEach((card) => {
      const pos = nodePositions[card.id];
      if (!pos) return;

      const isSelected = card.id === selectedNodeId;
      const isIsland = !connectedCardIds.has(card.id);

      ctx.save();
      // Node Circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 24, 0, 2 * Math.PI);

      if (isSelected) {
        ctx.fillStyle = "#3b82f6";
        ctx.strokeStyle = "#1d4ed8";
        ctx.lineWidth = 3;
      } else if (isIsland) {
        ctx.fillStyle = "#e2e8f0";
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1.5;
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();

      // Inner shape indicator
      ctx.fillStyle = isSelected ? "#ffffff" : "#1e293b";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.reasoningShape, pos.x, pos.y);

      // Label below
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = isSelected ? "#1d4ed8" : "#334155";
      ctx.fillText(card.title.slice(0, 10) + (card.title.length > 10 ? "..." : ""), pos.x, pos.y + 36);

      ctx.restore();
    });
  }, [cards, relations, nodePositions, selectedNodeId]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check hit node
    for (const card of cards) {
      const pos = nodePositions[card.id];
      if (pos) {
        const dist = Math.hypot(pos.x - x, pos.y - y);
        if (dist <= 26) {
          setSelectedNodeId(card.id);
          return;
        }
      }
    }
  };

  const selectedCard = cards.find((c) => c.id === selectedNodeId);
  const selectedRelations = relations.filter(
    (r) => r.fromCardId === selectedNodeId || r.toCardId === selectedNodeId
  );

  return (
    <div className="flex flex-col h-full bg-slate-100 text-xs overflow-hidden">
      {/* 1. Network Health Analysis Bar */}
      <div className="bg-white border-b border-slate-200 p-3 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm">
              知識網整合度與健康診斷
            </h3>
          </div>
          <button
            onClick={onOpenAddRelation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>建立知識關聯邊</span>
          </button>
        </div>

        {/* Seven Health Metric Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center">
            <span className="text-[10px] text-slate-500 block">孤島節點</span>
            <span className="text-base font-bold text-slate-800 font-mono">{islandCount}</span>
          </div>

          <div className="bg-amber-50/60 p-2 rounded-lg border border-amber-200 text-center">
            <span className="text-[10px] text-amber-800 block">⋯ 未編譯 HOW</span>
            <span className="text-base font-bold text-amber-700 font-mono">{uncompiledCount}</span>
          </div>

          <div className="bg-rose-50/60 p-2 rounded-lg border border-rose-200 text-center">
            <span className="text-[10px] text-rose-800 block">▲ 未決盲區</span>
            <span className="text-base font-bold text-rose-700 font-mono">{openBlindSpotsCount}</span>
          </div>

          <div className="bg-orange-50/60 p-2 rounded-lg border border-orange-200 text-center">
            <span className="text-[10px] text-orange-800 block">~ 未驗證類比</span>
            <span className="text-base font-bold text-orange-700 font-mono">
              {unverifiedAnalogiesCount}
            </span>
          </div>

          <div className="bg-purple-50/60 p-2 rounded-lg border border-purple-200 text-center">
            <span className="text-[10px] text-purple-800 block">⚡ 框架衝突</span>
            <span className="text-base font-bold text-purple-700 font-mono">
              {frameworkConflictsCount}
            </span>
          </div>

          <div className="bg-indigo-50/60 p-2 rounded-lg border border-indigo-200 text-center">
            <span className="text-[10px] text-indigo-800 block">🪐 成立母題</span>
            <span className="text-base font-bold text-indigo-700 font-mono">{motherTopicsCount}</span>
          </div>

          <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-200 text-center">
            <span className="text-[10px] text-blue-800 block">🕸️ 關係密度</span>
            <span className="text-base font-bold text-blue-700 font-mono">{relationDensity}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Area: Graph Canvas + Sidebar Info（手機改為上下堆疊） */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Graph Canvas — 響應式，維持 4:3 比例 */}
        <div className="flex-1 relative flex items-center justify-center p-2 sm:p-4 min-h-0">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onClick={handleCanvasClick}
            className="bg-white rounded-2xl border border-slate-200 shadow-md cursor-pointer max-w-full max-h-full"
            style={{ width: "100%", height: "auto", aspectRatio: "4 / 3" }}
          />
          <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 bg-white/90 backdrop-blur-xs p-2 sm:p-2.5 rounded-lg border border-slate-200 text-[9px] sm:text-[10px] space-y-1 max-w-[70%]">
            <div className="font-bold text-slate-700">圖例說明：</div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="w-2 h-0.5 bg-indigo-600"></span> 實線：已驗證前提/類比 (≈/→)
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-0.5 border-t border-dashed border-amber-600"></span> 虛線：未驗證類比 (~[d]，不計分)
            </div>
          </div>
        </div>

        {/* Sidebar Info of Selected Node — 手機為底部橫向面板 */}
        {selectedCard && (
          <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col justify-between overflow-y-auto max-h-[40vh] lg:max-h-none flex-shrink-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                  {selectedCard.reasoningShape}型
                </span>
                <button
                  onClick={() => onSelectCard(selectedCard.id)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                >
                  <span>跳至畫布</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedCard.title}</h4>
                <p className="text-slate-500 text-[11px] mt-0.5">{selectedCard.domain}</p>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 block mb-1">WHAT 概念摘要：</span>
                <p className="text-slate-700 leading-relaxed text-[11px]">{selectedCard.whatData?.summary}</p>
              </div>

              {/* Connected Relations */}
              <div className="space-y-1.5">
                <span className="font-bold text-slate-700 block text-[11px]">
                  關聯邊 ({selectedRelations.length} 條)：
                </span>
                {selectedRelations.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">此節點目前為孤島</p>
                ) : (
                  selectedRelations.map((rel) => {
                    const isOther = rel.fromCardId === selectedCard.id ? rel.toCardId : rel.fromCardId;
                    const otherCard = cards.find((c) => c.id === isOther);
                    return (
                      <div
                        key={rel.id}
                        onClick={() => onEditRelation(rel)}
                        className="p-2 rounded-lg border border-slate-200 hover:border-indigo-400 bg-slate-50 cursor-pointer text-[11px]"
                      >
                        <div className="flex items-center justify-between font-semibold text-indigo-700">
                          <span>{rel.label || rel.relationType}</span>
                          <span className="text-[9px] text-slate-400">點擊編輯</span>
                        </div>
                        <div className="text-slate-600 mt-0.5 truncate">
                          對應節點: {otherCard?.title || "未知"}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={onOpenAddRelation}
              className="w-full mt-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-semibold border border-indigo-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>以此卡為起點建立關係邊</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
