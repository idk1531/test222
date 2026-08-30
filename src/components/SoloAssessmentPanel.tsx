"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Network, RefreshCw, Check, AlertTriangle, ArrowUp, Plus, Trash2, History } from "lucide-react";
import { MathText } from "./MathText";
import { useWorkspaceState } from "@/lib/store";
import { assessSolo, openBlindSpotCardIds } from "@/lib/solo";

export const SOLO_LEVELS = [
  { key: "前結構", desc: "尚未抓到任何相關面向，回答與問題脫節", color: "bg-slate-400" },
  { key: "單點結構", desc: "只掌握單一面向，能背一條公式或一句結論", color: "bg-blue-400" },
  { key: "多點結構", desc: "掌握多個面向，但面向之間彼此獨立、未收束", color: "bg-emerald-500" },
  { key: "關聯結構", desc: "各面向被關係串成整體，能說明彼此如何互相決定", color: "bg-indigo-500" },
  { key: "抽象拓展", desc: "跳出原框架，能遷移到新情境並做出可證偽預測", color: "bg-purple-600" },
];

export interface SoloData {
  declaredLevel: string;
  evidence: Array<{ id: string; level: string; text: string }>;
  autoSuggestedLevel?: string;
  autoRationale?: string;
  accepted?: boolean;
  history?: Array<{ at: string; from: string; to: string; reason: string }>;
}

interface SoloAssessmentPanelProps {
  cardId: string;
  soloLevel: string;
  soloData?: SoloData;
  bloomLevel: string;
  editable?: boolean;
  onChange?: (soloLevel: string, soloData: SoloData) => void;
}

export const SoloAssessmentPanel: React.FC<SoloAssessmentPanelProps> = ({
  cardId,
  soloLevel,
  soloData,
  bloomLevel,
  editable = true,
  onChange,
}) => {
  const [data, setData] = useState<SoloData>(
    soloData || { declaredLevel: soloLevel, evidence: [], history: [] }
  );
  const [loading, setLoading] = useState(false);

  // 改為純前端 SOLO 評估：直接自全域狀態倉庫讀取關係邊/母題/盲區，不再呼叫後端
  const ws = useWorkspaceState();
  const assessment = useMemo(() => {
    const card = (ws.cards as any[]).find((c) => c.id === cardId);
    if (!card) return null;
    return assessSolo(
      card,
      ws.relations as any[],
      ws.motherTopics as any[],
      openBlindSpotCardIds(ws.blindSpots as any[])
    );
  }, [ws, cardId]);

  const runAssessment = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 300);
  };

  useEffect(() => {
    setLoading(false);
  }, [cardId]);

  const update = (next: SoloData, level?: string) => {
    setData(next);
    onChange?.(level ?? next.declaredLevel, next);
  };

  const currentIdx = SOLO_LEVELS.findIndex((l) => l.key === data.declaredLevel);

  return (
    <div className="space-y-4">
      {/* 維度分離提示 */}
      <div className="flex items-stretch gap-2">
        <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div className="text-[10px] font-bold text-emerald-700">Bloom · 單點認知深度</div>
          <div className="text-sm font-bold text-emerald-900">{bloomLevel}</div>
          <div className="text-[10px] text-emerald-700/70 mt-0.5">你對這一個概念鑽多深</div>
        </div>
        <div className="flex-1 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <div className="text-[10px] font-bold text-indigo-700">SOLO · 知識網整合度</div>
          <div className="text-sm font-bold text-indigo-900">{data.declaredLevel}</div>
          <div className="text-[10px] text-indigo-700/70 mt-0.5">它與其他知識連得多緊</div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 -mt-2">
        兩者是獨立維度，不可合併成單一分數。Bloom 高但 SOLO 低 = 單點很熟但知識孤島。
      </p>

      {/* SOLO 階梯 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-700">SOLO 層級宣告</span>
          <button
            onClick={runAssessment}
            disabled={loading}
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            <span>重新依知識網評估</span>
          </button>
        </div>

        <div className="space-y-1">
          {SOLO_LEVELS.map((lvl, idx) => {
            const isCurrent = data.declaredLevel === lvl.key;
            const isSuggested = assessment?.suggestedLevel === lvl.key;
            const reached = idx <= currentIdx;
            return (
              <button
                key={lvl.key}
                disabled={!editable}
                onClick={() => {
                  const next: SoloData = {
                    ...data,
                    declaredLevel: lvl.key,
                    history: [
                      ...(data.history || []),
                      {
                        at: new Date().toISOString().slice(0, 10),
                        from: data.declaredLevel,
                        to: lvl.key,
                        reason: "使用者手動調整宣告層級",
                      },
                    ],
                  };
                  update(next, lvl.key);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-lg border flex items-center gap-2 transition-all ${
                  isCurrent
                    ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                } ${editable ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`w-1.5 h-6 rounded-full flex-shrink-0 ${reached ? lvl.color : "bg-slate-200"}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${isCurrent ? "text-indigo-900" : "text-slate-700"}`}>
                      {lvl.key}
                    </span>
                    {isCurrent && <Check className="w-3 h-3 text-indigo-600" />}
                    {isSuggested && !isCurrent && (
                      <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-700 border border-amber-300">
                        系統建議
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{lvl.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 系統評估結果 */}
      {assessment && (
        <div
          className={`rounded-lg border p-3 space-y-2 ${
            assessment.verdict === "overclaim"
              ? "bg-rose-50 border-rose-200"
              : assessment.verdict === "underclaim"
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="flex items-start gap-2">
            {assessment.verdict === "overclaim" ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            ) : assessment.verdict === "underclaim" ? (
              <ArrowUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-800">{assessment.verdictMessage}</div>
              <div className="text-[11px] text-slate-600 mt-1">{assessment.rationale}</div>
            </div>
          </div>

          {/* 指標 */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            {[
              { label: "計分關係邊", value: assessment.metrics.countedRelations },
              { label: "≈ 已驗證類比", value: assessment.metrics.verifiedAnalogies },
              { label: "~ 未計分", value: assessment.metrics.unverifiedAnalogies },
              { label: "已成立母題", value: assessment.metrics.verifiedMotifs },
            ].map((m) => (
              <div key={m.label} className="bg-white/70 rounded px-1 py-1 border border-slate-200">
                <div className="text-sm font-bold text-slate-800">{m.value}</div>
                <div className="text-[9px] text-slate-500">{m.label}</div>
              </div>
            ))}
          </div>

          {/* 阻擋原因 */}
          {assessment.blockers?.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-slate-600">升級阻擋項：</div>
              {assessment.blockers.map((b: string, i: number) => (
                <div key={i} className="text-[10px] text-slate-600 flex gap-1">
                  <span className="text-rose-500">•</span>
                  <span>{b}</span>
                </div>
              ))}
            </div>
          )}

          {editable && assessment.verdict !== "match" && (
            <button
              onClick={() => {
                const next: SoloData = {
                  ...data,
                  declaredLevel: assessment.suggestedLevel,
                  autoSuggestedLevel: assessment.suggestedLevel,
                  autoRationale: assessment.rationale,
                  accepted: true,
                  history: [
                    ...(data.history || []),
                    {
                      at: new Date().toISOString().slice(0, 10),
                      from: data.declaredLevel,
                      to: assessment.suggestedLevel,
                      reason: "接受系統依知識網證據的建議",
                    },
                  ],
                };
                update(next, assessment.suggestedLevel);
              }}
              className="w-full text-[11px] py-1.5 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              接受系統建議：調整為「{assessment.suggestedLevel}」
            </button>
          )}
        </div>
      )}

      {/* 各級達成證據 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-slate-700">各級達成證據</span>
          {editable && (
            <button
              onClick={() =>
                update({
                  ...data,
                  evidence: [
                    ...(data.evidence || []),
                    { id: `ev-${Date.now()}`, level: data.declaredLevel, text: "" },
                  ],
                })
              }
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              <Plus className="w-3 h-3" />
              <span>新增證據</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {(data.evidence || []).length === 0 && (
            <p className="text-[11px] text-slate-400 italic">尚未填寫任何達成證據</p>
          )}
          {(data.evidence || []).map((ev, idx) => (
            <div key={ev.id} className="flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-2">
              {editable ? (
                <>
                  <select
                    value={ev.level}
                    onChange={(e) => {
                      const list = [...data.evidence];
                      list[idx] = { ...list[idx], level: e.target.value };
                      update({ ...data, evidence: list });
                    }}
                    className="text-[10px] px-1 py-0.5 rounded border border-slate-300 bg-white flex-shrink-0"
                  >
                    {SOLO_LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.key}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={ev.text}
                    onChange={(e) => {
                      const list = [...data.evidence];
                      list[idx] = { ...list[idx], text: e.target.value };
                      update({ ...data, evidence: list });
                    }}
                    placeholder="我能做到什麼，證明我到達這一級？"
                    className="flex-1 text-[11px] p-1 rounded border border-slate-300 bg-white"
                  />
                  <button
                    onClick={() =>
                      update({ ...data, evidence: data.evidence.filter((_, i) => i !== idx) })
                    }
                    className="text-slate-400 hover:text-rose-600 flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold flex-shrink-0">
                    {ev.level}
                  </span>
                  <span className="text-[11px] text-slate-700">
                    <MathText text={ev.text} />
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SOLO 演進歷史 */}
      {(data.history || []).length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-bold text-slate-700 mb-1.5">
            <History className="w-3.5 h-3.5" />
            <span>SOLO 演進歷史</span>
          </div>
          <div className="space-y-1">
            {(data.history || []).map((h, i) => (
              <div key={i} className="text-[10px] text-slate-600 flex items-center gap-1.5 bg-slate-50 rounded px-2 py-1 border border-slate-200">
                <span className="font-mono text-slate-400">{h.at}</span>
                <span className="text-slate-500">{h.from}</span>
                <ArrowUp className="w-2.5 h-2.5 rotate-45 text-indigo-500" />
                <span className="font-bold text-indigo-700">{h.to}</span>
                <span className="text-slate-400 truncate">· {h.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
