"use client";

import React, { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Plus, ArrowRight, Filter, Search } from "lucide-react";
import { CardData } from "./KnowledgeCardNode";

interface BlindSpotData {
  id: string;
  workspaceId: string;
  cardId?: string;
  title: string;
  description: string;
  domain?: string;
  severity: string; // low, medium, high, critical
  status: string; // open, resolved
  resolutionNotes?: string;
  createdAt: string;
}

interface BlindSpotsViewProps {
  cards: CardData[];
  blindSpots: BlindSpotData[];
  onUpdateBlindSpot: (id: string, updates: Partial<BlindSpotData>) => void;
  onAddBlindSpot: (newSpot: Partial<BlindSpotData>) => void;
  onJumpToCard: (cardId: string) => void;
}

export const BlindSpotsView: React.FC<BlindSpotsViewProps> = ({
  cards,
  blindSpots,
  onUpdateBlindSpot,
  onAddBlindSpot,
  onJumpToCard,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // New spot form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCardId, setNewCardId] = useState(cards[0]?.id || "");
  const [newSeverity, setNewSeverity] = useState("high");

  const filteredSpots = useMemo(() => {
    return blindSpots.filter((spot) => {
      if (filterStatus === "open" && spot.status !== "open") return false;
      if (filterStatus === "resolved" && spot.status !== "resolved") return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        spot.title.toLowerCase().includes(q) ||
        spot.description.toLowerCase().includes(q) ||
        (spot.domain && spot.domain.toLowerCase().includes(q))
      );
    });
  }, [blindSpots, filterStatus, searchQuery]);

  const severityBadges: Record<string, { label: string; color: string }> = {
    critical: { label: "致命", color: "bg-rose-100 text-rose-800 border-rose-300" },
    high: { label: "高危", color: "bg-orange-100 text-orange-800 border-orange-300" },
    medium: { label: "中度", color: "bg-amber-100 text-amber-800 border-amber-300" },
    low: { label: "輕度", color: "bg-blue-100 text-blue-800 border-blue-300" },
  };

  const handleCreateSpot = () => {
    if (!newTitle || !newDesc) return;
    const card = cards.find((c) => c.id === newCardId);
    onAddBlindSpot({
      cardId: newCardId,
      title: newTitle,
      description: newDesc,
      domain: card?.domain || "理科綜合",
      severity: newSeverity,
      status: "open",
    });
    setShowAddModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">▲ 認知盲區管理庫</h3>
            <span className="text-[11px] text-slate-500">
              所有被標記的盲區自動列入，支持回溯卡片、跟蹤處理解決狀態
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>登記新盲區 (▲)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-3 sm:p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700 hidden sm:inline">狀態篩選：</span>
          {["all", "open", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterStatus === s
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s === "all" ? "全部" : s === "open" ? "▲ 未決盲區" : "✓ 已解決盲區"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-72 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋盲區標題、領域或描述..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4">
        {filteredSpots.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <AlertTriangle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">無符合條件的盲區記錄</p>
          </div>
        ) : (
          filteredSpots.map((spot) => {
            const isResolved = spot.status === "resolved";
            const card = cards.find((c) => c.id === spot.cardId);
            const severity = severityBadges[spot.severity] || severityBadges.medium;

            return (
              <div
                key={spot.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs space-y-3 transition-all ${
                  isResolved ? "border-slate-200 opacity-80" : "border-amber-200 ring-1 ring-amber-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold border text-[10px] ${severity.color}`}>
                        {severity.label}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm">{spot.title}</h4>
                      {spot.domain && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border">
                          {spot.domain}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 text-xs leading-relaxed">{spot.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isResolved ? (
                      <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>已解決</span>
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          onUpdateBlindSpot(spot.id, {
                            status: "resolved",
                            resolutionNotes: "已完成閉卷推導或補充約束，確認盲區已排除。",
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
                      >
                        標記為已解決
                      </button>
                    )}
                  </div>
                </div>

                {spot.resolutionNotes && (
                  <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200 text-emerald-900 text-[11px]">
                    <span className="font-bold">解決與防呆備忘：</span> {spot.resolutionNotes}
                  </div>
                )}

                {card && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-500">
                    <span className="text-[11px]">原卡片：{card.title}</span>
                    <button
                      onClick={() => onJumpToCard(card.id)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px]"
                    >
                      <span>回到原卡片</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">登記新盲區 (▲)</h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">盲區標題：</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例如：誤以為催化劑能改變平衡常數 K"
                className="w-full p-2 rounded border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">對應卡片：</label>
              <select
                value={newCardId}
                onChange={(e) => setNewCardId(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 bg-white"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">嚴重程度：</label>
              <select
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value)}
                className="w-full p-2 rounded border border-slate-300 bg-white font-semibold"
              >
                <option value="critical">致命 (可能引致整個推導崩塌)</option>
                <option value="high">高危 (高頻易混淆陷阱)</option>
                <option value="medium">中度 (細節直覺偏差)</option>
                <option value="low">輕度 (術語或單位注意)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">盲區具體描述：</label>
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="詳細描述直覺在哪裡發生了誤判，以及哪種情境下容易中招..."
                className="w-full p-2 rounded border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleCreateSpot}
                disabled={!newTitle || !newDesc}
                className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50"
              >
                加入盲區清單
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
