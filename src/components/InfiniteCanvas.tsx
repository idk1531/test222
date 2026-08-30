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

  // ===== 觸控支援：單指平移空白畫布、雙指縮放 =====
  const touchState = useRef<{
    mode: "none" | "pan" | "pinch";
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startZoom: number;
    isCanvasBg: boolean;
  }>({
    mode: "none",
    startX: 0, startY: 0, startPanX: 0, startPanY: 0,
    startDist: 0, startZoom: 1, isCanvasBg: false,
  });

  const handleTouchStart = (e: React.TouchEvent) => {
    const targetEl = e.target as HTMLElement;
    const onBg = targetEl.id === "canvas-bg" || targetEl === containerRef.current;

    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touchState.current = {
        ...touchState.current,
        mode: "pinch",
        startDist: dist,
        startZoom: zoom,
        startPanX: pan.x,
        startPanY: pan.y,
        startX: (a.clientX + b.clientX) / 2,
        startY: (a.clientY + b.clientY) / 2,
      };
    } else if (e.touches.length === 1 && onBg) {
      // 只有在空白畫布上單指才平移（避免影響拖曳卡片）
      const t = e.touches[0];
      touchState.current = {
        ...touchState.current,
        mode: "pan",
        startX: t.clientX,
        startY: t.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        isCanvasBg: true,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const st = touchState.current;
    if (st.mode === "pinch" && e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / (st.startDist || 1);
      const newZoom = Math.min(2.5, Math.max(0.2, st.startZoom * ratio));
      setZoom(newZoom);
    } else if (st.mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      setPan({
        x: st.startPanX + (t.clientX - st.startX),
        y: st.startPanY + (t.clientY - st.startY),
      });
    }
  };

  const handleTouchEnd = () => {
    touchState.current.mode = "none";
  };

  // Track spacebar for panning
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Start Canvas Pan or Marquee
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && (e.target as HTMLElement).id !== "canvas-bg") {
      return;
    }

    if (e.button === 1 || isSpacePressed || e.altKey) {
      // Middle click or space+click -> Pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (e.button === 0) {
      // Left click on empty space -> start selection marquee
      setSelectedIds([]);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseCanvasX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseCanvasY = (e.clientY - rect.top - pan.y) / zoom;
      setSelectionMarquee({
        startX: mouseCanvasX,
        startY: mouseCanvasY,
        currentX: mouseCanvasX,
        currentY: mouseCanvasY,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (selectionMarquee) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const curX = (e.clientX - rect.left - pan.x) / zoom;
      const curY = (e.clientY - rect.top - pan.y) / zoom;
      setSelectionMarquee((prev) => prev && { ...prev, currentX: curX, currentY: curY });

      // Calculate enclosed objects
      const left = Math.min(selectionMarquee.startX, curX);
      const right = Math.max(selectionMarquee.startX, curX);
      const top = Math.min(selectionMarquee.startY, curY);
      const bottom = Math.max(selectionMarquee.startY, curY);

      const enclosed = objects.filter((o) => {
        return o.x >= left && o.x + o.width <= right && o.y >= top && o.y + o.height <= bottom;
      });
      setSelectedIds(enclosed.map((o) => o.id));
      return;
    }

    if (isDraggingObj && selectedIds.length > 0) {
      const deltaX = (e.clientX - dragStartMouse.x) / zoom;
      const deltaY = (e.clientY - dragStartMouse.y) / zoom;

      // Canva smart snap calculations
      const activeObj = objects.find((o) => o.id === selectedIds[0]);
      let snapDeltaX = deltaX;
      let snapDeltaY = deltaY;
      const newGuides: Array<{ type: "vertical" | "horizontal"; pos: number }> = [];

      if (activeObj && snapToObjects) {
        const initPos = initialObjPositions[activeObj.id];
        if (initPos) {
          const targetLeft = initPos.x + deltaX;
          const targetRight = targetLeft + activeObj.width;
          const targetCenterX = targetLeft + activeObj.width / 2;

          const targetTop = initPos.y + deltaY;
          const targetBottom = targetTop + activeObj.height;
          const targetCenterY = targetTop + activeObj.height / 2;

          const SNAP_THRESHOLD = 6;

          // Compare against all other objects
          for (const other of objects) {
            if (selectedIds.includes(other.id)) continue;

            const otherLeft = other.x;
            const otherRight = other.x + other.width;
            const otherCenterX = other.x + other.width / 2;

            const otherTop = other.y;
            const otherBottom = other.y + other.height;
            const otherCenterY = other.y + other.height / 2;

            // X alignments
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

            // Y alignments
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

      // Snap to Grid if enabled and no object snap line
      if (snapToGrid && gridSize > 0 && newGuides.length === 0) {
        // apply grid snapping
        snapDeltaX = Math.round(snapDeltaX / gridSize) * gridSize;
        snapDeltaY = Math.round(snapDeltaY / gridSize) * gridSize;
      }

      // Update positions
      const updates = selectedIds.map((id) => {
        const init = initialObjPositions[id];
        return {
          id,
          x: Math.round(init.x + snapDeltaX),
          y: Math.round(init.y + snapDeltaY),
        };
      });

      onUpdateObjects(updates);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setSelectionMarquee(null);
    setIsDraggingObj(false);
    setGuideLines([]);
  };

  // Start dragging an object
  const handleObjectMouseDown = (e: React.MouseEvent, obj: CanvasObjectData) => {
    e.stopPropagation();
    if (obj.isLocked) return;

    let newSelected = selectedIds;
    if (e.shiftKey) {
      if (selectedIds.includes(obj.id)) {
        newSelected = selectedIds.filter((id) => id !== obj.id);
      } else {
        newSelected = [...selectedIds, obj.id];
      }
    } else {
      if (!selectedIds.includes(obj.id)) {
        newSelected = [obj.id];
      }
    }
    setSelectedIds(newSelected);

    // If part of group, include whole group
    if (obj.groupId) {
      const groupMembers = objects.filter((o) => o.groupId === obj.groupId).map((o) => o.id);
      newSelected = Array.from(new Set([...newSelected, ...groupMembers]));
      setSelectedIds(newSelected);
    }

    setIsDraggingObj(true);
    setDragStartMouse({ x: e.clientX, y: e.clientY });

    const posMap: Record<string, { x: number; y: number }> = {};
    newSelected.forEach((id) => {
      const target = objects.find((o) => o.id === id);
      if (target) {
        posMap[id] = { x: target.x, y: target.y };
      }
    });
    setInitialObjPositions(posMap);
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full relative cursor-default overflow-hidden touch-none"
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
          {/* A. Relations (SVG connection lines between cards) */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-auto overflow-visible">
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
                <g key={rel.id} className="cursor-pointer group" onClick={() => onOpenEditRelation(rel)}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth="2.5"
                    strokeDasharray={isUnverified ? "6,6" : "none"}
                    markerEnd={isUnverified ? "url(#arrowhead-amber)" : "url(#arrowhead-indigo)"}
                    className="group-hover:stroke-blue-500 transition-colors"
                  />
                  {/* Label badge */}
                  <foreignObject
                    x={midX - 70}
                    y={midY - 14}
                    width={140}
                    height={30}
                    className="overflow-visible pointer-events-auto"
                  >
                    <div className="flex items-center justify-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs transition-transform group-hover:scale-105 ${
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
                onMouseDown={(e) => handleObjectMouseDown(e, obj)}
                className={`absolute pointer-events-auto transition-shadow ${
                  isSelected ? "ring-2 ring-blue-500 shadow-2xl" : "shadow-md"
                }`}
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
