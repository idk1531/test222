"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { CardData } from "./KnowledgeCardNode";
import { BookSpine } from "./BookSpine";
import { useWorkspaceState, actions } from "@/lib/store";
import {
  bookThicknessFor,
  packBoards,
  UNCATEGORIZED_ID,
  type StudyBookLayout,
  type StudyCategory,
} from "@/lib/study";

interface BookshelfViewProps {
  /** 開啟筆記卡（沿用 CardDetailModal，單一渲染路徑） */
  onOpenCard: (card: CardData) => void;
  /** 在畫布定位（切回書桌並置中／選取） */
  onLocateCard: (card: CardData) => void;
}

interface ShelfBoard {
  cat: StudyCategory;
  items: Array<{ book: StudyBookLayout; card: CardData }>;
}

const EMPTY_HINT = "這個櫃板還沒有書";

/**
 * 書架：側板＋層板＋背板＋櫃板（分類隔板）＋書本書脊。
 * - 書本 1:1 對應筆記卡（缺則 lazy 補建）；拖曳只改 studyBooks，不動畫布座標。
 * - 櫃板依 category.order 排列，保留「未分類」恆在最後。
 * - 書本拖曳用 Pointer Events（不引入 dnd-kit）；拖到別櫃板＝改 categoryId，
 *   櫃板內拖曳＝改 orderInShelf。
 */
export const BookshelfView: React.FC<BookshelfViewProps> = ({ onOpenCard, onLocateCard }) => {
  const state = useWorkspaceState();
  const cards = state.cards as CardData[];
  const objects = state.canvasObjects as Array<{ cardId?: string; style?: Record<string, any> }>;
  const categories = state.studyCategories;
  const books = state.studyBooks;

  const shelfRef = useRef<HTMLDivElement | null>(null);
  const [shelfWidth, setShelfWidth] = useState(() =>
    typeof window === "undefined" ? 680 : Math.round(window.innerWidth * 0.34)
  );
  const shelfWidthRef = useRef(shelfWidth);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [dragHint, setDragHint] = useState<{ catId: string; index: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    cardId: string | null;
    startX: number;
    startY: number;
    active: boolean;
    targetCatId: string | undefined;
    targetIndex: number;
  }>({ cardId: null, startX: 0, startY: 0, active: false, targetCatId: undefined, targetIndex: -1 });
  // 拖曳結束的合成 click 不可開啟卡片
  const suppressClickRef = useRef(false);

  useEffect(() => {
    shelfWidthRef.current = shelfWidth;
  }, [shelfWidth]);

  // ---- 量測書架寬度（ResizeObserver 回呼內 setState，非 effect 同步 setState） ----
  useEffect(() => {
    const el = shelfRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && Math.abs(w - shelfWidthRef.current) > 8) setShelfWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- 卡↔書 1:1 lazy 補建安全網（缺書的卡補建；不改任何卡片內容） ----
  useEffect(() => {
    for (const c of cards) {
      if (!books.some((b) => b.cardId === c.id)) actions.ensureBookForCard(c.id);
    }
  }, [cards, books]);

  // ---- 櫃板（分類 → 一本書一格） ----
  const boards: ShelfBoard[] = useMemo(() => {
    const known = new Set(cards.map((c) => c.id));
    // 孤兒書（卡已不存在）不顯示；刪卡時 store 已同步移除，此處只防呆
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    return sorted.map((cat) => {
      const items = books
        .filter((b) => b.cardId && known.has(b.cardId) && (b.categoryId ?? UNCATEGORIZED_ID) === cat.id)
        .sort((a, b) => a.orderInShelf - b.orderInShelf)
        .map((book) => ({ book, card: cards.find((c) => c.id === book.cardId)! }))
        .filter((x) => !!x.card);
      return { cat, items };
    });
  }, [categories, books, cards]);

  // ---- 書架層板打包（層數隨書量增加；寫回 studyLayout.shelfRows） ----
  const rows = useMemo(() => {
    const widthOf = (b: ShelfBoard) =>
      148 + b.items.reduce((n, it) => n + bookThicknessFor(it.card) + 6, 0);
    return packBoards(boards, widthOf, shelfWidth - 24);
  }, [boards, shelfWidth]);
  const rowCount = rows.length;
  const storedRows = state.studyLayout.shelfRows;

  useEffect(() => {
    if (rowCount !== storedRows) {
      actions.updateStudyLayout({ shelfRows: rowCount });
    }
  }, [rowCount, storedRows]);

  // ---- 預覽開合：Esc 收回；點書本／預覽以外的任意處收回 ----
  useEffect(() => {
    if (!openCardId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpenCardId(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("[data-book-spine], [data-book-preview]")) return;
      setOpenCardId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [openCardId]);

  // ---- 書本拖曳（Pointer Events；不改畫布座標） ----
  const cleanupDragListeners = () => {
    window.removeEventListener("pointermove", handleDragMove);
    window.removeEventListener("pointerup", handleDragEnd);
    window.removeEventListener("pointercancel", handleDragEnd);
  };

  const handleDragMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d.cardId) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (!d.active) {
      if (dist <= 6) return;
      d.active = true;
      setIsDragging(true);
    }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const boardEl = el?.closest("[data-shelf-board]") as HTMLElement | null;
    const catId = boardEl?.dataset?.shelfBoard;
    if (!boardEl || !catId) {
      if (d.targetCatId !== undefined) {
        d.targetCatId = undefined;
        d.targetIndex = -1;
        setDragHint(null);
      }
      return;
    }
    // 插入點：以不含自己的書本中心計算（同櫃板內拖曳才不會錯位）
    const spines = Array.from(boardEl.querySelectorAll<HTMLElement>("[data-book-spine]"));
    let index = 0;
    for (const s of spines) {
      if (s.dataset.cardId === d.cardId) continue;
      const r = s.getBoundingClientRect();
      if (e.clientX >= r.left + r.width / 2) index++;
    }
    if (d.targetCatId !== catId || d.targetIndex !== index) {
      d.targetCatId = catId;
      d.targetIndex = index;
      setDragHint({ catId, index });
    }
  };

  const handleDragEnd = () => {
    const d = dragRef.current;
    cleanupDragListeners();
    if (d.cardId && d.active && d.targetCatId !== undefined) {
      // 未分類櫃板 → categoryId null；其餘 → 該分類 id。只改佈置，不動畫布座標。
      const categoryId = d.targetCatId === UNCATEGORIZED_ID ? null : d.targetCatId;
      actions.reorderBook(d.cardId, categoryId, d.targetIndex);
    }
    if (d.active) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 350);
    }
    dragRef.current = { cardId: null, startX: 0, startY: 0, active: false, targetCatId: undefined, targetIndex: -1 };
    setDragHint(null);
    setOpenCardId(null);
    setIsDragging(false);
  };

  const handleBookPointerDown = (e: React.PointerEvent, cardId: string) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      targetCatId: undefined,
      targetIndex: -1,
    };
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
    window.addEventListener("pointercancel", handleDragEnd);
  };

  const handleToggle = (card: CardData) => {
    if (suppressClickRef.current) return;
    if (openCardId === card.id) onOpenCard(card); // 再點一次 → 開啟筆記卡
    else setOpenCardId(card.id);
  };

  const handleHoverOpen = (card: CardData) => {
    // hover 抽出僅桌機；觸控裝置第一次點擊才抽出（handleToggle）
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover)").matches) return;
    if (openCardId !== card.id) setOpenCardId(card.id);
  };

  return (
    <div className="study-bookshelf" data-dragging={isDragging ? "true" : undefined}>
      {/* 背板 */}
      <div className="study-shelf-back" aria-hidden="true" />
      {/* 側板 */}
      <div className="study-shelf-side study-shelf-side-left" aria-hidden="true" />
      <div className="study-shelf-side study-shelf-side-right" aria-hidden="true" />

      <div
        ref={shelfRef}
        className="study-shelf-scroll"
        onScroll={() => setOpenCardId(null)}
        onPointerDown={(e) => {
          // 書架空白處（非書本）拖曳＝環繞視角（交給 StudyRoomView）；僅收合預覽
          const t = e.target as HTMLElement | null;
          if (t && t.closest("[data-book-spine]")) e.stopPropagation();
        }}
      >
        {rows.map((row, ri) => (
          <div key={`row-${ri}`} className="study-shelf-row">
            <div className="study-shelf-boards">
              {row.map((board) => {
                const isUncat = board.cat.id === UNCATEGORIZED_ID;
                return (
                  <div
                    key={board.cat.id}
                    data-shelf-board={board.cat.id}
                    className="study-shelf-board"
                  >
                    {/* 櫃板標籤（紙膠帶） */}
                    <div className="study-board-label-wrap">
                      <div
                        className="study-board-label"
                        style={{
                          backgroundColor: board.cat.color,
                          boxShadow: "0 1px 3px rgba(64, 42, 18, 0.28)",
                        }}
                        title={`${board.cat.name}（${board.items.length} 本）`}
                      >
                        <span className="truncate">{board.cat.name}</span>
                        <span className="opacity-70">{board.items.length}</span>
                      </div>
                      {/* 櫃板隔板（實體感） */}
                      <div className="study-board-divider" aria-hidden="true" />
                    </div>

                    <div className="study-board-books">
                      {board.items.map(({ book, card }, bi) => (
                        <React.Fragment key={book.cardId}>
                          {dragHint && dragHint.catId === board.cat.id && dragHint.index === bi && (
                            <div className="study-drop-line" aria-hidden="true" />
                          )}
                          <BookSpine
                            card={card}
                            layout={book}
                            accentColor={
                              objects.find((o) => o.cardId === card.id)?.style?.accentColor as
                                | string
                                | undefined
                            }
                            categoryColor={isUncat ? "#a8a29e" : board.cat.color}
                            isOpen={openCardId === card.id}
                            onToggle={() => handleToggle(card)}
                            onHoverOpen={() => handleHoverOpen(card)}
                            onOpenCard={() => {
                              suppressClickRef.current = false;
                              setOpenCardId(null);
                              onOpenCard(card);
                            }}
                            onLocate={() => {
                              setOpenCardId(null);
                              onLocateCard(card);
                            }}
                            onDragPointerDown={(e) => handleBookPointerDown(e, card.id)}
                          />
                        </React.Fragment>
                      ))}
                      {dragHint && dragHint.catId === board.cat.id && dragHint.index >= board.items.length && (
                        <div className="study-drop-line" aria-hidden="true" />
                      )}
                      {board.items.length === 0 && (
                        <div className="study-empty-hint">{EMPTY_HINT}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 層板（厚度感） */}
            <div className="study-shelf-plank" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
};
