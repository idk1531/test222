"use client";

import React from "react";
import { Layers, Check, Sparkles } from "lucide-react";
import { MathText } from "./MathText";

export const SHAPE_DEFS: Record<string, { name: string; short: string; color: string; text: string; desc: string }> = {
  A: { name: "推導鏈型", short: "A", color: "bg-blue-500", text: "text-blue-700", desc: "由前提出發，步步演繹到結論的連鎖推理" },
  B: { name: "存在性+技法型", short: "B", color: "bg-emerald-500", text: "text-emerald-700", desc: "先保證對象存在，再給出構造/求解的專用技法" },
  C: { name: "判別程序型", short: "C", color: "bg-amber-500", text: "text-amber-700", desc: "輸入狀態 → 條件分支 → 輸出判定的決策流程" },
  D: { name: "前提/框架型", short: "D", color: "bg-purple-500", text: "text-purple-700", desc: "體系不可內部證明的出發公設或適用框架" },
  E: { name: "定義/約定型", short: "E", color: "bg-rose-500", text: "text-rose-700", desc: "概念的嚴格定義、符號約定或表象變換" },
  COMPOSITE: { name: "複合型", short: "複", color: "bg-slate-800", text: "text-slate-800", desc: "同一知識點內含兩種以上推理形狀，需標明各段歸屬" },
};

interface ShapeClassifierProps {
  reasoningShape: string;
  compositeShapes?: string[];
  compositeNote?: string;
  shapeRationale?: string;
  shapeConfidence?: number;
  shapeAccepted?: boolean;
  editable?: boolean;
  onChange?: (patch: {
    reasoningShape?: string;
    compositeShapes?: string[];
    compositeNote?: string;
    shapeAccepted?: boolean;
  }) => void;
}

export const ShapeClassifier: React.FC<ShapeClassifierProps> = ({
  reasoningShape,
  compositeShapes = [],
  compositeNote = "",
  shapeRationale,
  shapeConfidence,
  shapeAccepted,
  editable = true,
  onChange,
}) => {
  const isComposite = reasoningShape === "COMPOSITE";

  const toggleComposite = (key: string) => {
    const next = compositeShapes.includes(key)
      ? compositeShapes.filter((k) => k !== key)
      : [...compositeShapes, key];
    onChange?.({ compositeShapes: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
        <Sparkles className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[10px] text-slate-600 leading-relaxed">
          <b>A~E 只描述「這張卡內部的推理形狀」，不取代 WHAT/WHY/HOW/WHEN/ORIGIN 五格。</b>
          真實知識點常常不是單一形狀，此時請選 <b>複合型</b> 並標明哪一段屬於哪一型。
        </div>
      </div>

      {/* 形狀選擇 */}
      <div className="grid grid-cols-1 gap-1.5">
        {(["A", "B", "C", "D", "E", "COMPOSITE"] as const).map((key) => {
          const def = SHAPE_DEFS[key];
          const selected = reasoningShape === key;
          return (
            <button
              key={key}
              disabled={!editable}
              onClick={() => onChange?.({ reasoningShape: key, shapeAccepted: true })}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                selected
                  ? "border-slate-800 bg-slate-50 ring-1 ring-slate-400"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              } ${editable ? "cursor-pointer" : "cursor-default"}`}
            >
              <span className={`w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 ${def.color}`}>
                {def.short}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-800">{def.name}</div>
                <div className="text-[10px] text-slate-500 truncate">{def.desc}</div>
              </div>
              {selected && <Check className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* 複合型細節 */}
      {isComposite && (
        <div className="border border-slate-800/20 bg-slate-50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>複合型組成（至少選 2 種）</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["A", "B", "C", "D", "E"] as const).map((key) => {
              const def = SHAPE_DEFS[key];
              const on = compositeShapes.includes(key);
              return (
                <button
                  key={key}
                  disabled={!editable}
                  onClick={() => toggleComposite(key)}
                  className={`px-2 py-1 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all ${
                    on ? `${def.color} text-white border-transparent` : "bg-white text-slate-600 border-slate-300"
                  }`}
                >
                  <span>{key}</span>
                  <span className="font-normal">{def.name}</span>
                </button>
              );
            })}
          </div>

          {compositeShapes.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-slate-600">
              <span>目前組合：</span>
              <span className="font-mono font-bold text-slate-900">
                {compositeShapes.join(" + ")} 型
              </span>
              {compositeShapes.length < 2 && (
                <span className="text-rose-600">（複合型至少需要 2 種）</span>
              )}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-1">
              組合說明：哪一段是哪一型？缺了哪一段會出什麼錯？
            </label>
            {editable ? (
              <textarea
                rows={3}
                value={compositeNote}
                onChange={(e) => onChange?.({ compositeNote: e.target.value })}
                placeholder="例：外層是 C 判別程序（識別擾動→分支→輸出方向），內核是 A 推導鏈（自由能凸性）。只背 C 不懂 A，遇到恆容充惰氣就會誤判。"
                className="w-full text-[11px] p-2 rounded border border-slate-300 bg-white leading-relaxed"
              />
            ) : (
              <p className="text-[11px] text-slate-700 leading-relaxed">
                <MathText text={compositeNote || "（尚未填寫組合說明）"} />
              </p>
            )}
          </div>
        </div>
      )}

      {/* AI 判型理由 */}
      {shapeRationale && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-blue-800">AI 判型理由</span>
            <div className="flex items-center gap-1.5">
              {typeof shapeConfidence === "number" && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-200 text-blue-900">
                  信心 {shapeConfidence}%
                </span>
              )}
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  shapeAccepted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {shapeAccepted ? "使用者已確認" : "待使用者確認"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-blue-900 leading-relaxed">
            <MathText text={shapeRationale} />
          </p>
        </div>
      )}
    </div>
  );
};
