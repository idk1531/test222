"use client";

import React, { useState, useEffect, useMemo } from "react";
import { HelpCircle, X, Check, ArrowRight, ShieldAlert, Sparkles, ChevronLeft, ChevronRight, Hand, Move, ZoomIn, Download, Upload, CheckCircle2, MousePointer2 } from "lucide-react";
import type { CardData } from "./KnowledgeCardNode";

interface BlockageGuideModalProps {
  cards: CardData[];
  onClose: () => void;
  onRecordResolution: (cardId: string, resolutionNote: string) => void;
}

export const BlockageGuideModal: React.FC<BlockageGuideModalProps> = ({
  cards,
  onClose,
  onRecordResolution,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.id || "");
  const [step, setStep] = useState<number>(1);
  const [diagnosedCause, setDiagnosedCause] = useState<string>("");
  const [customNote, setCustomNote] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  const handleFinish = () => {
    if (!selectedCardId) return;
    const finalRecord = `（曾引發堵塞，已定位：${diagnosedCause}${customNote ? ` - ${customNote}` : ""}）`;
    onRecordResolution(selectedCardId, finalRecord);
    setSaved(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 bg-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-300" />
            <div>
              <h3 className="font-bold text-sm">堵塞感定位導引（「我不知道自己哪裡不懂」）</h3>
              <span className="text-[11px] text-amber-200">
                穿透隱形認知障礙，定位認識論地基裂痕
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-amber-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Step 1: Select Card */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              第 1 步：選擇你感覺產生卡頓或堵塞的知識卡片：
            </label>
            <select
              value={selectedCardId}
              onChange={(e) => setSelectedCardId(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 font-medium text-slate-800 text-xs"
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.domain})
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Diagnostic Checkpoints */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-700 block">
              第 2 步：逐項審查最常見的三種理科底層堵塞源：
            </span>

            {/* Cause 1 */}
            <div
              onClick={() => setDiagnosedCause("缺少明確認識論標記（不清楚命題是公設、定理還是經驗）")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("缺少明確認識論標記")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>① 核心聲明缺少認識論標記</span>
                {diagnosedCause.includes("缺少明確認識論標記") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：心裡隱約懷疑「這真的必然成立嗎？」，卻又說不出為什麼。原因通常是混淆了出發公設（[地位:公設(框架)]）與推導證明（[地位:證明]）。
              </p>
            </div>

            {/* Cause 2 */}
            <div
              onClick={() => setDiagnosedCause("跨框架概念挪用（例如用宏觀連續直覺套用微觀離散/量子波函數）")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("跨框架概念挪用")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>② 跨框架挪用了互不兼容的概念</span>
                {diagnosedCause.includes("跨框架概念挪用") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：腦子裡出現兩個互相打架的模型。例如：既想用經典質點彈珠軌跡，又想用波動干涉疊加；或用微觀可逆力學理解宏觀熱力學不可逆。
              </p>
            </div>

            {/* Cause 3 */}
            <div
              onClick={() => setDiagnosedCause("把 [地位:近似於框架] 默默當成了 [地位:證明]")}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                diagnosedCause.includes("把 [地位:近似")
                  ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300/40"
                  : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>③ 把近似條件 [地位:近似於框架] 默默當成了絕對證明 [地位:證明]</span>
                {diagnosedCause.includes("把 [地位:近似") && (
                  <Check className="w-4 h-4 text-amber-600" />
                )}
              </div>
              <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                症狀：在極限尺度推演時發現荒謬矛盾。原因是一開始就忽略了「低速、稀薄氣體或小擾動」等隱蔽近似邊界。
              </p>
            </div>
          </div>

          {/* Step 3: Specific Note */}
          <div className="pt-2 border-t border-slate-200">
            <label className="font-bold text-slate-700 block mb-1">
              第 3 步：補充具體堵塞細節（可選）：
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="例如：混淆了恆容與恆壓下的氣體分壓計算..."
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-amber-500"
            />
          </div>

          {saved && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg font-semibold flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>堵塞已成功定位並記錄至卡片歷史！</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            記錄格式：(曾引發堵塞，已定位：...)
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              onClick={handleFinish}
              disabled={!diagnosedCause}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              完成定位並記錄
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// ============================================================
// 跨裝置首次使用教學動畫（同檔匯出，維持專案既定檔案樹）
// ============================================================

interface OnboardingTutorialProps {
  open: boolean;
  onClose: () => void;
}

const UI = "'Varela Round', sans-serif";

interface Step {
  icon: React.ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
  body: React.ReactNode;
  animation: React.ReactNode;
}

function CanvasPanAnimation() {
  return (
    <div className="tutorial-stage tutorial-grid-stage relative h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      <div className="tutorial-mini-card absolute left-[19%] top-[22%] w-36 h-24 rounded-lg bg-white border border-slate-200 shadow-sm p-2">
        <div className="h-2.5 bg-slate-800 rounded w-20 mb-2" />
        <div className="h-1.5 bg-slate-200 rounded w-full mb-1" />
        <div className="h-1.5 bg-slate-200 rounded w-4/5" />
      </div>
      <div className="tutorial-mini-card absolute left-[60%] top-[52%] w-28 h-20 rounded-lg bg-white border border-slate-200 shadow-sm p-2">
        <div className="h-2.5 bg-blue-500 rounded w-16 mb-2" />
        <div className="h-1.5 bg-slate-200 rounded w-full" />
      </div>
      <div className="tutorial-hand-pan absolute left-[43%] top-[48%] text-blue-600 drop-shadow-sm">
        <Hand className="w-10 h-10 fill-blue-100" />
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white/90 border border-slate-200 text-[10px] text-slate-600 shadow-sm" style={{ fontFamily: UI }}>
        拖曳空白處
      </div>
    </div>
  );
}

function CardDragAnimation() {
  return (
    <div className="tutorial-stage relative h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-5">
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-blue-200" />
      <div className="tutorial-card-drag absolute top-[45px] left-[20%] w-48 rounded-xl bg-white border-2 border-blue-400 shadow-lg overflow-hidden">
        <div className="h-2 bg-blue-500" />
        <div className="p-3">
          <div className="flex gap-1 items-center">
            <span className="w-4 h-4 rounded bg-blue-500 text-white text-[8px] flex items-center justify-center">A</span>
            <span className="font-bold text-xs text-slate-800">知識卡片</span>
          </div>
          <div className="h-1.5 bg-slate-200 rounded w-full mt-3" />
          <div className="h-1.5 bg-slate-100 rounded w-4/5 mt-1.5" />
        </div>
      </div>
      <div className="tutorial-pointer-drag absolute top-[100px] left-[35%] text-slate-700">
        <MousePointer2 className="w-7 h-7 fill-white" />
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white/90 border border-slate-200 text-[10px] text-slate-600 shadow-sm" style={{ fontFamily: UI }}>
        卡片按住後直接拖動
      </div>
    </div>
  );
}

function PinchAnimation() {
  return (
    <div className="tutorial-stage relative h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="tutorial-pinch-card w-40 h-24 rounded-xl bg-white border-2 border-indigo-400 shadow-md p-3">
          <div className="h-2.5 bg-indigo-500 rounded w-20 mb-3" />
          <div className="h-1.5 bg-slate-200 rounded w-full mb-1.5" />
          <div className="h-1.5 bg-slate-100 rounded w-4/5" />
        </div>
      </div>
      <div className="tutorial-finger-left absolute left-[28%] top-[72%] text-indigo-600"><span className="text-3xl">☝</span></div>
      <div className="tutorial-finger-right absolute right-[28%] top-[72%] text-indigo-600"><span className="text-3xl">☝</span></div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white/90 border border-slate-200 text-[10px] text-slate-600 shadow-sm" style={{ fontFamily: UI }}>
        兩指張開／合攏
      </div>
    </div>
  );
}

function FileAnimation() {
  return (
    <div className="tutorial-stage relative h-48 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center gap-8">
      <div className="tutorial-file-out relative flex flex-col items-center gap-1 text-blue-600">
        <Download className="w-9 h-9" />
        <span className="text-[10px] font-bold" style={{ fontFamily: UI }}>匯出</span>
      </div>
      <div className="tutorial-json-file w-20 h-24 bg-white border border-slate-300 rounded-lg shadow p-2 text-center">
        <div className="text-[10px] font-bold text-emerald-600 mt-3">{'{ }'}</div>
        <div className="text-[9px] text-slate-500 mt-1">JSON</div>
      </div>
      <div className="tutorial-file-in relative flex flex-col items-center gap-1 text-indigo-600">
        <Upload className="w-9 h-9" />
        <span className="text-[10px] font-bold" style={{ fontFamily: UI }}>匯入</span>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-white/90 border border-slate-200 text-[10px] text-slate-600 shadow-sm" style={{ fontFamily: UI }}>
        資料永遠由你掌握
      </div>
    </div>
  );
}

export const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const steps: Step[] = useMemo(
    () => [
      {
        icon: Hand,
        kicker: "第 1 步 · 自由畫布",
        title: "拖曳空白處，即可平移畫布",
        body: <><b>桌機／筆電：</b>用左鍵按住空白處拖曳。<br /><b>手機／平板：</b>用一根手指在空白處拖曳。<br /><span className="text-slate-500">想框選多個物件？點底部的游標工具，或在桌機按住 Shift 拖曳。</span></>,
        animation: <CanvasPanAnimation />,
      },
      {
        icon: Move,
        kicker: "第 2 步 · 移動卡片",
        title: "按住任何卡片，直接拖到想要的位置",
        body: <><b>滑鼠、觸控筆與手指</b>都使用同一種拖曳方式。拖曳接近另一張卡時，會顯示粉紅色對齊線並自動吸附。<br /><span className="text-slate-500">卡片被鎖定時無法移動；選取後可由浮動工具列解鎖。</span></>,
        animation: <CardDragAnimation />,
      },
      {
        icon: ZoomIn,
        kicker: "第 3 步 · 縮放與選取",
        title: "雙指縮放，或用工具列調整視角",
        body: <><b>手機／平板：</b>兩指張開放大、合攏縮小。<br /><b>桌機：</b>Ctrl/⌘ + 滾輪縮放；一般滾輪可平移。底部工具列也提供 ± 按鈕與網格開關。<br /><span className="text-slate-500">所有拖曳、縮放與吸附都是跨裝置統一操作。</span></>,
        animation: <PinchAnimation />,
      },
      {
        icon: Download,
        kicker: "第 4 步 · 資料備份",
        title: "匯出 JSON；任何裝置都保有備援方式",
        body: <><b>桌機：</b>點頂欄下載圖示，會直接下載 JSON。<br /><b>手機／平板：</b>優先開啟系統分享面板，選「儲存到檔案」。若瀏覽器阻擋下載，可從手機選單選<b>「複製 JSON 備份」</b>，貼到文字檔另存。<br /><span className="text-slate-500">上傳圖示可隨時匯入 JSON，整個應用沒有伺服器資料庫。</span></>,
        animation: <FileAnimation />,
      },
    ],
    []
  );

  if (!open) return null;
  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="使用教學">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            <div>
              <div className="text-sm font-bold text-slate-900" style={{ fontFamily: UI }}>三分鐘上手 SciNotes</div>
              <div className="text-[10px] text-slate-500" style={{ fontFamily: UI }}>跨桌機、平板、手機的畫布操作</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="關閉教學"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-5 pt-4 flex items-center gap-1.5">
          {steps.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />)}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon className="w-4 h-4 text-blue-600" />
            <span className="text-[11px] font-bold text-blue-700" style={{ fontFamily: UI }}>{current.kicker}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: UI }}>{current.title}</h2>
          {current.animation}
          <div className="mt-4 text-sm text-slate-700 leading-6" style={{ fontFamily: UI }}>{current.body}</div>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-30" style={{ fontFamily: UI }}>
            <ChevronLeft className="w-4 h-4" /> 上一步
          </button>
          {step === steps.length - 1 ? (
            <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white" style={{ fontFamily: UI }}>
              <CheckCircle2 className="w-4 h-4" /> 開始使用
            </button>
          ) : (
            <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white" style={{ fontFamily: UI }}>
              下一步 <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
