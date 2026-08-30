"use client";

import React, { useState } from "react";
import { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { FONT_OPTIONS, resolveFont } from "@/lib/fonts";
import { SoloAssessmentPanel } from "./SoloAssessmentPanel";
import { ShapeClassifier } from "./ShapeClassifier";
import {
  SectionHeader,
  SectionConstructionThinking,
  SectionThoughtPoints,
  SectionWhat,
  SectionWhy,
  SectionHow,
  SectionWhen,
  SectionOrigin,
  SectionIntuitionTraps,
  SectionClaims,
  SectionDiagnostics,
} from "./CardPaperSections";
import {
  X, Sparkles, Save, Trash2, Lock, Eye, Edit3, FileText, Files, Type,
  ChevronLeft, ChevronRight, Sigma, AlertCircle, CheckCircle, AlertTriangle,
} from "lucide-react";

interface CardDetailModalProps {
  card: CardData;
  onClose: () => void;
  onSave: (updatedCard: CardData) => void;
  onRunAudit: (card: CardData) => void;
  onExpansionTest: (card: CardData) => void;
  fontFamily?: string;
  initialMode?: "preview" | "edit";
}

const UI = "'Varela Round', sans-serif";

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  onClose,
  onSave,
  onRunAudit,
  onExpansionTest,
  fontFamily = "quicksand",
  initialMode = "preview",
}) => {
  const [formData, setFormData] = useState<CardData>(JSON.parse(JSON.stringify(card)));
  const [mode, setMode] = useState<"preview" | "edit">(initialMode);
  const [pageMode, setPageMode] = useState<"single" | "paged">(card.pageMode || "single");
  const [activePage, setActivePage] = useState(0);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "basic" | "what" | "why" | "how" | "when" | "origin" | "epistemology" | "diagnostics"
  >("basic");

  const cardFont = formData.cardFont || fontFamily;
  const ff = resolveFont(cardFont);

  const patch = (p: Partial<CardData>) => setFormData({ ...formData, ...p });
  const handleSave = () => { onSave(formData); onClose(); };
  const handleSaveAndClose = () => { onSave(formData); onClose(); onExpansionTest(formData); };

  /** 分頁模式：把八個區塊分配到多張 A4 紙 */
  // v4 順序：構造思路 → ORIGIN（兩個「觸發」放一起對照）→ WHY（含追問點）→ WHAT → HOW → WHEN（含 WHEN·可用）→ 認識論 → 診斷
  const PAGES: Array<{ title: string; render: () => React.ReactNode }> = [
    {
      title: "卡頭 · 背景 · 構造思路 · ORIGIN",
      render: () => (
        <>
          <SectionHeader card={formData} font={ff} />
          <SectionConstructionThinking card={formData} font={ff} />
          <SectionOrigin card={formData} font={ff} />
        </>
      ),
    },
    {
      title: "WHY · 深度推理",
      render: () => (
        <>
          <SectionWhy card={formData} font={ff} />
          <SectionThoughtPoints card={formData} font={ff} />
        </>
      ),
    },
    { title: "WHAT · 概念本質", render: () => <SectionWhat card={formData} font={ff} /> },
    { title: "HOW · 可執行步驟", render: () => <SectionHow card={formData} font={ff} /> },
    { title: "WHEN · 觸發（含可用）", render: () => <SectionWhen card={formData} font={ff} /> },
    {
      title: "認識論 · 診斷",
      render: () => (<><SectionIntuitionTraps card={formData} font={ff} /><SectionClaims card={formData} font={ff} /><SectionDiagnostics card={formData} font={ff} /></>),
    },
  ];

  // ============ 共用頂欄 ============
  const Toolbar = (
    <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-b border-slate-200 flex items-center justify-between gap-2 flex-shrink-0 flex-wrap">
      <div className="min-w-0 flex items-center gap-2 order-1">
        <span className="text-sm font-bold text-slate-900 truncate max-w-[45vw] sm:max-w-none" style={{ fontFamily: ff }}>
          {formData.title}
        </span>
        <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex-shrink-0" style={{ fontFamily: UI }}>
          {formData.granularity}
        </span>
      </div>

      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 order-2 flex-wrap justify-end">
        {/* 預覽 / 編輯 */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5" style={{ fontFamily: UI }}>
          <button
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all ${mode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">預覽</span>
          </button>
          <button
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all ${mode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            <Edit3 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">編輯</span>
          </button>
        </div>

        {/* 一頁式 / 分頁 A4（僅預覽模式） */}
        {mode === "preview" && (
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5" style={{ fontFamily: UI }}>
            <button
              onClick={() => setPageMode("single")}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all ${pageMode === "single" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              title="一頁式：全部內容連續一張長紙"
            >
              <FileText className="w-3.5 h-3.5" /> <span className="hidden sm:inline">一頁式</span>
            </button>
            <button
              onClick={() => { setPageMode("paged"); setActivePage(0); }}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded text-xs font-medium transition-all ${pageMode === "paged" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              title="分頁：多張 A4 紙"
            >
              <Files className="w-3.5 h-3.5" /> <span className="hidden sm:inline">分頁 A4</span>
            </button>
          </div>
        )}

        {/* 每張卡片獨立字體 */}
        <div className="relative">
          <button
            onClick={() => setShowFontMenu(!showFontMenu)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs"
            title="此卡片字體"
          >
            <Type className="w-3.5 h-3.5" />
            <span style={{ fontFamily: ff }} className="hidden sm:inline max-w-[68px] truncate">
              {FONT_OPTIONS.find((f) => f.key === cardFont)?.label.split(" ")[0] || "字體"}
            </span>
          </button>
          {showFontMenu && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-slate-200 w-60 max-h-80 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border-b border-slate-200" style={{ fontFamily: UI }}>
                手寫體
              </div>
              {FONT_OPTIONS.filter((f) => f.handwriting).map((f) => (
                <button
                  key={f.key}
                  onClick={() => { patch({ cardFont: f.key }); setShowFontMenu(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-base ${cardFont === f.key ? "bg-blue-50" : ""}`}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 border-y border-slate-200" style={{ fontFamily: UI }}>
                易讀體（長推導建議）
              </div>
              {FONT_OPTIONS.filter((f) => !f.handwriting).map((f) => (
                <button
                  key={f.key}
                  onClick={() => { patch({ cardFont: f.key }); setShowFontMenu(false); }}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-50 text-base ${cardFont === f.key ? "bg-blue-50" : ""}`}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onRunAudit(formData)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
          title="AI 假懂審查"
        >
          <Sparkles className="w-4 h-4" />
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
          style={{ fontFamily: UI }}
        >
          <Save className="w-3.5 h-3.5" /> <span className="hidden sm:inline">儲存</span>
        </button>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ============ 預覽模式 ============
  if (mode === "preview") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-0 sm:p-4">
        <div className="modal-frame bg-slate-100 sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[94vh] flex flex-col overflow-hidden safe-top safe-bottom">
          {Toolbar}

          {/* 分頁導覽列（手機可橫向捲動） */}
          {pageMode === "paged" && (
            <div className="px-2 sm:px-4 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar" style={{ fontFamily: UI }}>
              <button
                onClick={() => setActivePage(Math.max(0, activePage - 1))}
                disabled={activePage === 0}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 flex-shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 mx-auto">
                {PAGES.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePage(i)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap ${
                      activePage === i ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="hidden sm:inline">第 {i + 1} 頁 · {p.title}</span>
                    <span className="sm:hidden">P{i + 1}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setActivePage(Math.min(PAGES.length - 1, activePage + 1))}
                disabled={activePage === PAGES.length - 1}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 flex-shrink-0"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 紙張區 */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">
            {pageMode === "single" ? (
              // —— 一頁式：連續長紙（寬度自適應，最大 794px）——
              <div
                className="w-full max-w-[794px] mx-auto bg-white shadow-lg rounded-sm px-5 py-6 sm:px-14 sm:py-12"
                style={{
                  fontFamily: ff,
                  backgroundImage:
                    "repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(148,163,184,0.10) 31px, rgba(148,163,184,0.10) 32px)",
                  backgroundPosition: "0 14px",
                }}
              >
                 <SectionHeader card={formData} font={ff} />
                 <SectionConstructionThinking card={formData} font={ff} />
                 <SectionOrigin card={formData} font={ff} />
                 <SectionWhy card={formData} font={ff} />
                 <SectionThoughtPoints card={formData} font={ff} />
                 <SectionWhat card={formData} font={ff} />
                 <SectionHow card={formData} font={ff} />
                 <SectionWhen card={formData} font={ff} />
                 <SectionIntuitionTraps card={formData} font={ff} />
                 <SectionClaims card={formData} font={ff} />
                 <SectionDiagnostics card={formData} font={ff} />
                <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200" style={{ fontFamily: UI }}>
                  一頁式 · 全部內容連續呈現
                </div>
              </div>
            ) : (
              // —— 分頁：A4 紙張。桌機固定 794×1123；手機寬度自適應（保持 A4 比例）——
              <div className="flex flex-col items-center gap-6 sm:gap-8">
                {PAGES.map((p, i) => (
                  <div
                    key={i}
                    id={`a4-page-${i}`}
                    className={`bg-white shadow-lg rounded-sm px-5 py-6 sm:px-14 sm:py-12 flex flex-col transition-all w-full sm:w-[794px] sm:min-h-[1123px] ${
                      activePage === i ? "ring-2 ring-slate-900" : "opacity-60"
                    }`}
                    style={{
                      // 手機用 A4 比例 (1:1.414) 保持紙張感，桌機用固定尺寸
                      aspectRatio: undefined,
                      fontFamily: ff,
                      backgroundImage:
                        "repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(148,163,184,0.10) 31px, rgba(148,163,184,0.10) 32px)",
                      backgroundPosition: "0 14px",
                    }}
                    onClick={() => setActivePage(i)}
                  >
                    <div className="flex-1">{p.render()}</div>
                    <div
                      className="pt-4 mt-auto border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400"
                      style={{ fontFamily: UI }}
                    >
                      <span className="truncate max-w-[55%]">{formData.title}</span>
                      <span className="truncate">A4 · {i + 1}/{PAGES.length} — {p.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ 編輯模式 ============
  const TABS = [
    { key: "basic", label: "基本 · 背景 · 判型" },
    { key: "what", label: "WHAT" },
    { key: "why", label: "WHY" },
    { key: "how", label: "HOW" },
    { key: "when", label: "WHEN" },
    { key: "origin", label: "ORIGIN" },
    { key: "epistemology", label: "認識論 ⊢" },
    { key: "diagnostics", label: "診斷 Bloom×SOLO" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="modal-frame bg-white sm:rounded-xl shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[94vh] flex flex-col overflow-hidden safe-top safe-bottom">
        {Toolbar}

        <div className="flex border-b border-slate-200 bg-slate-50 text-xs px-3 overflow-x-auto no-scrollbar" style={{ fontFamily: UI }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`py-2 px-3 whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? "text-slate-900 font-bold border-b-2 border-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-800" style={{ fontFamily: UI }}>
          {/* ===== 基本 / 背景 / 判型 ===== */}
          {activeTab === "basic" && (
            <div className="space-y-4">
              {/* v4 新增：構造思路（邏輯觸發，與 ORIGIN 歷史觸發分開） */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  構造思路（選填——邏輯觸發，與 ORIGIN 歷史觸發分開：「當初怎麼想到這條路的？」）
                </label>
                <textarea
                  rows={4}
                  value={formData.constructionThinking || ""}
                  onChange={(e) => patch({ constructionThinking: e.target.value })}
                  placeholder="例：卡諾時代蒸汽機效率上限不明，工程界爭論不休。切入點不是直接算效率，而是問：『如果存在一台效率超過可逆極限的機器，能不能用它造出違反熱二律的複合裝置？』——這個反證法的切入角度，把「求極值」問題轉化為「檢驗一致性」問題，才是整套推導真正的契機。"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed bg-teal-50/40 border-teal-200"
                />
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-slate-600">
                  <MathText text={formData.constructionThinking || ""} />
                </div>
              </div>

              {/* v4 新增：追問點（嵌入在用戶判斷的 WHY/HOW 關鍵轉折處） */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">
                    追問點（WHY/HOW 正文中的關鍵轉折——v4 手冊規定格式：【追問·思維模式名】問題 → 答案）
                  </span>
                  <button
                    onClick={() =>
                      patch({
                        thoughtPoints: [
                          ...(formData.thoughtPoints || []),
                          {
                            id: `tp-${Date.now()}`,
                            modeName: "",
                            question: "",
                            answer: "",
                            passed: false,
                          },
                        ],
                      })
                    }
                    className="text-[11px] px-2 py-1 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 font-semibold"
                  >
                    + 新增追問點
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.thoughtPoints?.map((tp, i) => (
                    <div key={tp.id} className="bg-orange-50/50 border border-orange-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-orange-900">
                            【追問 · 思維模式名】
                          </span>
                          {tp.passed ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                              ✓已推出
                            </span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                              ⋯ 未通過
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            patch({
                              thoughtPoints: formData.thoughtPoints!.filter((_, x) => x !== i),
                            })
                          }
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block mb-1">思維模式名（具體招式）</label>
                        <input
                          value={tp.modeName}
                          onChange={(e) => {
                            const list = [...formData.thoughtPoints!];
                            list[i] = { ...list[i], modeName: e.target.value };
                            patch({ thoughtPoints: list });
                          }}
                          placeholder="例：反證法起手式、退化情形排除、離散-連續極限對照"
                          className="w-full p-1.5 rounded border border-orange-300 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block mb-1">追問問題</label>
                        <textarea
                          rows={2}
                          value={tp.question}
                          onChange={(e) => {
                            const list = [...formData.thoughtPoints!];
                            list[i] = { ...list[i], question: e.target.value };
                            patch({ thoughtPoints: list });
                          }}
                          placeholder="把關鍵轉折處變成一個具體問題"
                          className="w-full p-1.5 rounded border border-orange-300 text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block mb-1">答案（完整解釋）</label>
                        <textarea
                          rows={3}
                          value={tp.answer}
                          onChange={(e) => {
                            const list = [...formData.thoughtPoints!];
                            list[i] = { ...list[i], answer: e.target.value };
                            patch({ thoughtPoints: list });
                          }}
                          placeholder="完整推理、不省略關鍵步驟"
                          className="w-full p-1.5 rounded border border-orange-300 text-xs bg-white"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={tp.passed}
                            onChange={(e) => {
                              const list = [...formData.thoughtPoints!];
                              list[i] = { ...list[i], passed: e.target.checked };
                              patch({ thoughtPoints: list });
                            }}
                          />
                          <span className={tp.passed ? "text-emerald-700 font-bold" : "text-amber-700"}>
                            {tp.passed ? "✓能不看答案自行推出" : "⋯ 仍需看答案才能推出"}
                          </span>
                        </label>
                        <button
                          onClick={() => {
                            onSave(formData);
                            onExpansionTest(formData);
                          }}
                          className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 border-none"
                        >
                          進入追問測試
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">知識點名稱</label>
                  <input
                    value={formData.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">領域</label>
                  <input
                    value={formData.domain}
                    onChange={(e) => patch({ domain: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">顆粒度等級</label>
                  <select
                    value={formData.granularity}
                    onChange={(e) => patch({ granularity: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="L1 核心原理">L1 核心原理</option>
                    <option value="L2 定理/機制">L2 定理/機制</option>
                    <option value="L3 技法/程序">L3 技法/程序</option>
                    <option value="L4 事實/常數">L4 事實/常數</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">預設版面（預覽時）</label>
                  <select
                    value={formData.pageMode || "single"}
                    onChange={(e) => { patch({ pageMode: e.target.value as any }); setPageMode(e.target.value as any); }}
                    className="w-full p-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="single">一頁式（連續長紙）</option>
                    <option value="paged">分頁 A4（多張紙）</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  背景描述（卡片未點開時顯示的重點：框架、前置背景、向下支撐什麼）
                </label>
                <textarea
                  rows={4}
                  value={formData.backgroundDescription || ""}
                  onChange={(e) => patch({ backgroundDescription: e.target.value })}
                  placeholder="例：位於「非相對論量子力學」框架。前置背景為德布羅意物質波；本卡是波動力學的出發公設，向下支撐能階量子化與化學鍵理論。支援 LaTeX：$v \ll c$"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed"
                />
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-slate-600">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                    <Sigma className="w-3 h-3" /> LaTeX 即時預覽
                  </span>
                  <MathText text={formData.backgroundDescription || ""} />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <label className="font-bold text-slate-700 block mb-2">知識點分類 · 內部推理形狀（含複合型）</label>
                <ShapeClassifier
                  reasoningShape={formData.reasoningShape}
                  compositeShapes={formData.compositeShapes}
                  compositeNote={formData.compositeNote}
                  shapeRationale={formData.shapeRationale}
                  shapeConfidence={formData.shapeConfidence}
                  shapeAccepted={formData.shapeAccepted}
                  onChange={(p) => patch(p as Partial<CardData>)}
                />
              </div>
            </div>
          )}

          {/* ===== WHAT ===== */}
          {activeTab === "what" && (
            <div className="space-y-4">
              <div>
                <label className="font-bold text-slate-700 block mb-1">WHAT 概念本質（支援 LaTeX）</label>
                <textarea
                  rows={3}
                  value={formData.whatData?.summary || ""}
                  onChange={(e) => patch({ whatData: { ...formData.whatData!, summary: e.target.value } })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed"
                />
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200">
                  <MathText text={formData.whatData?.summary || ""} />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">與 HOW 的嚴格區分</label>
                <input
                  value={formData.whatData?.distinctionFromHow || ""}
                  onChange={(e) => patch({ whatData: { ...formData.whatData!, distinctionFromHow: e.target.value } })}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">多視角 G/L/I/C/O/A/P</span>
                  <button
                    onClick={() => patch({
                      whatData: {
                        ...formData.whatData!,
                        perspectives: [...(formData.whatData?.perspectives || []), { code: "P", label: "物理機制", content: "" }],
                      },
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                  >
                    + 新增視角
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.whatData?.perspectives?.map((p, i) => (
                    <div key={i} className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex gap-2">
                      <select
                        value={p.code}
                        onChange={(e) => {
                          const list = [...formData.whatData!.perspectives];
                          list[i] = { ...list[i], code: e.target.value };
                          patch({ whatData: { ...formData.whatData!, perspectives: list } });
                        }}
                        className="font-mono font-bold text-xs p-1 rounded border border-slate-300 bg-white h-fit"
                      >
                        {["G", "L", "I", "C", "O", "A", "P"].map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input
                        value={p.label}
                        onChange={(e) => {
                          const list = [...formData.whatData!.perspectives];
                          list[i] = { ...list[i], label: e.target.value };
                          patch({ whatData: { ...formData.whatData!, perspectives: list } });
                        }}
                        className="w-24 p-1 rounded border border-slate-300 text-xs bg-white h-fit"
                      />
                      <textarea
                        rows={2}
                        value={p.content}
                        onChange={(e) => {
                          const list = [...formData.whatData!.perspectives];
                          list[i] = { ...list[i], content: e.target.value };
                          patch({ whatData: { ...formData.whatData!, perspectives: list } });
                        }}
                        className="flex-1 p-1 rounded border border-slate-300 text-xs bg-white"
                      />
                      <button
                        onClick={() => patch({
                          whatData: {
                            ...formData.whatData!,
                            perspectives: formData.whatData!.perspectives.filter((_, x) => x !== i),
                          },
                        })}
                        className="text-slate-400 hover:text-rose-600 h-fit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== WHY ===== */}
          {activeTab === "why" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {(["confidenceBefore", "confidenceAfter"] as const).map((key) => (
                  <div key={key}>
                    <label className="font-bold text-slate-700 block mb-1">
                      {key === "confidenceBefore" ? "1. 撰寫前信心" : "4. 推導後信心"}
                    </label>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => patch({ whyData: { ...formData.whyData!, [key]: v } as any })}
                          className={`px-2.5 py-1 rounded font-bold ${
                            formData.whyData?.[key] === v
                              ? key === "confidenceBefore" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                              : "bg-white text-slate-700 border border-slate-300"
                          }`}
                        >
                          {v}★
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">2. 閉卷直覺草稿（不查資料）</label>
                <textarea
                  rows={3}
                  value={formData.whyData?.closedBookDraft || ""}
                  onChange={(e) => patch({ whyData: { ...formData.whyData!, closedBookDraft: e.target.value } })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">3. 完整嚴密推理（支援 LaTeX）</label>
                <textarea
                  rows={6}
                  value={formData.whyData?.fullReasoning || ""}
                  onChange={(e) => patch({ whyData: { ...formData.whyData!, fullReasoning: e.target.value } })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed"
                />
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                    <Sigma className="w-3 h-3" /> LaTeX 即時預覽
                  </span>
                  <MathText text={formData.whyData?.fullReasoning || ""} />
                </div>
              </div>

              {/* 雙視角 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                {(["perspective1", "perspective2"] as const).map((pk, idx) => (
                  <div key={pk} className="space-y-1.5">
                    <label className="font-bold text-slate-700 block">視角 {idx + 1}（失效模式需不同）</label>
                    <input
                      placeholder="視角名稱"
                      value={formData.whyData?.[pk]?.name || ""}
                      onChange={(e) => patch({
                        whyData: { ...formData.whyData!, [pk]: { ...(formData.whyData?.[pk] || { name: "", failureMode: "", content: "" }), name: e.target.value } } as any,
                      })}
                      className="w-full p-1.5 rounded border border-slate-300 text-xs"
                    />
                    <textarea
                      rows={2}
                      placeholder="內容"
                      value={formData.whyData?.[pk]?.content || ""}
                      onChange={(e) => patch({
                        whyData: { ...formData.whyData!, [pk]: { ...(formData.whyData?.[pk] || { name: "", failureMode: "", content: "" }), content: e.target.value } } as any,
                      })}
                      className="w-full p-1.5 rounded border border-slate-300 text-xs"
                    />
                    <input
                      placeholder="失效模式：什麼情況下這個視角會失靈？"
                      value={formData.whyData?.[pk]?.failureMode || ""}
                      onChange={(e) => patch({
                        whyData: { ...formData.whyData!, [pk]: { ...(formData.whyData?.[pk] || { name: "", failureMode: "", content: "" }), failureMode: e.target.value } } as any,
                      })}
                      className="w-full p-1.5 rounded border border-amber-300 bg-amber-50/40 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* 子目標 */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">子目標聲明</span>
                  <button
                    onClick={() => patch({
                      whyData: {
                        ...formData.whyData!,
                        subGoals: [...(formData.whyData?.subGoals || []), { id: `sg-${Date.now()}`, goal: "", requiredParts: [], whyNecessary: "", whySufficient: "" }],
                      },
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                  >
                    + 新增子目標
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.whyData?.subGoals?.map((sg, i) => (
                    <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          placeholder="要證什麼？"
                          value={sg.goal}
                          onChange={(e) => {
                            const list = [...formData.whyData!.subGoals!];
                            list[i] = { ...list[i], goal: e.target.value };
                            patch({ whyData: { ...formData.whyData!, subGoals: list } });
                          }}
                          className="flex-1 p-1.5 rounded border border-slate-300 text-xs font-semibold bg-white"
                        />
                        <button
                          onClick={() => patch({ whyData: { ...formData.whyData!, subGoals: formData.whyData!.subGoals!.filter((_, x) => x !== i) } })}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          placeholder="為什麼必要？"
                          value={sg.whyNecessary}
                          onChange={(e) => {
                            const list = [...formData.whyData!.subGoals!];
                            list[i] = { ...list[i], whyNecessary: e.target.value };
                            patch({ whyData: { ...formData.whyData!, subGoals: list } });
                          }}
                          className="p-1.5 rounded border border-emerald-300 bg-white text-xs"
                        />
                        <input
                          placeholder="為什麼合起來足夠？"
                          value={sg.whySufficient}
                          onChange={(e) => {
                            const list = [...formData.whyData!.subGoals!];
                            list[i] = { ...list[i], whySufficient: e.target.value };
                            patch({ whyData: { ...formData.whyData!, subGoals: list } });
                          }}
                          className="p-1.5 rounded border border-blue-300 bg-white text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 假設鎖定 */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-600" /> 假設鎖定清單
                  </span>
                  <button
                    onClick={() => patch({
                      assumptions: [...(formData.assumptions || []), { id: `a-${Date.now()}`, name: "", status: "locked", description: "" }],
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold"
                  >
                    + 新增假設
                  </button>
                </div>
                <div className="space-y-1.5">
                  {formData.assumptions?.map((a, i) => (
                    <div key={i} className="p-2 bg-amber-50/40 rounded-lg border border-amber-200 flex gap-2">
                      <input
                        placeholder="假設名稱"
                        value={a.name}
                        onChange={(e) => {
                          const list = [...formData.assumptions!];
                          list[i] = { ...list[i], name: e.target.value };
                          patch({ assumptions: list });
                        }}
                        className="w-44 p-1 rounded border border-amber-300 font-semibold text-xs bg-white"
                      />
                      <input
                        placeholder="邊界說明"
                        value={a.description}
                        onChange={(e) => {
                          const list = [...formData.assumptions!];
                          list[i] = { ...list[i], description: e.target.value };
                          patch({ assumptions: list });
                        }}
                        className="flex-1 p-1 rounded border border-amber-300 text-xs bg-white"
                      />
                      <button
                        onClick={() => patch({ assumptions: formData.assumptions!.filter((_, x) => x !== i) })}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== HOW ===== */}
          {activeTab === "how" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700">
                  編譯狀態：
                  <span className={`ml-2 px-2 py-0.5 rounded font-mono ${formData.howData?.status === "compiled" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {formData.howData?.status === "compiled" ? "✓展" : "⋯ 未編譯"}
                  </span>
                </span>
                <div className="flex gap-2">
                  <button onClick={() => onExpansionTest(formData)} className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-medium">
                    閉卷展開測試
                  </button>
                  <button
                    onClick={() => patch({ howData: { ...formData.howData!, status: formData.howData?.status === "compiled" ? "uncompiled" : "compiled" } })}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs"
                  >
                    切換
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">步驟清單</span>
                <button
                  onClick={() => patch({
                    howData: {
                      ...formData.howData!,
                      steps: [...(formData.howData?.steps || []), { id: `s-${Date.now()}`, title: "", action: "", isCompiled: false }],
                    },
                  })}
                  className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                >
                  + 新增步驟
                </button>
              </div>

              {formData.howData?.steps?.map((s, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <input
                      value={s.title}
                      placeholder={`步驟 ${i + 1} 標題`}
                      onChange={(e) => {
                        const list = [...formData.howData!.steps];
                        list[i] = { ...list[i], title: e.target.value };
                        patch({ howData: { ...formData.howData!, steps: list } });
                      }}
                      className="flex-1 p-1.5 rounded border border-slate-300 text-xs font-semibold bg-white"
                    />
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.isCompiled}
                        onChange={(e) => {
                          const list = [...formData.howData!.steps];
                          list[i] = { ...list[i], isCompiled: e.target.checked };
                          patch({ howData: { ...formData.howData!, steps: list } });
                        }}
                      />
                      <span className={s.isCompiled ? "text-emerald-700 font-bold" : "text-amber-700"}>
                        {s.isCompiled ? "✓展" : "⋯"}
                      </span>
                    </label>
                    <button
                      onClick={() => patch({ howData: { ...formData.howData!, steps: formData.howData!.steps.filter((_, x) => x !== i) } })}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={s.action}
                    placeholder="可執行動作（支援 LaTeX）"
                    onChange={(e) => {
                      const list = [...formData.howData!.steps];
                      list[i] = { ...list[i], action: e.target.value };
                      patch({ howData: { ...formData.howData!, steps: list } });
                    }}
                    className="w-full p-2 rounded border border-slate-300 text-xs bg-white"
                  />
                </div>
              ))}
            </div>
          )}

          {/* ===== WHEN ===== */}
          {activeTab === "when" && (
            <div className="space-y-3">
              {/* v4: WHY 視角失效模式 → WHEN 檢查映射 */}
              {(formData.whyData?.perspective1 || formData.whyData?.perspective2) && (
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> WHY 視角失效模式映射
                    </span>
                    <span className="text-[10px] text-indigo-700">每個失效模式必須有對應的 WHEN 檢查</span>
                  </div>
                  {[formData.whyData?.perspective1, formData.whyData?.perspective2].map((p, i) => {
                    if (!p?.failureMode) return null;
                    const mappedCheck = formData.whenData?.triggers?.find(t => 
                      t.cue.includes(p.name) || t.check.includes(p.failureMode)
                    );
                    return (
                      <div key={i} className={`p-2 rounded border ${mappedCheck ? 'bg-emerald-50 border-emerald-300' : 'bg-amber-50 border-amber-300'}`}>
                        <div className="flex items-start gap-2">
                          <span className={`text-xs font-bold ${mappedCheck ? 'text-emerald-700' : 'text-amber-700'}`}>
                            視角 {i+1}: {p.name}
                          </span>
                          {mappedCheck ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          <span className="font-semibold">失效模式：</span>{p.failureMode}
                        </div>
                        {mappedCheck ? (
                          <div className="text-[10px] text-emerald-700 mt-1">
                            ✓ 已有 WHEN 檢查：「{mappedCheck.cue}」→「{mappedCheck.check}」
                          </div>
                        ) : (
                          <button
                            onClick={() => patch({
                              whenData: {
                                ...formData.whenData!,
                                triggers: [...(formData.whenData?.triggers || []), {
                                  id: `w-${Date.now()}`,
                                  cue: `在 ${p.name} 視角下`,
                                  check: `檢查是否遇到：${p.failureMode}`,
                                  keywords: [p.name, "失效模式"]
                                }]
                              }
                            })}
                            className="mt-1 text-[10px] px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                          >
                            + 建立 WHEN 檢查
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">觸發線索（看到 ___ → 檢查 ___）</span>
                <button
                  onClick={() => patch({
                    whenData: {
                      ...formData.whenData!,
                      triggers: [...(formData.whenData?.triggers || []), { id: `w-${Date.now()}`, cue: "", check: "", keywords: [] }],
                    },
                  })}
                  className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                >
                  + 新增線索
                </button>
              </div>
              {formData.whenData?.triggers?.map((t, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-blue-700 w-12 text-[11px]">看到</span>
                    <input
                      value={t.cue}
                      onChange={(e) => {
                        const list = [...formData.whenData!.triggers];
                        list[i] = { ...list[i], cue: e.target.value };
                        patch({ whenData: { ...formData.whenData!, triggers: list } });
                      }}
                      className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                      placeholder="具體關鍵詞，例：「催化劑」"
                    />
                    <button
                      onClick={() => patch({ whenData: { ...formData.whenData!, triggers: formData.whenData!.triggers.filter((_, x) => x !== i) } })}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-emerald-700 w-12 text-[11px]">→檢查</span>
                    <input
                      value={t.check}
                      onChange={(e) => {
                        const list = [...formData.whenData!.triggers];
                        list[i] = { ...list[i], check: e.target.value };
                        patch({ whenData: { ...formData.whenData!, triggers: list } });
                      }}
                      className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                      placeholder="例：$K$ 是否改變（絕對不變）"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-slate-500 w-12 text-[11px]">關鍵詞</span>
                    <input
                      value={(t.keywords || []).join(", ")}
                      onChange={(e) => {
                        const list = [...formData.whenData!.triggers];
                        list[i] = { ...list[i], keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                        patch({ whenData: { ...formData.whenData!, triggers: list } });
                      }}
                      className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                      placeholder="逗號分隔"
                    />
                  </div>
                </div>
              ))}

              {/* v4 新增：WHEN·可用（能力辨識：看到 ___ → 就能做 ___） */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">
                    WHEN·可用（能力辨識：看到 ___ → 就能做 ___）
                  </span>
                  <button
                    onClick={() =>
                      patch({
                        whenData: {
                          ...formData.whenData!,
                          enables: [
                            ...(formData.whenData?.enables || []),
                            { id: `en-${Date.now()}`, trigger: "", capability: "" },
                          ],
                        },
                      })
                    }
                    className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                  >
                    + 新增能力
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic mb-2">
                  僅通用技巧型才寫（一次性證明型通常為空，不強制填——見 v4 手冊 WHEN·可用說明）
                </p>
                {formData.whenData?.enables?.map((en, i) => (
                  <div key={i} className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200 space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-indigo-700 w-12 text-[11px]">看到</span>
                      <input
                        value={en.trigger}
                        onChange={(e) => {
                          const list = [...formData.whenData!.enables!];
                          list[i] = { ...list[i], trigger: e.target.value };
                          patch({ whenData: { ...formData.whenData!, enables: list } });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="例：看到線性時不變系統的微分方程"
                      />
                      <button
                        onClick={() =>
                          patch({
                            whenData: {
                              ...formData.whenData!,
                              enables: formData.whenData!.enables!.filter((_, x) => x !== i),
                            },
                          })
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-emerald-700 w-12 text-[11px]">→就能做</span>
                      <input
                        value={en.capability}
                        onChange={(e) => {
                          const list = [...formData.whenData!.enables!];
                          list[i] = { ...list[i], capability: e.target.value };
                          patch({ whenData: { ...formData.whenData!, enables: list } });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="例：就能把微分運算轉換為頻域代數相乘"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== ORIGIN ===== */}
          {activeTab === "origin" && (
            <div className="space-y-3">
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <label className="font-bold text-amber-900 block mb-1.5">
                  ↯ 當初是哪個問題／矛盾逼出了這個概念？
                </label>
                <textarea
                  rows={5}
                  value={formData.originData?.conflict || ""}
                  onChange={(e) => patch({ originData: { ...formData.originData!, conflict: e.target.value } })}
                  className="w-full p-2.5 rounded-lg border border-amber-300 text-xs leading-relaxed bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">歷史脈絡</label>
                <input
                  value={formData.originData?.historicalContext || ""}
                  onChange={(e) => patch({ originData: { ...formData.originData!, historicalContext: e.target.value } })}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
          )}

          {/* ===== 認識論 ===== */}
          {activeTab === "epistemology" && (
            <div className="space-y-3">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                <b>⊢證</b> 邏輯必然演繹 · <b>⊢歸</b> 經驗歸納 · <b>⊢近</b> 框架近似（嚴禁當成 ⊢證）· <b>⊢約</b> 定義約定 · <b>⊢公設</b> 不可內部證明的基石
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">核心聲明</span>
                <button
                  onClick={() => patch({ claims: [...(formData.claims || []), { id: `c-${Date.now()}`, text: "", epistemicMark: "⊢證" }] })}
                  className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                >
                  + 新增聲明
                </button>
              </div>
              {formData.claims?.map((c, i) => (
                <div key={i} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex gap-2">
                  <select
                    value={c.epistemicMark}
                    onChange={(e) => {
                      const list = [...formData.claims!];
                      list[i] = { ...list[i], epistemicMark: e.target.value as any };
                      patch({ claims: list });
                    }}
                    className="font-mono font-bold text-xs p-1.5 rounded border border-slate-300 bg-white h-fit"
                  >
                    {["⊢證", "⊢歸", "⊢近", "⊢約", "⊢公設"].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={c.text}
                    onChange={(e) => {
                      const list = [...formData.claims!];
                      list[i] = { ...list[i], text: e.target.value };
                      patch({ claims: list });
                    }}
                    className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                    placeholder="聲明內容（支援 LaTeX）"
                  />
                  <input
                    value={c.frameworkNote || ""}
                    onChange={(e) => {
                      const list = [...formData.claims!];
                      list[i] = { ...list[i], frameworkNote: e.target.value };
                      patch({ claims: list });
                    }}
                    className="w-36 p-1.5 rounded border border-slate-300 text-xs bg-white h-fit"
                    placeholder="框架備註"
                  />
                  <button
                    onClick={() => patch({ claims: formData.claims!.filter((_, x) => x !== i) })}
                    className="text-slate-400 hover:text-rose-600 h-fit"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ===== 診斷 Bloom × SOLO ===== */}
          {activeTab === "diagnostics" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <h4 className="font-bold text-slate-800 mb-1">Bloom · 單點認知深度</h4>
                <p className="text-[10px] text-slate-500 mb-2">你對這一個概念鑽多深</p>
                <div className="space-y-1">
                  {["記憶", "理解", "應用", "分析", "評鑑", "創造"].map((lv) => (
                    <button
                      key={lv}
                      onClick={() => patch({ bloomLevel: lv })}
                      className={`w-full text-left px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        formData.bloomLevel === lv
                          ? "bg-emerald-600 text-white border-emerald-700"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {lv}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">SOLO · 知識網整合度</h4>
                <SoloAssessmentPanel
                  cardId={formData.id}
                  soloLevel={formData.soloLevel}
                  soloData={formData.soloData}
                  bloomLevel={formData.bloomLevel}
                  editable
                  onChange={(level, data) => patch({ soloLevel: level, soloData: data })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
