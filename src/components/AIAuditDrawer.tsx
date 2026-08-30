"use client";

import React, { useState, useEffect } from "react";
import { CardData } from "./KnowledgeCardNode";
import { fullCardAudit } from "@/lib/inspect";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  HelpCircle,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

interface AIAuditDrawerProps {
  card: CardData | null;
  onClose: () => void;
  onOpenExpansionTest: (card: CardData) => void;
  onOpenBlockageGuide: () => void;
}

export const AIAuditDrawer: React.FC<AIAuditDrawerProps> = ({
  card,
  onClose,
  onOpenExpansionTest,
  onOpenBlockageGuide,
}) => {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);

  // 改為純前端審查（不呼叫後端）
  const runAudit = () => {
    if (!card) return;
    setLoading(true);
    // 讓 UI 有短暫「審查中」狀態，之後顯示本地計算結果
    setTimeout(() => {
      setAuditResult(fullCardAudit(card));
      setLoading(false);
    }, 400);
  };

  useEffect(() => {
    if (card) {
      runAudit();
    }
  }, [card?.id]);

  if (!card) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden text-xs safe-top safe-bottom">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="font-bold text-sm">AI 假懂檢查與結構分析器</h3>
            <span className="text-[11px] text-slate-400 truncate block max-w-[280px]">
              審查目標：{card.title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={runAudit}
            disabled={loading}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="重新審查"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Philosophy Banner */}
      <div className="p-3 bg-blue-50/70 border-b border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">AI 教練審查原則：</span>
          AI 優先指出推理跳步、偷渡前提、循環論證與認識論越級，
          <strong>絕不直接替使用者代寫補完全部推理</strong>，確保真實深度理解。
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span>AI 正以認識論邏輯審查該卡片結構...</span>
          </div>
        ) : auditResult ? (
          <>
            {/* Score & Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">嚴密性健全指數：</span>
                <span className="text-2xl font-black font-mono text-slate-800">
                  {auditResult.score} / 100
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">發現潛在問題：</span>
                <span className="font-bold text-sm text-slate-700">
                  {auditResult.totalIssues} 項
                  {auditResult.criticalCount > 0 && (
                    <span className="ml-1 text-rose-600 font-bold">
                      ({auditResult.criticalCount} 項致命)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Issue List */}
            <div className="space-y-3">
              <h4 className="font-bold text-slate-700 flex items-center justify-between">
                <span>檢測項目與審查回饋：</span>
              </h4>

              {auditResult.issues?.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>各項檢查全數通過！未發現跳步、偷渡前提或認識論越級。</span>
                </div>
              ) : (
                auditResult.issues.map((issue: any, idx: number) => {
                  const isCrit = issue.severity === "critical";
                  const isWarn = issue.severity === "warning";
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        isCrit
                          ? "bg-rose-50/60 border-rose-200 text-rose-900"
                          : isWarn
                          ? "bg-amber-50/60 border-amber-200 text-amber-900"
                          : "bg-blue-50/40 border-blue-200 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold text-xs">
                          {isCrit ? (
                            <AlertOctagon className="w-4 h-4 text-rose-600" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          )}
                          <span>[{issue.category}]</span>
                          <span>{issue.title}</span>
                        </div>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase bg-white/80 border">
                          {issue.targetSlot}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">{issue.description}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Diagnostic Actions */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <span className="font-bold text-slate-700 block">針對性診斷工具：</span>
              <button
                onClick={() => onOpenExpansionTest(card)}
                className="w-full p-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold flex items-center justify-between transition-colors"
              >
                <span>進行閉卷展開測試（消除 ⋯ 未編譯）</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onOpenBlockageGuide}
                className="w-full p-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold flex items-center justify-between transition-colors"
              >
                <span>堵塞感檢查導引（「我不知道自己哪裡不懂」）</span>
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
