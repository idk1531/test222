"use client";

import React, { useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { Lock, Lightbulb, HelpCircle, CheckCircle, XCircle, CheckCircle2, AlertTriangle, OctagonAlert, ClipboardCheck } from "lucide-react";
import {
  epistemicLabel,
  relationLabelText,
  STATUS_COMPILED,
  STATUS_UNCOMPILED,
  ORIGIN_MARK,
} from "@/lib/inspect";
import { SHAPE_DEFS } from "./ShapeClassifier";
import type { CheckResult, FourPointReport } from "@/lib/inspect";
import { SOLO_LEVELS } from "./SoloAssessmentPanel";

const UI_FONT = "'Varela Round', sans-serif";

const EPI_COLORS: Record<string, string> = {
  "⊢證": "bg-blue-100 text-blue-800 border-blue-300",
  "⊢歸": "bg-emerald-100 text-emerald-800 border-emerald-300",
  "⊢近": "bg-amber-100 text-amber-800 border-amber-300",
  "⊢約": "bg-purple-100 text-purple-800 border-purple-300",
  "⊢公設": "bg-rose-100 text-rose-800 border-rose-300",
};

function SlotHeading({
  letter,
  title,
  subtitle,
  color,
  font,
}: {
  letter: string;
  title: string;
  subtitle: string;
  color: string;
  font: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-full text-white font-bold text-base flex-shrink-0 ${color}`}
      >
        {letter}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily: font }}>
          {title}
        </h2>
        <p className="text-[10px] text-slate-500" style={{ fontFamily: UI_FONT }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}

/** 卡頭：知識點名稱 / 顆粒度 / 領域 / 推理形狀（含複合型）/ 背景描述 */
export function SectionHeader({ card, font }: { card: CardData; font: string }) {
  const shapeDef = SHAPE_DEFS[card.reasoningShape] || SHAPE_DEFS.A;
  const isComposite = card.reasoningShape === "COMPOSITE";
  return (
    <section className="mb-8">
      <h1 className="text-3xl font-bold text-slate-900 text-center leading-tight" style={{ fontFamily: font }}>
        {card.title}
      </h1>
      <div
        className="flex flex-wrap items-center justify-center gap-2 mt-3 pb-4 border-b-2 border-slate-800"
        style={{ fontFamily: UI_FONT }}
      >
        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          顆粒度 {card.granularity}
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
          {card.domain}
        </span>
        <span className={`text-[11px] px-2 py-0.5 rounded text-white ${shapeDef.color}`}>
          {isComposite && card.compositeShapes?.length
            ? `複合型 ${card.compositeShapes.join(" + ")}`
            : `${card.reasoningShape} ${shapeDef.name}`}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1" style={{ fontFamily: UI_FONT }}>
          背景描述
        </div>
        <p className="text-[15px] text-slate-800 leading-relaxed">
          <MathText text={card.backgroundDescription || "（尚未填寫背景描述）"} />
        </p>
      </div>

      {isComposite && card.compositeNote && (
        <div className="mt-3 bg-slate-50 border border-slate-300 rounded-lg p-3">
          <div className="text-[10px] font-bold text-slate-700 mb-1" style={{ fontFamily: UI_FONT }}>
            複合型組合說明
          </div>
          <p className="text-[13px] text-slate-700 leading-relaxed">
            <MathText text={card.compositeNote} />
          </p>
        </div>
      )}
    </section>
  );
}

// v4 新增：構造思路（邏輯觸發，與 ORIGIN 歷史觸發分開）
/**
 * 追問點統一呈現（v4）：【追問·思維模式名】問題 → 讀者先想 → (答案)。
 * 構造思路的路徑、WHY 正文、直覺陷阱三處共用同一格式與同一套標籤庫。
 * 預覽時答案預設收合，強迫「生成」一次再對答案（Slamecka & Graf 1978）。
 */
export function ThoughtPointCard({
  modeName,
  question,
  answer,
  passed,
  note,
  tone = "orange",
  prompt = "先自己想一次，再展開答案",
}: {
  modeName: string;
  question: string;
  answer: React.ReactNode;
  passed?: boolean;
  note?: string;
  tone?: "orange" | "teal" | "purple";
  prompt?: string;
}) {
  const palette = {
    orange: { box: "bg-orange-50/50 border-orange-200", head: "text-orange-900", icon: "text-orange-700", bar: "border-orange-300", label: "text-orange-800" },
    teal: { box: "bg-teal-50/50 border-teal-200", head: "text-teal-900", icon: "text-teal-700", bar: "border-teal-300", label: "text-teal-800" },
    purple: { box: "bg-purple-50/50 border-purple-200", head: "text-purple-900", icon: "text-purple-700", bar: "border-purple-300", label: "text-purple-800" },
  }[tone];
  return (
    <div className={`${palette.box} border rounded-lg p-3`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <HelpCircle className={`w-4 h-4 ${palette.icon}`} />
        <span className={`text-xs font-bold ${palette.head}`} style={{ fontFamily: UI_FONT }}>
          【追問 · {modeName || "思維模式名"}】
        </span>
        {passed ? (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
            <CheckCircle className="w-3 h-3" /> [已推出]
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
            <XCircle className="w-3 h-3" /> 尚未推出
          </span>
        )}
      </div>
      <p className="text-[13px] text-slate-800 font-medium mb-2">
        <MathText text={question} />
      </p>
      <details className={`pl-3 border-l-2 ${palette.bar}`}>
        <summary className={`cursor-pointer select-none text-[10px] font-bold ${palette.label}`} style={{ fontFamily: UI_FONT }}>
          (答案) — {prompt}
        </summary>
        <div className="text-[12px] text-slate-700 leading-relaxed mt-1.5">{answer}</div>
      </details>
      {note && (
        <p className="text-[10px] text-slate-500 italic mt-2">卡在哪一步：{note}</p>
      )}
    </div>
  );
}

// v4：獨立主幹【背景】——三段式（情境 → 精確對象＋情境語言 → 精確對應的問題）
export function SectionBackground({ card, font }: { card: CardData; font: string }) {
  const bg = card.backgroundData;
  if (!bg) return null;
  const anyContent = (bg.situation || bg.preciseObject || bg.preciseQuestion || "").trim();
  if (!anyContent) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-sky-600 text-white flex-shrink-0 shadow-md">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily: font }}>背景</h2>
          <p className="text-[10px] text-slate-500" style={{ fontFamily: UI_FONT }}>
            為什麼需要這個知識點、在什麼情境下面臨什麼問題才被逼出來（三段式）
          </p>
        </div>
      </div>
      <div className="pl-4 border-l-4 border-sky-200 space-y-2.5">
        {bg.situation && (
          <div className="bg-sky-50/60 p-2.5 rounded-lg border border-sky-200">
            <p className="text-[10px] font-bold text-sky-900 mb-0.5" style={{ fontFamily: UI_FONT }}>第一段 · 情境</p>
            <p className="text-[13px] text-slate-800 leading-relaxed"><MathText text={bg.situation} /></p>
          </div>
        )}
        {bg.preciseObject && (
          <div className="bg-sky-50/60 p-2.5 rounded-lg border border-sky-200">
            <p className="text-[10px] font-bold text-sky-900 mb-0.5" style={{ fontFamily: UI_FONT }}>第二段 · 精確對象＋情境語言（先給形式、再給動機）</p>
            <p className="text-[13px] text-slate-800 leading-relaxed"><MathText text={bg.preciseObject} /></p>
          </div>
        )}
        {bg.preciseQuestion && (
          <div className="bg-sky-100/70 p-2.5 rounded-lg border border-sky-300">
            <p className="text-[10px] font-bold text-sky-900 mb-0.5" style={{ fontFamily: UI_FONT }}>第三段 · 精確對應的問題（對應回第一段對象）</p>
            <p className="text-[13px] text-slate-800 font-medium leading-relaxed"><MathText text={bg.preciseQuestion} /></p>
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionConstructionThinking({ card, font }: { card: CardData; font: string }) {
  if (!card.constructionThinking) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-teal-600 text-white flex-shrink-0 shadow-md">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily: font }}>
            構造思路
          </h2>
          <p className="text-[10px] text-slate-500" style={{ fontFamily: UI_FONT }}>
            邏輯上的觸發：當初怎麼想到這條路的？（與 ORIGIN 歷史觸發不同）
          </p>
        </div>
      </div>
      <div className="pl-4 border-l-4 border-teal-200 space-y-3">
        {/* v4：理解問題信心校準（Polya 理解問題階段；與 WHY 的 IOED 獨立） */}
        {card.constructionCalibration && (() => {
          const c = card.constructionCalibration!;
          const delta = c.confidenceAfter - c.confidenceBefore;
          return (
            <div
              className={`inline-flex flex-wrap items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] ${
                delta < 0 ? "bg-rose-50 border-rose-300" : "bg-teal-50 border-teal-300"
              }`}
              style={{ fontFamily: UI_FONT }}
            >
              <span className={`font-bold ${delta < 0 ? "text-rose-800" : "text-teal-800"}`}>理解問題信心</span>
              <span className="bg-white px-2 py-0.5 rounded border border-current/20">動筆前 {c.confidenceBefore}★</span>
              <span>→</span>
              <span className={`px-2 py-0.5 rounded text-white ${delta < 0 ? "bg-rose-600" : "bg-teal-700"}`}>寫完背景 {c.confidenceAfter}★</span>
              <span className={`font-bold ${delta < 0 ? "text-rose-700" : "text-teal-700"}`}>({delta >= 0 ? "+" : ""}{delta})</span>
              {delta < 0 && (
                <span className="text-rose-800">
                  理解問題階段盲區{c.blindSpotNote ? `：${c.blindSpotNote}` : "（先不進構造思路／WHY，回頭補背景）"}
                </span>
              )}
            </div>
          );
        })()}

        <p className="text-[15px] text-slate-800 leading-relaxed">
          <MathText text={card.constructionThinking} />
        </p>

        {/* v4：候選登場（決策敘事，不做驗證）——從「要求」逐步摸索到具體候選形式 */}
        {card.candidate && (card.candidate.requirement || card.candidate.candidateForm || card.candidate.motivation) && (
          <div className="bg-teal-50/60 p-2.5 rounded-lg border border-teal-200 space-y-1.5">
            <p className="text-[10px] font-bold text-teal-900" style={{ fontFamily: UI_FONT }}>候選登場（決策敘事，驗證留給 WHY）</p>
            {card.candidate.requirement && (
              <p className="text-[12px] text-slate-700"><b className="text-teal-800">要求：</b><MathText text={card.candidate.requirement} /></p>
            )}
            {card.candidate.candidateForm && (
              <p className="text-[12px] text-slate-700"><b className="text-teal-800">候選形式：</b><MathText text={card.candidate.candidateForm} /></p>
            )}
            {card.candidate.motivation && (
              <p className="text-[12px] text-slate-700"><b className="text-teal-800">為什麼偏偏是它：</b><MathText text={card.candidate.motivation} /></p>
            )}
          </div>
        )}

        {/* v4：計畫（構造思路收尾）——只講打算證什麼／用什麼方法／範圍，含順序依賴 */}
        {card.plan && (card.plan.steps?.length || card.plan.ranges) && (
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1.5">
            <p className="text-[10px] font-bold text-slate-700" style={{ fontFamily: UI_FONT }}>計畫（Polya「擬定計劃」階段的產出）</p>
            {card.plan.steps && card.plan.steps.length > 0 && (
              <ol className="space-y-1">
                {card.plan.steps.map((st, i) => (
                  <li key={st.id || i} className="text-[12px] text-slate-700">
                    <b>{i + 1}. </b>{st.label}
                    {st.rationale && <span className="text-slate-500"> — {st.rationale}</span>}
                  </li>
                ))}
              </ol>
            )}
            {card.plan.ranges && (
              <p className="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 border border-amber-200">
                <b>範圍：</b><MathText text={card.plan.ranges} />
              </p>
            )}
          </div>
        )}

        {/* v4：路徑不是被動敘述——摸索當下真的問過自己的問題，用追問點格式標出（Polya 啟發式問句） */}
        {(card.thoughtPoints || []).filter((t) => t.placement === "construction").length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-teal-800" style={{ fontFamily: UI_FONT }}>
              路徑中的追問點（與 WHY 共用同一套思維模式標籤庫）
            </p>
            {(card.thoughtPoints || [])
              .filter((t) => t.placement === "construction")
              .map((tp) => (
                <ThoughtPointCard
                  key={tp.id}
                  tone="teal"
                  modeName={tp.modeName}
                  question={tp.question}
                  answer={<MathText text={tp.answer} />}
                  passed={tp.passed}
                  note={tp.note}
                  prompt="當時怎麼想通／怎麼發現走不通換方向"
                />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}

// v4：WHY 正文中的追問點（構造思路路徑的追問點在上方構造思路區塊內呈現）
export function SectionThoughtPoints({ card, font }: { card: CardData; font: string }) {
  const points = (card.thoughtPoints || []).filter((t) => t.placement !== "construction");
  if (points.length === 0) return null;
  return (
    <section className="mb-8">
      <SlotHeading letter="?" title="追問點" subtitle="WHY 正文關鍵轉折處：懂了這一步就懂了整個論證（原展開測試 → 追問測試）" color="bg-orange-600" font={font} />
      <div className="space-y-3">
        {points.map((tp) => (
          <ThoughtPointCard
            key={tp.id}
            modeName={tp.modeName}
            question={tp.question}
            answer={<MathText text={tp.answer} />}
            passed={tp.passed}
            note={tp.note}
          />
        ))}
      </div>
    </section>
  );
}

export function SectionWhat({ card, font }: { card: CardData; font: string }) {
  return (
    <section className="mb-8">
      <SlotHeading letter="W" title="WHAT · 概念本質" subtitle="這個知識點本身的描述／說明——不是 WHY 結論的重複陳述（與 HOW 嚴格分離）" color="bg-blue-600" font={font} />
      <div className="pl-4 border-l-4 border-blue-200 space-y-3">
        <p className="text-[15px] text-slate-800 leading-relaxed">
          <MathText text={card.whatData?.summary || "（尚未填寫）"} />
        </p>

        {card.whatData?.perspectives && card.whatData.perspectives.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500 flex items-center gap-2" style={{ fontFamily: UI_FONT }}>
              <span>多視角理解（自由命名借用哪個學科／框架的工具箱，下限 3 個、不設上限）</span>
              <span className={`px-1.5 py-0.5 rounded ${card.whatData.perspectives.length >= 3 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {card.whatData.perspectives.length} 個{card.whatData.perspectives.length < 3 ? "（未達 3）" : ""}
              </span>
            </p>
            {card.whatData.perspectives.map((p, i) => (
              <div key={i} className="flex gap-2.5 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200/70">
                <span
                  className={`flex-shrink-0 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center ${
                    (p.code || "").length <= 2 ? "w-7 h-7" : "px-2 h-7 max-w-[7rem] truncate"
                  }`}
                  title={p.code}
                >
                  {p.code || "視角"}
                </span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold text-blue-900" style={{ fontFamily: UI_FONT }}>
                    {p.label}
                  </div>
                  <div className="text-[13px] text-slate-700 leading-relaxed">
                    <MathText text={p.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* v4：四個方向延伸（推深／推淺／推廣／推窄）——強烈建議，不強制寫滿 */}
        {card.whatData?.extensions &&
          Object.values(card.whatData.extensions).some((v) => v && v.trim()) && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500" style={{ fontFamily: UI_FONT }}>
                五方向延伸——讓「這是什麼」的說明範圍更完整（視角＝借外面語言講這個點；翻譯＝把外面的東西收進這個點的語言）
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: "deeper", label: "推深", hint: "奠基在什麼更底層的知識上", cls: "bg-indigo-50/70 border-indigo-200 text-indigo-900" },
                  { key: "shallower", label: "推淺", hint: "能推出什麼／撐起什麼應用", cls: "bg-sky-50/70 border-sky-200 text-sky-900" },
                  { key: "generalize", label: "推廣", hint: "放寬條件會變成什麼", cls: "bg-violet-50/70 border-violet-200 text-violet-900" },
                  { key: "specialize", label: "推窄", hint: "收緊條件會變成什麼特例", cls: "bg-fuchsia-50/70 border-fuchsia-200 text-fuchsia-900" },
                  { key: "translate", label: "翻譯", hint: "把別的知識／現象用這個知識點的語言重講（與視角相反）", cls: "bg-emerald-50/70 border-emerald-200 text-emerald-900" },
                ].map((d) => {
                  const val = (card.whatData!.extensions as Record<string, string | undefined>)[d.key];
                  if (!val || !val.trim()) return null;
                  return (
                    <div key={d.key} className={`p-2.5 rounded-lg border ${d.cls} ${d.key === "translate" ? "sm:col-span-2" : ""}`}>
                      <div className="text-[10px] font-bold mb-0.5" style={{ fontFamily: UI_FONT }}>
                        {d.label} <span className="font-normal opacity-70">· {d.hint}</span>
                      </div>
                      <div className="text-[12px] text-slate-700 leading-relaxed">
                        <MathText text={val} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {card.whatData?.distinctionFromHow && (
          <div className="bg-amber-50 border border-amber-300 p-2.5 rounded-lg text-[12px] text-amber-900">
            <b style={{ fontFamily: UI_FONT }}>⚠ 與 HOW 的界線：</b>
            <MathText text={card.whatData.distinctionFromHow} />
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionWhy({ card, font }: { card: CardData; font: string }) {
  const w = card.whyData;
  return (
    <section className="mb-8">
      <SlotHeading letter="W" title="WHY · 深度推理" subtitle="為什麼成立？完整演繹，不是背一句結論" color="bg-emerald-600" font={font} />
      <div className="pl-4 border-l-4 border-emerald-200 space-y-4">
        {w && (
          <div
            className="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-300 text-[11px]"
            style={{ fontFamily: UI_FONT }}
          >
            <span className="font-bold text-emerald-800">理解信心</span>
            <span className="bg-white px-2 py-0.5 rounded border border-emerald-300">前 {w.confidenceBefore}★</span>
            <span className="text-emerald-600">→</span>
            <span className="bg-emerald-700 text-white px-2 py-0.5 rounded">後 {w.confidenceAfter}★</span>
            <span className={`font-bold ${w.confidenceAfter - w.confidenceBefore >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
              ({w.confidenceAfter - w.confidenceBefore >= 0 ? "+" : ""}
              {w.confidenceAfter - w.confidenceBefore})
            </span>
          </div>
        )}

        {w?.closedBookDraft && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 mb-0.5" style={{ fontFamily: UI_FONT }}>
              閉卷直覺草稿（不查資料）
            </p>
            <p className="text-[13px] text-slate-600 italic leading-relaxed">
              「<MathText text={w.closedBookDraft} />」
            </p>
          </div>
        )}

        {w?.fullReasoning && (
          <div>
            <p className="text-[10px] font-bold text-emerald-800 mb-0.5" style={{ fontFamily: UI_FONT }}>
              完整嚴密推理
            </p>
            <p className="text-[15px] text-slate-800 leading-relaxed">
              <MathText text={w.fullReasoning} />
            </p>
          </div>
        )}

        {(w?.perspective1 || w?.perspective2) && (
          <div>
            <p className="text-[10px] font-bold text-emerald-800 mb-1.5" style={{ fontFamily: UI_FONT }}>
              兩個失效模式不同的視角
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[w?.perspective1, w?.perspective2].map(
                (p, i) =>
                  p?.content && (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border ${i === 0 ? "bg-emerald-50/60 border-emerald-200" : "bg-indigo-50/60 border-indigo-200"}`}
                    >
                      <div className="text-[10px] font-bold text-slate-800 mb-1" style={{ fontFamily: UI_FONT }}>
                        視角 {i + 1}：{p.name}
                      </div>
                      <div className="text-[12px] text-slate-700 leading-relaxed mb-1.5">
                        <MathText text={p.content} />
                      </div>
                      <div className="text-[10px] text-slate-500 italic">⚠ 失效模式：{p.failureMode}</div>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {w?.subGoals && w.subGoals.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-emerald-800 mb-1.5" style={{ fontFamily: UI_FONT }}>
              子目標聲明
            </p>
            <div className="space-y-2">
              {w.subGoals.map((sg, i) => (
                <div key={i} className="bg-white p-2.5 rounded-lg border border-emerald-200">
                  <div className="text-[12px] font-bold text-slate-800 mb-1">
                    子目標 {i + 1}：<MathText text={sg.goal} />
                  </div>
                  <div className="text-[11px] text-slate-700 space-y-0.5">
                    <div>
                      <b className="text-emerald-700">必要性：</b>
                      <MathText text={sg.whyNecessary} />
                    </div>
                    <div>
                      <b className="text-blue-700">充分性：</b>
                      <MathText text={sg.whySufficient} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {card.assumptions && card.assumptions.length > 0 && (
          <div className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-300">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-900 mb-1.5" style={{ fontFamily: UI_FONT }}>
              <Lock className="w-3 h-3" />
              假設鎖定清單（{card.assumptions.length}）· 推理只能使用清單內假設
            </div>
            <ul className="space-y-1">
              {card.assumptions.map((a, i) => (
                <li key={i} className="text-[12px] text-slate-700 flex gap-1.5">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>
                    <b>
                      <MathText text={a.name} />
                    </b>
                    {a.description && <span className="text-slate-500"> — {a.description}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionHow({ card, font }: { card: CardData; font: string }) {
  return (
    <section className="mb-8">
      <SlotHeading
        letter="H"
        title="HOW · 可執行步驟"
        subtitle={`知道怎麼做 · 狀態：${card.howData?.status === "compiled" ? STATUS_COMPILED : STATUS_UNCOMPILED}`}
        color="bg-amber-600"
        font={font}
      />
      <div className="pl-4 border-l-4 border-amber-200">
        {card.howData?.steps?.length ? (
          <ol className="space-y-2">
            {card.howData.steps.map((s, i) => (
              <li key={i} className="bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-bold text-slate-800">
                    步驟 {i + 1}：<MathText text={s.title} />
                  </span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0 ${
                      s.isCompiled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {s.isCompiled ? STATUS_COMPILED : STATUS_UNCOMPILED}
                  </span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">
                  <MathText text={s.action} />
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-slate-400 italic">（尚未填寫步驟）</p>
        )}
      </div>
    </section>
  );
}

export function SectionWhen({ card, font }: { card: CardData; font: string }) {
  return (
    <section className="mb-8">
      <SlotHeading letter="W" title="WHEN · 觸發線索" subtitle="看到 ___ → 檢查 ___（禁止抽象套話）" color="bg-indigo-600" font={font} />
      <div className="pl-4 border-l-4 border-indigo-200 space-y-2">
        {card.whenData?.triggers?.length ? (
          card.whenData.triggers.map((t, i) => (
            <div key={i} className="bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-200 space-y-1">
              <div className="text-[13px]">
                <b className="text-blue-700 text-[10px]" style={{ fontFamily: UI_FONT }}>
                  看到：
                </b>
                <span className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-slate-800 ml-1">
                  <MathText text={t.cue} />
                </span>
              </div>
              <div className="text-[13px] text-slate-800">
                <b className="text-emerald-700 text-[10px]" style={{ fontFamily: UI_FONT }}>
                  → 檢查：
                </b>
                <span className="ml-1">
                  <MathText text={t.check} />
                </span>
              </div>
              {t.keywords?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {t.keywords.map((k, ki) => (
                    <span
                      key={ki}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200"
                      style={{ fontFamily: UI_FONT }}
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-[13px] text-slate-400 italic">（尚未填寫觸發線索）</p>
        )}

        {/* v4 新增：WHEN·可用（能力辨識，通用技巧型才寫） */}
        {card.whenData?.enables && card.whenData.enables.length > 0 && (
          <div className="mt-4 pt-3 border-t border-indigo-200">
            <p className="text-[10px] font-bold text-indigo-800 mb-2" style={{ fontFamily: UI_FONT }}>
              WHEN · 可用（能力辨識：看到___ → 就能做___）
            </p>
            <div className="space-y-2">
              {card.whenData.enables.map((en, i) => (
                <div key={i} className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                  <div className="text-[13px] text-slate-800">
                    <b className="text-indigo-700 text-[10px]" style={{ fontFamily: UI_FONT }}>
                      看到：
                    </b>
                    <span className="ml-1">
                      <MathText text={en.trigger} />
                    </span>
                  </div>
                  <div className="text-[13px] text-slate-800 mt-1">
                    <b className="text-emerald-700 text-[10px]" style={{ fontFamily: UI_FONT }}>
                      → 就能做：
                    </b>
                    <span className="ml-1">
                      <MathText text={en.capability} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {card.whenData?.boundaryNotes && (
          <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-3">
            <b style={{ fontFamily: UI_FONT }}>邊界約束：</b>
            <MathText text={card.whenData.boundaryNotes} />
          </div>
        )}
      </div>
    </section>
  );
}

export function SectionOrigin({ card, font }: { card: CardData; font: string }) {
  return (
    <section className="mb-8">
      <SlotHeading letter="O" title="ORIGIN · 逼出概念" subtitle="哪個問題／矛盾逼出了它（不是教科書背景）" color="bg-rose-600" font={font} />
      <div className="pl-4 border-l-4 border-rose-200">
        <div className="bg-rose-50/60 p-3 rounded-lg border border-rose-200">
          <p className="text-[15px] text-slate-800 leading-relaxed">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 mr-1 align-middle">{ORIGIN_MARK}</span>
            <MathText text={card.originData?.conflict || "（尚未填寫）"} />
          </p>
          {card.originData?.historicalContext && (
            <div className="mt-2 pt-2 border-t border-rose-200 text-[12px] text-slate-600">
              <b style={{ fontFamily: UI_FONT }}>歷史脈絡：</b>
              <MathText text={card.originData.historicalContext} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// v4 新增：直覺陷阱（不是 WHEN、不是警示、不塞入堵塞感——是內容本身違反直覺）
export function SectionIntuitionTraps({ card, font }: { card: CardData; font: string }) {
  if (!card.intuitionTraps || card.intuitionTraps.length === 0) return null;
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-600 text-white flex-shrink-0 shadow-md">
          <span className="font-bold text-base">⚠</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight" style={{ fontFamily: font }}>
            直覺陷阱
          </h2>
          <p className="text-[10px] text-slate-500" style={{ fontFamily: UI_FONT }}>
            推導正確但直覺容易誤判成別的東西（跟 WHEN、警示、堵塞感協議都不同）
          </p>
        </div>
      </div>
      <div className="pl-4 border-l-4 border-purple-200 space-y-3">
        <p className="text-[10px] text-slate-500" style={{ fontFamily: UI_FONT }}>
          v4：直覺陷阱本身就是一個隱性追問點——先自己預測「我大概會怎麼誤會」，再展開看正確理解與錯在哪裡；
          標籤統一為「直覺陷阱」，與其他追問點共用 ≥3 次的思維動作庫門檻。
        </p>
        {card.intuitionTraps.map((trap, i) => (
          <ThoughtPointCard
            key={trap.id || i}
            tone="purple"
            modeName="直覺陷阱"
            question="常見的直覺誤判是什麼？（先想一次：關於這個知識點，我大概會怎麼誤會？）"
            passed={trap.passed}
            note={trap.note}
            prompt="先寫下自己的預測，再展開"
            answer={
              <div className="space-y-1.5">
                <p>
                  <b className="text-purple-800" style={{ fontFamily: UI_FONT }}>常見誤判：</b>
                  <MathText text={trap.description} />
                </p>
                <p>
                  <b className="text-purple-800" style={{ fontFamily: UI_FONT }}>錯在哪裡：</b>
                  <MathText text={trap.whyMisleading} />
                </p>
                <p className="pl-2 border-l-2 border-purple-300">
                  <b className="text-emerald-700" style={{ fontFamily: UI_FONT }}>✓ 正確理解：</b>
                  <MathText text={trap.correctUnderstanding} />
                </p>
              </div>
            }
          />
        ))}
      </div>
    </section>
  );
}

export function SectionClaims({ card, font }: { card: CardData; font: string }) {
  if (!card.claims?.length) return null;
  return (
    <section className="mb-8">
      <SlotHeading letter="證" title="認識論聲明" subtitle="[地位:證明] / [地位:歸納] / [地位:近似於框架] / [地位:約定] / [地位:公設(框架)]（每條須附 WHY 段落錨點）" color="bg-slate-700" font={font} />
      <div className="space-y-2">
        {card.claims.map((c, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
            <div className="flex flex-col gap-1 flex-shrink-0">
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${EPI_COLORS[c.epistemicMark] || ""}`}
              >
                {epistemicLabel(c.epistemicMark, c.frameworkNote)}
              </span>
              {c.anchor ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {c.anchor}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  缺錨點
                </span>
              )}
            </div>
            <div className="flex-1 text-[13px] text-slate-800">
              <MathText text={c.text} />
              {c.frameworkNote && (
                <div className="text-[10px] text-slate-500 italic mt-0.5">框架：{c.frameworkNote}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionDiagnostics({ card, font }: { card: CardData; font: string }) {
  const solo = card.soloData?.declaredLevel || card.soloLevel;
  const soloIdx = SOLO_LEVELS.findIndex((l) => l.key === solo);
  return (
    <section className="mb-4">
      <SlotHeading letter="◎" title="認知診斷" subtitle="Bloom 單點深度 × SOLO 網絡整合度（兩獨立維度）" color="bg-slate-600" font={font} />

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
          <div className="text-[10px] font-bold text-emerald-700" style={{ fontFamily: UI_FONT }}>
            Bloom · 單點認知深度
          </div>
          <div className="text-lg font-bold text-emerald-900" style={{ fontFamily: font }}>
            {card.bloomLevel}
          </div>
        </div>
        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
          <div className="text-[10px] font-bold text-indigo-700" style={{ fontFamily: UI_FONT }}>
            SOLO · 知識網整合度
          </div>
          <div className="text-lg font-bold text-indigo-900" style={{ fontFamily: font }}>
            {solo}
          </div>
        </div>
      </div>

      {/* SOLO 階梯視覺 */}
      <div className="flex items-center gap-1 mb-3">
        {SOLO_LEVELS.map((l, i) => (
          <div key={l.key} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= soloIdx ? l.color : "bg-slate-200"}`} />
            <div
              className={`text-[8px] mt-1 text-center ${i === soloIdx ? "font-bold text-indigo-700" : "text-slate-400"}`}
              style={{ fontFamily: UI_FONT }}
            >
              {l.key}
            </div>
          </div>
        ))}
      </div>

      {card.soloData?.evidence && card.soloData.evidence.length > 0 && (
        <div className="space-y-1.5 mb-3">
          <div className="text-[10px] font-bold text-slate-600" style={{ fontFamily: UI_FONT }}>
            SOLO 各級達成證據
          </div>
          {card.soloData.evidence.map((ev) => (
            <div key={ev.id} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded p-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold flex-shrink-0">
                {ev.level}
              </span>
              <span className="text-[12px] text-slate-700">
                <MathText text={ev.text} />
              </span>
            </div>
          ))}
        </div>
      )}

      {card.soloData?.autoRationale && (
        <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mb-2">
          <b style={{ fontFamily: UI_FONT }}>系統依知識網評估：</b>
          {card.soloData.autoRationale}
        </div>
      )}

      {card.blockageNotes && (
        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          <div className="text-[10px] font-bold text-amber-800 mb-0.5" style={{ fontFamily: UI_FONT }}>
            堵塞感定位記錄
          </div>
          <div className="text-[12px] text-slate-700">
            <MathText text={card.blockageNotes} />
          </div>
        </div>
      )}
    </section>
  );
}

// v4：七主幹之【關係邊】（沒有邊＝孤島，自檢第一個要抓）
export function SectionRelations({
  card,
  font,
  relations,
  cardTitles,
}: {
  card: CardData;
  font: string;
  relations?: Array<any>;
  cardTitles?: Record<string, string>;
}) {
  const rels = (relations || []).filter((r: any) => r.fromCardId === card.id || r.toCardId === card.id);
  if (rels.length === 0) {
    return (
      <section className="mb-8">
        <SlotHeading letter="邊" title="關係邊" subtitle="沒有邊＝孤島（自檢第一個要抓）" color="bg-indigo-600" font={font} />
        <p className="text-[13px] text-slate-400 italic">（尚未建立任何關係邊——此卡目前是孤島）</p>
      </section>
    );
  }
  return (
    <section className="mb-8">
      <SlotHeading letter="邊" title="關係邊" subtitle="沒有邊＝孤島（自檢第一個要抓）" color="bg-indigo-600" font={font} />
      <div className="space-y-2">
        {rels.map((r: any, i: number) => {
          const otherId = r.fromCardId === card.id ? r.toCardId : r.fromCardId;
          const other = (cardTitles && cardTitles[otherId]) || r.label || otherId;
          const dim = r.dimension ? `: ${r.dimension}` : r.distance ? `: d=${r.distance}` : "";
          return (
            <div key={r.id || i} className="p-2.5 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                  {r.label || relationLabelText(r.relationType)}
                </span>
                <span className="text-[12px] font-bold text-slate-800">{other}</span>
                {dim && <span className="text-[10px] text-slate-500">d{dim}</span>}
              </div>
              {r.relationType === "prerequisite" && r.breakStep && (
                <p className="text-[11px] text-slate-600 mt-1">缺 A 會斷在：<MathText text={r.breakStep} /></p>
              )}
              {r.relationType === "counter_example" && r.counterCondition && (
                <p className="text-[11px] text-slate-600 mt-1">卡在條件：<MathText text={r.counterCondition} /></p>
              )}
              {(r.relationType === "analogy_verified" || r.relationType === "analogy_unverified") && r.candidatePrediction && (
                <p className="text-[11px] text-slate-600 mt-1">候選推理測試：<MathText text={r.candidatePrediction} /></p>
              )}
              {r.notes && <p className="text-[11px] text-slate-500 mt-1"><MathText text={r.notes} /></p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// 關係邊文字標籤：統一由 inspect.ts 的 relationLabelText 提供，避免重複定義。

// v4：七主幹之【過程日誌】（只增不改，帶時間戳；[框架衝突] 新舊並排）
export function SectionProcessLogs({
  card,
  font,
  processLogs,
}: {
  card: CardData;
  font: string;
  processLogs?: Array<any>;
}) {
  const logs = (processLogs || []).filter((l: any) => !l.cardId || l.cardId === card.id);
  if (logs.length === 0) return null;
  const badge = (t: string) => {
    switch (t) {
      case "[增量]": case "⟲": return "bg-blue-100 text-blue-800 border-blue-300";
      case "[框架衝突]": case "⚡": return "bg-purple-100 text-purple-800 border-purple-300";
      case "[同session矛盾]": case "⇹": return "bg-rose-100 text-rose-800 border-rose-300";
      default: return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };
  const label = (t: string) =>
    t === "⟲" ? "[增量]" : t === "⚡" ? "[框架衝突]" : t === "⇹" ? "[同session矛盾]" : t;
  return (
    <section className="mb-8">
      <SlotHeading letter="誌" title="過程日誌" subtitle="只增不改，帶時間戳（理解如何演進的痕跡）" color="bg-slate-700" font={font} />
      <div className="space-y-2">
        {logs.map((l: any, i: number) => (
          <div key={l.id || i} className="p-2.5 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge(l.logType)}`}>{label(l.logType)}</span>
              <span className="text-[12px] font-bold text-slate-800">{l.title}</span>
              <span className="text-[10px] text-slate-400 font-mono ml-auto">{l.createdAt ? new Date(l.createdAt).toLocaleString() : ""}</span>
            </div>
            {(l.oldContent || l.newContent) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                <div className="bg-rose-50/50 p-2 rounded border border-rose-200">
                  <div className="text-[9px] font-bold text-rose-700 mb-0.5">舊主張</div>
                  <div className="text-[11px] text-slate-700"><MathText text={l.oldContent || "（無）"} /></div>
                </div>
                <div className="bg-emerald-50/50 p-2 rounded border border-emerald-200">
                  <div className="text-[9px] font-bold text-emerald-700 mb-0.5">新主張</div>
                  <div className="text-[11px] text-slate-700"><MathText text={l.newContent || "（無）"} /></div>
                </div>
              </div>
            )}
            {l.explanation && <p className="text-[11px] text-slate-600 mt-1.5"><MathText text={l.explanation} /></p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// v4 八點自我檢查 ＋ 符號綁定（compact chip / full 展開兩种形態）
// ============================================================

const STATUS_STYLE = {
  pass: { chip: "bg-emerald-50 border-emerald-200 text-emerald-800", dot: "bg-emerald-500", label: "通過", Icon: CheckCircle2 },
  warn: { chip: "bg-amber-50 border-amber-200 text-amber-900", dot: "bg-amber-500", label: "待確認", Icon: AlertTriangle },
  fail: { chip: "bg-rose-50 border-rose-200 text-rose-900", dot: "bg-rose-500", label: "違規", Icon: OctagonAlert },
} as const;

function CheckRow({ check, defaultOpen }: { check: CheckResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const st = STATUS_STYLE[check.status];
  const hasFindings = check.findings.length > 0;

  return (
    <div className={`rounded-lg border ${st.chip} overflow-hidden`}>
      <button
        onClick={() => hasFindings && setOpen(!open)}
        className={`w-full flex items-start gap-2 p-2.5 text-left ${hasFindings ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold">{check.index} {check.label}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/70 border border-current/20 font-bold" style={{ fontFamily: UI_FONT }}>
              {st.label}
            </span>
            {hasFindings && (
              <span className="text-[9px] opacity-60" style={{ fontFamily: UI_FONT }}>
                {check.findings.length} 處 · {open ? "收起" : "展開"}
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug mt-0.5 opacity-90">{check.summary}</p>
        </div>
      </button>

      {open && hasFindings && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          <p className="text-[10px] opacity-70 border-t border-current/15 pt-2 leading-relaxed" style={{ fontFamily: UI_FONT }}>
            手冊要求：{check.manualRule}
          </p>
          {check.findings.map((f, i) => (
            <div key={i} className="bg-white/70 rounded p-2 space-y-1 border border-current/15">
              <p className="text-[11px] font-medium leading-snug">
                「{f.quote}」
              </p>
              <p className="text-[10px] opacity-80">{f.issue}</p>
              <p className="text-[10px] text-slate-700 leading-relaxed">
                <b style={{ fontFamily: UI_FONT }}>建議：</b>
                {f.fix}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FourPointCheckPanelProps {
  report: FourPointReport;
  /** compact：只顯示四顆狀態 chip，用於表單下方 */
  variant?: "full" | "compact";
}

export const FourPointCheckPanel: React.FC<FourPointCheckPanelProps> = ({ report, variant = "full" }) => {
  if (variant === "compact") {
    const allPass = report.clean;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
            allPass ? "bg-emerald-100 text-emerald-800" : report.failCount ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
          }`}
          style={{ fontFamily: UI_FONT }}
        >
          八點自我檢查 {allPass ? "全過" : `${report.failCount} 違規 / ${report.warnCount} 待確認`}
        </span>
        {report.checks.map((c) => (
          <span
            key={c.id}
            title={`${c.label}：${c.summary}`}
            className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${STATUS_STYLE[c.status].chip}`}
          >
            {c.index}
            {c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "!"}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4 text-slate-600" />
        <h4 className="text-sm font-bold text-slate-800" style={{ fontFamily: UI_FONT }}>
          八點自我檢查 · {report.fieldLabel}
        </h4>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            report.clean ? "bg-emerald-100 text-emerald-800" : report.failCount ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
          }`}
          style={{ fontFamily: UI_FONT }}
        >
          {report.clean ? "八點全過" : `${report.failCount} 違規 · ${report.warnCount} 待確認`}
        </span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed" style={{ fontFamily: UI_FONT }}>
        這八點＋符號綁定，是從真實寫壞的例子逼出來的，每一點都回報具體原文，不是抽象評語。背景、構造思路與 WHY 正文共用<b>同一套</b>規則，不是三套。
      </p>
      <div className="space-y-1.5">
        {report.checks.map((c) => (
          <CheckRow key={c.id} check={c} defaultOpen={c.status === "fail"} />
        ))}
      </div>

      {"symbolBinding" in report && report.symbolBinding && (
        <div className={`p-2.5 rounded-lg border text-xs ${
          report.symbolBinding.status === "pass"
            ? "bg-slate-50 border-slate-200 text-slate-600"
            : "bg-amber-50 border-amber-200 text-amber-900"
        }`}>
          <div className="flex items-center gap-1.5 font-bold mb-1">
            <span>⌘ 符號綁定檢查</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${report.symbolBinding.status === "pass" ? "bg-slate-200 text-slate-700" : "bg-amber-200 text-amber-800"}`}>
              {report.symbolBinding.status === "pass" ? "通過" : "待核對"}
            </span>
          </div>
          <p className="text-[11px] opacity-90">{report.symbolBinding.summary}</p>
          {report.symbolBinding.findings.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {report.symbolBinding.findings.map((f, i) => (
                <li key={i} className="text-[10px] leading-relaxed">
                  <b>「{f.quote}」</b> — {f.issue}。{f.fix}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
