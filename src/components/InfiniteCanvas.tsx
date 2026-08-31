"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { KnowledgeCardNode, CardData } from "./KnowledgeCardNode";
import { KaTeXRenderer } from "./KaTeXRenderer";
import { FunctionPlotCanvas } from "./FunctionPlotCanvas";
import { MathFormulaEditor } from "./MathFormulaEditor";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid,
  Magnet,
  RotateCw,
  Copy,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Layers,
  Sparkles,
  Edit3,
} from "lucide-react";

export interface CanvasObjectData {
  id: string;
  workspaceId: string;
  cardId?: string;
  type: string; // 'card_node' | 'text' | 'math' | 'diagram' | 'plot' | 'table' | 'code' | 'shape' | 'arrow'
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  semanticType: string; // WHAT, WHY, WHY_VISUAL, HOW, WHEN, ORIGIN, ASSUMPTION, CLAIM, RELATION, AUXILIARY
  content?: Record<string, any>;
  style?: Record<string, any>;
  isLocked?: boolean;
  isHidden?: boolean;
  groupId?: string;
}

export interface RelationData {
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

interface InfiniteCanvasProps {
  objects: CanvasObjectData[];
  cards: CardData[];
  relations: RelationData[];
  onUpdateObjects: (updated: Partial<CanvasObjectData>[]) => void;
  onDeleteObject: (id: string) => void;
  onSelectCard: (card: CardData) => void;
  onOpenPreview: (card: CardData) => void;
  onRunAudit: (card: CardData) => void;
  onExpansionTest: (card: CardData) => void;
  onOpenEditRelation: (rel: RelationData) => void;
  onImageTextIndependenceTest: (text: string) => void;
  onOpenCardDetail: (card: CardData) => void;
  fontFamily?: string;
  backgroundConfig?: {
    type: "solid" | "gradient" | "pattern" | "custom";
    solidColor?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientAngle?: number;
    patternType?: "dots" | "grid" | "lines" | "none";
    patternColor?: string;
    customCss?: string;
    imageUrl?: string;
    imageOpacity?: number;
  };
}

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
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
  backgroundConfig,
}) => {
  // Canvas Viewport transform
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Grid & Snap settings
  const [gridMode, setGridMode] = useState<"coarse" | "fine" | "none">("coarse");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMarquee, setSelectionMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Dragging objects
  const [isDraggingObj, setIsDraggingObj] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState({ x: 0, y: 0 });
  const [initialObjPositions, setInitialObjPositions] = useState<Record<string, { x: number; y: number }>>({});

  // Alignment guidelines (Canva style)
  const [guideLines, setGuideLines] = useState<Array<{ type: "vertical" | "horizontal"; pos: number }>>([]);

  // Math formula editor modal
  const [editingMathObj, setEditingMathObj] = useState<CanvasObjectData | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const gridSize = gridMode === "coarse" ? 40 : gridMode === "fine" ? 15 : 0;

  // Wheel zoom and pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(2.5, Math.max(0.2, zoom * zoomFactor));
      setZoom(newZoom);
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.9,
        y: prev.y - e.deltaY * 0.9,
      }));
    }
  };

  // ===== 統一互動系統：Pointer Events（滑鼠 / 觸控 / 手寫筆共用）=====
  // 互動狀態放在 ref，避免 React 狀態批次更新造成拖曳延遲或中斷
  type InteractionMode = "none" | "pan" | "marquee" | "drag" | "pinch";
  const interaction = useRef<{
    mode: InteractionMode;
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startZoom: number;
    startMidX: number;
    startMidY: number;
    dragIds: string[];
    initialPositions: Record<string, { x: number; y: number }>;
    moved: boolean;
  }>({
    mode: "none",
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    startDist: 0,
    startZoom: 1,
    startMidX: 0,
    startMidY: 0,
    dragIds: [],
    initialPositions: {},
    moved: false,
  });

  // 追蹤同時按下的指標（用於雙指縮放）
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  // 最新值 ref：讓 window 事件處理器讀到即時值，不受閉包快照影響
  const latest = useRef({ zoom, pan, objects, snapToGrid, snapToObjects, gridSize });
  useEffect(() => {
    latest.current = { zoom, pan, objects, snapToGrid, snapToObjects, gridSize };
  }, [zoom, pan, objects, snapToGrid, snapToObjects, gridSize]);

  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code === "Space" && tag !== "INPUT" && tag !== "TEXTAREA") {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  /** 計算拖曳位移（含 Canva 智慧吸附與網格吸附） */
  const computeDragUpdates = (clientX: number, clientY: number) => {
    const st = interaction.current;
    const { zoom: z, objects: objs, snapToObjects: snapObj, snapToGrid: snapGrid, gridSize: gs } = latest.current;

    const deltaX = (clientX - st.startClientX) / z;
    const deltaY = (clientY - st.startClientY) / z;

    const activeObj = objs.find((o) => o.id === st.dragIds[0]);
    let snapDeltaX = deltaX;
    let snapDeltaY = deltaY;
    const newGuides: Array<{ type: "vertical" | "horizontal"; pos: number }> = [];

    if (activeObj && snapObj) {
      const initPos = st.initialPositions[activeObj.id];
      if (initPos) {
        const targetLeft = initPos.x + deltaX;
        const targetRight = targetLeft + activeObj.width;
        const targetCenterX = targetLeft + activeObj.width / 2;
        const targetTop = initPos.y + deltaY;
        const targetBottom = targetTop + activeObj.height;
        const targetCenterY = targetTop + activeObj.height / 2;
        const SNAP_THRESHOLD = 6;

        for (const other of objs) {
          if (st.dragIds.includes(other.id)) continue;
          const otherLeft = other.x;
          const otherRight = other.x + other.width;
          const otherCenterX = other.x + other.width / 2;
          const otherTop = other.y;
          const otherBottom = other.y + other.height;
          const otherCenterY = other.y + other.height / 2;

          if (Math.abs(targetLeft - otherLeft) < SNAP_THRESHOLD) {
            snapDeltaX = otherLeft - initPos.x;
            newGuides.push({ type: "vertical", pos: otherLeft });
          } else if (Math.abs(targetRight - otherRight) < SNAP_THRESHOLD) {
            snapDeltaX = otherRight - activeObj.width - initPos.x;
            newGuides.push({ type: "vertical", pos: otherRight });
          } else if (Math.abs(targetCenterX - otherCenterX) < SNAP_THRESHOLD) {
            snapDeltaX = otherCenterX - activeObj.width / 2 - initPos.x;
            newGuides.push({ type: "vertical", pos: otherCenterX });
          }

          if (Math.abs(targetTop - otherTop) < SNAP_THRESHOLD) {
            snapDeltaY = otherTop - initPos.y;
            newGuides.push({ type: "horizontal", pos: otherTop });
          } else if (Math.abs(targetBottom - otherBottom) < SNAP_THRESHOLD) {
            snapDeltaY = otherBottom - activeObj.height - initPos.y;
            newGuides.push({ type: "horizontal", pos: otherBottom });
          } else if (Math.abs(targetCenterY - otherCenterY) < SNAP_THRESHOLD) {
            snapDeltaY = otherCenterY - activeObj.height / 2 - initPos.y;
            newGuides.push({ type: "horizontal", pos: otherCenterY });
          }
        }
      }
    }

    setGuideLines(newGuides);

    if (snapGrid && gs > 0 && newGuides.length === 0) {
      snapDeltaX = Math.round(snapDeltaX / gs) * gs;
      snapDeltaY = Math.round(snapDeltaY / gs) * gs;
    }

    return st.dragIds
      .map((id) => {
        const init = st.initialPositions[id];
        if (!init) return null;
        return { id, x: Math.round(init.x + snapDeltaX), y: Math.round(init.y + snapDeltaY) };
      })
      .filter(Boolean) as Partial<CanvasObjectData>[];
  };

  /** 全域 pointermove / pointerup：即使指標移出畫布也不中斷拖曳 */
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const st = interaction.current;
      if (st.mode === "none") return;

      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      // 雙指縮放
      if (st.mode === "pinch" && activePointers.current.size >= 2) {
        const pts = Array.from(activePointers.current.values());
        const [a, b] = [pts[0], pts[1]];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const ratio = dist / (st.startDist || 1);
        const newZoom = Math.min(2.5, Math.max(0.2, st.startZoom * ratio));
        // 以雙指中心為錨點縮放，避免畫面亂跳
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const midX = (a.x + b.x) / 2 - rect.left;
          const midY = (a.y + b.y) / 2 - rect.top;
          const scaleRatio = newZoom / st.startZoom;
          setPan({
            x: midX - (st.startMidX - st.startPanX) * scaleRatio,
            y: midY - (st.startMidY - st.startPanY) * scaleRatio,
          });
        }
        setZoom(newZoom);
        st.moved = true;
        return;
      }

      if (e.pointerId !== st.pointerId) return;

      const dx = e.clientX - st.startClientX;
      const dy = e.clientY - st.startClientY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) st.moved = true;

      if (st.mode === "pan") {
        setPan({ x: st.startPanX + dx, y: st.startPanY + dy });
        return;
      }

      if (st.mode === "marquee") {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const { zoom: z, pan: p, objects: objs } = latest.current;
        const curX = (e.clientX - rect.left - p.x) / z;
        const curY = (e.clientY - rect.top - p.y) / z;
        setSelectionMarquee((prev) => {
          if (!prev) return prev;
          const left = Math.min(prev.startX, curX);
          const right = Math.max(prev.startX, curX);
          const top = Math.min(prev.startY, curY);
          const bottom = Math.max(prev.startY, curY);
          const enclosed = objs.filter(
            (o) => o.x >= left && o.x + o.width <= right && o.y >= top && o.y + o.height <= bottom
          );
          setSelectedIds(enclosed.map((o) => o.id));
          return { ...prev, currentX: curX, currentY: curY };
        });
        return;
      }

      if (st.mode === "drag" && st.dragIds.length > 0) {
        const updates = computeDragUpdates(e.clientX, e.clientY);
        if (updates.length > 0) onUpdateObjects(updates);
      }
    };

    const endPointer = (e: PointerEvent) => {
      activePointers.current.delete(e.pointerId);
      const st = interaction.current;

      // 雙指其中一指放開 → 結束縮放
      if (st.mode === "pinch" && activePointers.current.size < 2) {
        st.mode = "none";
        st.pointerId = null;
        return;
      }

      if (e.pointerId !== st.pointerId) return;

      st.mode = "none";
      st.pointerId = null;
      st.dragIds = [];
      st.initialPositions = {};
      setIsPanning(false);
      setIsDraggingObj(false);
      setSelectionMarquee(null);
      setGuideLines([]);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endPointer);
    window.addEventListener("pointercancel", endPointer);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endPointer);
      window.removeEventListener("pointercancel", endPointer);
    };
  }, [onUpdateObjects]);

  /** 畫布空白處按下：預設拖曳平移；Shift 或右鍵 → 框選 */
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const targetEl = e.target as Element;

    // 判定是否落在「空白畫布」上。
    // 除了直接命中背景 div 之外，也接受任何非互動元素——
    // 這樣即使日後新增覆蓋層，只要不是卡片/按鈕/關係線，平移依然有效，
    // 不會再出現「某一塊區域拖不動」的死角。
    const isBackground =
      targetEl === containerRef.current ||
      (targetEl as HTMLElement).id === "canvas-bg" ||
      !targetEl.closest?.(
        '[data-canvas-object="true"], button, a, input, textarea, select, [data-relation-hit="true"]'
      );

    if (!isBackground) return;

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 兩指同時按下 → 進入縮放模式
    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      const [a, b] = [pts[0], pts[1]];
      const rect = containerRef.current?.getBoundingClientRect();
      interaction.current = {
        ...interaction.current,
        mode: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startZoom: zoom,
        startPanX: pan.x,
        startPanY: pan.y,
        startMidX: rect ? (a.x + b.x) / 2 - rect.left : 0,
        startMidY: rect ? (a.y + b.y) / 2 - rect.top : 0,
        moved: false,
      };
      setIsPanning(false);
      return;
    }

    if (e.button === 2) return; // 右鍵交給 contextmenu

    // Shift（或 Ctrl/Cmd）+ 拖曳 → 框選；其餘一律平移（含手機單指、滑鼠左鍵）
    const wantMarquee = e.shiftKey || e.ctrlKey || e.metaKey;

    if (wantMarquee) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startX = (e.clientX - rect.left - pan.x) / zoom;
      const startY = (e.clientY - rect.top - pan.y) / zoom;
      setSelectedIds([]);
      setSelectionMarquee({ startX, startY, currentX: startX, currentY: startY });
      interaction.current = {
        ...interaction.current,
        mode: "marquee",
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        moved: false,
      };
    } else {
      setSelectedIds([]);
      setIsPanning(true);
      interaction.current = {
        ...interaction.current,
        mode: "pan",
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        moved: false,
      };
    }
  };

  /** 物件上按下：開始拖曳（滑鼠 / 觸控 / 手寫筆通用） */
  const handleObjectPointerDown = (e: React.PointerEvent, obj: CanvasObjectData) => {
    if (obj.isLocked) return;
    // 讓卡片內部的按鈕 / 輸入框仍可正常點擊
    const el = e.target as HTMLElement;
    if (el.closest("button, a, input, textarea, select")) return;

    e.stopPropagation();
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    let newSelected = selectedIds;
    if (e.shiftKey) {
      newSelected = selectedIds.includes(obj.id)
        ? selectedIds.filter((id) => id !== obj.id)
        : [...selectedIds, obj.id];
    } else if (!selectedIds.includes(obj.id)) {
      newSelected = [obj.id];
    }

    if (obj.groupId) {
      const groupMembers = objects.filter((o) => o.groupId === obj.groupId).map((o) => o.id);
      newSelected = Array.from(new Set([...newSelected, ...groupMembers]));
    }
    setSelectedIds(newSelected);

    const posMap: Record<string, { x: number; y: number }> = {};
    newSelected.forEach((id) => {
      const target = objects.find((o) => o.id === id);
      if (target) posMap[id] = { x: target.x, y: target.y };
    });

    setIsDraggingObj(true);
    interaction.current = {
      ...interaction.current,
      mode: "drag",
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      dragIds: newSelected,
      initialPositions: posMap,
      moved: false,
    };
  };

  // Group / Ungroup
  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    const newGroupId = `group-${Date.now()}`;
    const updates = selectedIds.map((id) => ({ id, groupId: newGroupId }));
    onUpdateObjects(updates);
  };

  const handleUngroup = () => {
    const updates = selectedIds.map((id) => ({ id, groupId: undefined }));
    onUpdateObjects(updates);
  };

  // Alignments
  const handleAlign = (type: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (selectedIds.length < 2) return;
    const selectedObjs = objects.filter((o) => selectedIds.includes(o.id));
    if (selectedObjs.length < 2) return;

    if (type === "left") {
      const minX = Math.min(...selectedObjs.map((o) => o.x));
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, x: minX })));
    } else if (type === "right") {
      const maxRight = Math.max(...selectedObjs.map((o) => o.x + o.width));
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, x: maxRight - o.width })));
    } else if (type === "center") {
      const avgCenter =
        selectedObjs.reduce((acc, o) => acc + o.x + o.width / 2, 0) / selectedObjs.length;
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, x: avgCenter - o.width / 2 })));
    } else if (type === "top") {
      const minY = Math.min(...selectedObjs.map((o) => o.y));
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, y: minY })));
    } else if (type === "bottom") {
      const maxBottom = Math.max(...selectedObjs.map((o) => o.y + o.height));
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, y: maxBottom - o.height })));
    } else if (type === "middle") {
      const avgMiddle =
        selectedObjs.reduce((acc, o) => acc + o.y + o.height / 2, 0) / selectedObjs.length;
      onUpdateObjects(selectedObjs.map((o) => ({ id: o.id, y: avgMiddle - o.height / 2 })));
    }
  };

  // Z-Index ordering
  const handleZOrder = (direction: "front" | "back") => {
    if (selectedIds.length === 0) return;
    const allZ = objects.map((o) => o.zIndex);
    const maxZ = Math.max(...allZ, 1);
    const minZ = Math.min(...allZ, 1);

    const updates = selectedIds.map((id) => ({
      id,
      zIndex: direction === "front" ? maxZ + 1 : Math.max(0, minZ - 1),
    }));
    onUpdateObjects(updates);
  };

  // Lock / Unlock
  const handleToggleLock = () => {
    if (selectedIds.length === 0) return;
    const isAnyUnlocked = objects.some((o) => selectedIds.includes(o.id) && !o.isLocked);
    const updates = selectedIds.map((id) => ({ id, isLocked: isAnyUnlocked }));
    onUpdateObjects(updates);
  };

  // Change semantic role of selected objects
  const handleChangeSemantic = (semanticType: string) => {
    if (selectedIds.length === 0) return;
    const updates = selectedIds.map((id) => ({ id, semanticType }));
    onUpdateObjects(updates);
  };

  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

  return (
    <div className="relative w-full h-full overflow-hidden select-none flex flex-col">
      {/* Minimal Floating Toolbar — bottom-center */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-200/80 shadow-lg text-xs">
        <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="縮小">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[10px] w-9 text-center text-slate-500">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="放大">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={() => { setGridMode(gridMode === "coarse" ? "fine" : gridMode === "fine" ? "none" : "coarse"); }}
          className={`p-1.5 rounded transition-colors ${gridMode !== "none" ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-100"}`}
          title="網格"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setSnapToObjects((s) => !s)}
          className={`p-1.5 rounded transition-colors ${snapToObjects ? "text-emerald-600 bg-emerald-50" : "text-slate-400 hover:bg-slate-100"}`}
          title="對齊吸附"
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Selection Bar — only when objects are selected */}
      {selectedIds.length > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-[10px]">
          <span className="text-slate-400 mr-1">{selectedIds.length} 選取</span>
          <div className="w-px h-3.5 bg-slate-700" />
          <select
            value={selectedObjects[0]?.semanticType || "AUXILIARY"}
            onChange={(e) => handleChangeSemantic(e.target.value)}
            className="bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 outline-none"
          >
            <option value="WHAT">WHAT</option>
            <option value="WHY">WHY</option>
            <option value="HOW">HOW</option>
            <option value="WHEN">WHEN</option>
            <option value="ORIGIN">ORIGIN</option>
            <option value="AUXILIARY">輔助</option>
          </select>
          <div className="w-px h-3.5 bg-slate-700" />
          {selectedIds.length >= 2 && (
            <>
              <button onClick={() => handleAlign("left")} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="靠左"><AlignLeft className="w-3 h-3" /></button>
              <button onClick={() => handleAlign("center")} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="置中"><AlignCenter className="w-3 h-3" /></button>
              <button onClick={handleGroup} className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300">群組</button>
              <div className="w-px h-3.5 bg-slate-700" />
            </>
          )}
          <button onClick={handleToggleLock} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="鎖定">
            {selectedObjects.some((o) => o.isLocked) ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
          </button>
          <button onClick={() => selectedIds.forEach((id) => onDeleteObject(id))} className="p-1 rounded hover:bg-rose-900 text-rose-400" title="刪除">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 3. Main Infinite Canvas Viewport */}
      <div
        id="canvas-bg"
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className={`w-full h-full relative overflow-hidden touch-none select-none ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          background: "transparent",
          backgroundImage: gridMode === "none"
            ? "none"
            : (gridMode === "coarse"
              ? "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)"
              : "radial-gradient(#e2e8f0 1px, transparent 1px)"),
          backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Transform Layer */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* A. Relations (SVG connection lines between cards)
              注意：SVG 本身必須 pointer-events-none，否則這塊 5000×5000 的透明區域
              會吞掉指標事件，導致該範圍內無法拖曳平移畫布。
              只有實際的關係線與標籤（各 <g>）才開啟 pointer-events-auto。 */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker
                id="arrowhead-indigo"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 8 4, 0 8" fill="#6366f1" />
              </marker>
              <marker
                id="arrowhead-amber"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon points="0 0, 8 4, 0 8" fill="#f59e0b" />
              </marker>
            </defs>

            {relations.map((rel) => {
              const fromObj = objects.find((o) => o.cardId === rel.fromCardId);
              const toObj = objects.find((o) => o.cardId === rel.toCardId);
              if (!fromObj || !toObj) return null;

              const x1 = fromObj.x + fromObj.width / 2;
              const y1 = fromObj.y + fromObj.height / 2;
              const x2 = toObj.x + toObj.width / 2;
              const y2 = toObj.y + toObj.height / 2;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              const isUnverified = rel.relationType === "analogy_unverified";
              const strokeColor = isUnverified ? "#f59e0b" : "#6366f1";

              return (
                <g key={rel.id} className="cursor-pointer group">
                  {/* 透明加寬命中區：讓細線在觸控裝置也好點，但不阻擋周圍空白處的平移 */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="14"
                    strokeLinecap="round"
                    data-relation-hit="true"
                    className="pointer-events-auto"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onOpenEditRelation(rel)}
                  />
                  {/* 實際可見的關係線（本身不接收事件，交給上面的命中區） */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    strokeDasharray={isUnverified ? "6,6" : "none"}
                    markerEnd={isUnverified ? "url(#arrowhead-amber)" : "url(#arrowhead-indigo)"}
                    className="pointer-events-none group-hover:stroke-blue-500 transition-colors"
                  />
                  {/* Label badge：foreignObject 容器不可攔截事件，只有標籤本體可點 */}
                  <foreignObject
                    x={midX - 70}
                    y={midY - 14}
                    width={140}
                    height={30}
                    className="overflow-visible pointer-events-none"
                  >
                    <div className="flex items-center justify-center">
                      <span
                        data-relation-hit="true"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onOpenEditRelation(rel)}
                        className={`pointer-events-auto cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs transition-transform group-hover:scale-105 ${
                          isUnverified
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : "bg-white text-indigo-800 border-indigo-300"
                        }`}
                      >
                        {rel.label || rel.relationType}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* B. Canvas Objects */}
          {objects.map((obj) => {
            if (obj.isHidden) return null;
            const isSelected = selectedIds.includes(obj.id);
            const card = obj.cardId ? cards.find((c) => c.id === obj.cardId) : null;

            return (
              <div
                key={obj.id}
                data-canvas-object="true"
                onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                className={`absolute pointer-events-auto touch-none ${
                  isSelected ? "ring-2 ring-blue-500 shadow-2xl" : "shadow-md"
                } ${obj.isLocked ? "cursor-default" : "cursor-move"}`}
                style={{
                  left: `${obj.x}px`,
                  top: `${obj.y}px`,
                  width: `${obj.width}px`,
                  height: `${obj.height}px`,
                  transform: `rotate(${obj.rotation || 0}deg)`,
                  zIndex: obj.zIndex || 1,
                }}
              >
                {/* 1. Knowledge Card Node */}
                {obj.type === "card_node" && card && (
                  <KnowledgeCardNode
                    card={card}
                    isSelected={isSelected}
                    onSelect={() => onSelectCard(card)}
                    onOpenPreview={() => onOpenPreview(card)}
                    onOpenDetail={() => onOpenCardDetail(card)}
                    onRunAudit={() => onRunAudit(card)}
                    onExpansionTest={() => onExpansionTest(card)}
                    fontFamily={fontFamily}
                  />
                )}

                {/* 2. Math LaTeX Object */}
                {obj.type === "math" && (
                  <div className="w-full h-full bg-white rounded-xl border border-blue-200 p-3 shadow-sm flex flex-col justify-between overflow-hidden group">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-slate-700 font-semibold text-xs">
                      <span className="truncate">{obj.content?.title || "公式推導"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-100 text-blue-800">
                          {obj.content?.epistemicMark || "⊢證"}
                        </span>
                        <button
                          onClick={() => setEditingMathObj(obj)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-blue-600 hover:text-blue-800 transition-opacity"
                          title="編輯公式"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-2 overflow-x-auto">
                      <KaTeXRenderer latex={obj.content?.latex || ""} displayMode={true} />
                    </div>
                  </div>
                )}

                {/* 3. Function Plot Canvas Object */}
                {obj.type === "plot" && (
                  <FunctionPlotCanvas
                    width={obj.width}
                    height={obj.height}
                    title={obj.content?.title}
                    formula={obj.content?.formula}
                    caption={obj.content?.caption}
                    onCheckIndependence={() =>
                      onImageTextIndependenceTest(
                        obj.content?.caption || "圖文獨立性檢查：文字是否把推理偷偷交給了圖片"
                      )
                    }
                  />
                )}

                {/* 4. Text / Methodology Banner Object */}
                {obj.type === "text" && (
                  <div
                    className="w-full h-full p-4 rounded-xl shadow-xs overflow-y-auto leading-relaxed text-xs"
                    style={{
                      backgroundColor: obj.style?.backgroundColor || "#ffffff",
                      borderColor: obj.style?.borderColor || "#cbd5e1",
                      borderWidth: obj.style?.borderWidth || 1,
                      color: obj.style?.color || "#1e293b",
                    }}
                  >
                    {obj.content?.title && (
                      <h4 className="font-bold text-sm mb-2">{obj.content.title}</h4>
                    )}
                    <p className="whitespace-pre-wrap">{obj.content?.text}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* C. Canva Smart Snap Guides (pink/cyan dashed lines) */}
          {guideLines.map((g, idx) => (
            <div
              key={idx}
              className="absolute pointer-events-none"
              style={{
                left: g.type === "vertical" ? `${g.pos}px` : "0px",
                top: g.type === "horizontal" ? `${g.pos}px` : "0px",
                width: g.type === "vertical" ? "1.5px" : "5000px",
                height: g.type === "horizontal" ? "1.5px" : "5000px",
                backgroundColor: "#ec4899", // Canva pink alignment guide line
                boxShadow: "0 0 4px rgba(236, 72, 153, 0.6)",
              }}
            />
          ))}

          {/* D. Selection Marquee Box */}
          {selectionMarquee && (
            <div
              className="absolute pointer-events-none bg-blue-500/10 border border-blue-500 rounded"
              style={{
                left: `${Math.min(selectionMarquee.startX, selectionMarquee.currentX)}px`,
                top: `${Math.min(selectionMarquee.startY, selectionMarquee.currentY)}px`,
                width: `${Math.abs(selectionMarquee.currentX - selectionMarquee.startX)}px`,
                height: `${Math.abs(selectionMarquee.currentY - selectionMarquee.startY)}px`,
              }}
            />
          )}
        </div>
      </div>

      {/* 4. Math Editor Modal when clicked */}
      {editingMathObj && (
        <MathFormulaEditor
          initialLatex={editingMathObj.content?.latex}
          initialTitle={editingMathObj.content?.title}
          initialEpistemicMark={editingMathObj.content?.epistemicMark}
          onSave={(data) => {
            onUpdateObjects([
              {
                id: editingMathObj.id,
                content: {
                  ...editingMathObj.content,
                  latex: data.latex,
                  title: data.title,
                  epistemicMark: data.epistemicMark,
                },
              },
            ]);
            setEditingMathObj(null);
          }}
          onCancel={() => setEditingMathObj(null)}
        />
      )}
    </div>
  );
};
