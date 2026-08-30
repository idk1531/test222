"use client";

import React, { useState } from "react";
import { EyeOff, AlertTriangle, CheckCircle2, X, Sparkles, Image as ImageIcon } from "lucide-react";
import { imageTextIndependence } from "@/lib/inspect";

interface ImageTextCheckModalProps {
  captionText: string;
  onClose: () => void;
}

export const ImageTextCheckModal: React.FC<ImageTextCheckModalProps> = ({
  captionText,
  onClose,
}) => {
  const [text, setText] = useState(captionText);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // 改為純前端檢查（不呼叫後端）
  const runCheck = () => {
    setLoading(true);
    setTimeout(() => {
      setResult(imageTextIndependence(text));
      setLoading(false);
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-bold text-sm">圖文獨立性審查 (Image-Text Independence)</h3>
              <span className="text-[11px] text-slate-400">
                模擬移去所有圖示，檢驗文字是否把推理偷偷丟給圖片
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Principles */}
        <div className="p-3 bg-blue-50/70 border-b border-blue-200 text-blue-900 text-[11px] space-y-1">
          <div className="font-bold">圖文綁定核心規範：</div>
          <p>
            • 圖片看得出的（空間佈局、幾何形狀）：文字可精簡「如圖」。
            <br />
            • 圖片看不出的（因果為什麼、下一步推導、定理結論）：
            <strong>必須由文字獨立完成，不可用「見圖即明」偷渡。</strong>
          </p>
        </div>

        {/* Input */}
        <div className="p-5 flex-1 overflow-y-auto space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              待審查的圖形伴隨說明文字：
            </label>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs leading-relaxed"
              placeholder="輸入卡片或圖形旁的配套文字..."
            />
          </div>

          {result && (
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                result.passes
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-300 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.passes ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
                <span>{result.verdict}</span>
              </div>

              {result.warnings && result.warnings.length > 0 && (
                <ul className="list-disc ml-4 space-y-1 text-[11px]">
                  {result.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}

              <p className="text-[11px] text-slate-500 italic mt-1">{result.ruleReminder}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">AI 模擬去除圖片盲測</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              關閉
            </button>
            <button
              onClick={runCheck}
              disabled={loading || !text.trim()}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs disabled:opacity-50"
            >
              {loading ? "審查中..." : "開始獨立性檢查"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
