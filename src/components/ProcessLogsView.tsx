"use client";

import React, { useState } from "react";
import { History, Plus, Layers, ArrowRight, Zap, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { CardData } from "./KnowledgeCardNode";

interface ProcessLogData {
  id: string;
  workspaceId: string;
  cardId?: string;
  logType: string; // ⟲, ⚡, ⇹, ⋯
  title: string;
  oldContent?: string;
  newContent?: string;
  explanation?: string;
  sessionNote?: string;
  createdAt: string;
}

interface ProcessLogsViewProps {
  cards: CardData[];
  processLogs: ProcessLogData[];
  onAddLog: (newLog: Partial<ProcessLogData>) => void;
}

export const ProcessLogsView: React.FC<ProcessLogsViewProps> = ({
  cards,
  processLogs,
  onAddLog,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id || "");
  const [logType, setLogType] = useState("⚡");
  const [title, setTitle] = useState("");
  const [oldContent, setOldContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [explanation, setExplanation] = useState("");

  const handleCreate = () => {
    if (!title) return;
    onAddLog({
      cardId: selectedCardId,
      logType,
      title,
      oldContent,
      newContent,
      explanation,
    });
    setShowAddModal(false);
    setTitle("");
    setOldContent("");
    setNewContent("");
    setExplanation("");
  };

  const getLogBadge = (type: string) => {
    switch (type) {
      case "⚡":
        return {
          symbol: "⚡ 框架衝突",
          color: "bg-purple-100 text-purple-900 border-purple-300",
          desc: "跨時間維度的重大理解升級，否定過去具體主張，新舊並排",
        };
      case "⟲":
        return {
          symbol: "⟲ 增量補充",
          color: "bg-blue-100 text-blue-900 border-blue-300",
          desc: "新認知補充舊理解",
        };
      case "⇹":
        return {
          symbol: "⇹ 當場矛盾",
          color: "bg-rose-100 text-rose-900 border-rose-300",
          desc: "同一討論 session 內前後說法互相矛盾",
        };
      default:
        return {
          symbol: "⋯ 未編譯記錄",
          color: "bg-amber-100 text-amber-900 border-amber-300",
          desc: "未編譯演繹步驟記錄",
        };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">認知演化歷史與過程日志</h3>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5">
            日誌不是一般代碼版本控制，而是「理解如何發生演進的認知痕跡」。
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>記錄認知升級 / 衝突</span>
        </button>
      </div>

      {/* Logs Timeline */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
        {processLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">尚無認知演化歷史記錄</p>
            <p className="text-[11px]">點擊右上角按鈕記錄第一次新舊認知衝突</p>
          </div>
        ) : (
          processLogs.map((log) => {
            const badge = getLogBadge(log.logType);
            const card = cards.find((c) => c.id === log.cardId);

            return (
              <div
                key={log.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-bold border text-xs ${badge.color}`}>
                      {badge.symbol}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{log.title}</h4>
                    {card && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        關聯卡片: {card.title}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Side by side comparison for ⚡ framework conflict */}
                {(log.oldContent || log.newContent) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                    <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                      <span className="font-bold text-rose-800 text-[10px] uppercase block mb-1">
                        舊理解 / 舊主張（已被否定）：
                      </span>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {log.oldContent || "無"}
                      </p>
                    </div>

                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-200">
                      <span className="font-bold text-emerald-800 text-[10px] uppercase block mb-1">
                        新理解 / 新框架（當前成立）：
                      </span>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {log.newContent || "無"}
                      </p>
                    </div>
                  </div>
                )}

                {log.explanation && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] leading-relaxed">
                    <span className="font-semibold text-slate-800">演化脈絡剖析：</span>
                    {log.explanation}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Log Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">新增認知演化歷史日志</h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">日志類型：</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: "⚡", label: "⚡ 框架衝突 (跨時段升級，新舊並排)" },
                  { key: "⟲", label: "⟲ 增量補充 (完善舊理解)" },
                  { key: "⇹", label: "⇹ 當場矛盾 (同Session前後矛盾)" },
                  { key: "⋯", label: "⋯ 未編譯演繹記錄" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLogType(item.key)}
                    className={`p-2 rounded-lg border text-left text-xs font-semibold ${
                      logType === item.key
                        ? "bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-400"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">關聯知識卡片：</label>
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
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
              <label className="font-bold text-slate-700 block mb-1">日志標題：</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：熱質守恆觀向熵增能量守恆的框架升級"
                className="w-full p-2 rounded border border-slate-300 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-rose-700 block mb-1">舊理解 / 舊主張：</label>
                <textarea
                  rows={3}
                  value={oldContent}
                  onChange={(e) => setOldContent(e.target.value)}
                  placeholder="當初是怎麼想的..."
                  className="w-full p-2 rounded border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-emerald-700 block mb-1">新理解 / 新認知：</label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="現在發現真實機制是什麼..."
                  className="w-full p-2 rounded border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">演化脈絡說明：</label>
              <textarea
                rows={2}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="這次認知演化的觸發原因與重要意義..."
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
                onClick={handleCreate}
                disabled={!title}
                className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
              >
                儲存日志
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
