"use client";

import React from "react";
import { MathText } from "./MathText";
import { Maximize2, Eye } from "lucide-react";
import { resolveFont } from "@/lib/fonts";
import { runFourPointCheckOnCard, STATUS_COMPILED, STATUS_UNCOMPILED } from "@/lib/inspect";
import { SHAPE_DEFS } from "./ShapeClassifier";

export interface CardData {
  id: string;
  workspaceId: string;
  title: string;
  domain: string;
  granularity: string;
  backgroundDescription?: string;
  cardFont?: string;
  pageMode?: "single" | "paged";
  constructionThinking?: string; // v4: 邏輯觸發，與 ORIGIN 歷史觸發分開
  /**
   * v4：「理解問題」信心校準（Polya 理解問題階段）。
   * 與 WHY 的 IOED 是平行但獨立的兩次校準：這輪測「有沒有搞懂題目在問什麼」，
   * WHY 那輪測「有沒有搞懂為什麼結論成立」，不能合併。
   */
  constructionCalibration?: {
    confidenceBefore: number; // 只看名稱／原始問題，不查資料、不回想解法
    confidenceAfter: number;  // 寫完【背景】三段式後
    blindSpotNote?: string;   // 掉分時：記「理解問題階段盲區」，先不進構造思路／WHY
  };
  /**
   * v4：獨立主幹【背景】——回答「為什麼需要、在什麼情境下面臨什麼問題才被逼出來」，
   * 產出一個精確表述的問題；構造思路接著回答「怎麼想到用哪個候選工具去解決」。
   */
  backgroundData?: {
    situation?: string;      // 第一段·情境：1~2 個引出問題的具體情境（同領域對象）
    preciseObject?: string;  // 第二段·精確對象＋情境語言：精確數學對象／式子，但仍貼著情境講
    preciseQuestion?: string; // 第三段·精確對應的問題：必須對應回第一段的具體對象
  };
  /** v4：構造思路的收尾【計畫】——只講「打算證什麼、用什麼方法、範圍劃在哪」，完全不涉及執行與證法 */
  plan?: {
    steps?: Array<{ id: string; label: string; rationale: string }>; // 每步 + 為什麼是這順序／為什麼缺一不可
    ranges?: string; // 範圍誠實標註（超出本卡範圍的部分）
  };
  /** v4：候選登場（決策敘事，不做驗證）——扣住要求的摸索：從「要求」一步步到這個具體候選形式 */
  candidate?: {
    requirement?: string;   // 往回追溯：構造思路已確立的那個「要求」
    candidateForm?: string; // 具體候選工具／building block 形式
    motivation?: string;    // 為什麼偏偏是這個形式（扣住 candidateForm 的摸索，非泛泛優點）
    /** v4：擴展方案與範圍誠實標註（單一候選不足時的下一步；牽涉更深獨立問題須老實標「超出本卡範圍」） */
    expansion?: string;
    expansionOutOfScope?: string;
  };
  thoughtPoints?: Array<{
    id: string;
    modeName: string; // 思維模式名，如「反證法起手式」
    question: string;
    answer: string;
    passed: boolean; // [已推出]：能不看答案自己推出
    note?: string;   // 卡在哪一步
    createdAt?: string;
    /** v4：追問點放在構造思路的「路徑」還是 WHY 正文——同一套規則、同一套標籤庫 */
    placement?: "construction" | "why";
    lastTestedAt?: string;
  }>;
  thinkingPatterns?: Array<{
    id: string;
    modeName: string;
    description: string;
    occurrenceCount: number;
    sourceCardIds: string[];
  }>;
  // v4：直覺陷阱（推導正確但直覺容易誤判）——以【追問·直覺陷阱】格式呈現，
  // 讀者先自己想「我大概會怎麼誤會」，再看正確理解；標籤「直覺陷阱」計入 ≥3 次門檻
  intuitionTraps?: Array<{
    id: string;
    description: string;          // 常見的直覺誤判是什麼
    whyMisleading: string;        // 為什麼直覺會錯
    correctUnderstanding: string; // 正確理解
    passed?: boolean;             // [已推出]
    note?: string;
  }>;
  reasoningShape: string; // A|B|C|D|E|COMPOSITE
  compositeShapes?: string[];
  compositeNote?: string;
  shapeRationale?: string;
  shapeConfidence?: number;
  shapeAccepted?: boolean;
  whatData?: {
    summary: string;
    /** v4：視角標籤不再限定 G/L/I/C/O/A/P，`code` 為自由命名（如「經濟學視角」）；下限 3 個 */
    perspectives: Array<{ code: string; label: string; content: string }>;
    distinctionFromHow: string;
    /** v4：五個方向延伸（強烈建議，不強制寫滿；挖不到不用硬湊） */
    extensions?: {
      deeper?: string;     // 推深：奠基在什麼更底層的知識上（開放方向，不是重寫 WHY）
      shallower?: string;  // 推淺：能推出什麼／撐起什麼後果／應用
      generalize?: string; // 推廣：放寬條件／範疇會變成什麼
      specialize?: string; // 推窄：收緊條件／範疇會變成什麼特例
      translate?: string;  // 翻譯：把別的知識／現象，用這個知識點的語言重講一次（與「視角」方向相反）
    };
  };
  whyData?: {
    confidenceBefore: number;
    closedBookDraft: string;
    fullReasoning: string;
    confidenceAfter: number;
    perspective1?: { name: string; failureMode: string; content: string };
    perspective2?: { name: string; failureMode: string; content: string };
    subGoals?: Array<{
      id: string;
      goal: string;
      requiredParts: string[];
      whyNecessary: string;
      whySufficient: string;
    }>;
    /** v4：場／分布類「形狀」三選一（無此類對象時選 not-applicable，不要無聲切換） */
    fieldShape?: "not-applicable" | "①" | "②" | "③";
  };
  assumptions?: Array<{
    id: string;
    name: string;
    status: "locked" | "smuggled_candidate";
    description: string;
    /** v4：假設鎖定 vs 適用範圍。一次性情境設定 → situation；「通常在什麼範圍成立」→ scope（該寫 WHEN/WHY 前提說明） */
    kind?: "situation" | "scope";
  }>;
  /**
   * v5：HOW = CHECK 橫跨性前置關卡 ＋ 分支（可巢狀，含區域性 CHECK）＋ CAN 下游解鎖。
   * WHEN 整格併入 HOW：原 WHEN·警示（triggers）→ checks（橫跨性）、
   * 原 HOW steps → branches（可巢狀）、原 WHEN·可用（enables）→ can。
   */
  howData?: {
    /** CHECK · 橫跨性前置關卡——進程序前全程把關的「看到___→檢查___」（橫跨全部分支） */
    checks?: Array<{ id: string; cue: string; check: string; keywords?: string[] }>;
    /** 分支（可巢狀）；每個分支可帶自己的區域性 CHECK（只在該分支內要過的關卡） */
    branches?: Array<{
      id: string;
      title: string;
      action: string;
      isCompiled: boolean;
      checks?: Array<{ id: string; cue: string; check: string; keywords?: string[] }>;
      /** 子分支（可巢狀，結構同上） */
      branches?: Array<any>;
    }>;
    /** CAN · 下游解鎖——編譯後「看到___→就能做___」（僅通用技巧型才寫） */
    can?: Array<{ id: string; trigger: string; capability: string }>;
    status: "compiled" | "uncompiled";
    testNotes?: string;
    /** 邊界約束（原 WHEN·boundaryNotes 併入） */
    boundaryNotes?: string;
  };
  originData?: { conflict: string; historicalContext?: string };
  claims?: Array<{
    id: string;
    text: string;
    epistemicMark: "⊢證" | "⊢歸" | "⊢近" | "⊢約" | "⊢公設";
    frameworkNote?: string;
    anchor?: string; // v4：指回 WHY 具體段落的錨點（如「[見WHY視角2]」）
  }>;
  /** v4：省略某格必須在卡頭註明理由，不能悄悄跳過 */
  omittedSlots?: Array<{ slot: string; reason: string }>;
  bloomLevel: string;
  soloLevel: string;
  soloData?: {
    declaredLevel: string;
    evidence: Array<{ id: string; level: string; text: string }>;
    autoSuggestedLevel?: string;
    autoRationale?: string;
    accepted?: boolean;
    history?: Array<{ at: string; from: string; to: string; reason: string }>;
  };
  blockageNotes?: string;
}

interface KnowledgeCardNodeProps {
  card: CardData;
  isSelected?: boolean;
  onSelect?: () => void;
  onOpenPreview?: (card: CardData) => void;
  onOpenDetail?: (card: CardData) => void;
  onRunAudit?: (card: CardData) => void;
  onExpansionTest?: (card: CardData) => void;
  onUpdateCard?: (updated: Partial<CardData>) => void;
  fontFamily?: string;
}

/** 顆粒度色帶 */
const GRANULARITY_STYLE: Record<string, string> = {
  L1: "bg-rose-100 text-rose-700 border-rose-200",
  L2: "bg-blue-100 text-blue-700 border-blue-200",
  L3: "bg-emerald-100 text-emerald-700 border-emerald-200",
  L4: "bg-slate-100 text-slate-600 border-slate-200",
};

export const KnowledgeCardNode: React.FC<KnowledgeCardNodeProps> = ({
  card,
  isSelected = false,
  onSelect,
  onOpenPreview,
  onOpenDetail,
  fontFamily,
}) => {
  // 每張卡片可獨立指定字體，未指定才用全域字體
  const ff = resolveFont(card.cardFont || fontFamily);

  // v4：追問點與直覺陷阱共用同一套「[已推出]」計數
  const probeTotal = (card.thoughtPoints?.length || 0) + (card.intuitionTraps?.length || 0);
  const probePassed =
    (card.thoughtPoints?.filter((t) => t.passed).length || 0) +
    (card.intuitionTraps?.filter((t) => t.passed).length || 0);

  const shapeDef = SHAPE_DEFS[card.reasoningShape] || SHAPE_DEFS.A;
  const isComposite = card.reasoningShape === "COMPOSITE";

  // v4 八點自我檢查＋符號綁定（構造思路＋WHY正文）彙總，僅供快速掃描
  const reports = runFourPointCheckOnCard(card);
  const qualityFail = reports.reduce((n, r) => n + r.failCount + (r.symbolBinding?.status === "fail" ? 1 : 0), 0);
  const qualityWarn = reports.reduce((n, r) => n + r.warnCount + (r.symbolBinding?.status === "warn" ? 1 : 0), 0);
  const qualityClean = qualityFail === 0 && qualityWarn === 0;
  const gKey = (card.granularity || "L2").slice(0, 2);
  const gStyle = GRANULARITY_STYLE[gKey] || GRANULARITY_STYLE.L4;

  return (
    <div
      onClick={onSelect}
      className={`group flex flex-col h-full rounded-xl select-none overflow-hidden transition-all duration-150 bg-white ${
        isSelected ? "ring-2 ring-blue-500 shadow-lg" : "shadow-md hover:shadow-lg"
      }`}
      style={{
        fontFamily: ff,
        border: isSelected ? "2px solid #3b82f6" : "1px solid #e2e8f0",
      }}
    >
      {/* 顆粒度色帶 */}
      <div className={`h-1 w-full ${shapeDef.color}`} />

      <div className="flex-1 flex flex-col p-3.5 min-h-0">
        {/* 第一行：顆粒度 + 推理形狀 + 操作 */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${gStyle}`}>
              {card.granularity}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${shapeDef.color}`}
              title={shapeDef.name}
            >
              {isComposite && card.compositeShapes?.length
                ? `複合 ${card.compositeShapes.join("+")}`
                : `${card.reasoningShape} ${shapeDef.name}`}
            </span>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onOpenPreview?.(card); }}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="預覽模式"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail?.(card); }}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              title="編輯模式"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 知識點名稱 */}
        <h3
          className="text-lg font-bold text-slate-900 leading-snug mb-1 line-clamp-2"
          style={{ fontFamily: ff }}
        >
          {card.title}
        </h3>

        {/* 領域 */}
        <div className="text-[11px] text-slate-500 mb-1.5">{card.domain}</div>

        {/* v4：省略聲明（省略本身也是需要交代的判斷，不是預設狀態） */}
        {card.omittedSlots && card.omittedSlots.length > 0 && (
          <div className="mb-2.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-1 leading-snug">
            省略 {card.omittedSlots.map((o) => o.slot).join("/")}：
            {card.omittedSlots.map((o) => o.reason).filter(Boolean).join("；") || "（尚未填寫理由）"}
          </div>
        )}

        {/* 背景描述（摺疊態的核心資訊） */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            背景描述
          </div>
          <p className="text-[12px] text-slate-700 leading-relaxed line-clamp-5">
            <MathText text={card.backgroundDescription || "（尚未填寫背景描述：此知識點座落於哪個框架？前置背景是什麼？向下支撐什麼？）"} />
          </p>
        </div>
      </div>

      {/* 底部：Bloom · SOLO ｜ 追問點 · HOW · 自檢（⑦點＋符號綁定，極簡，僅供掃描） */}
      <div className="px-3 py-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500 gap-1">
        <div className="flex items-center gap-1 min-w-0 overflow-hidden truncate">
          <span className="text-emerald-600">{card.bloomLevel}</span>
          <span className="text-slate-300">/</span>
          <span className="text-indigo-600">{card.soloData?.declaredLevel || card.soloLevel}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {probeTotal > 0 && (
            <span
              className={probePassed === probeTotal ? "text-emerald-600" : "text-amber-600"}
              title={`追問點（含直覺陷阱）${probePassed}/${probeTotal} 已推出`}
            >
              追問 {probePassed}/{probeTotal}
            </span>
          )}
           {card.howData?.status === "compiled" ? (
             <span className="text-emerald-600" title="HOW 已編譯">{STATUS_COMPILED}</span>
           ) : (
             <span className="text-amber-600" title="HOW 未編譯（仍需臨場重推）">{STATUS_UNCOMPILED}</span>
           )}
          {qualityClean ? (
            <span className="text-slate-400" title="構造思路與 WHY 正文已通過八點自我檢查＋符號綁定">✓</span>
          ) : (
            <span className="text-rose-500" title={`自檢（⑧點＋符號綁定）：${qualityFail} 違規 / ${qualityWarn} 待確認`}>
              ⚠{qualityFail > 0 ? qualityFail : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
