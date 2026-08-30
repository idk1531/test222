"use client";

import React, { useState } from "react";
import { Sparkles, Plus, CheckCircle2, AlertCircle, Layers, ArrowRight } from "lucide-react";
import { CardData } from "./KnowledgeCardNode";

interface MotherTopicData {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  instanceCardIds: string[];
  hypothesisTest?: string;
  predictionVerification?: string;
  isVerified: boolean;
}

interface MotherTopicsViewProps {
  cards: CardData[];
  motherTopics: MotherTopicData[];
  onAddMotherTopic: (topic: Partial<MotherTopicData>) => void;
  onVerifyMotherTopic: (id: string, updates: Partial<MotherTopicData>) => void;
}

export const MotherTopicsView: React.FC<MotherTopicsViewProps> = ({
  cards,
  motherTopics,
  onAddMotherTopic,
  onVerifyMotherTopic,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInstances, setSelectedInstances] = useState<string[]>([]);
  const [hypothesisTest, setHypothesisTest] = useState("");
  const [predictionVerification, setPredictionVerification] = useState("");

  const toggleInstance = (id: string) => {
    if (selectedInstances.includes(id)) {
      setSelectedInstances(selectedInstances.filter((x) => x !== id));
    } else {
      setSelectedInstances([...selectedInstances, id]);
    }
  };

  const handleCreate = () => {
    if (!title || !description) return;
    const canBeVerified =
      selectedInstances.length >= 3 &&
      hypothesisTest.trim().length > 10 &&
      predictionVerification.trim().length > 10;

    onAddMotherTopic({
      title,
      description,
      instanceCardIds: selectedInstances,
      hypothesisTest,
      predictionVerification,
      isVerified: canBeVerified,
    });
    setShowAddModal(false);
    setTitle("");
    setDescription("");
    setSelectedInstances([]);
    setHypothesisTest("");
    setPredictionVerification("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-xs overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-bold text-slate-900 text-sm">🪐 母題管理 (Motif & Deep Universal Patterns)</h3>
            <span className="text-[11px] text-slate-500">
              跨領域高階深層結構模式（如連續對稱性對偶、凸性極值、正交分解）
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>提議新母題</span>
        </button>
      </div>

      {/* Philosophy Rule Card */}
      <div className="p-4 bg-indigo-50 border-b border-indigo-100 text-indigo-900 text-xs flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">母題成立嚴格三準則：</span>
          母題不能由 AI 隨意宣布成立。只有滿足：
          <strong> ① ≥3 個具體實例卡片</strong> +
          <strong> ② 候選推理測試</strong> +
          <strong> ③ 對新實例的預測驗證成功</strong>，
          才正式建立 <code>∈[母題]</code> 關係邊。
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-4 sm:space-y-6">
        {motherTopics.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">目前尚無成立的母題</p>
          </div>
        ) : (
          motherTopics.map((topic) => {
            const instanceCards = cards.filter((c) => topic.instanceCardIds?.includes(c.id));
            const hasThreeOrMore = (topic.instanceCardIds?.length || 0) >= 3;

            return (
              <div
                key={topic.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                        topic.isVerified
                          ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                          : "bg-amber-100 text-amber-900 border border-amber-300"
                      }`}
                    >
                      {topic.isVerified ? "✓ 已正式成立母題" : "候選母題 (未滿驗證條件)"}
                    </span>
                    <h4 className="font-bold text-slate-900 text-base">{topic.title}</h4>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">
                    實例數: {topic.instanceCardIds?.length || 0} / 3 (門檻)
                  </span>
                </div>

                <p className="text-slate-700 leading-relaxed text-xs">{topic.description}</p>

                {/* Instances */}
                <div className="space-y-1.5 pt-1">
                  <span className="font-bold text-slate-700 block text-[11px]">
                    涵蓋的理科知識實例卡片 (∈[母題])：
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {instanceCards.map((c) => (
                      <span
                        key={c.id}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium text-xs flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        <span>{c.title}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tests */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block mb-1">候選推理測試：</span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {topic.hypothesisTest || "尚未填寫候選推理預測"}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block mb-1">新預測驗證結果：</span>
                    <p className="text-slate-600 leading-relaxed text-[11px]">
                      {topic.predictionVerification || "尚未驗證"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">提議新理科母題</h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">母題名稱：</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例如：諾特定理母題：連續對稱性與守恆荷對偶"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">深層結構描述：</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="闡述該深層模式如何在不同學科/現象間普遍重現..."
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                勾選共享此母題的實例卡片（需 ≥3 個）：
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                {cards.map((c) => {
                  const isChecked = selectedInstances.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleInstance(c.id)}
                      className={`p-2 rounded border text-left text-xs transition-colors flex items-center gap-2 ${
                        isChecked
                          ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold"
                          : "bg-white border-slate-200 text-slate-700"
                      }`}
                    >
                      <input type="checkbox" checked={isChecked} readOnly className="rounded" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">候選推理測試：</label>
              <input
                type="text"
                value={hypothesisTest}
                onChange={(e) => setHypothesisTest(e.target.value)}
                placeholder="提出一個基於此母題的可證偽新預測..."
                className="w-full p-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">新實例預測驗證：</label>
              <input
                type="text"
                value={predictionVerification}
                onChange={(e) => setPredictionVerification(e.target.value)}
                placeholder="輸入具體驗證結論與文獻/計算依據..."
                className="w-full p-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!title || !description}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-50"
              >
                建立母題
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
