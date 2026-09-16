"use client";

import React, { useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { FONT_OPTIONS, resolveFont } from "@/lib/fonts";
import { SoloAssessmentPanel } from "./SoloAssessmentPanel";
import { ShapeClassifier } from "./ShapeClassifier";
import { runFourPointCheck, collectHowChecks } from "@/lib/inspect";
import { useWorkspaceState } from "@/lib/store";
import {
  SectionHeader,
  SectionBackground,
  SectionConstructionThinking,
  SectionThoughtPoints,
  SectionWhat,
  SectionWhy,
  SectionHow,
  SectionOrigin,
  SectionIntuitionTraps,
  SectionClaims,
  SectionDiagnostics,
  SectionRelations,
  SectionProcessLogs,
  FourPointCheckPanel,
} from "./CardPaperSections";
import {
  X, Sparkles, Save, Trash2, Lock, Eye, Edit3, FileText, Files, Type,
  ChevronLeft, ChevronRight, Sigma, AlertCircle, CheckCircle, AlertTriangle, ShieldCheck, KeyRound,
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
    "basic" | "what" | "why" | "how" | "origin" | "epistemology" | "diagnostics"
  >("basic");

  const cardFont = formData.cardFont || fontFamily;
  const ff = resolveFont(cardFont);

  // v4 思維動作庫：同一標籤在「不同知識點」出現 ≥3 次才够格（同卡多處只算 1 次）
  const wsState = useWorkspaceState();
  const allCards = wsState.cards as any[];
  const wsRelations = (wsState.relations as any[]) || [];
  const wsLogs = (wsState.processLogs as any[]) || [];
  const wsTitles: Record<string, string> = Object.fromEntries(allCards.map((c: any) => [c.id, c.title]));
  const patternLib = (() => {
    const map = new Map<string, { count: number; cards: string[]; questions: string[] }>();
    const bump = (key: string, title: string, question?: string) => {
      const k = (key || "").trim();
      if (!k) return;
      const cur = map.get(k) || { count: 0, cards: [], questions: [] };
      cur.count += 1;
      if (!cur.cards.includes(title)) cur.cards.push(title);
      if (question) cur.questions.push(question);
      map.set(k, cur);
    };
    for (const c of allCards) {
      // 構造思路路徑與 WHY 正文的追問點：同一套標籤庫，累積次數一起算
      for (const tp of c.thoughtPoints || []) bump(tp.modeName, c.title, tp.question);
      // 直覺陷阱：標籤統一為「直覺陷阱」，不另開計數
      for (const it of c.intuitionTraps || []) bump("直覺陷阱", c.title, it.description);
    }
    return Array.from(map.entries()).map(([modeName, v]) => ({ modeName, ...v, cardCount: v.cards.length, eligible: v.cards.length >= 3 }));
  })();

  const patch = (p: Partial<CardData>) => setFormData({ ...formData, ...p });
  const handleSave = () => { onSave(formData); onClose(); };
  const handleSaveAndClose = () => { onSave(formData); onClose(); onExpansionTest(formData); };

  // ============ v5：HOW 分支樹編輯輔助（不可變更新，支援巢狀） ============
  type HowBranchForm = NonNullable<NonNullable<CardData["howData"]>["branches"]>[number];
  const patchHow = (howPatch: Partial<NonNullable<CardData["howData"]>>) =>
    patch({ howData: { status: "uncompiled", ...formData.howData, ...howPatch } as CardData["howData"] });

  const updateBranchDeep = (
    list: HowBranchForm[] | undefined,
    id: string,
    fn: (b: HowBranchForm) => HowBranchForm
  ): HowBranchForm[] =>
    (list || []).map((b) =>
      b.id === id ? fn(b) : { ...b, ...(b.branches ? { branches: updateBranchDeep(b.branches, id, fn) } : {}) }
    );

  const removeBranchDeep = (list: HowBranchForm[] | undefined, id: string): HowBranchForm[] =>
    (list || []).filter((b) => b.id !== id).map((b) => (b.branches ? { ...b, branches: removeBranchDeep(b.branches, id) } : b));

  const addBranchDeep = (list: HowBranchForm[] | undefined, node: HowBranchForm, parentId?: string): HowBranchForm[] => {
    if (!parentId) return [...(list || []), node];
    return (list || []).map((b) =>
      b.id === parentId
        ? { ...b, branches: [...(b.branches || []), node] }
        : { ...b, ...(b.branches ? { branches: addBranchDeep(b.branches, node, parentId) } : {}) }
    );
  };

  /**
   * 分支編輯器（遞迴渲染）。刻意用「函式呼叫」而非子元件：每次輸入都會重建 formData，
   * 若做成子元件會因型別識別變動而卸載重掛、失去輸入焦點。
   */
  const renderBranchEditor = (b: HowBranchForm, path: string, depth: number): React.ReactNode => (
    <div
      key={b.id}
      className={
        depth === 0
          ? "p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5"
          : "p-2.5 bg-white rounded-lg border border-amber-200 space-y-1.5"
      }
    >
      <div className="flex gap-2 items-center">
        <span className="font-bold text-amber-700 text-[10px] w-10 flex-shrink-0" style={{ fontFamily: UI }}>分支 {path}</span>
        <input
          value={b.title}
          placeholder={`分支 ${path} 標題（例：加壓至 $f$ 倍）`}
          onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, title: e.target.value })) })}
          className="flex-1 p-1.5 rounded border border-slate-300 text-xs font-semibold bg-white"
        />
        <label className="flex items-center gap-1 text-xs cursor-pointer" title="能否不經重新推導直接執行">
          <input
            type="checkbox"
            checked={b.isCompiled}
            onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, isCompiled: e.target.checked })) })}
          />
          <span className={b.isCompiled ? "text-emerald-700 font-bold" : "text-amber-700"}>{b.isCompiled ? "✓展" : "⋯"}</span>
        </label>
        <button
          onClick={() => patchHow({ branches: removeBranchDeep(formData.howData?.branches, b.id) })}
          className="text-slate-400 hover:text-rose-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <textarea
        rows={2}
        value={b.action}
        placeholder="可執行動作（支援 LaTeX）"
        onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, action: e.target.value })) })}
        className="w-full p-2 rounded border border-slate-300 text-xs bg-white"
      />
      {/* 區域性 CHECK：只在這個分支內要過的「看到___→檢查___」 */}
      {(b.checks || []).length > 0 && (
        <div className="pl-2 border-l-2 border-indigo-300 space-y-1.5">
          <p className="text-[9px] font-bold text-indigo-700" style={{ fontFamily: UI }}>
            區域性 CHECK（只在分支 {path} 內要過的「看到___→檢查___」）
          </p>
          {(b.checks || []).map((c, ci) => (
            <div key={c.id || ci} className="p-2 bg-indigo-50/50 rounded border border-indigo-200 space-y-1">
              <div className="flex gap-2 items-center">
                <span className="font-bold text-blue-700 w-10 text-[10px] flex-shrink-0" style={{ fontFamily: UI }}>看到</span>
                <input
                  value={c.cue || ""}
                  onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, checks: (x.checks || []).map((cc, j) => (j === ci ? { ...cc, cue: e.target.value } : cc)) })) })}
                  className="flex-1 p-1 rounded border border-slate-300 text-[11px] bg-white"
                  placeholder="例：加壓場合看到「充入惰性氣體」"
                />
                <button
                  onClick={() => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, checks: (x.checks || []).filter((_, j) => j !== ci) })) })}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-bold text-emerald-700 w-10 text-[10px] flex-shrink-0" style={{ fontFamily: UI }}>→檢查</span>
                <input
                  value={c.check || ""}
                  onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, checks: (x.checks || []).map((cc, j) => (j === ci ? { ...cc, check: e.target.value } : cc)) })) })}
                  className="flex-1 p-1 rounded border border-slate-300 text-[11px] bg-white"
                  placeholder="例：先分恆容還是恆壓"
                />
              </div>
              <div className="flex gap-2 items-center">
                <span className="font-bold text-slate-500 w-10 text-[10px] flex-shrink-0" style={{ fontFamily: UI }}>關鍵詞</span>
                <input
                  value={(c.keywords || []).join(", ")}
                  onChange={(e) => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, checks: (x.checks || []).map((cc, j) => (j === ci ? { ...cc, keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : cc)) })) })}
                  className="flex-1 p-1 rounded border border-slate-300 text-[11px] bg-white"
                  placeholder="逗號分隔"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => patchHow({ branches: updateBranchDeep(formData.howData?.branches, b.id, (x) => ({ ...x, checks: [...(x.checks || []), { id: `bc-${Date.now()}`, cue: "", check: "", keywords: [] }] })) })}
          className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold"
        >
          + 區域性 CHECK
        </button>
        <button
          onClick={() => patchHow({ branches: addBranchDeep(formData.howData?.branches, { id: `b-${Date.now()}`, title: "", action: "", isCompiled: false }, b.id) })}
          className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 font-semibold"
        >
          + 子分支（可巢狀）
        </button>
      </div>
      {(b.branches || []).length > 0 && (
        <div className="space-y-1.5 border-l-2 border-amber-300 pl-2">
          {(b.branches || []).map((sb, si) => renderBranchEditor(sb, `${path}${String.fromCharCode(97 + si)}`, depth + 1))}
        </div>
      )}
    </div>
  );

  /** 分頁模式：把八個區塊分配到多張 A4 紙 */
  // v5 順序：構造思路 → ORIGIN（兩個「觸發」放一起對照）→ WHY（含追問點）→ WHAT → HOW（CHECK＋分支＋CAN，WHEN 已併入）→ 認識論 → 診斷
  const PAGES: Array<{ title: string; render: () => React.ReactNode }> = [
    {
      title: "卡頭 · 背景 · 構造思路 · ORIGIN",
      render: () => (
        <>
          <SectionHeader card={formData} font={ff} />
          <SectionBackground card={formData} font={ff} />
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
    { title: "HOW · 程序（CHECK＋分支＋CAN）", render: () => <SectionHow card={formData} font={ff} /> },
    {
      title: "關係邊 · 過程日誌",
      render: () => (<><SectionRelations card={formData} font={ff} relations={wsRelations} cardTitles={wsTitles} /><SectionProcessLogs card={formData} font={ff} processLogs={wsLogs} /></>),
    },
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
                 <SectionBackground card={formData} font={ff} />
                 <SectionConstructionThinking card={formData} font={ff} />
                 <SectionOrigin card={formData} font={ff} />
                 <SectionWhy card={formData} font={ff} />
                 <SectionThoughtPoints card={formData} font={ff} />
                 <SectionWhat card={formData} font={ff} />
                 <SectionHow card={formData} font={ff} />
                 <SectionIntuitionTraps card={formData} font={ff} />
                 <SectionRelations card={formData} font={ff} relations={wsRelations} cardTitles={wsTitles} />
                 <SectionProcessLogs card={formData} font={ff} processLogs={wsLogs} />
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
    { key: "how", label: "HOW（CHECK/分支/CAN）" },
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
              {/* v5：四格省略聲明——省略本身是需要交代的判斷，不能悄悄跳過（WHEN 已併入 HOW，不再是獨立格） */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-700">四格省略聲明</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const slot = e.target.value;
                      if (!slot) return;
                      patch({
                        omittedSlots: [...(formData.omittedSlots || []), { slot, reason: "" }],
                      });
                    }}
                    className="text-[11px] px-1.5 py-0.5 rounded border border-slate-300 bg-white"
                  >
                    <option value="">+ 宣告省略某格…</option>
                    {["WHAT", "WHY", "HOW", "ORIGIN"].map((sl) => (
                      <option key={sl} value={sl}>省略 {sl}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-slate-500 mb-1.5" style={{ fontFamily: UI }}>
                  規則：不是「覺得麻煩」就能省——必須先把該格寫出來，內容若逐字/逐意與其他格重複、無額外資訊量，才允許省；且必須在此註明理由。
                </p>
                {(formData.omittedSlots || []).length === 0 ? (
                  <p className="text-[10px] text-slate-400">未省略任何格（預設）</p>
                ) : (
                  <div className="space-y-1">
                    {formData.omittedSlots!.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex-shrink-0">
                          省略 {o.slot}
                        </span>
                        <input
                          value={o.reason}
                          placeholder="理由：寫出來後發現與哪一格重複？額外資訊量是什麼（应为无）？"
                          onChange={(e) => {
                            const list = [...formData.omittedSlots!];
                            list[i] = { ...list[i], reason: e.target.value };
                            patch({ omittedSlots: list });
                          }}
                          className="flex-1 p-1 rounded border border-slate-300 text-[11px] bg-white"
                        />
                        <button
                          onClick={() => patch({ omittedSlots: formData.omittedSlots!.filter((_, x) => x !== i) })}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              {/* v4：獨立主幹【背景】——三段式（情境 → 精確對象＋情境語言 → 精確對應的問題） */}
              <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/40">
                <div className="font-bold text-slate-800 mb-0.5">【背景】——為什麼需要這個知識點、在什麼情境下面臨什麼問題才被逼出來</div>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                  三段式：①情境（1~2 個同領域具體情境，第二個最好只換一個變數做對照）②精確對象＋情境語言（寫成式子，但仍貼著情境講，不能半路丟掉情境）③精確對應的問題（必須對應回第一段的具體對象，不能寫成泛問句）。
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">第一段 · 情境（同領域對象）</label>
                    <textarea rows={3} value={formData.backgroundData?.situation || ""}
                      onChange={(e) => patch({ backgroundData: { ...formData.backgroundData, situation: e.target.value } })}
                      placeholder="例：把「錄音訊號」做 2 倍放大、延遲 0.5 秒——一個換放大、一個換延遲做對照。別選需要另一領域背景知識的情境（如 RC 電路）。"
                      className="w-full p-1.5 rounded border border-sky-300 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">第二段 · 精確對象＋情境語言（先給形式、再給動機；一般化後仍貼著情境講）</label>
                    <textarea rows={3} value={formData.backgroundData?.preciseObject || ""}
                      onChange={(e) => patch({ backgroundData: { ...formData.backgroundData, preciseObject: e.target.value } })}
                      placeholder="例：L[x(t)] = 2x(t-0.5)。推廣成 L[ax+by]=aL(x)+bL(y) 之後，仍要繼續用「人聲」「背景音樂」這類情境語言，不能只剩抽象 x(t)、y(t)。"
                      className="w-full p-1.5 rounded border border-sky-300 text-xs bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">第三段 · 精確對應的問題（對應回第一段對象）</label>
                    <textarea rows={2} value={formData.backgroundData?.preciseQuestion || ""}
                      onChange={(e) => patch({ backgroundData: { ...formData.backgroundData, preciseQuestion: e.target.value } })}
                      placeholder="例：對「這段錄音 x(t)」，有沒有什麼簡單的組成單位可以拆解它？（而非「任意訊號能不能被拆成這種形式疊加」這種脫離情境的泛問句）"
                      className="w-full p-1.5 rounded border border-sky-300 text-xs bg-white" />
                  </div>
                </div>
              </div>

              {/* v4：理解問題信心校準（Polya「理解問題」階段；與 WHY 的 IOED 平行但獨立，不能合併） */}
              {(() => {
                const cal = formData.constructionCalibration;
                const before = cal?.confidenceBefore ?? 0;
                const after = cal?.confidenceAfter ?? 0;
                const both = before > 0 && after > 0;
                const delta = after - before;
                const dropped = both && delta < 0;
                const setCal = (patchCal: Partial<NonNullable<CardData["constructionCalibration"]>>) =>
                  patch({
                    constructionCalibration: {
                      confidenceBefore: before,
                      confidenceAfter: after,
                      blindSpotNote: cal?.blindSpotNote,
                      ...patchCal,
                    },
                  });
                return (
                  <div className={`p-3 rounded-lg border ${dropped ? "bg-rose-50 border-rose-300" : "bg-teal-50/60 border-teal-200"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <span className="font-bold text-slate-800">理解問題信心校準（動筆寫【背景】前先做）</span>
                      {both && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dropped ? "bg-rose-600 text-white" : "bg-teal-600 text-white"}`}>
                          {before}★ → {after}★（{delta >= 0 ? "+" : ""}{delta}）{dropped ? " 理解問題階段盲區" : " 可進 WHY"}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-600 mb-2 leading-relaxed">
                      這輪測的是「我有多確定自己真的抓到這題在問什麼」，<b>不是</b>「我會不會解」；WHY 的 IOED 才測「為什麼結論成立」。
                      兩者分開做，才分得出卡在理解問題還是卡在推理機制。
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">第一步：只看名稱／原始問題，不查資料、不回想解法</label>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <button key={v} onClick={() => setCal({ confidenceBefore: v })}
                              className={`px-2.5 py-1 rounded font-bold ${before === v ? "bg-teal-600 text-white" : "bg-white text-slate-700 border border-slate-300"}`}>
                              {v}★
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-1">第三步：寫完【背景】三段式後，重新打同一個分</label>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <button key={v} onClick={() => setCal({ confidenceAfter: v })}
                              className={`px-2.5 py-1 rounded font-bold ${after === v ? (dropped ? "bg-rose-600 text-white" : "bg-teal-700 text-white") : "bg-white text-slate-700 border border-slate-300"}`}>
                              {v}★
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {dropped && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] font-bold text-rose-800">
                          分數下降 → 先不進構造思路／WHY。帶著沒釐清的問題理解硬寫，推理再嚴謹也是在回答錯的問題。回頭把【背景】補完整，並把這次盲區記入過程日誌。
                        </p>
                        <input
                          value={cal?.blindSpotNote || ""}
                          onChange={(e) => setCal({ blindSpotNote: e.target.value })}
                          placeholder="理解問題階段盲區：我原本以為題目在問…，寫完①②才發現其實在問…"
                          className="w-full p-1.5 rounded border border-rose-300 bg-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* v4 新增：構造思路（邏輯觸發，與 ORIGIN 歷史觸發分開） */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  構造思路（選填——邏輯觸發，與 ORIGIN 歷史觸發分開：①契機：卡在哪個困難 ②路徑：怎麼一步步摸到答案）
                </label>
                <textarea
                  rows={4}
                  value={formData.constructionThinking || ""}
                  onChange={(e) => patch({ constructionThinking: e.target.value })}
                  placeholder="例：蒸汽機效率上限不明，工程界爭論不休。切入點不是直接算效率，而是問：『如果存在一台效率超過可逆極限的機器，能不能用它造出違反熱二律的複合裝置？』——這個反證法的切入角度，把「求極值」問題轉化為「檢驗一致性」問題，才是整套推導真正的契機。"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed bg-teal-50/40 border-teal-200"
                />
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-slate-600">
                  <MathText text={formData.constructionThinking || ""} />
                </div>

                {/* v4：候選登場（決策敘事，不做驗證）+ 計畫（構造思路收尾） */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-teal-800 block mb-1">候選登場 · 要求（往回追溯構造思路已確立的那個「要求」）</label>
                      <textarea rows={2} value={formData.candidate?.requirement || ""}
                        onChange={(e) => patch({ candidate: { ...formData.candidate, requirement: e.target.value } })}
                        placeholder="例：要求是「通過運算後形式不變」——不是「形式簡單、別處常用」這種泛泛優點"
                        className="w-full p-1.5 rounded border border-teal-300 text-xs bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-teal-800 block mb-1">候選工具 / building block（扣住 requirement 的具體形式）</label>
                      <textarea rows={2} value={formData.candidate?.candidateForm || ""}
                        onChange={(e) => patch({ candidate: { ...formData.candidate, candidateForm: e.target.value } })}
                        placeholder="例：e^(iωt)——從「對微分而言微分完還是自己乘個係數 → 指數型函數」這個摸索把它挑出來"
                        className="w-full p-1.5 rounded border border-teal-300 text-xs bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-teal-800 block mb-1">為什麼偏偏是這個形式（摸索過程，非泛泛優點羅列）</label>
                      <textarea rows={2} value={formData.candidate?.motivation || ""}
                        onChange={(e) => patch({ candidate: { ...formData.candidate, motivation: e.target.value } })}
                        placeholder="判斷：把候選人換成任何別的東西，這段動機還成立嗎？能＝泛泛優點，要補摸索"
                        className="w-full p-1.5 rounded border border-teal-300 text-xs bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-teal-800 block mb-1">擴展方案（單一候選不足時的下一步；仍是決策層級）</label>
                      <textarea rows={2} value={formData.candidate?.expansion || ""}
                        onChange={(e) => patch({ candidate: { ...formData.candidate, expansion: e.target.value } })}
                        placeholder="例：多個候選人＋權重係數"
                        className="w-full p-1.5 rounded border border-teal-300 text-xs bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-teal-800 block mb-1">擴展牽涉的更深問題（若有：老實標「超出本卡範圍，需另開卡」）</label>
                      <textarea rows={2} value={formData.candidate?.expansionOutOfScope || ""}
                        onChange={(e) => patch({ candidate: { ...formData.candidate, expansionOutOfScope: e.target.value } })}
                        placeholder="例：這樣組合真能還原任意目標嗎、係數唯一嗎——超出本卡範圍，需另開卡（對應 WHY 的 [地位:公設] 誠實標註）。禁「這樣才有足夠自由度」式空話。"
                        className="w-full p-1.5 rounded border border-amber-300 bg-amber-50/40 text-xs" />
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-slate-700">計畫（構造思路收尾：打算證什麼、用什麼方法、範圍劃在哪）＋ 順序依賴</span>
                      <button onClick={() => patch({ plan: { ...formData.plan, steps: [...(formData.plan?.steps || []), { id: `p-${Date.now()}`, label: "", rationale: "" }] } })}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold">+ 新增步驟</button>
                    </div>
                    <p className="text-[10px] text-slate-500 mb-1.5">不只列「要做哪幾件事」，要說明為什麼是這個順序、後一步如何依賴前一步的結論（打亂順序還成立＝只是清單不是計畫）。</p>
                    {(formData.plan?.steps || []).length === 0
                      ? <p className="text-[11px] text-slate-400 italic">尚未寫計畫（構造思路沒收尾，會觸發審查提示）</p>
                      : (formData.plan!.steps || []).map((st, i) => (
                          <div key={st.id || i} className="flex items-start gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-slate-500 mt-1 w-4">{i + 1}.</span>
                            <div className="flex-1 space-y-1">
                              <input value={st.label} placeholder="要做的事（例：先證特徵函數性質）"
                                onChange={(e) => { const l = [...(formData.plan!.steps || [])]; l[i] = { ...l[i], label: e.target.value }; patch({ plan: { ...formData.plan!, steps: l } }); }}
                                className="w-full p-1 rounded border border-slate-300 text-xs bg-white font-semibold" />
                              <input value={st.rationale} placeholder="為什麼必須是這個順序／為什麼這步缺一不可（例：這是候選人能不能用的先決條件）"
                                onChange={(e) => { const l = [...(formData.plan!.steps || [])]; l[i] = { ...l[i], rationale: e.target.value }; patch({ plan: { ...formData.plan!, steps: l } }); }}
                                className="w-full p-1 rounded border border-slate-300 text-xs bg-white" />
                            </div>
                            <button onClick={() => patch({ plan: { ...formData.plan!, steps: (formData.plan!.steps || []).filter((_, x) => x !== i) } })}
                              className="text-slate-400 hover:text-rose-600 mt-1"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                    <input value={formData.plan?.ranges || ""} placeholder="範圍誠實標註（超出本卡範圍的部分，例：『組合能否唯一還原任意目標，超出本卡範圍，需另開卡』）"
                      onChange={(e) => patch({ plan: { ...formData.plan, ranges: e.target.value } })}
                      className="w-full p-1 rounded border border-amber-300 bg-amber-50/40 text-xs" />
                  </div>
                </div>

                {/* v4：八點自我檢查＋符號綁定（與 WHY 正文同一套規則） */}
                <div className="mt-2">
                  <FourPointCheckPanel
                    report={runFourPointCheck(formData.constructionThinking, "constructionThinking")}
                    variant="compact"
                  />
                </div>
              </div>

              {/* v4 新增：追問點（嵌入在用戶判斷的 WHY/HOW 關鍵轉折處） */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700">
                    追問點——【追問·思維模式名】問題 →（答案）。放在「構造思路的路徑」（Polya 啟發式自問）或「WHY 正文關鍵轉折」，同一套規則、同一套標籤庫
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
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-600">位置</label>
                        <select
                          value={tp.placement || "why"}
                          onChange={(e) => {
                            const list = [...formData.thoughtPoints!];
                            list[i] = { ...list[i], placement: e.target.value as "construction" | "why" };
                            patch({ thoughtPoints: list });
                          }}
                          className="text-[11px] px-1.5 py-0.5 rounded border border-orange-300 bg-white"
                        >
                          <option value="construction">構造思路 · 路徑（摸索時真的問過自己的問題）</option>
                          <option value="why">WHY 正文 · 關鍵轉折（懂了這步就懂整個論證）</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block mb-1">思維模式名（具體招式；同一標籤跨卡 ≥3 次即入思維動作庫）</label>
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
                          進入追問測試（逐個閉卷作答）
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* v4：思維動作庫（跨卡片統計，出現 ≥3 次才够格整理成條目） */}
              {patternLib.length > 0 && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-[11px] font-bold text-slate-700 mb-1.5" style={{ fontFamily: UI }}>
                    思維動作庫 · 各招式在本工作區被想起的次數
                  </p>
                  <div className="space-y-1">
                    {patternLib.map((p) => (
                      <div
                        key={p.modeName}
                        className={`flex items-start gap-2 text-[11px] rounded px-2 py-1 border ${
                          p.eligible ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"
                        }`}
                      >
                        <span className="font-bold text-slate-800 flex-shrink-0">{p.modeName}</span>
                        <span className={`px-1 rounded text-[9px] font-mono flex-shrink-0 ${p.eligible ? "bg-emerald-200 text-emerald-900" : "bg-slate-200 text-slate-600"}`} title={`共出現 ${p.count} 次，橫跨 ${(p as any).cardCount ?? p.cards.length} 張卡`}>
                          {(p as any).cardCount ?? p.cards.length} 卡{p.count !== ((p as any).cardCount ?? p.cards.length) ? `／${p.count} 次` : ""}
                        </span>
                        <span className="text-slate-500 flex-1 truncate">{p.cards.join("、")}</span>
                        {p.eligible && (
                          <span className="text-[9px] text-emerald-700 font-bold flex-shrink-0" style={{ fontFamily: UI }}>
                            够格入庫
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5" style={{ fontFamily: UI }}>
                    記錄的重點是「這一招通常在什麼情境下該被想起」，不是招式定義本身。
                  </p>
                </div>
              )}

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

              <datalist id="perspective-code-suggestions">
                {["幾何視角", "代數視角", "直覺視角", "計算視角", "算符視角", "應用視角", "物理視角", "經濟學視角", "信息論視角", "操作視角", "統計視角", "拓撲視角", "歷史演化視角"].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 flex items-center gap-2 flex-wrap">
                    <span>多視角理解（自由命名借用哪個學科／框架的工具箱；下限 3 個，不設上限、不要求正交）</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${(formData.whatData?.perspectives?.length || 0) >= 3 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {formData.whatData?.perspectives?.length || 0} / 3
                    </span>
                  </span>
                  <button
                    onClick={() => patch({
                      whatData: {
                        ...formData.whatData!,
                        perspectives: [...(formData.whatData?.perspectives || []), { code: "", label: "", content: "" }],
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
                      <input
                        list="perspective-code-suggestions"
                        value={p.code}
                        onChange={(e) => {
                          const list = [...formData.whatData!.perspectives];
                          list[i] = { ...list[i], code: e.target.value };
                          patch({ whatData: { ...formData.whatData!, perspectives: list } });
                        }}
                        placeholder="視角名（自由命名）"
                        className="w-28 font-bold text-xs p-1 rounded border border-slate-300 bg-white h-fit"
                      />
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

              {/* v4：五個方向延伸（推深／推淺／推廣／推窄／翻譯）——強烈建議，不強制寫滿；挖不到不用硬湊 */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 block">五方向延伸——讓「這是什麼」的說明範圍更完整（每個方向至少自問一次「有沒有東西可挖」）</span>
                <p className="text-[10px] text-slate-500">
                  「視角」是拿別的學科語言重講<b>這個知識點</b>；「翻譯」反過來，把<b>外面的知識／現象</b>收進這個知識點的語言裡講（例：用數學描述經濟學現象）。
                </p>
                <p className="text-[10px] text-slate-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <b>洞見檢查</b>：每個方向寫完自問「拿掉這句，讀者會不會真的損失理解？」純事實（A 可用在 B 上）不夠格，要點出為什麼重要（更大理論脈絡／真實後果／一個具體取捨或張力）。讀完要讓讀者「原來如此」而非「喔，知道了」。
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: "deeper", label: "推深", hint: "是什麼更底層的東西讓這件事成立？（開放方向，不是重寫 WHY 那條封閉推理鏈）" },
                    { key: "shallower", label: "推淺", hint: "這件事能推出什麼、撐起什麼後果／應用？" },
                    { key: "generalize", label: "推廣", hint: "放寬條件／範疇會變成什麼？（例：函數 → 映射）" },
                    { key: "specialize", label: "推窄", hint: "收緊條件／範疇會變成什麼特例？" },
                    { key: "translate", label: "翻譯", hint: "把別的知識／現象，用這個知識點的語言重新講一次（與視角相反）" },
                  ].map((d) => (
                    <div key={d.key} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="text-[10px] font-bold text-slate-700 block mb-1">{d.label} <span className="font-normal text-slate-500">· {d.hint}</span></label>
                      <textarea
                        rows={2}
                        value={((formData.whatData?.extensions || {}) as Record<string, string | undefined>)[d.key] || ""}
                        onChange={(e) => patch({
                          whatData: {
                            ...formData.whatData!,
                            extensions: { ...(formData.whatData?.extensions || {}), [d.key]: e.target.value },
                          },
                        })}
                        className="w-full p-1.5 rounded border border-slate-300 text-xs bg-white"
                      />
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
                {/* v4：八點自我檢查＋符號綁定（WHY 正文與構造思路同一套規則） */}
                <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <FourPointCheckPanel
                    report={runFourPointCheck(formData.whyData?.fullReasoning, "whyFullReasoning")}
                  />
                </div>

                {/* v4：場／分布類物件的「形狀」三選一（存入卡片；避免在三個意義間無聲切換） */}
                <div className="p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-200">
                  <p className="text-[11px] font-bold text-indigo-900 mb-1" style={{ fontFamily: UI }}>
                    若對象是場／分布類（充滿空間、每點有取值）：「形狀」一詞三選一，講清楚是哪個
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ["not-applicable", "不適用", "本卡對象不是場／分布類"],
                      ["①", "① 分布範圍", "佔了多大一塊"],
                      ["②", "② 取值朝向", "某點矢量指向哪裡"],
                      ["③", "③ 幾個對象", "自由度計數"],
                    ].map(([v, label, hint]) => {
                      const cur = (formData.whyData as any)?.fieldShape || "not-applicable";
                      const on = cur === v;
                      return (
                        <button
                          key={v}
                          onClick={() => patch({ whyData: { ...formData.whyData!, fieldShape: v } as any })}
                          title={hint}
                          className={`text-[10px] px-2 py-1 rounded border font-semibold ${on ? "bg-indigo-600 text-white border-indigo-700" : "bg-white border-indigo-200 text-slate-700 hover:bg-indigo-50"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
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
                      assumptions: [...(formData.assumptions || []), { id: `a-${Date.now()}`, name: "", status: "locked", description: "", kind: "situation" } as any],
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold"
                  >
                    + 新增假設
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mb-1.5">
                  只收「這個具體情境／思想實驗設定了什麼條件」（一次性設定）。「這個技巧通常在什麼範圍成立」（如訊號需絕對可積）屬於適用範圍，請標為「適用範圍」並移到 HOW 的 CHECK／WHY 前提說明。
                </p>
                <div className="space-y-1.5">
                  {formData.assumptions?.map((a, i) => (
                    <div key={i} className="p-2 bg-amber-50/40 rounded-lg border border-amber-200 space-y-1.5">
                      <div className="flex gap-2">
                        <select
                          value={(a as any).kind || "situation"}
                          onChange={(e) => {
                            const list = [...formData.assumptions!];
                            list[i] = { ...list[i], kind: e.target.value } as any;
                            patch({ assumptions: list });
                          }}
                          className="text-[10px] p-1 rounded border border-amber-300 bg-white font-semibold flex-shrink-0"
                          title="一次性情境設定 vs 適用範圍前提"
                        >
                          <option value="situation">一次性設定</option>
                          <option value="scope">適用範圍（應移出）</option>
                        </select>
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
                      {(a as any).kind === "scope" && (
                        <p className="text-[10px] text-amber-800 bg-amber-100/60 rounded px-2 py-1">
                          此條屬於適用範圍前提：請搬到 HOW 的 CHECK（看到___→檢查___）或 WHY 的前提說明，不要留在假設鎖定清單。
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* v5：直覺陷阱——以【追問·直覺陷阱】格式呈現；讀者先預測「我大概會怎麼誤會」再看正確理解。
                  不是 HOW·CHECK（何時失效／可用）、不是 [警示]、不是堵塞感協議（標註遺漏）。標籤共用 ≥3 次門檻。 */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    【追問·直覺陷阱】推導正確、但直覺容易誤判成別的東西
                  </span>
                  <button
                    onClick={() => patch({
                      intuitionTraps: [
                        ...(formData.intuitionTraps || []),
                        { id: `it-${Date.now()}`, description: "", whyMisleading: "", correctUnderstanding: "", passed: false },
                      ],
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold"
                  >
                    + 新增直覺陷阱
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  跟 HOW·CHECK 不同：CHECK 問「這技巧什麼時候失效／能用」；直覺陷阱問「這技巧本身哪裡違反直覺、容易被腦補成錯的東西」。例：負頻率 −ω 不是數學假象，是複平面反向旋轉的向量。
                </p>
                {formData.intuitionTraps?.map((it, i) => (
                  <div key={it.id || i} className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-purple-900">問題固定：「常見的直覺誤判是什麼？」→ 讀者先想 →（答案）</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!it.passed}
                            onChange={(e) => {
                              const list = [...formData.intuitionTraps!];
                              list[i] = { ...list[i], passed: e.target.checked };
                              patch({ intuitionTraps: list });
                            }}
                          />
                          <span className={it.passed ? "text-emerald-700 font-bold" : "text-amber-700"}>{it.passed ? "[已推出]" : "尚未推出"}</span>
                        </label>
                        <button
                          onClick={() => patch({ intuitionTraps: formData.intuitionTraps!.filter((_, x) => x !== i) })}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={it.description}
                      onChange={(e) => { const list = [...formData.intuitionTraps!]; list[i] = { ...list[i], description: e.target.value }; patch({ intuitionTraps: list }); }}
                      placeholder="常見誤判：大家通常會把它誤會成…"
                      className="w-full p-1.5 rounded border border-purple-300 text-xs bg-white"
                    />
                    <input
                      value={it.whyMisleading}
                      onChange={(e) => { const list = [...formData.intuitionTraps!]; list[i] = { ...list[i], whyMisleading: e.target.value }; patch({ intuitionTraps: list }); }}
                      placeholder="錯在哪裡：為什麼直覺會這樣走偏"
                      className="w-full p-1.5 rounded border border-purple-300 text-xs bg-white"
                    />
                    <textarea
                      rows={2}
                      value={it.correctUnderstanding}
                      onChange={(e) => { const list = [...formData.intuitionTraps!]; list[i] = { ...list[i], correctUnderstanding: e.target.value }; patch({ intuitionTraps: list }); }}
                      placeholder="正確理解（支援 LaTeX）"
                      className="w-full p-1.5 rounded border border-purple-300 text-xs bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== HOW（v5：CHECK 橫跨性前置關卡＋分支（可巢狀）＋CAN 下游解鎖；WHEN 已併入） ===== */}
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
                    HOW 閉卷重推／追問測試
                  </button>
                  <button
                    onClick={() => patchHow({ status: formData.howData?.status === "compiled" ? "uncompiled" : "compiled" })}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white text-xs"
                  >
                    切換
                  </button>
                </div>
              </div>

              {/* v5: WHY 視角失效模式 → HOW CHECK 映射（原 WHEN 檢查映射） */}
              {(formData.whyData?.perspective1 || formData.whyData?.perspective2) && (
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> WHY 視角失效模式映射
                    </span>
                    <span className="text-[10px] text-indigo-700">每個失效模式必須有對應的 HOW CHECK（橫跨性或區域性）</span>
                  </div>
                  {[formData.whyData?.perspective1, formData.whyData?.perspective2].map((p, i) => {
                    if (!p?.failureMode) return null;
                    const mappedCheck = collectHowChecks(formData).find(t =>
                      (t.cue || "").includes(p.name) || (t.check || "").includes(p.name) || (t.check || "").includes("失效")
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
                            ✓ 已有 HOW CHECK：「{mappedCheck.cue}」→「{mappedCheck.check}」
                          </div>
                        ) : (
                          <button
                            onClick={() => patchHow({
                              checks: [...(formData.howData?.checks || []), {
                                id: `chk-${Date.now()}`,
                                cue: `在 ${p.name} 視角下`,
                                check: `檢查是否遇到：${p.failureMode}`,
                                keywords: [p.name, "失效模式"]
                              }]
                            })}
                            className="mt-1 text-[10px] px-2 py-0.5 rounded bg-amber-600 text-white hover:bg-amber-700"
                          >
                            + 建立 CHECK 檢查項
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* v5：CHECK · 橫跨性前置關卡 */}
              <div className="p-3 bg-indigo-50/40 rounded-lg border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-900 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" /> CHECK · 橫跨性前置關卡（看到 ___ → 檢查 ___）
                  </span>
                  <button
                    onClick={() => patchHow({
                      checks: [...(formData.howData?.checks || []), { id: `chk-${Date.now()}`, cue: "", check: "", keywords: [] }],
                    })}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                  >
                    + 新增檢查項
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  橫跨整個程序、不限單一分支的把關寫這層（v5 起 WHEN·警示併入這裡）；只在某個分支內要查的，寫進該分支的「區域性 CHECK」。不要抽象套話（如『在高維時注意』）。
                </p>
                {(formData.howData?.checks || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">無橫跨性檢查項</p>
                ) : (formData.howData!.checks || []).map((t, i) => (
                  <div key={t.id || i} className="p-2.5 bg-white rounded-lg border border-indigo-200 space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-blue-700 w-12 text-[11px]">看到</span>
                      <input
                        value={t.cue}
                        onChange={(e) => {
                          const list = [...(formData.howData!.checks || [])];
                          list[i] = { ...list[i], cue: e.target.value };
                          patchHow({ checks: list });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="具體關鍵詞，例：「催化劑」"
                      />
                      <button
                        onClick={() => patchHow({ checks: (formData.howData!.checks || []).filter((_, x) => x !== i) })}
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
                          const list = [...(formData.howData!.checks || [])];
                          list[i] = { ...list[i], check: e.target.value };
                          patchHow({ checks: list });
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
                          const list = [...(formData.howData!.checks || [])];
                          list[i] = { ...list[i], keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                          patchHow({ checks: list });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="逗號分隔"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* v5：分支（可巢狀，含區域性 CHECK） */}
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">分支（可巢狀，含區域性 CHECK）</span>
                  <button
                    onClick={() => patchHow({ branches: addBranchDeep(formData.howData?.branches, { id: `b-${Date.now()}`, title: "", action: "", isCompiled: false }) })}
                    className="text-[11px] px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
                  >
                    + 新增分支
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  先過上面的 CHECK 關卡再進分支執行。分支可再開子分支（例：「算擾動瞬間的 $Q$」之下，加濃度／加壓／升溫各走一支）；只在某一支內要查的事，寫該分支的區域性 CHECK。
                </p>
                {(formData.howData?.branches || []).length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">尚未填寫分支</p>
                ) : (
                  <div className="space-y-2">
                    {(formData.howData?.branches || []).map((b, i) => renderBranchEditor(b, `${i + 1}`, 0))}
                  </div>
                )}
              </div>

              {/* v5：CAN · 下游解鎖（原 WHEN·可用併入） */}
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1">
                    <KeyRound className="w-4 h-4 text-emerald-600" />
                    CAN · 下游解鎖（看到 ___ → 就能做 ___）
                  </span>
                  <button
                    onClick={() =>
                      patchHow({
                        can: [
                          ...(formData.howData?.can || []),
                          { id: `can-${Date.now()}`, trigger: "", capability: "" },
                        ],
                      })
                    }
                    className="text-[11px] px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold"
                  >
                    + 新增解鎖
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 italic mb-2">
                  僅通用技巧型才寫（一次性證明型通常為空，不強制填）；HOW 編譯（✓展）後這些能力才真正解鎖。
                </p>
                {(formData.howData?.can || []).map((en, i) => (
                  <div key={en.id || i} className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200 space-y-2 mb-2">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-indigo-700 w-12 text-[11px]">看到</span>
                      <input
                        value={en.trigger}
                        onChange={(e) => {
                          const list = [...(formData.howData!.can || [])];
                          list[i] = { ...list[i], trigger: e.target.value };
                          patchHow({ can: list });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="例：看到線性時不變系統的微分方程"
                      />
                      <button
                        onClick={() =>
                          patchHow({
                            can: (formData.howData!.can || []).filter((_, x) => x !== i),
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
                          const list = [...(formData.howData!.can || [])];
                          list[i] = { ...list[i], capability: e.target.value };
                          patchHow({ can: list });
                        }}
                        className="flex-1 p-1.5 rounded border border-slate-300 text-xs bg-white"
                        placeholder="例：就能把微分運算轉換為頻域代數相乘"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* v5：邊界約束（原 WHEN·boundaryNotes 併入） */}
              <div className="pt-2 border-t border-slate-200">
                <label className="font-bold text-slate-700 block mb-1">邊界約束（程序邊界外的情形怎麼處理）</label>
                <input
                  value={formData.howData?.boundaryNotes || ""}
                  onChange={(e) => patchHow({ boundaryNotes: e.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs"
                  placeholder="例：當熱庫熱容有限時，熱源溫度會隨排熱變化，需改用微分積分平均溫度。"
                />
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
