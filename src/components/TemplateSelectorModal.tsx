"use client";

import React from "react";
import { X, Layers, FileText, CheckCircle2, Sparkles, BookOpen, Compass, Cpu, Atom } from "lucide-react";

interface TemplateSelectorModalProps {
  onClose: () => void;
  onSelectTemplate: (templateKey: string) => void;
}

export const TemplateSelectorModal: React.FC<TemplateSelectorModalProps> = ({
  onClose,
  onSelectTemplate,
}) => {
  const templates = [
    {
      key: "standard_card",
      name: "理科知識卡 (標準)",
      shape: "A",
      domain: "物理/化學/數學",
      desc: "完備包含 WHAT/WHY/HOW/WHEN/ORIGIN 五格，雙重視角與認識論標記。",
      icon: Atom,
      color: "border-blue-200 hover:border-blue-500 hover:bg-blue-50/40",
    },
    {
      key: "proof_card",
      name: "證明卡 (推導鏈型)",
      shape: "A",
      domain: "數學/理論物理",
      desc: "專注於連鎖推導鏈條、子目標聲明 (Sub-goals) 與 ⊢證 嚴謹演繹。",
      icon: Layers,
      color: "border-indigo-200 hover:border-indigo-500 hover:bg-indigo-50/40",
    },
    {
      key: "procedure_card",
      name: "判別程序卡 (決策型)",
      shape: "C",
      domain: "化學/算法/工程",
      desc: "針對擾動響應判定（如勒夏特列、正負極判斷），包含分支條件防呆。",
      icon: Cpu,
      color: "border-amber-200 hover:border-amber-500 hover:bg-amber-50/40",
    },
    {
      key: "thought_experiment_card",
      name: "思想實驗卡 (框架假設型)",
      shape: "D",
      domain: "物理/哲學",
      desc: "構造思想極端邊界，強化假設鎖定清單（避免偷渡前提）與 ↯ 逼出矛盾。",
      icon: Compass,
      color: "border-purple-200 hover:border-purple-500 hover:bg-purple-50/40",
    },
    {
      key: "definition_card",
      name: "定義卡 (約定型)",
      shape: "E",
      domain: "數學/基礎公設",
      desc: "概念嚴格代數定義、完備基底投影雙射與 ⊢約 符號約定。",
      icon: BookOpen,
      color: "border-rose-200 hover:border-rose-500 hover:bg-rose-50/40",
    },
    {
      key: "composite_card",
      name: "複合型知識卡",
      shape: "複",
      domain: "理科綜合",
      desc: "同一知識點含兩種以上推理形狀（如外層 C 判別程序 + 內核 A 推導鏈），需標明各段歸屬。",
      icon: Layers,
      color: "border-slate-300 hover:border-slate-800 hover:bg-slate-50",
    },
    {
      key: "math_formula_block",
      name: "LaTeX 公式推導塊",
      shape: "M",
      domain: "公式專用",
      desc: "直接在畫布新增結構化 KaTeX 公式塊與認識論標記。",
      icon: Sparkles,
      color: "border-emerald-200 hover:border-emerald-500 hover:bg-emerald-50/40",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh] safe-bottom">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm">理科知識卡片模板庫</h3>
              <span className="text-[11px] text-slate-400">
                模板僅作為初始結構配置，完全不限制後續自由畫布排版
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div
                key={tpl.key}
                onClick={() => {
                  onSelectTemplate(tpl.key);
                  onClose();
                }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${tpl.color}`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-5 h-5 text-slate-700" />
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border">
                      {tpl.shape}型
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1">{tpl.name}</h4>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{tpl.desc}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] text-slate-400 font-semibold">
                  領域：{tpl.domain}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
