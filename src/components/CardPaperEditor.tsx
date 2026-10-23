"use client";

import React, { useState, useEffect, useRef } from "react";
import type { CardData } from "./KnowledgeCardNode";
import type { RemoteEditingPresence } from "@/lib/collaborationEditing";
import { MathText } from "./MathText";
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Edit2, ChevronDown, ChevronRight, X } from "lucide-react";

// =========================================================================
//  CardEditContext
// =========================================================================

export interface CardEditContextType {
  editable: boolean;
  patch: (p: Partial<CardData>) => void;
  card?: CardData;
  resolveTextFieldPath?: (value: string) => string | null;
  remoteTextPresence?: RemoteEditingPresence[];
}

export const CardEditContext = React.createContext<CardEditContextType | null>(null);

export const useCardEdit = () => React.useContext(CardEditContext);

// =========================================================================
//  EditableText (可編輯文字：顯示用 MathText，點擊進入編輯態原始碼)
// =========================================================================

interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  font?: string;
  style?: React.CSSProperties;
  asInput?: boolean;
  type?: string;
  showCue?: boolean;
}

export const EditableText: React.FC<EditableTextProps> = ({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder = "（點擊編輯內容…）",
  className = "",
  font,
  style,
  asInput = false,
  type = "text",
  showCue = true,
}) => {
  const ed = useCardEdit();
  const editable = ed?.editable ?? false;
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const fieldPath = ed?.resolveTextFieldPath?.(value) ?? null;
  const remoteCursors = fieldPath
    ? (ed?.remoteTextPresence || []).filter((presence) => presence.path === fieldPath && presence.active)
    : [];
  const cursorMarkers = remoteCursors.map((presence) => (
    <span
      key={presence.participantId}
      className="ml-1 inline-flex items-center gap-1 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-semibold text-indigo-700 align-middle"
      title={`${presence.name}${presence.typing ? " 正在輸入" : " 正在編輯"} · 游標第 ${presence.position + 1} 字`}
      aria-label={`${presence.name} 的遠端游標，第 ${presence.position + 1} 字`}
    >
      <span className="h-3 w-0.5 bg-indigo-500" />{presence.name}
    </span>
  ));

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ("selectionStart" in inputRef.current) {
        const length = inputRef.current.value.length;
        inputRef.current.setSelectionRange(length, length);
      }
    }
  }, [isEditing]);

  const commit = () => setIsEditing(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 阻止向外冒泡以避免觸發畫布全域快捷鍵
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      commit();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey || (!multiline && !asInput))) {
      e.preventDefault();
      commit();
    }
  };

  if (!editable) {
    return (
      <span className={className} style={{ fontFamily: font, ...style }}>
        <span data-collaborative-text-path={fieldPath ?? undefined}>
          {value ? <MathText text={value} /> : <span className="italic opacity-45">{placeholder}</span>}
        </span>
        {cursorMarkers}
      </span>
    );
  }

  if (isEditing) {
    return (
      <div className="relative w-full my-1 print:hidden" onClick={(e) => e.stopPropagation()}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            data-collaborative-text-path={fieldPath ?? undefined}
            value={value}
            rows={rows}
            onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full p-2 text-xs rounded border-2 border-blue-500 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono leading-relaxed"
            style={{ fontFamily: font }}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            data-collaborative-text-path={fieldPath ?? undefined}
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs rounded border-2 border-blue-500 bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
            style={{ fontFamily: font }}
          />
        )}
        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 px-1 font-sans">
          <span>Esc 結束編輯 · Ctrl/Cmd+Enter 完成</span>
          <div className="flex items-center gap-1">
            {cursorMarkers}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit();
              }}
              className="px-1.5 py-0.5 bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      className={`group/edit cursor-pointer rounded px-1 -mx-1 transition-all hover:bg-blue-50/70 hover:ring-1 hover:ring-blue-300 relative inline-block max-w-full ${
        !value ? "italic text-slate-400 border border-dashed border-slate-300 bg-slate-50/50 py-0.5" : ""
      } ${className}`}
      style={{ fontFamily: font, ...style }}
      title="點擊編輯此欄位"
    >
      <span data-collaborative-text-path={fieldPath ?? undefined}>
        {value ? <MathText text={value} /> : <span>{placeholder}</span>}
      </span>
      {cursorMarkers}
      {showCue && (
        <span className="opacity-0 group-hover/edit:opacity-100 ml-1 text-[10px] text-blue-600 font-sans print:hidden align-middle">
          ✎
        </span>
      )}
    </div>
  );
};

// =========================================================================
//  EditableRating (信心分 1-5 點擊直接打分)
// =========================================================================

interface EditableRatingProps {
  value: number;
  onChange: (val: number) => void;
  max?: number;
  activeColor?: string;
  size?: "sm" | "md";
}

export const EditableRating: React.FC<EditableRatingProps> = ({
  value,
  onChange,
  max = 5,
  activeColor = "bg-amber-400 text-amber-950 border-amber-500",
  size = "md",
}) => {
  const ed = useCardEdit();
  const editable = ed?.editable ?? false;
  const items = Array.from({ length: max }, (_, i) => i + 1);
  const sizeClass = size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]";

  return (
    <div className="flex items-center gap-1">
      {items.map((num) => {
        const isActive = value >= num;
        return (
          <button
            key={num}
            type="button"
            disabled={!editable}
            onClick={() => onChange(num)}
            className={`${sizeClass} rounded-full inline-flex items-center justify-center font-bold border transition-all ${
              isActive ? `${activeColor} shadow-2xs` : "bg-white text-slate-400 border-slate-300"
            } ${editable ? "cursor-pointer hover:scale-110" : "cursor-default"}`}
            title={editable ? `設為 ${num} 分` : undefined}
          >
            {num}
          </button>
        );
      })}
    </div>
  );
};

// =========================================================================
//  EditableToggle (可點選開關 / 徽章)
// =========================================================================

interface EditableToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  activeClass?: string;
  inactiveClass?: string;
  className?: string;
}

export const EditableToggle: React.FC<EditableToggleProps> = ({
  checked,
  onChange,
  label,
  activeClass = "bg-blue-600 text-white border-blue-600",
  inactiveClass = "bg-white text-slate-600 border-slate-300 opacity-60",
  className = "",
}) => {
  const ed = useCardEdit();
  const editable = ed?.editable ?? false;

  return (
    <button
      type="button"
      disabled={!editable}
      onClick={() => onChange(!checked)}
      className={`px-2 py-0.5 rounded border text-[10px] font-bold transition-all flex items-center gap-1 ${
        checked ? activeClass : inactiveClass
      } ${editable ? "cursor-pointer hover:opacity-90" : "cursor-default"} ${className}`}
    >
      <span>{checked ? "✓" : "○"}</span>
      {label && <span>{label}</span>}
    </button>
  );
};

// =========================================================================
//  EditableSelect (可選下拉式選項)
// =========================================================================

interface EditableSelectProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const EditableSelect: React.FC<EditableSelectProps> = ({
  value,
  options,
  onChange,
  className = "",
  style,
}) => {
  const ed = useCardEdit();
  const editable = ed?.editable ?? false;

  if (!editable) {
    const selected = options.find((o) => o.value === value);
    return <span className={className} style={style}>{selected?.label || value}</span>;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`p-1 rounded border border-slate-300 bg-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer ${className}`}
      style={style}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

// =========================================================================
//  EditableListItemControls (清單列操作工具：＋ ✕ ↑ ↓)
// =========================================================================

interface EditableListItemControlsProps {
  onAddBelow?: () => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  className?: string;
}

export const EditableListItemControls: React.FC<EditableListItemControlsProps> = ({
  onAddBelow,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  className = "",
}) => {
  const ed = useCardEdit();
  if (!ed?.editable) return null;

  return (
    <div
      className={`flex items-center gap-0.5 print:hidden opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded border border-slate-200 p-0.5 shadow-2xs ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {canMoveUp && onMoveUp && (
        <button
          type="button"
          onClick={onMoveUp}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          title="上移"
        >
          <ArrowUp className="w-3 h-3" />
        </button>
      )}
      {canMoveDown && onMoveDown && (
        <button
          type="button"
          onClick={onMoveDown}
          className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          title="下移"
        >
          <ArrowDown className="w-3 h-3" />
        </button>
      )}
      {onAddBelow && (
        <button
          type="button"
          onClick={onAddBelow}
          className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          title="在下方新增一列"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm("確定要刪除此項目嗎？")) {
              onRemove();
            }
          }}
          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
          title="刪除此項"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

// =========================================================================
//  List Helpers
// =========================================================================

export function listMove<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return list;
  const temp = next[index];
  next[index] = next[target];
  next[target] = temp;
  return next;
}

export function listRemove<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function listInsert<T>(list: T[], index: number, item: T): T[] {
  const next = [...list];
  next.splice(index + 1, 0, item);
  return next;
}

// =========================================================================
//  Branch Tree Helpers (HOW 分支樹深度不可變更新)
// =========================================================================

export type HowBranchItem = NonNullable<NonNullable<CardData["howData"]>["branches"]>[number];

export function updateBranchDeep(
  list: HowBranchItem[],
  path: number[],
  patch: Partial<HowBranchItem> | ((node: HowBranchItem) => HowBranchItem)
): HowBranchItem[] {
  if (path.length === 0) return list;
  const [head, ...tail] = path;
  return list.map((b, idx) => {
    if (idx !== head) return b;
    if (tail.length === 0) {
      if (typeof patch === "function") {
        return patch(b);
      }
      return { ...b, ...patch };
    }
    return {
      ...b,
      branches: updateBranchDeep(
        (b.branches as HowBranchItem[]) || [],
        tail,
        patch
      ),
    };
  });
}

export function removeBranchDeep(list: HowBranchItem[], path: number[]): HowBranchItem[] {
  if (path.length === 0) return list;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    return list.filter((_, idx) => idx !== head);
  }
  return list.map((b, idx) => {
    if (idx !== head) return b;
    return {
      ...b,
      branches: removeBranchDeep((b.branches as HowBranchItem[]) || [], tail),
    };
  });
}

export function addBranchDeep(
  list: HowBranchItem[],
  path: number[],
  initialSub?: Partial<HowBranchItem>
): HowBranchItem[] {
  const newSub: HowBranchItem = {
    id: `br-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: initialSub?.title || "新子分支",
    action: initialSub?.action || "",
    isCompiled: initialSub?.isCompiled ?? true,
    source: initialSub?.source || "[源:WHY/分支]",
    ...initialSub,
  };
  if (path.length === 0) {
    return [...list, newSub];
  }
  const [head, ...tail] = path;
  return list.map((b, idx) => {
    if (idx !== head) return b;
    if (tail.length === 0) {
      return {
        ...b,
        branches: [...((b.branches as HowBranchItem[]) || []), newSub],
      };
    }
    return {
      ...b,
      branches: addBranchDeep(
        (b.branches as HowBranchItem[]) || [],
        tail,
        initialSub
      ),
    };
  });
}


// =========================================================================

export const EditableListAddButton: React.FC<{
  onClick: () => void;
  label?: string;
  className?: string;
}> = ({ onClick, label = "+ 新增項目", className = "" }) => {
  const ed = useCardEdit();
  if (!ed?.editable) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-2.5 py-1 rounded-md border border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100 text-blue-700 font-bold transition-all flex items-center gap-1 print:hidden ${className}`}
    >
      <Plus className="w-3 h-3" />
      <span>{label}</span>
    </button>
  );
};
