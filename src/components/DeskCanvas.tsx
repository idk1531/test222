"use client";

import React from "react";
import { InfiniteCanvas, CanvasObjectData, RelationData } from "./InfiniteCanvas";
import type { CardData } from "./KnowledgeCardNode";

interface DeskCanvasProps {
  objects: CanvasObjectData[];
  cards: CardData[];
  relations: RelationData[];
  onUpdateObjects: (updated: Partial<CanvasObjectData>[], options?: { final?: boolean }) => void;
  onDeleteObject: (id: string) => void;
  onSelectCard: (card: CardData) => void;
  onOpenPreview: (card: CardData) => void;
  onRunAudit: (card: CardData) => void;
  onExpansionTest: (card: CardData) => void;
  onOpenEditRelation: (rel: RelationData) => void;
  onImageTextIndependenceTest: (text: string) => void;
  onOpenCardDetail: (card: CardData) => void;
  fontFamily?: string;
  /** v8.0：書架「在畫布定位」→ 置中並選取該卡 */
  apiRef?: React.RefObject<{ focusCard: (cardId: string) => void } | null>;
}

/**
 * 書桌區域：把現有 InfiniteCanvas 嵌進桌面（桌板＋前緣厚度 + 紙面）。
 * - 畫布本體 100% 沿用 InfiniteCanvas（新增卡、選取、拖曳、框選、縮放、雙擊開卡、關聯邊…全部保留）。
 * - 書桌面維持面向使用者（不隨環繞視角旋轉），確保 InfiniteCanvas 的
 *   pointer 座標換算仍是仿射映射、IME／輸入框／手勢全部正常；
 *   視角環繞作用於牆面／地板／書架等家具（見 StudyRoomView）。
 * - data-canvas-surface：此區域的手勢全部交給畫布，不觸發視角環繞。
 */
export const DeskCanvas: React.FC<DeskCanvasProps> = ({
  objects,
  cards,
  relations,
  onUpdateObjects,
  onDeleteObject,
  onSelectCard,
  onOpenPreview,
  onRunAudit,
  onExpansionTest,
  onOpenEditRelation,
  onImageTextIndependenceTest,
  onOpenCardDetail,
  fontFamily,
  apiRef,
}) => {
  return (
    <div className="study-desk">
      {/* 桌板（上層厚度）：木紋漸層 + 內陰影讓畫布像嵌進桌面 */}
      <div className="study-desk-top">
        <div className="study-canvas-inset" data-canvas-surface="true" data-no-orbit="true">
          <InfiniteCanvas
            objects={objects}
            cards={cards}
            relations={relations}
            onUpdateObjects={onUpdateObjects}
            onDeleteObject={onDeleteObject}
            onSelectCard={onSelectCard}
            onOpenPreview={onOpenPreview}
            onRunAudit={onRunAudit}
            onExpansionTest={onExpansionTest}
            onOpenEditRelation={onOpenEditRelation}
            onImageTextIndependenceTest={onImageTextIndependenceTest}
            onOpenCardDetail={onOpenCardDetail}
            fontFamily={fontFamily}
            apiRef={apiRef}
          />
        </div>
      </div>
      {/* 桌板前緣（下層厚度）：陰影往右下（主光源左上） */}
      <div className="study-desk-edge" aria-hidden="true" />
    </div>
  );
};
