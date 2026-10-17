"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { MathText } from "./MathText";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";

/**
 * v7.2：紙上編輯的共用原子元件。
 *
 * 設計原則：
 * 1. 預覽與編輯是同一棵元件樹；只有 editable 時才長出控制項。
 * 2. 顯示態用 MathText（KaTeX），編輯態用原始碼 textarea/input——不對 KaTeX DOM 做 contentEditable。
 * 3. 編輯中的格子用 local draft，blur / Ctrl+Enter 才 commit，避免 formData 重建造成焦點掉落。
 * 4. 所有控制項 print:hidden；顯示文字在列印時仍保留。
 */

export interface CardPaperEditTheme {
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  accentColor?: string;
  boxBg?: string;
  headingColor?: string;
}

export interface CardEditContextValue {
  editable: boolean;
  patch: (p: Partial<CardData>) => void;
  theme?: CardPaperEditTheme;
}

export const CardEditContext = React.createContext<CardEditContextValue | null>(null);

export const useCardEdit = () => React.useContext(CardEditContext);

/** 與 store.ts 的 genId 同樣的風格：prefix-timestamp-random */
export function newRowId(prefix = "row") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

function focusNextCell(current: HTMLElement) {
  const root = current.closest("[data-editable-cell]") as HTMLElement | null;
  const all = Array.from(document.querySelectorAll<HTMLElement>("[data-editable-cell]"));
  if (!root) return;
  const idx = all.indexOf(root);
  const next = all[idx + 1];
  if (next) next.focus();
}

// ============================================================================
//  EditableText — 顯示 MathText / 點擊後顯示原始碼 textarea（或多行 input）
// ============================================================================

export interface EditableTextProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  rows?: number;
  ariaLabel?: string;
  /** 預覽時即使空字串也顯示 placeholder（預設 true；純顯示欄位可關掉） */
  showPlaceholder?: boolean;
  /** 行內欄位（標題、領域等）：外框不強制佔滿整行 */
  inline?: boolean;
}

export function EditableText({
  value,
  onChange,
  multiline = false,
  placeholder,
  className = "",
  style,
  rows = 2,
  ariaLabel,
  showPlaceholder = true,
  inline = false,
}: EditableTextProps) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelledRef = useRef(false);
  const controlRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const el = controlRef.current;
    if (el) {
      el.focus();
      if (el instanceof HTMLTextAreaElement) {
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editing]);

  // textarea 自動增高：以 scrollHeight 為準，避免長文被截斷
  useEffect(() => {
    if (!editing) return;
    const el = controlRef.current;
    if (el instanceof HTMLTextAreaElement) {
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, 40)}px`;
    }
  }, [editing, draft]);

  const beginEdit = () => {
    if (!editable) return;
    setDraft(value);
    cancelledRef.current = false;
    setEditing(true);
  };

  const commit = () => {
    if (!editing) return;
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    cancelledRef.current = true;
    setDraft(value);
    setEditing(false);
  };

  const display = value ? (
    <MathText text={value} />
  ) : placeholder && showPlaceholder ? (
    <span className="italic opacity-50">{placeholder}</span>
  ) : null;

  if (!editable) {
    return (
      <span className={className} style={style}>
        {display}
      </span>
    );
  }

  const controlClass = `mt-1 block w-full min-w-[8rem] resize-y rounded border border-amber-400/80 bg-white/95 px-1.5 py-1 text-inherit leading-relaxed text-slate-900 shadow-sm outline-none ring-1 ring-amber-300/40 print:hidden ${
    multiline ? "min-h-[2.5rem]" : ""
  }`;

  return (
    <span
      data-editable-cell="true"
      tabIndex={0}
      onClick={beginEdit}
      onKeyDown={(e) => {
        // 避免 page.tsx 的全域快捷鍵（Ctrl/Cmd+K）吃到輸入
        e.stopPropagation();
        if (!editing && (e.key === "Enter" || e.key === "F2")) {
          e.preventDefault();
          beginEdit();
        }
      }}
      title={editing ? undefined : "點擊編輯（Esc 取消，Ctrl/⌘+Enter 提交）"}
      aria-label={ariaLabel}
      className={`group/editable min-w-0 cursor-text rounded-sm outline-none transition-colors hover:bg-amber-100/40 focus:bg-amber-50/60 focus:ring-1 focus:ring-amber-400/50 ${
        inline ? "inline-block max-w-full align-baseline" : "block w-full"
      }`}
      style={editing && inline ? { width: "min(100%, 420px)" } : undefined}
    >
      <span
        className={`${className} ${editing ? "hidden print:inline" : ""} ${
          value ? "" : "text-inherit"
        }`}
        style={style}
      >
        {display}
      </span>

      {editing &&
        (multiline ? (
          <textarea
            ref={(el) => { controlRef.current = el; }}
            value={draft}
            rows={rows}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={stop}
            onPointerDown={stop}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                commit();
                focusNextCell(e.currentTarget);
              }
            }}
            className={controlClass}
            style={style}
            placeholder={placeholder}
            aria-label={ariaLabel}
          />
        ) : (
          <input
            ref={(el) => { controlRef.current = el; }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onClick={stop}
            onPointerDown={stop}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                cancel();
              } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                commit();
                focusNextCell(e.currentTarget);
              }
            }}
            className={controlClass}
            style={style}
            placeholder={placeholder}
            aria-label={ariaLabel}
          />
        ))}
    </span>
  );
}

// ============================================================================
//  EditableList — 清單列（hover 出現 ＋ / ✕ / ↑ / ↓）
// ============================================================================

export interface EditableListControls {
  add: () => void;
  remove: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

export interface EditableListProps<T> {
  items: T[];
  onChange: (next: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, index: number, controls: EditableListControls) => React.ReactNode;
  className?: string;
  itemClassName?: string;
  addLabel?: string;
  emptyPlaceholder?: React.ReactNode;
  keyOf?: (item: T, index: number) => React.Key;
}

function ListControlButton({
  title,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 items-center justify-center rounded border bg-white text-slate-500 shadow-sm transition-colors disabled:opacity-30 ${
        danger ? "border-rose-200 hover:bg-rose-50 hover:text-rose-600" : "border-slate-200 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

export function EditableList<T>({
  items,
  onChange,
  newItem,
  renderItem,
  className = "",
  itemClassName = "",
  addLabel = "新增一列",
  emptyPlaceholder,
  keyOf,
}: EditableListProps<T>) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  const removeAt = (index: number) => {
    if (items.length === 1) {
      const ok = typeof window !== "undefined"
        ? window.confirm("這是最後一列，刪除後此清單會變空。確定要刪除嗎？")
        : false;
      if (!ok) return;
    }
    onChange(items.filter((_, i) => i !== index));
  };

  const addAt = (index: number) => {
    const next = [...items];
    next.splice(index + 1, 0, newItem());
    onChange(next);
  };

  const controlsFor = (index: number): EditableListControls => ({
    add: () => addAt(index),
    remove: () => removeAt(index),
    moveUp: () => move(index, index - 1),
    moveDown: () => move(index, index + 1),
  });

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div
          key={keyOf ? keyOf(item, index) : index}
          className={`group/editrow relative ${itemClassName}`}
        >
          {editable && (
            <div className="absolute -right-1 -top-1 z-20 hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white/95 p-0.5 shadow-md group-hover/editrow:flex print:hidden">
              <ListControlButton title="新增同型一列" onClick={() => addAt(index)}>
                <Plus className="h-3 w-3" />
              </ListControlButton>
              <ListControlButton title="上移" onClick={() => move(index, index - 1)} disabled={index === 0}>
                <ArrowUp className="h-3 w-3" />
              </ListControlButton>
              <ListControlButton title="下移" onClick={() => move(index, index + 1)} disabled={index === items.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </ListControlButton>
              <ListControlButton title="刪除這一列" onClick={() => removeAt(index)} danger>
                <Trash2 className="h-3 w-3" />
              </ListControlButton>
            </div>
          )}
          {renderItem(item, index, controlsFor(index))}
        </div>
      ))}

      {editable && (
        <button
          type="button"
          onClick={() => addAt(items.length - 1)}
          className="mt-1.5 inline-flex items-center gap-1 rounded border border-dashed border-amber-400/80 bg-amber-50/50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100/70 print:hidden"
        >
          <Plus className="h-3 w-3" />
          {addLabel}
        </button>
      )}

      {!editable && items.length === 0 && emptyPlaceholder}
    </div>
  );
}

// ============================================================================
//  EditableSelect / EditableToggle / EditableCheck / EditableRating / EditableSlider
// ============================================================================

export interface EditableOption {
  value: string;
  label: string;
}

export function EditableSelect({
  value,
  options,
  onChange,
  className = "",
  style,
  controlClassName = "",
  ariaLabel,
}: {
  value: string;
  options: EditableOption[];
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  controlClassName?: string;
  ariaLabel?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;
  const opts = options.some((o) => o.value === value)
    ? options
    : [{ value, label: value || "（未設定）" }, ...options];
  const current = opts.find((o) => o.value === value);

  if (!editable) {
    return (
      <span className={className} style={style}>
        {current?.label ?? value}
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={stop}
      aria-label={ariaLabel}
      className={
        controlClassName ||
        "max-w-full rounded border border-amber-400/80 bg-white/95 px-1 py-0.5 text-[10px] text-slate-900 shadow-sm outline-none ring-1 ring-amber-300/40 print:hidden"
      }
      style={style}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EditableToggle({
  checked,
  onChange,
  onLabel,
  offLabel,
  className = "",
  onClassName = "text-emerald-700",
  offClassName = "text-amber-700",
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onLabel: string;
  offLabel: string;
  className?: string;
  onClassName?: string;
  offClassName?: string;
  ariaLabel?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  if (!editable) {
    return <span className={`${className} ${checked ? onClassName : offClassName}`}>{checked ? onLabel : offLabel}</span>;
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`inline-flex items-center gap-1 rounded border border-amber-400/60 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold shadow-sm print:hidden ${className} ${
        checked ? onClassName : offClassName
      }`}
    >
      <span>{checked ? onLabel : offLabel}</span>
      <span
        className={`relative inline-flex h-3 w-5 items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-amber-400"
        }`}
      >
        <span
          className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[9px]" : "left-[1px]"
          }`}
        />
      </span>
    </button>
  );
}

export function EditableCheck({
  checked,
  onChange,
  label,
  className = "",
  showWhenUnchecked = false,
  checkedClassName = "",
  uncheckedClassName = "opacity-45",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  className?: string;
  showWhenUnchecked?: boolean;
  checkedClassName?: string;
  uncheckedClassName?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  if (!editable) {
    if (!checked && !showWhenUnchecked) return null;
    return (
      <span className={`${className} ${checked ? checkedClassName : uncheckedClassName}`}>
        {checked && <Check className="mr-0.5 inline h-3 w-3" />}
        {label}
      </span>
    );
  }

  return (
    <label
      className={`inline-flex cursor-pointer items-center gap-1 rounded border border-amber-300/70 bg-white/90 px-1.5 py-0.5 text-[10px] font-bold shadow-sm print:hidden ${className} ${
        checked ? `text-slate-900 ${checkedClassName}` : `text-slate-500 ${uncheckedClassName}`
      }`}
      onPointerDown={stop}
      onClick={stop}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 cursor-pointer accent-blue-600"
      />
      {label}
    </label>
  );
}

export function EditableRating({
  value,
  onChange,
  max = 5,
  min = 1,
  className = "",
  activeClassName = "bg-amber-400 text-amber-950 border-amber-500",
  idleClassName = "bg-white text-slate-400 border-slate-300",
  size = "h-5 w-5 text-[10px]",
}: {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  className?: string;
  activeClassName?: string;
  idleClassName?: string;
  size?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {nums.map((num) => {
        const active = value >= num;
        if (!editable) {
          return (
            <span
              key={num}
              className={`${size} inline-flex items-center justify-center rounded-full border font-bold ${
                active ? activeClassName : idleClassName
              }`}
            >
              {num}
            </span>
          );
        }
        return (
          <button
            key={num}
            type="button"
            title={`設為 ${num}`}
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              onChange(num);
            }}
            className={`${size} inline-flex items-center justify-center rounded-full border font-bold shadow-sm transition-transform hover:scale-110 print:hidden ${
              active ? activeClassName : idleClassName
            }`}
          >
            {num}
          </button>
        );
      })}
    </span>
  );
}

export function EditableSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  suffix = "%",
  className = "",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  className?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  if (!editable) {
    return <span className={`font-mono ${className}`}>{value}{suffix}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 print:hidden ${className}`}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={stop}
        onClick={stop}
        onKeyDown={stop}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-3 w-20 cursor-pointer accent-blue-600"
      />
      <span className="w-9 text-right font-mono text-[10px] text-slate-700">{value}{suffix}</span>
    </span>
  );
}

export function EditableTagGroup({
  options,
  active,
  onChange,
  className = "",
  chipClassName = "",
  activeStyle,
  inactiveStyle,
  activeLabelClassName = "font-bold shadow-xs",
  inactiveLabelClassName = "opacity-45",
}: {
  options: Array<{ value: string; label: React.ReactNode; title?: string }>;
  active: string[];
  onChange: (next: string[]) => void;
  className?: string;
  chipClassName?: string;
  activeStyle?: React.CSSProperties;
  inactiveStyle?: React.CSSProperties;
  activeLabelClassName?: string;
  inactiveLabelClassName?: string;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  const toggle = (value: string) => {
    onChange(active.includes(value) ? active.filter((v) => v !== value) : [...active, value]);
  };

  return (
    <span className={`inline-flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => {
        const isActive = active.includes(opt.value);
        if (!editable) {
          return (
            <span
              key={opt.value}
              title={opt.title}
              className={`px-2 py-0.5 rounded border text-[11px] ${chipClassName} ${
                isActive ? activeLabelClassName : inactiveLabelClassName
              }`}
              style={isActive ? activeStyle : inactiveStyle}
            >
              {opt.label}
            </span>
          );
        }
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title || "點擊切換"}
            onPointerDown={stop}
            onClick={(e) => {
              e.stopPropagation();
              toggle(opt.value);
            }}
            className={`px-2 py-0.5 rounded border text-[11px] shadow-sm transition-all print:hidden ${chipClassName} ${
              isActive ? activeLabelClassName : inactiveLabelClassName
            }`}
            style={isActive ? activeStyle : inactiveStyle}
          >
            {opt.label}
          </button>
        );
      })}
    </span>
  );
}

/** 唯讀區塊標記（P7 過程日誌、關係邊） */
export function ReadOnlyBadge({ label = "唯讀" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 print:hidden">
      {label}
    </span>
  );
}

// ============================================================================
//  ApplyBranchTree — APPLY 分支樹的紙上編輯（支援巢狀、區域 CHECK、狀態切換）
// ============================================================================

export interface ApplyBranchCheck {
  id: string;
  cue: string;
  check: string;
  keywords?: string[];
  twoStageTransform?: string;
  source?: string;
}

export interface ApplyBranch {
  id: string;
  title: string;
  action: string;
  isCompiled: boolean;
  constructionAction?: string;
  source?: string;
  checks?: ApplyBranchCheck[];
  branches?: ApplyBranch[];
}

function RowIconButton({
  title,
  onClick,
  children,
  danger = false,
  disabled = false,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-5 w-5 items-center justify-center rounded border bg-white text-[9px] shadow-sm transition-colors disabled:opacity-30 print:hidden ${
        danger ? "border-rose-200 text-rose-500 hover:bg-rose-50" : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function ApplyBranchRow({
  branch,
  index,
  siblings,
  onChangeSiblings,
  depth,
  font,
  theme,
}: {
  branch: ApplyBranch;
  index: number;
  siblings: ApplyBranch[];
  onChangeSiblings: (next: ApplyBranch[]) => void;
  depth: number;
  font: string;
  theme?: CardPaperEditTheme;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  const patch = (p: Partial<ApplyBranch>) =>
    onChangeSiblings(siblings.map((b, i) => (i === index ? { ...b, ...p } : b)));

  const remove = () => {
    if (depth === 0 && siblings.length === 1) {
      const ok = typeof window !== "undefined"
        ? window.confirm("這是最後一個分支，刪除後 APPLY 分支樹會變空。確定刪除嗎？")
        : false;
      if (!ok) return;
    }
    onChangeSiblings(siblings.filter((_, i) => i !== index));
  };

  const move = (to: number) => {
    if (to < 0 || to >= siblings.length) return;
    const next = [...siblings];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row);
    onChangeSiblings(next);
  };

  const addSibling = () => {
    const node: ApplyBranch = {
      id: newRowId("branch"),
      title: "",
      action: "",
      isCompiled: false,
      checks: [],
      branches: [],
    };
    const next = [...siblings];
    next.splice(index + 1, 0, node);
    onChangeSiblings(next);
  };

  const addChild = () => {
    const node: ApplyBranch = {
      id: newRowId("branch"),
      title: "",
      action: "",
      isCompiled: false,
      checks: [],
      branches: [],
    };
    patch({ branches: [...(branch.branches || []), node] });
  };

  const borderColor = theme?.borderColor || "#e2e8f0";

  return (
    <div className={depth > 0 ? "border-t border-dashed" : ""} style={{ borderColor }}>
      <div
        className="grid grid-cols-12 py-2 px-2 items-start text-xs"
        style={{
          backgroundColor: depth === 0 ? "rgba(255,255,255,0.6)" : "rgba(248,250,252,0.8)",
          paddingLeft: `${8 + depth * 16}px`,
        }}
      >
        <div className="col-span-4 font-bold text-slate-900 pr-2 space-y-1">
          <div>
            【看到{" "}
            <EditableText
              value={branch.title || ""}
              onChange={(v) => patch({ title: v })}
              placeholder={`分支 ${depth === 0 ? index + 1 : ""}`}
              inline
              className="font-bold"
              style={{ color: theme?.headingColor || "#0f172a", fontFamily: font }}
              ariaLabel={`分支 ${index + 1} 標題`}
            />
            】
          </div>
          <div>
            <EditableToggle
              checked={!!branch.isCompiled}
              onChange={(v) => patch({ isCompiled: v })}
              onLabel="✓已編譯"
              offLabel="[未編譯]"
              onClassName="text-emerald-600"
              offClassName="text-amber-600"
              ariaLabel={`分支 ${index + 1} 編譯狀態`}
            />
          </div>
          {(editable || branch.constructionAction) && (
            <div className="text-[10px] font-normal text-amber-900 bg-amber-50 p-1 rounded border border-amber-200">
              <b>兩段式構造：</b>
              <EditableText
                value={branch.constructionAction || ""}
                onChange={(v) => patch({ constructionAction: v })}
                multiline
                rows={1}
                placeholder="遇到看似不相關題 → 想到把___設成___"
                className="text-[10px]"
                style={{ color: "#78350f", fontFamily: font }}
                ariaLabel={`分支 ${index + 1} 兩段式構造`}
              />
            </div>
          )}

          {editable && (
            <div className="flex flex-wrap items-center gap-0.5 pt-0.5 print:hidden">
              <RowIconButton title="新增同層分支" onClick={addSibling}>
                <Plus className="h-3 w-3" />
              </RowIconButton>
              <RowIconButton title="上移" onClick={() => move(index - 1)} disabled={index === 0}>
                <ArrowUp className="h-3 w-3" />
              </RowIconButton>
              <RowIconButton title="下移" onClick={() => move(index + 1)} disabled={index === siblings.length - 1}>
                <ArrowDown className="h-3 w-3" />
              </RowIconButton>
              <RowIconButton title="新增子分支" onClick={addChild}>
                <Plus className="h-3 w-3" />
              </RowIconButton>
              <RowIconButton title="刪除分支" onClick={remove} danger>
                <Trash2 className="h-3 w-3" />
              </RowIconButton>
            </div>
          )}
        </div>

        <div className="col-span-6 leading-relaxed pr-2 space-y-1.5" style={{ fontFamily: font }}>
          <EditableText
            value={branch.action || ""}
            onChange={(v) => patch({ action: v })}
            multiline
            rows={2}
            placeholder="（執行步驟）"
            className="text-xs"
            style={{ color: theme?.textColor || "#334155", fontFamily: font }}
            ariaLabel={`分支 ${index + 1} 流程`}
          />

          {((branch.checks || []).length > 0 || editable) && (
            <EditableList<ApplyBranchCheck>
              items={branch.checks || []}
              onChange={(next) => patch({ checks: next })}
              newItem={() => ({ id: newRowId("check"), cue: "", check: "" })}
              addLabel="新增區域 CHECK"
              className="space-y-1 pt-1"
              itemClassName=""
              emptyPlaceholder={null}
              renderItem={(rc, rci) => {
                const patchCheck = (p: Partial<ApplyBranchCheck>) => {
                  const next = [...(branch.checks || [])];
                  next[rci] = { ...next[rci], ...p };
                  patch({ checks: next });
                };
                return (
                  <div className="p-1.5 rounded bg-blue-50/70 border border-blue-200 text-[10px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-bold text-blue-900">‖ 區域 CHECK：</span>
                      <span>看到「</span>
                      <EditableText
                        value={rc.cue || ""}
                        onChange={(v) => patchCheck({ cue: v })}
                        placeholder="觸發線索"
                        inline
                        className="text-[10px]"
                        style={{ color: theme?.textColor || "#334155", fontFamily: font }}
                        ariaLabel={`區域 CHECK ${rci + 1} 線索`}
                      />
                      <span>」</span>
                    </div>
                    <div className="mt-0.5">
                      <b className="text-amber-900">→ 兩段式變換／識別：</b>
                      <EditableText
                        value={rc.twoStageTransform || ""}
                        onChange={(v) => patchCheck({ twoStageTransform: v })}
                        placeholder="先做什麼變換"
                        inline
                        className="text-[10px]"
                        style={{ color: theme?.textColor || "#334155", fontFamily: font }}
                        ariaLabel={`區域 CHECK ${rci + 1} 變換`}
                      />
                    </div>
                    <div className="mt-0.5">
                      <b className="text-emerald-900">→ 檢查：</b>
                      <EditableText
                        value={rc.check || ""}
                        onChange={(v) => patchCheck({ check: v })}
                        placeholder="檢查什麼"
                        inline
                        className="text-[10px]"
                        style={{ color: theme?.textColor || "#334155", fontFamily: font }}
                        ariaLabel={`區域 CHECK ${rci + 1} 檢查`}
                      />
                    </div>
                    <div className="mt-0.5 text-indigo-700 font-mono">
                      <EditableText
                        value={rc.source || ""}
                        onChange={(v) => patchCheck({ source: v })}
                        placeholder="[源:___]"
                        inline
                        className="text-[9px] font-mono"
                        style={{ color: "#4338ca", fontFamily: "monospace" }}
                        ariaLabel={`區域 CHECK ${rci + 1} 來源`}
                      />
                    </div>
                  </div>
                );
              }}
            />
          )}
        </div>

        <div className="col-span-2 text-right text-[10px] text-indigo-700 font-mono">
          <EditableText
            value={branch.source || ""}
            onChange={(v) => patch({ source: v })}
            placeholder="[源:WHY/分支]"
            inline
            className="text-[10px] font-mono"
            style={{ color: "#4338ca", fontFamily: "monospace" }}
            ariaLabel={`分支 ${index + 1} 來源`}
          />
        </div>
      </div>

      {(branch.branches || []).length > 0 && (
        <div style={{ paddingLeft: `${depth * 12}px` }}>
          <ApplyBranchTree
            branches={branch.branches || []}
            onChange={(next) => patch({ branches: next })}
            font={font}
            theme={theme}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

export function ApplyBranchTree({
  branches,
  onChange,
  font,
  theme,
  depth = 0,
}: {
  branches: ApplyBranch[];
  onChange: (next: ApplyBranch[]) => void;
  font: string;
  theme?: CardPaperEditTheme;
  depth?: number;
}) {
  const ed = useCardEdit();
  const editable = !!ed?.editable;

  const addTop = () => {
    onChange([
      ...branches,
      { id: newRowId("branch"), title: "", action: "", isCompiled: false, checks: [], branches: [] },
    ]);
  };

  if (branches.length === 0 && !editable) {
    return <div className="p-3 text-center text-xs italic text-slate-400">（尚未建立分支步驟）</div>;
  }

  return (
    <div className="divide-y" style={{ borderColor: theme?.borderColor || "#e2e8f0" }}>
      {branches.map((b, i) => (
        <ApplyBranchRow
          key={b.id || i}
          branch={b}
          index={i}
          siblings={branches}
          onChangeSiblings={onChange}
          depth={depth}
          font={font}
          theme={theme}
        />
      ))}
      {editable && (
        <div className="p-2 print:hidden">
          <button
            type="button"
            onClick={addTop}
            className="inline-flex items-center gap-1 rounded border border-dashed border-amber-400/80 bg-amber-50/50 px-2 py-1 text-[10px] font-bold text-amber-800 hover:bg-amber-100/70"
          >
            <Plus className="h-3 w-3" />
            {depth === 0 ? "新增分支" : "新增同層分支"}
          </button>
        </div>
      )}
    </div>
  );
}
