"use client";

import React, { useState } from "react";
import { KaTeXRenderer } from "./KaTeXRenderer";
import { Check, Copy, Sparkles, BookOpen } from "lucide-react";

interface MathFormulaEditorProps {
  initialLatex?: string;
  initialTitle?: string;
  initialEpistemicMark?: "⊢證" | "⊢歸" | "⊢近" | "⊢約" | "⊢公設";
  onSave: (data: { latex: string; title: string; epistemicMark: string }) => void;
  onCancel: () => void;
}

export const MathFormulaEditor: React.FC<MathFormulaEditorProps> = ({
  initialLatex = "\\eta = 1 - \\frac{T_C}{T_H}",
  initialTitle = "核心公式推導",
  initialEpistemicMark = "⊢證",
  onSave,
  onCancel,
}) => {
  const [latex, setLatex] = useState(initialLatex);
  const [title, setTitle] = useState(initialTitle);
  const [epistemicMark, setEpistemicMark] = useState(initialEpistemicMark);
  const [copied, setCopied] = useState(false);

  const symbolGroups = [
    {
      name: "微積分/算符",
      items: [
        { label: "分數", code: "\\frac{a}{b}" },
        { label: "偏導", code: "\\frac{\\partial \\Psi}{\\partial t}" },
        { label: "定積分", code: "\\int_{a}^{b} f(x) dx" },
        { label: "閉合積分", code: "\\oint \\frac{\\delta Q_{rev}}{T} = 0" },
        { label: "求和", code: "\\sum_{i=1}^{n} x_i" },
        { label: "普朗克常數", code: "\\hbar" },
        { label: "梯度", code: "\\nabla \\cdot \\vec{E}" },
      ],
    },
    {
      name: "希臘字母/物理量",
      items: [
        { label: "α", code: "\\alpha" },
        { label: "β", code: "\\beta" },
        { label: "γ", code: "\\gamma" },
        { label: "ω", code: "\\omega" },
        { label: "ψ", code: "\\Psi" },
        { label: "λ", code: "\\lambda" },
        { label: "Δ", code: "\\Delta" },
        { label: "η", code: "\\eta" },
        { label: "μ", code: "\\mu" },
      ],
    },
    {
      name: "矩陣/向量/關係",
      items: [
        { label: "二階矩陣", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
        { label: "粗體向量", code: "\\mathbf{v}" },
        { label: "算符頂帽", code: "\\hat{H}" },
        { label: "約等於", code: "\\approx" },
        { label: "恆等於", code: "\\equiv" },
        { label: "正比於", code: "\\propto" },
        { label: "無窮大", code: "\\infty" },
      ],
    },
  ];

  const insertSymbol = (code: string) => {
    setLatex((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + code);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">LaTeX 公式與認識論地位編輯器</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">認識論地位：</span>
            <select
              value={epistemicMark}
              onChange={(e) => setEpistemicMark(e.target.value as any)}
              className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 outline-none"
            >
              <option value="⊢證">⊢證 (邏輯演繹證明)</option>
              <option value="⊢歸">⊢歸 (實驗經驗歸納)</option>
              <option value="⊢近">⊢近[框架] (有效近似簡化)</option>
              <option value="⊢約">⊢約 (符號/定義約定)</option>
              <option value="⊢公設">⊢公設[框架] (出發基石公設)</option>
            </select>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="block text-slate-600 font-medium mb-1">公式名稱 / 標題：</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:border-blue-500 outline-none text-slate-800"
              placeholder="例如：卡諾極限定理推導核心式"
            />
          </div>

          {/* Quick symbol palettes */}
          <div>
            <div className="text-slate-600 font-medium mb-1.5 flex items-center justify-between">
              <span>理科常用符號快速插入：</span>
            </div>
            <div className="space-y-2">
              {symbolGroups.map((group, gIdx) => (
                <div key={gIdx} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 mb-1 block">{group.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => insertSymbol(item.code)}
                        className="px-2 py-1 rounded bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 text-[11px] text-slate-700 transition-colors"
                        title={item.code}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Latex Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium">LaTeX 原始碼：</label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800"
              >
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? "已複製" : "複製 LaTeX"}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 focus:border-blue-500 outline-none bg-slate-900 text-emerald-400"
              placeholder="\eta = 1 - \frac{T_C}{T_H}"
            />
          </div>

          {/* Live KaTeX Preview */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50">
            <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center justify-between">
              <span>即時渲染預覽 (KaTeX)：</span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                {epistemicMark}
              </span>
            </div>
            <div className="min-h-[60px] flex items-center justify-center p-3 bg-white rounded border border-slate-200 shadow-inner">
              <KaTeXRenderer latex={latex} displayMode={true} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">提示：理科公式必須結構化儲存，而非貼圖。</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => onSave({ latex, title, epistemicMark })}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors"
            >
              儲存至畫布
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
