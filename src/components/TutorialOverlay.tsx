"use client";

import React, { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, Hand, MousePointer2, ZoomIn,
  Move, Eye, Sparkles, Download, Upload, CheckCircle2, Smartphone, Monitor,
} from "lucide-react";

const UI = "'Varela Round', sans-serif";
const TUTORIAL_KEY = "scinotes-tutorial-seen-v4";

interface TutorialStep {
  id: string;
  title: string;
  desc: string;
  detail: string;
  animation: "pan" | "drag" | "pinch" | "open" | "audit" | "export";
}

const STEPS: TutorialStep[] = [
  {
    id: "pan",
    title: "移動畫布",
    desc: "在空白處直接拖曳，畫布就會跟著移動",
    detail: "電腦：滑鼠左鍵按住空白處拖曳。手機／平板：單指按住空白處滑動。想框選多張卡片時，按住 Shift 再拖曳。",
    animation: "pan",
  },
  {
    id: "drag",
    title: "移動卡片",
    desc: "按住卡片本身拖曳，即可自由擺放",
    detail: "電腦與手機操作相同：按住卡片後拖動。靠近其他卡片時會出現粉紅色對齊線自動吸附，鬆手即完成。",
    animation: "drag",
  },
  {
    id: "pinch",
    title: "縮放畫布",
    desc: "雙指張合縮放，或用底部工具列的按鈕",
    detail: "手機／平板：兩指張開放大、捏合縮小。電腦：Ctrl（或 ⌘）+ 滾輪，也可點底部工具列的 +／− 按鈕。",
    animation: "pinch",
  },
  {
    id: "open",
    title: "打開卡片",
    desc: "眼睛圖示 = 預覽；放大圖示 = 編輯",
    detail: "預覽模式把 ORIGIN → WHY → WHAT → HOW → WHEN 五格連續排在同一張紙上，可切換「一頁式」或「分頁 A4」。編輯模式則可逐格修改內容。",
    animation: "open",
  },
  {
    id: "audit",
    title: "AI 假懂審查",
    desc: "自動抓出推理跳步與認識論越級",
    detail: "系統會檢查：WHY 是否只有結論、是否偷渡未聲明前提、[地位:近似] 是否被當成 [地位:證明]、視角失效模式有沒有接到 WHEN 檢查項，並執行四點自我檢查。",
    animation: "audit",
  },
  {
    id: "export",
    title: "備份與還原",
    desc: "資料存在你的瀏覽器，可匯出成 JSON 檔",
    detail: "所有編輯會自動存到本機瀏覽器。點頂欄「匯出」下載 JSON 備份，換裝置時用「匯入」載回。iPhone 會改用「分享 → 儲存到檔案」。",
    animation: "export",
  },
];

/** 各步驟對應的示意動畫 */
function StepAnimation({ type }: { type: TutorialStep["animation"] }) {
  const base =
    "relative w-full h-40 sm:h-48 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center";

  if (type === "pan") {
    return (
      <div className={base}>
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)",
            backgroundSize: "22px 22px",
            animation: "tut-pan 2.6s ease-in-out infinite",
          }}
        />
        <div className="absolute left-6 top-6 w-20 h-14 rounded-lg bg-white border-2 border-blue-300 shadow-sm" style={{ animation: "tut-pan 2.6s ease-in-out infinite" }} />
        <div className="absolute right-8 bottom-8 w-24 h-16 rounded-lg bg-white border-2 border-emerald-300 shadow-sm" style={{ animation: "tut-pan 2.6s ease-in-out infinite" }} />
        <div className="relative z-10 flex flex-col items-center gap-1" style={{ animation: "tut-hand-drag 2.6s ease-in-out infinite" }}>
          <Hand className="w-9 h-9 text-slate-800 drop-shadow-lg" />
          <span className="text-[10px] font-bold text-slate-700 bg-white/90 px-2 py-0.5 rounded-full shadow-sm">拖曳空白處</span>
        </div>
      </div>
    );
  }

  if (type === "drag") {
    return (
      <div className={base}>
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)", backgroundSize: "22px 22px" }} />
        {/* 靜止參考卡 */}
        <div className="absolute right-10 top-8 w-24 h-16 rounded-lg bg-white border-2 border-slate-300 shadow-sm" />
        {/* 對齊線 */}
        <div className="absolute right-10 top-0 bottom-0 w-[2px] bg-pink-500" style={{ animation: "tut-guide 2.8s ease-in-out infinite" }} />
        {/* 被拖曳的卡 */}
        <div
          className="absolute left-8 top-14 w-24 h-16 rounded-lg bg-white border-2 border-blue-500 shadow-xl flex items-center justify-center"
          style={{ animation: "tut-card-move 2.8s ease-in-out infinite" }}
        >
          <span className="text-[9px] font-bold text-blue-700">知識卡片</span>
          <Hand className="w-7 h-7 text-slate-800 absolute -bottom-4 -right-3 drop-shadow-lg" />
        </div>
      </div>
    );
  }

  if (type === "pinch") {
    return (
      <div className={base}>
        <div
          className="w-28 h-20 rounded-lg bg-white border-2 border-indigo-400 shadow-lg flex items-center justify-center"
          style={{ animation: "tut-zoom 2.4s ease-in-out infinite" }}
        >
          <ZoomIn className="w-7 h-7 text-indigo-500" />
        </div>
        <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800/80" style={{ animation: "tut-pinch-a 2.4s ease-in-out infinite" }} />
        <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800/80" style={{ animation: "tut-pinch-b 2.4s ease-in-out infinite" }} />
      </div>
    );
  }

  if (type === "open") {
    return (
      <div className={base}>
        <div className="relative w-32 h-24 rounded-lg bg-white border-2 border-slate-300 shadow-md p-2">
          <div className="h-1.5 w-10 rounded bg-blue-400 mb-1.5" />
          <div className="h-1 w-full rounded bg-slate-200 mb-1" />
          <div className="h-1 w-3/4 rounded bg-slate-200 mb-2" />
          <div className="flex gap-1">
            <span className="px-1 py-0.5 rounded bg-slate-800 text-white text-[8px] flex items-center gap-0.5" style={{ animation: "tut-pulse 1.6s ease-in-out infinite" }}>
              <Eye className="w-2.5 h-2.5" />預覽
            </span>
            <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-700 text-[8px]">編輯</span>
          </div>
        </div>
        <div
          className="absolute right-8 w-24 h-28 rounded bg-white border border-slate-300 shadow-xl p-1.5 origin-left"
          style={{ animation: "tut-paper 2.6s ease-in-out infinite" }}
        >
          {["bg-rose-400", "bg-emerald-400", "bg-blue-400", "bg-amber-400", "bg-indigo-400"].map((c, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${c}`} />
              <div className="h-0.5 flex-1 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "audit") {
    return (
      <div className={base}>
        <div className="w-44 space-y-1.5">
          {[
            { t: "WHY 推理完整性", ok: true, d: "0s" },
            { t: "偷渡前提偵測", ok: false, d: "0.35s" },
            { t: "認識論地位越級", ok: false, d: "0.7s" },
            { t: "四點自我檢查", ok: true, d: "1.05s" },
          ].map((r) => (
            <div
              key={r.t}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-[10px] font-bold ${
                r.ok ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-amber-50 border-amber-300 text-amber-800"
              }`}
              style={{ animation: `tut-fade-in 2.6s ease-in-out infinite`, animationDelay: r.d }}
            >
              {r.ok ? <CheckCircle2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              <span>{r.t}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // export
  return (
    <div className={base}>
      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-14 h-16 rounded-lg bg-white border-2 border-slate-300 shadow-sm flex items-center justify-center">
            <Monitor className="w-6 h-6 text-slate-500" />
          </div>
          <span className="text-[9px] text-slate-600 font-bold">瀏覽器本機</span>
        </div>
        <div className="relative w-16 flex flex-col items-center">
          <Download className="w-5 h-5 text-blue-600" style={{ animation: "tut-arrow 2s ease-in-out infinite" }} />
          <div className="h-px w-full bg-slate-300 my-1" />
          <Upload className="w-5 h-5 text-emerald-600" style={{ animation: "tut-arrow 2s ease-in-out infinite", animationDelay: "1s" }} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-14 h-16 rounded-lg bg-blue-50 border-2 border-blue-300 shadow-sm flex items-center justify-center">
            <span className="text-[9px] font-bold text-blue-700">JSON</span>
          </div>
          <span className="text-[9px] text-slate-600 font-bold">備份檔案</span>
        </div>
      </div>
    </div>
  );
}

interface TutorialOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    try {
      window.localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* 忽略隱私模式寫入失敗 */
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4" style={{ fontFamily: UI }}>
      <style>{`
        @keyframes tut-pan { 0%,100%{transform:translate(0,0)} 50%{transform:translate(26px,-16px)} }
        @keyframes tut-hand-drag { 0%,100%{transform:translate(-22px,10px)} 50%{transform:translate(20px,-10px)} }
        @keyframes tut-card-move { 0%,100%{transform:translate(0,0)} 55%,75%{transform:translate(86px,-22px)} }
        @keyframes tut-guide { 0%,50%{opacity:0} 60%,80%{opacity:1} 100%{opacity:0} }
        @keyframes tut-zoom { 0%,100%{transform:scale(0.72)} 50%{transform:scale(1.12)} }
        @keyframes tut-pinch-a { 0%,100%{transform:translate(-14px,0)} 50%{transform:translate(-52px,-26px)} }
        @keyframes tut-pinch-b { 0%,100%{transform:translate(14px,0)} 50%{transform:translate(52px,26px)} }
        @keyframes tut-paper { 0%,25%{opacity:0;transform:scaleX(0.3) translateX(-12px)} 45%,100%{opacity:1;transform:scaleX(1) translateX(0)} }
        @keyframes tut-fade-in { 0%,10%{opacity:0;transform:translateY(6px)} 30%,100%{opacity:1;transform:translateY(0)} }
        @keyframes tut-arrow { 0%,100%{transform:translateX(-5px);opacity:0.4} 50%{transform:translateX(5px);opacity:1} }
        @keyframes tut-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden safe-bottom">
        {/* 標題列 */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold">
              {step + 1}
            </span>
            <div>
              <h3 className="text-sm font-bold">{cur.title}</h3>
              <p className="text-[10px] text-slate-400">使用教學 · {step + 1} / {STEPS.length}</p>
            </div>
          </div>
          <button onClick={finish} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" title="略過教學">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <StepAnimation type={cur.animation} />

          <div>
            <p className="text-sm font-bold text-slate-900 mb-1">{cur.desc}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{cur.detail}</p>
          </div>

          {/* 裝置適用標示 */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
              <Monitor className="w-3 h-3" /> 電腦
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
              <Smartphone className="w-3 h-3" /> 手機 / 平板
            </span>
            <span>皆適用</span>
          </div>
        </div>

        {/* 底部導覽 */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> 上一步
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300 hover:bg-slate-400"}`}
                title={s.title}
              />
            ))}
          </div>

          {isLast ? (
            <button onClick={finish} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
              開始使用 <CheckCircle2 className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium"
            >
              下一步 <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** 是否為首次造訪（尚未看過教學） */
export function shouldShowTutorial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TUTORIAL_KEY) !== "1";
  } catch {
    return false;
  }
}
