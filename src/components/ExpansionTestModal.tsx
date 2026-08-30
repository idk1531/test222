"use client";

import React, { useState } from "react";
import { CardData } from "./KnowledgeCardNode";
import { expansionTest } from "@/lib/inspect";
import {
  FileCheck2,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  HelpCircle,
} from "lucide-react";

interface ExpansionTestModalProps {
  card: CardData | null;
  onClose: () => void;
  onSuccess: (cardId: string) => void;
}

export const ExpansionTestModal: React.FC<ExpansionTestModalProps> = ({
  card,
  onClose,
  onSuccess,
}) => {
  const [attemptText, setAttemptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!card) return null;

  // 改為純前端評估（v4 追問測試邏輯，不呼叫後端）
  const handleEvaluate = () => {
    if (!attemptText.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const data = expansionTest(card, attemptText, card.title);
      setResult(data);
      setLoading(false);
      if (data.passed) {
        onSuccess(card.id);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm">閉卷展開測試 (HOW 展開驗證)</h3>
              <span className="text-[11px] text-slate-400">
                目標概念：{card.title}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compressed Cue */}
        <div className="p-4 bg-blue-50/60 border-b border-blue-200 space-y-1.5">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            壓縮版提示詞（閉卷）：
          </span>
          <div className="p-2.5 bg-white rounded-lg border border-blue-200 font-medium text-slate-800">
            {card.title}：{card.whatData?.summary || "請從基礎物理前提展開核心步驟"}
          </div>
          <p className="text-[11px] text-slate-500">
            規則：請不看任何手冊與先前記筆記，依據自己的認知從出發前提步步展開推導與執行步驟。
          </p>
        </div>

        {/* Input area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              你的閉卷展開推導：
            </label>
            <textarea
              rows={6}
              value={attemptText}
              onChange={(e) => setAttemptText(e.target.value)}
              placeholder="請嘗試寫出：1. 出發前提是什麼？ 2. 中間守恆或代數約束如何變形？ 3. 最終結論如何必然成立？"
              className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none leading-relaxed text-xs font-sans"
            />
          </div>

          {/* AI Result */}
          {result && (
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                result.passed
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                )}
                <span>{result.feedback}</span>
              </div>

              {!result.passed && result.stuckAtStep && (
                <div className="p-2.5 bg-white/80 rounded-lg border border-amber-300 text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <HelpCircle className="w-4 h-4 text-amber-600" />
                    <span>AI 教練診斷（絕不直接代寫）：</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{result.hint}</p>
                </div>
              )}

              {result.passed && (
                <p className="text-emerald-700 font-medium">
                  {result.recommendation}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            成功驗證將把卡片標記為 ✓展 (Compiled)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              關閉
            </button>
            <button
              onClick={handleEvaluate}
              disabled={loading || !attemptText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? "AI 評估中..." : "送出展開評估"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
