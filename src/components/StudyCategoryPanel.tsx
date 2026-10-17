"use client";

import React, { useState } from "react";
import { ChevronUp, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { useWorkspaceState, actions } from "@/lib/store";
import {
  CATEGORY_PALETTE,
  UNCATEGORIZED_ID,
  UNCATEGORIZED_NAME,
  type StudyCategory,
} from "@/lib/study";

interface StudyCategoryPanelProps {
  onClose: () => void;
}

/** 單列分類：改名用 local draft（blur／Enter 才提交），避免每鍵盤重繪整座書架 */
function CategoryRow({ cat, isFirst, isLast }: { cat: StudyCategory; isFirst: boolean; isLast: boolean }) {
  const [draft, setDraft] = useState(cat.name);
  const isReserved = cat.id === UNCATEGORIZED_ID;

  const commitName = () => {
    const name = draft.trim();
    if (!name) {
      setDraft(cat.name);
      return;
    }
    if (name !== cat.name) actions.updateCategory(cat.id, { name });
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/70 px-2 py-1.5">
      <input
        type="color"
        value={cat.color}
        onChange={(e) => actions.updateCategory(cat.id, { color: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-stone-200 bg-transparent"
        title="分類顏色（標籤與書脊分類色）"
        aria-label={`「${cat.name}」分類顏色`}
        disabled={isReserved}
      />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commitName();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        maxLength={24}
        className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-amber-400"
        title={isReserved ? "系統保留分類：不可刪除、不可改名為空" : "分類名稱（改名不影響書本關聯）"}
        aria-label={`分類名稱：${cat.name}`}
      />
      {isReserved ? (
        <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500">系統</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => actions.moveCategory(cat.id, -1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isFirst}
            className="touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded text-stone-500 hover:bg-stone-100 disabled:opacity-30"
            title="上移"
            aria-label={`「${cat.name}」上移`}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => actions.moveCategory(cat.id, 1)}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isLast}
            className="touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded text-stone-500 hover:bg-stone-100 disabled:opacity-30"
            title="下移"
            aria-label={`「${cat.name}」下移`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`刪除分類「${cat.name}」？該櫃板的書會全部回到「${UNCATEGORIZED_NAME}」（不會刪卡）。`)) {
                actions.deleteCategory(cat.id);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded text-rose-500 hover:bg-rose-50"
            title="刪除分類（書回未分類）"
            aria-label={`刪除分類「${cat.name}」`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/**
 * 分類管理面板：新增／改名／改色／上下移動／刪除。
 * 「未分類」為系統保留分類：不可刪除、不可改名為空。
 * 刪除分類只把書移回未分類，絕不刪卡。
 */
export const StudyCategoryPanel: React.FC<StudyCategoryPanelProps> = ({ onClose }) => {
  const state = useWorkspaceState();
  const cats = [...state.studyCategories].sort((a, b) => a.order - b.order);
  const userCats = cats.filter((c) => c.id !== UNCATEGORIZED_ID);
  const reserved = cats.find((c) => c.id === UNCATEGORIZED_ID);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CATEGORY_PALETTE[userCats.length % CATEGORY_PALETTE.length]);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    actions.addCategory({ name, color: newColor });
    setNewName("");
    setNewColor(CATEGORY_PALETTE[(userCats.length + 1) % CATEGORY_PALETTE.length]);
  };

  return (
    <div
      className="study-category-panel fixed right-2 top-16 z-[70] w-[min(320px,calc(100vw-16px))] rounded-xl border border-stone-300/80 bg-[#faf5ea] shadow-2xl sm:absolute sm:right-3 sm:top-14"
      data-no-orbit="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="分類管理"
    >
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
        <h3 className="text-sm font-bold text-stone-800">分類櫃板</h3>
        <button
          type="button"
          onClick={onClose}
          className="touch-target flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/70"
          aria-label="關閉分類管理"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[52vh] space-y-1.5 overflow-y-auto p-2.5">
        {userCats.map((cat, i) => (
          <CategoryRow key={cat.id} cat={cat} isFirst={i === 0} isLast={i === userCats.length - 1} />
        ))}
        {reserved && <CategoryRow cat={reserved} isFirst={false} isLast={false} />}

        {/* 新增分類 */}
        <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-2 py-1.5">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-7 w-7 shrink-0 cursor-pointer rounded border border-stone-200 bg-transparent"
            title="新分類顏色"
            aria-label="新分類顏色"
          />
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleAdd();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            maxLength={24}
            placeholder="新分類名稱…"
            className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:border-amber-400"
            aria-label="新分類名稱"
          />
          <button
            type="button"
            onClick={handleAdd}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={!newName.trim()}
            className="touch-target flex h-7 w-7 shrink-0 items-center justify-center rounded bg-amber-700 text-white hover:bg-amber-800 disabled:opacity-40"
            title="新增分類"
            aria-label="新增分類"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="border-t border-stone-200 px-3 py-2 text-[10px] leading-relaxed text-stone-500">
        書本只屬於一個櫃板；刪除分類不會刪卡，書會回到「{UNCATEGORIZED_NAME}」。改名不影響書本關聯（以 id 關聯）。
      </p>
    </div>
  );
};
