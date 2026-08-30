"use client";

import React, { useState } from "react";
import { HelpCircle, X, Check, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { CardData } from "./KnowledgeCardNode";

interface BlockageGuideModalProps {
  cards: CardData[];
  onClose: () => void;
  onRecordResolution: (cardId: string, resolutionNote: string) => void;
}

export const BlockageGuideModal: React.FC<BlockageGuideModalProps> = ({
  cards,
  onClose,
  onRecordResolution,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id || "");
  const [step, setStep] = useState<number>(1);
  const [diagnosedCause, setDiagnosedCause] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  const handleFinish = () => {
    if (!selectedCardId) return;
    const finalRecord = `（曾引發堵塞，已定位：${diagnosedCause}${customNote ? ` - ${customNote}` : ""}）`;
    onRecordResolution(selectedCardId, finalRecord);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 bg-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-sm">堵塞感定位導引（「我不知道自己哪裡不懂」）</h3>
              <span className="text-[11px] text-amber-200">
                穿透隱形認知障礙，定位認識論地基裂痕
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-amber-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Step 1: Select Card */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              第 1 步：選擇你感覺產生卡頓或堵塞的知識卡片：
            </label>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 font-medium text-slate-800 text-xs"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.domain})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Diagnostic Checkpoints */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-700 block">
              第 2 步：逐項審查最常見的三種理科底層堵塞源：
            </span>

            {/* Cause 1 */}
            <div
              onClick={() => setDiagnosedCause("缺少明確認識論標記（不清楚命題是公設、定理還是經驗）")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("缺少明確認識論標記")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>① 核心聲明缺少認識論標記</span>
                {diagnosedCause.includes("缺少明確認識論標記") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：心裡隱約懷疑「這真的必然成立嗎？」，卻又說不出為什麼。原因通常是混淆了出發公設（⊢公設）與推導證明（⊢證）。
              </p>
            </div>

            {/* Cause 2 */}
            <div
              onClick={() => setDiagnosedCause("跨框架概念挪用（例如用宏觀連續直覺套用微觀離散/量子波函數）")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("跨框架概念挪用")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>② 跨框架挪用了互不兼容的概念</span>
                {diagnosedCause.includes("跨框架概念挪用") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：腦子裡出現兩個互相打架的模型。例如：既想用經典質點彈珠軌跡，又想用波動干涉疊加；或用微觀可逆力學理解宏觀熱力學不可逆。
              </p>
            </div>

            {/* Cause 3 */}
            <div
              onClick={() => setDiagnosedCause("把 ⊢近 (近似框架) 默默當成了 ⊢證 (絕對真理)")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("把 ⊢近")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>③ 把近似條件 ⊢近 默默當成了絕對證明 ⊢證</span>
                {diagnosedCause.includes("把 ⊢近") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：在極限尺度推演時發現荒謬矛盾。原因是一開始就忽略了「低速、稀薄氣體或小擾動」等隱蔽近似邊界。
              </p>
            </div>
          </div>

          {/* Step 3: Specific Note */}
          <div className="pt-2 border-t border-slate-200">
            <label className="font-bold text-slate-700 block mb-1">
              第 3 步：補充具體堵塞細節（可選）：
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="例如：混淆了恆容與恆壓下的氣體分壓計算..."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-amber-500"
            />
          </div>

          {saved && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>堵塞已成功定位並記錄至卡片歷史！</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            記錄格式：(曾引發堵塞，已定位：...)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              onClick={handleFinish}
              disabled={!diagnosedCause}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              完成定位並記錄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
