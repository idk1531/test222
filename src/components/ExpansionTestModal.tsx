"use client";

import React, { useMemo, useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { expansionTest } from "@/lib/inspect";
import {
  FileCheck2,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Lightbulb,
} from "lucide-react";

/**
 * 追問測試（v4；原「展開測試」改名）
 *
 * 測的對象不再是「能不能展開壓縮句」，而是「能不能不看答案，自己推出追問點的答案」。
 * - 逐個追問點閉卷作答 → 揭曉答案 → 自評：順暢推出 → [已推出]；卡殼／要查資料／需要新頓悟 → 不算過，如實記錄卡在哪一步
 * - 不能因為「上次好像懂了」就默認這次也算過：每次進入都重新判定，舊狀態只作歷史提示
 * - 納入三種來源：構造思路路徑的追問點、WHY 正文的追問點、直覺陷阱（【追問·直覺陷阱】）
 * - 另保留「HOW 閉卷重推」：HOW 步驟仍需臨場重推者標 [未編譯]，重推通過後方可去掉
 */

interface ExpansionTestModalProps {
  card: CardData | null;
  onClose: () => void;
  /** HOW 閉卷重推通過 → 由外層把 HOW 標為已編譯 */
  onSuccess: (cardId: string) => void;
  /** 持久化追問點／直覺陷阱的 [已推出] 與「卡在哪一步」 */
  onSaveCard?: (patch: Partial<CardData> & { id: string }) => void;
}

type ProbeSource = "construction" | "why" | "intuition";

interface ProbeItem {
  key: string;
  source: ProbeSource;
  modeName: string;
  question: string;
  answer: React.ReactNode;
  previouslyPassed: boolean;
  previousNote?: string;
}

const UI = "'Varela Round', sans-serif";

const SOURCE_META: Record<ProbeSource, { label: string; chip: string; hint: string }> = {
  construction: { label: "構造思路 · 路徑", chip: "bg-teal-100 text-teal-800 border-teal-300", hint: "當時怎麼想通／怎麼發現走不通換方向" },
  why: { label: "WHY 正文 · 關鍵轉折", chip: "bg-orange-100 text-orange-800 border-orange-300", hint: "懂了這一步就懂了整個論證" },
  intuition: { label: "直覺陷阱", chip: "bg-purple-100 text-purple-800 border-purple-300", hint: "先預測自己大概會怎麼誤會" },
};

export const ExpansionTestModal: React.FC<ExpansionTestModalProps> = ({
  card,
  onClose,
  onSuccess,
  onSaveCard,
}) => {
  const items: ProbeItem[] = useMemo(() => {
    if (!card) return [];
    const list: ProbeItem[] = [];
    for (const tp of card.thoughtPoints || []) {
      list.push({
        key: `tp:${tp.id}`,
        source: tp.placement === "construction" ? "construction" : "why",
        modeName: tp.modeName || "思維模式名",
        question: tp.question,
        answer: <MathText text={tp.answer} />,
        previouslyPassed: !!tp.passed,
        previousNote: tp.note,
      });
    }
    for (const it of card.intuitionTraps || []) {
      list.push({
        key: `it:${it.id}`,
        source: "intuition",
        modeName: "直覺陷阱",
        question: "常見的直覺誤判是什麼？（先想一次：關於這個知識點，我大概會怎麼誤會？）",
        answer: (
          <div className="space-y-1">
            <p><b>常見誤判：</b><MathText text={it.description} /></p>
            <p><b>錯在哪裡：</b><MathText text={it.whyMisleading} /></p>
            <p className="pl-2 border-l-2 border-purple-300"><b className="text-emerald-700">✓ 正確理解：</b><MathText text={it.correctUnderstanding} /></p>
          </div>
        ),
        previouslyPassed: !!it.passed,
        previousNote: it.note,
      });
    }
    return list;
  }, [card]);

  const [mode, setMode] = useState<"probe" | "how">(items.length > 0 ? "probe" : "how");
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [verdicts, setVerdicts] = useState<Record<string, "passed" | "stuck">>({});
  const [stuckNotes, setStuckNotes] = useState<Record<string, string>>({});

  // ---- HOW 閉卷重推（保留：[未編譯] → 通過重推才可去掉） ----
  const [attemptText, setAttemptText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!card) return null;

  const current = items[index];
  const doneCount = Object.keys(verdicts).length;
  const passedCount = Object.values(verdicts).filter((v) => v === "passed").length;

  const persist = (item: ProbeItem, verdict: "passed" | "stuck", note: string) => {
    if (!onSaveCard) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (item.key.startsWith("tp:")) {
      const id = item.key.slice(3);
      onSaveCard({
        id: card.id,
        thoughtPoints: (card.thoughtPoints || []).map((tp) =>
          tp.id === id
            ? { ...tp, passed: verdict === "passed", note: verdict === "stuck" ? note : undefined, lastTestedAt: stamp }
            : tp
        ),
      });
    } else {
      const id = item.key.slice(3);
      onSaveCard({
        id: card.id,
        intuitionTraps: (card.intuitionTraps || []).map((it) =>
          it.id === id ? { ...it, passed: verdict === "passed", note: verdict === "stuck" ? note : undefined } : it
        ),
      });
    }
  };

  const judge = (verdict: "passed" | "stuck") => {
    if (!current) return;
    const note = stuckNotes[current.key] || "";
    if (verdict === "stuck" && note.trim().length < 4) return; // 卡殼必須如實寫出卡在哪一步
    setVerdicts((v) => ({ ...v, [current.key]: verdict }));
    persist(current, verdict, note);
  };

  const handleHowEvaluate = () => {
    if (!attemptText.trim()) return;
    setLoading(true);
    setTimeout(() => {
      const data = expansionTest(card, attemptText, card.title);
      setResult(data);
      setLoading(false);
      if (data.passed) onSuccess(card.id);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh] safe-bottom">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-sm">追問測試（原展開測試）</h3>
              <span className="text-[11px] text-slate-400 truncate block" style={{ fontFamily: UI }}>
                {card.title}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5" style={{ fontFamily: UI }}>
              <button
                onClick={() => setMode("probe")}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${mode === "probe" ? "bg-white text-slate-900" : "text-slate-300"}`}
              >
                追問點 {items.length}
              </button>
              <button
                onClick={() => setMode("how")}
                className={`px-2 py-1 rounded text-[11px] font-semibold ${mode === "how" ? "bg-white text-slate-900" : "text-slate-300"}`}
              >
                HOW 重推
              </button>
            </div>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {mode === "probe" ? (
          items.length === 0 ? (
            <div className="p-6 text-center text-slate-500 space-y-2" style={{ fontFamily: UI }}>
              <HelpCircle className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-700">這張卡還沒有任何追問點</p>
              <p className="text-[11px]">
                在編輯模式的「基本」分頁新增追問點（構造思路路徑或 WHY 關鍵轉折），或在 WHY 分頁新增直覺陷阱後，再回來做追問測試。
              </p>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2" style={{ fontFamily: UI }}>
                <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {items.map((it, i) => {
                    const v = verdicts[it.key];
                    return (
                      <button
                        key={it.key}
                        onClick={() => setIndex(i)}
                        className={`w-6 h-6 rounded-full text-[10px] font-bold flex-shrink-0 border ${
                          i === index ? "ring-2 ring-slate-900" : ""
                        } ${v === "passed" ? "bg-emerald-500 text-white border-emerald-600" : v === "stuck" ? "bg-amber-400 text-white border-amber-500" : "bg-white text-slate-500 border-slate-300"}`}
                        title={`${SOURCE_META[it.source].label}：${it.modeName}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">
                  本次 {passedCount}/{doneCount} 已推出 · 共 {items.length}
                </span>
                <button onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))} disabled={index === items.length - 1} className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Question */}
              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                <div className="flex items-center gap-2 flex-wrap" style={{ fontFamily: UI }}>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${SOURCE_META[current.source].chip}`}>
                    {SOURCE_META[current.source].label}
                  </span>
                  <span className="text-xs font-bold text-slate-800">【追問 · {current.modeName}】</span>
                  {current.previouslyPassed && !verdicts[current.key] && (
                    <span className="text-[10px] text-slate-400" title="上次通過不代表這次也算過，請重新判定">
                      上次 [已推出]（本次仍需重新判定）
                    </span>
                  )}
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[13px] text-slate-800 font-medium">
                  <MathText text={current.question} />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1" style={{ fontFamily: UI }}>
                    閉卷作答：不看答案、不查資料，把你的推法寫下來（{SOURCE_META[current.source].hint}）
                  </label>
                  <textarea
                    rows={5}
                    value={attempts[current.key] || ""}
                    onChange={(e) => setAttempts((a) => ({ ...a, [current.key]: e.target.value }))}
                    disabled={!!revealed[current.key]}
                    placeholder="先寫，再揭曉。寫不出來也要留下『卡在哪一步』，不能空著就看答案。"
                    className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none leading-relaxed text-xs disabled:bg-slate-50"
                  />
                </div>

                {!revealed[current.key] ? (
                  <button
                    onClick={() => setRevealed((r) => ({ ...r, [current.key]: true }))}
                    disabled={(attempts[current.key] || "").trim().length < 8}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-40"
                    style={{ fontFamily: UI }}
                    title="至少寫下 8 個字的嘗試，才能揭曉答案（生成效應）"
                  >
                    <Eye className="w-4 h-4" /> 揭曉答案並自評
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/60">
                      <div className="text-[10px] font-bold text-blue-800 mb-1 flex items-center gap-1" style={{ fontFamily: UI }}>
                        <Lightbulb className="w-3.5 h-3.5" /> (答案)
                      </div>
                      <div className="text-[12px] text-slate-800 leading-relaxed">{current.answer}</div>
                    </div>

                    {verdicts[current.key] ? (
                      <div
                        className={`p-3 rounded-xl border flex items-start gap-2 ${
                          verdicts[current.key] === "passed" ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"
                        }`}
                      >
                        {verdicts[current.key] === "passed" ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />}
                        <div className="text-[12px]">
                          {verdicts[current.key] === "passed" ? (
                            <b>已標 [已推出]：這個追問點你已經能不看答案自己推出來。</b>
                          ) : (
                            <>
                              <b>不算過，已如實記錄卡點：</b>「{stuckNotes[current.key]}」。下次複習從這一步重推。
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2" style={{ fontFamily: UI }}>
                        <p className="text-[11px] text-slate-600">
                          對照你的作答與答案，誠實自評——「卡殼／要查資料／需要新頓悟」都不算過。
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            onClick={() => judge("passed")}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            順暢推出 → 標 [已推出]
                          </button>
                          <div className="space-y-1">
                            <input
                              value={stuckNotes[current.key] || ""}
                              onChange={(e) => setStuckNotes((n) => ({ ...n, [current.key]: e.target.value }))}
                              placeholder="卡在哪一步？（必填才能標記）"
                              className="w-full p-1.5 rounded border border-amber-300 bg-white text-xs"
                            />
                            <button
                              onClick={() => judge("stuck")}
                              disabled={(stuckNotes[current.key] || "").trim().length < 4}
                              className="w-full px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold disabled:opacity-40"
                            >
                              卡住了 → 記錄卡點，不算過
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between" style={{ fontFamily: UI }}>
                <span className="text-[10px] text-slate-500">[已推出] 與卡點會即時寫回卡片，並計入摺疊卡的「追問 n/m」。</span>
                <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100">
                  結束
                </button>
              </div>
            </>
          )
        ) : (
          <>
            {/* HOW 閉卷重推：[未編譯] 的唯一出口 */}
            <div className="p-4 bg-blue-50/60 border-b border-blue-200 space-y-1.5">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block" style={{ fontFamily: UI }}>
                HOW 閉卷重推（[未編譯] → 通過後才可去掉標記）
              </span>
              <div className="p-2.5 bg-white rounded-lg border border-blue-200 font-medium text-slate-800">
                {card.title}：{card.whatData?.summary || "請從出發前提重推可執行步驟"}
              </div>
              <p className="text-[11px] text-slate-500" style={{ fontFamily: UI }}>
                若這類題仍需每次先臨場重推 WHY 才能往下走，HOW 就還是 [未編譯]。這裡測的是能否不經重新推導直接執行。
              </p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <textarea
                rows={6}
                value={attemptText}
                onChange={(e) => setAttemptText(e.target.value)}
                placeholder="寫出：1. 出發前提 2. 中間變形／守恆約束 3. 結論如何必然成立"
                className="w-full p-3 rounded-xl border border-slate-300 focus:border-blue-500 outline-none leading-relaxed text-xs"
              />
              {result && (
                <div className={`p-4 rounded-xl border space-y-2 ${result.passed ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {result.passed ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-amber-600" />}
                    <span>{result.feedback}</span>
                  </div>
                  {!result.passed && result.stuckAtStep && (
                    <div className="p-2.5 bg-white/80 rounded-lg border border-amber-300 text-amber-800 space-y-1">
                      <div className="font-bold flex items-center gap-1"><HelpCircle className="w-4 h-4 text-amber-600" /><span>只指出卡在第幾個推理節點，不代寫：</span></div>
                      <p className="text-[11px] leading-relaxed">{result.hint}</p>
                    </div>
                  )}
                  {result.passed && <p className="text-emerald-700 font-medium">{result.recommendation}</p>}
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between" style={{ fontFamily: UI }}>
              <span className="text-[11px] text-slate-500">通過即把 HOW 標為已編譯</span>
              <button
                onClick={handleHowEvaluate}
                disabled={loading || !attemptText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? "評估中..." : "送出重推"}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
