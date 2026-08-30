"use client";

import React, { useState } from "react";
import { Settings, Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Check, X } from "lucide-react";

export interface CustomField {
  id: string;
  name: string;
  type: "text" | "textarea" | "math" | "url" | "select" | "tags";
  visible: boolean;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select type
  description?: string;
  order: number;
}

interface FieldCustomizerProps {
  fields: CustomField[];
  onUpdate: (fields: CustomField[]) => void;
  onClose: () => void;
}

export const FieldCustomizer: React.FC<FieldCustomizerProps> = ({
  fields,
  onUpdate,
  onClose,
}) => {
  const [editFields, setEditFields] = useState<CustomField[]>(fields);
  const [editingField, setEditingField] = useState<CustomField | null>(null);

  const handleAddField = () => {
    const newField: CustomField = {
      id: `field-${Date.now()}`,
      name: "新欄位",
      type: "text",
      visible: true,
      required: false,
      order: editFields.length,
    };
    setEditFields([...editFields, newField]);
    setEditingField(newField);
  };

  const handleDeleteField = (id: string) => {
    setEditFields(editFields.filter((f) => f.id !== id).map((f, idx) => ({ ...f, order: idx })));
    setEditingField(null);
  };

  const handleMoveField = (id: string, direction: "up" | "down") => {
    const idx = editFields.findIndex((f) => f.id === id);
    if ((direction === "up" && idx === 0) || (direction === "down" && idx === editFields.length - 1)) {
      return;
    }

    const newFields = [...editFields];
    if (direction === "up") {
      [newFields[idx], newFields[idx - 1]] = [newFields[idx - 1], newFields[idx]];
    } else {
      [newFields[idx], newFields[idx + 1]] = [newFields[idx + 1], newFields[idx]];
    }
    newFields.forEach((f, i) => (f.order = i));
    setEditFields(newFields);
  };

  const handleToggleVisible = (id: string) => {
    setEditFields(
      editFields.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92dvh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            <h3 className="font-bold text-sm">卡片欄位自訂編輯器 (極高自由度)</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules Banner */}
        <div className="p-3 bg-blue-50 border-b border-blue-200 text-blue-900 text-[11px] flex items-start gap-2">
          <span className="font-bold">欄位自訂規則：</span>
          可自行新增、隱藏、刪除、重排序任意欄位。系統將記憶每個卡片的欄位配置，支援混合 WHAT/WHY/HOW/WHEN/ORIGIN 與自訂欄位。
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {editFields.map((field) => {
            const isEditing = editingField?.id === field.id;
            return (
              <div
                key={field.id}
                className={`border-2 rounded-lg p-3 transition-all ${
                  isEditing ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    {/* Field Name */}
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">
                        欄位名稱：
                      </label>
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => {
                          const updated = editFields.map((f) =>
                            f.id === field.id ? { ...f, name: e.target.value } : f
                          );
                          setEditFields(updated);
                          setEditingField({ ...field, name: e.target.value });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                      />
                    </div>

                    {/* Field Type */}
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">
                        欄位類型：
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) => {
                          const updated = editFields.map((f) =>
                            f.id === field.id
                              ? { ...f, type: e.target.value as CustomField["type"] }
                              : f
                          );
                          setEditFields(updated);
                          setEditingField({
                            ...field,
                            type: e.target.value as CustomField["type"],
                          });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white"
                      >
                        <option value="text">文字行（Text）</option>
                        <option value="textarea">文字區（Textarea）</option>
                        <option value="math">LaTeX 公式</option>
                        <option value="url">網址（URL）</option>
                        <option value="select">下拉選項</option>
                        <option value="tags">標籤清單</option>
                      </select>
                    </div>

                    {/* Placeholder */}
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">
                        提示文字：
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ""}
                        onChange={(e) => {
                          const updated = editFields.map((f) =>
                            f.id === field.id ? { ...f, placeholder: e.target.value } : f
                          );
                          setEditFields(updated);
                          setEditingField({ ...field, placeholder: e.target.value });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                        placeholder="輸入提示文字..."
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="font-bold text-slate-700 text-xs block mb-1">
                        說明：
                      </label>
                      <input
                        type="text"
                        value={field.description || ""}
                        onChange={(e) => {
                          const updated = editFields.map((f) =>
                            f.id === field.id ? { ...f, description: e.target.value } : f
                          );
                          setEditFields(updated);
                          setEditingField({ ...field, description: e.target.value });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                        placeholder="此欄位的用途說明..."
                      />
                    </div>

                    {/* Select Options */}
                    {field.type === "select" && (
                      <div>
                        <label className="font-bold text-slate-700 text-xs block mb-1">
                          選項（逗號分隔）：
                        </label>
                        <input
                          type="text"
                          value={(field.options || []).join(", ")}
                          onChange={(e) => {
                            const options = e.target.value.split(",").map((s) => s.trim());
                            const updated = editFields.map((f) =>
                              f.id === field.id ? { ...f, options } : f
                            );
                            setEditFields(updated);
                            setEditingField({ ...field, options });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 text-xs"
                          placeholder="選項 1, 選項 2, 選項 3"
                        />
                      </div>
                    )}

                    {/* Required & Visible Toggle */}
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => {
                            const updated = editFields.map((f) =>
                              f.id === field.id ? { ...f, required: e.target.checked } : f
                            );
                            setEditFields(updated);
                            setEditingField({ ...field, required: e.target.checked });
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-xs text-slate-600">必填</span>
                      </label>

                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.visible}
                          onChange={(e) => {
                            const updated = editFields.map((f) =>
                              f.id === field.id ? { ...f, visible: e.target.checked } : f
                            );
                            setEditFields(updated);
                            setEditingField({ ...field, visible: e.target.checked });
                          }}
                          className="rounded text-blue-600"
                        />
                        <span className="text-xs text-slate-600">可見</span>
                      </label>
                    </div>

                    {/* Done Button */}
                    <button
                      onClick={() => setEditingField(null)}
                      className="w-full px-2 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs"
                    >
                      完成編輯
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-800">
                        {field.name}
                        {field.required && <span className="text-rose-600 ml-1">*</span>}
                      </div>
                      <div className="text-slate-500 text-[10px] mt-0.5">
                        {field.type === "textarea" && "多行文字"}
                        {field.type === "text" && "單行文字"}
                        {field.type === "math" && "LaTeX 公式"}
                        {field.type === "url" && "網址連結"}
                        {field.type === "select" && "下拉選項"}
                        {field.type === "tags" && "標籤清單"}
                        {field.description && ` • ${field.description}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingField(field)}
                        className="px-2 py-1 rounded text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold"
                      >
                        編輯
                      </button>

                      <button
                        onClick={() => handleToggleVisible(field.id)}
                        className="p-1 text-slate-600 hover:text-slate-800"
                      >
                        {field.visible ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <button
                        onClick={() => handleMoveField(field.id, "up")}
                        disabled={field.order === 0}
                        className="p-1 text-slate-600 hover:text-slate-800 disabled:text-slate-300"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleMoveField(field.id, "down")}
                        disabled={field.order === editFields.length - 1}
                        className="p-1 text-slate-600 hover:text-slate-800 disabled:text-slate-300"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Field Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={handleAddField}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新增自訂欄位</span>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={() => {
              onUpdate(editFields);
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Check className="w-4 h-4" />
            <span>保存欄位配置</span>
          </button>
        </div>
      </div>
    </div>
  );
};
