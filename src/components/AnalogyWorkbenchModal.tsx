"use client";

import React, { useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { X, GitFork } from "lucide-react";
import { relationLabelText } from "@/lib/inspect";

export interface RelationData {
  id: string;
  workspaceId: string;
  fromCardId: string;
  toCardId: string;
  relationType: string;
  distance?: number;
  /** v4：類比／對照必須點名的具體維度 d（不能籠統說「不一樣」） */
  dimension?: string;
  /** v4：[前提] 必須寫清「缺 A，B 哪步會斷」 */
  breakStep?: string;
  /** v4：[反例] 必須寫清具體卡在哪個條件上 */
  counterCondition?: string;
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
  const [dimension, setDimension] = useState((relation as any)?.dimension || "");
  const [breakStep, setBreakStep] = useState((relation as any)?.breakStep || "");
  const [counterCondition, setCounterCondition] = useState((relation as any)?.counterCondition || "");
  const [notes, setNotes] = useState(relation?.notes || "");
  const [error, setError] = useState("");

  const needsDimension = ["analogy_verified", "analogy_unverified", "contrast"].includes(relationType);
  const isAnalogy = relationType === "analogy_verified" || relationType === "analogy_unverified";

  const handleTestAndUpgrade = () => {
    if (needsDimension && !dimension.trim()) {
      setError("請點名分歧／共享的具體維度 d（例如「決速步驟／底物結構偏好」），不能籠統說「不一樣」。");
      return;
    }
    if (relationType === "prerequisite" && breakStep.trim().length < 4) {
      setError("[前提] 必須寫清「缺 A，B 哪一步會斷」。");
      return;
    }
    if (relationType === "counter_example" && counterCondition.trim().length < 4) {
      setError("[反例] 必須寫清楚具體卡在哪個條件上。");
      return;
    }

    let updatedType = relationType;
    if (isAnalogy) {
      const hasPrediction = candidatePrediction.trim().length > 15;
      const hasVerification = verificationResult.trim().length > 15;
      updatedType = hasPrediction && hasVerification ? "analogy_verified" : "analogy_unverified";
    }

    onSaveRelation({
      id: relation?.id,
      fromCardId,
      toCardId,
      relationType: updatedType,
      distance,
      dimension: dimension.trim() || undefined,
      breakStep: breakStep.trim() || undefined,
      counterCondition: counterCondition.trim() || undefined,
      candidatePrediction,
      verificationResult,
      notes,
      label:
        updatedType === "analogy_verified"
          ? `${relationLabelText("analogy_verified", { dimension: dimension.trim() || String(distance) })}（已驗證，計分）`
          : updatedType === "analogy_unverified"
          ? `${relationLabelText("analogy_unverified", { dimension: dimension.trim() || String(distance) })}（未驗證，不計分）`
          : relationLabelText(updatedType, { dimension: dimension.trim() || undefined }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92dvh]">
        <div className="p-4 bg-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork className="w-5 h-5 text-indigo-300" />
            <div>
              <h3 className="font-bold text-sm">類比候選推理測試與關係邊編輯</h3>
              <span className="text-[11px] text-indigo-200">
                嚴格區分 [結構類比:d] 與 [表面相似:d]
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-indigo-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-indigo-900 text-[11px]">
          <strong>類比驗證原則：</strong>不能因為兩個東西「看起來很像」就建立 [結構類比]。
          必須回答：<strong>能否從這個結構類比推出一個新的、可驗證的預測？</strong>
          若無法推出或尚未驗證，只能標記為 <strong>[表面相似:d]</strong>，且<strong>不計入知識網整合度</strong>。
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

          <div>
            <label className="font-bold text-slate-700 block mb-1">關係邊語義類型（文字標籤）：</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value)}
              className="w-full p-2 rounded-lg border border-slate-300 bg-white font-medium"
            >
              <option value="prerequisite">[前提] A 是 B 成立的必要基礎</option>
              <option value="analogy_verified">[結構類比:d] 已過候選推理測試（計入整合度）</option>
              <option value="analogy_unverified">[表面相似:d] 未驗證（不計入整合度）</option>
              <option value="contrast">[對照:d] 對照／衝突（須點名維度）</option>
              <option value="positive_example">[正例] 舉例支持</option>
              <option value="counter_example">[反例] 舉反例排除（須寫清卡點）</option>
              <option value="special_case">[特例] 從屬於另一知識點</option>
              <option value="generalization">[推廣] 推廣自另一知識點</option>
              <option value="motif_instance">[歸屬母題] 需≥3實例＋候選推理測試雙達標</option>
            </select>
          </div>

          {needsDimension && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">維度 d（必填）：共享／分歧的具體維度</label>
              <input
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
                placeholder="例：偏離-回歸機制；決速步驟／底物結構偏好"
                className="w-full p-2 rounded-lg border border-slate-300 bg-white"
              />
            </div>
          )}

          {relationType === "prerequisite" && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">[前提] 缺 A，B 哪一步會斷？（必填）</label>
              <textarea
                rows={2}
                value={breakStep}
                onChange={(e) => setBreakStep(e.target.value)}
                placeholder="例：缺了質量作用定律，B 的「由 Q≠K 推出淨反應方向」這一步就沒有動力學依據"
                className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
              />
            </div>
          )}

          {relationType === "counter_example" && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">[反例] 具體卡在哪個條件上？（必填）</label>
              <textarea
                rows={2}
                value={counterCondition}
                onChange={(e) => setCounterCondition(e.target.value)}
                placeholder="例：卡在「恆容」條件——充惰氣時總壓上升但各組分分壓不變，Q 不變"
                className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
              />
            </div>
          )}

          {isAnalogy && (
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
                  placeholder="例如：由「偏離設定值→自動反向修正」可推測溫控器原理也是「測量偏離→驅動反向拉回」..."
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
                  placeholder="例如：該推測與實際溫控器原理一致，驗證通過 → 升級為[結構類比]"
                  className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">備註（可選）：</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 rounded border border-slate-300 bg-white text-xs"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            {isAnalogy ? "預測與驗證均通過時自動升級為 [結構類比:d]" : "儲存後即參與知識網與 SOLO 計分（[表面相似] 除外）"}
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
