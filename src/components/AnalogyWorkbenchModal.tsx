"use client";

import React, { useState } from "react";
import { CardData } from "./KnowledgeCardNode";
import { Sparkles, Check, AlertCircle, X, ArrowRight, GitFork } from "lucide-react";

interface RelationData {
  id: string;
  workspaceId: string;
  fromCardId: string;
  toCardId: string;
  relationType: string;
  distance?: number;
  label?: string;
  status: string;
  candidatePrediction?: string;
  verificationResult?: string;
  notes?: string;
}

interface AnalogyWorkbenchModalProps {
  cards: CardData[];
  relation?: RelationData | null;
  onClose: () => void;
  onSaveRelation: (relation: Partial<RelationData>) => void;
}

export const AnalogyWorkbenchModal: React.FC<AnalogyWorkbenchModalProps> = ({
  cards,
  relation,
  onClose,
  onSaveRelation,
}) => {
  const [fromCardId, setFromCardId] = useState(relation?.fromCardId || cards[0]?.id || "");
  const [toCardId, setToCardId] = useState(relation?.toCardId || cards[1]?.id || "");
  const [relationType, setRelationType] = useState(relation?.relationType || "analogy_unverified");
  const [candidatePrediction, setCandidatePrediction] = useState(relation?.candidatePrediction || "");
  const [verificationResult, setVerificationResult] = useState(relation?.verificationResult || "");
  const [distance, setDistance] = useState(relation?.distance || 1);
  const [notes, setNotes] = useState(relation?.notes || "");

  const fromCard = cards.find((c) => c.id === fromCardId);
  const toCard = cards.find((c) => c.id === toCardId);

  const handleTestAndUpgrade = () => {
    const hasPrediction = candidatePrediction.trim().length > 15;
    const hasVerification = verificationResult.trim().length > 15;

    let updatedType = relationType;
    if (hasPrediction && hasVerification) {
      updatedType = "analogy_verified"; // ≈[d]
    } else {
      updatedType = "analogy_unverified"; // ~[d]
    }

    onSaveRelation({
      id: relation?.id,
      fromCardId,
      toCardId,
      relationType: updatedType,
      distance,
      candidatePrediction,
      verificationResult,
      notes,
      label: updatedType === "analogy_verified" ? `≈[${distance}] 結構類比 (已驗證)` : `~[${distance}] 表面相似 (未驗證)`,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-indigo-300" />
            <div>
              <h3 className="font-bold text-sm">類比候選推理測試與關係邊編輯</h3>
              <span className="text-[11px] text-indigo-200">
                嚴格區分 ≈[d] 結構類比 與 ~[d] 表面相似
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-indigo-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Philosophy alert */}
        <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-indigo-900 text-[11px]">
          <strong>類比驗證原則：</strong>不能因為兩個東西「看起來很像」就建立 ≈。
          必須回答：<strong>能否從這個結構類比推出一個新的、可驗證的預測？</strong>
          若無法推出或尚未驗證，只能標記為 <strong>~[d] (表面相似)</strong>，且<strong>不計入知識網整合度</strong>。
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* Card Selectors */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">源知識點 (From)：</label>
              <select
                value={fromCardId}
                onChange={(e) => setFromCardId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">目標知識點 (To)：</label>
              <select
                value={toCardId}
                onChange={(e) => setToCardId(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Relation Type */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">關係邊語義類型：</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-mono font-medium"
            >
              <option value="prerequisite">→ 前提 (Prerequisite)</option>
              <option value="analogy_verified">≈[d] 結構類比，已驗證 (計入整合度)</option>
              <option value="analogy_unverified">~[d] 表面相似，未驗證 (不計入整合度)</option>
              <option value="contrast">⇄[d] 對照 / 衝突</option>
              <option value="positive_example">⊨ 正例</option>
              <option value="counter_example">⊭ 反例</option>
              <option value="special_case">⊂ 特例</option>
              <option value="generalization">⊃ 推廣</option>
              <option value="motif_instance">∈[母題] 母題實例</option>
            </select>
          </div>

          {/* Analogy Test Fields */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <span className="font-bold text-slate-800 block text-xs">
              類比候選推理測試 (Candidate Inference Test)：
            </span>

            <div>
              <label className="font-medium text-slate-700 block mb-1">
                1. 提出的新預測（能否由該結構類比推出未知的具體推論？）：
              </label>
              <textarea
                rows={2}
                value={candidatePrediction}
                onChange={(e) => setCandidatePrediction(e.target.value)}
                placeholder="例如：若兩者均基於自由能極小原理，則凡特霍夫平衡方程必然可精確退化為卡諾相變方程..."
                className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
              />
            </div>

            <div>
              <label className="font-medium text-slate-700 block mb-1">
                2. 預測驗證結果（經實驗或數學代數檢驗）：
              </label>
              <textarea
                rows={2}
                value={verificationResult}
                onChange={(e) => setVerificationResult(e.target.value)}
                placeholder="例如：已完成代數證明，兩者二階偏導矩陣對稱性嚴格同構..."
                className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            預測與驗證均通過時自動升級為 ≈[d]
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              onClick={handleTestAndUpgrade}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm"
            >
              儲存關係邊
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
