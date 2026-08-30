"use client";

import React from "react";
import { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { Lock, Lightbulb, HelpCircle, CheckCircle, XCircle } from "lucide-react";
import { SHAPE_DEFS } from "./ShapeClassifier";
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
        <p className="text-[15px] text-slate-800 leading-relaxed">
          <MathText text={card.constructionThinking} />
        </p>
      </div>
    </section>
  );
}

// v4 新增：追問點（嵌入在 WHY/HOW 關鍵轉折處）
export function SectionThoughtPoints({ card, font }: { card: CardData; font: string }) {
  if (!card.thoughtPoints || card.thoughtPoints.length === 0) return null;
  return (
    <section className="mb-8">
      <SlotHeading letter="?" title="追問點" subtitle="關鍵轉折處的思維模式提問（v4：原展開測試改名）" color="bg-orange-600" font={font} />
      <div className="space-y-3">
        {card.thoughtPoints.map((tp) => (
          <div key={tp.id} className="bg-orange-50/50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-orange-700" />
              <span className="text-xs font-bold text-orange-900" style={{ fontFamily: UI_FONT }}>
                【追問 · {tp.modeName}】
              </span>
              {tp.passed ? (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-300">
                  <CheckCircle className="w-3 h-3" /> ✓展
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300">
                  <XCircle className="w-3 h-3" /> 尚未通過
                </span>
              )}
            </div>
            <p className="text-[13px] text-slate-800 font-medium mb-2">
              <span className="text-orange-700 font-bold">問題：</span>
              <MathText text={tp.question} />
            </p>
            <div className="pl-3 border-l-2 border-orange-300">
              <p className="text-[10px] text-orange-800 font-bold mb-1" style={{ fontFamily: UI_FONT }}>
                (答案)
              </p>
              <p className="text-[12px] text-slate-700 leading-relaxed">
                <MathText text={tp.answer} />
              </p>
            </div>
            {tp.note && (
              <p className="text-[10px] text-slate-500 italic mt-2">
                備註：{tp.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionWhat({ card, font }: { card: CardData; font: string }) {
  return (
    <section className="mb-8">
      <SlotHeading letter="W" title="WHAT · 概念本質" subtitle="知道這個東西是什麼（與 HOW 嚴格分離）" color="bg-blue-600" font={font} />
      <div className="pl-4 border-l-4 border-blue-200 space-y-3">
        <p className="text-[15px] text-slate-800 leading-relaxed">
          <MathText text={card.whatData?.summary || "（尚未填寫）"} />
        </p>

        {card.whatData?.perspectives && card.whatData.perspectives.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-500" style={{ fontFamily: UI_FONT }}>
              多視角理解 G/L/I/C/O/A/P
            </p>
            {card.whatData.perspectives.map((p, i) => (
              <div key={i} className="flex gap-2.5 bg-blue-50/60 p-2.5 rounded-lg border border-blue-200/70">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {p.code}
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
        subtitle={`知道怎麼做 · 狀態：${card.howData?.status === "compiled" ? "✓展 已編譯" : "⋯ 未編譯"}`}
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
                    {s.isCompiled ? "✓展" : "⋯ 未編譯"}
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
            <span className="text-rose-600 text-xl mr-1">↯</span>
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
        {card.intuitionTraps.map((trap, i) => (
          <div key={i} className="bg-purple-50/50 border border-purple-200 rounded-lg p-3">
            <p className="text-[13px] text-slate-800 font-medium mb-1">
              {trap.description}
            </p>
            <p className="text-[11px] text-slate-600 mb-2">
              <b>為什麼直覺會錯：</b>{trap.whyMisleading}
            </p>
            <div className="pl-2 border-l-2 border-purple-300">
              <p className="text-[10px] font-bold text-purple-800" style={{ fontFamily: UI_FONT }}>
                ✓正確理解
              </p>
              <p className="text-[12px] text-slate-700 mt-0.5">
                {trap.correctUnderstanding}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionClaims({ card, font }: { card: CardData; font: string }) {
  if (!card.claims?.length) return null;
  return (
    <section className="mb-8">
      <SlotHeading letter="⊢" title="認識論聲明" subtitle="⊢證 / ⊢歸 / ⊢近 / ⊢約 / ⊢公設" color="bg-slate-700" font={font} />
      <div className="space-y-2">
        {card.claims.map((c, i) => (
          <div key={i} className="flex items-start gap-2 p-2.5 bg-white rounded-lg border border-slate-200">
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${EPI_COLORS[c.epistemicMark] || ""}`}
            >
              {c.epistemicMark}
            </span>
            <div className="flex-1 text-[13px] text-slate-800">
              <MathText text={c.text} />
              {c.frameworkNote && (
                <div className="text-[10px] text-slate-500 italic mt-0.5">[{c.frameworkNote}]</div>
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
