"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Trash2,
  Lock,
  Unlock,
  Move,
  AlignLeft,
  AlignCenter,
  Layers,
  Edit3,
  Hand,
  MousePointer2,
} from "lucide-react";

export interface CanvasObjectData {
  id: string;
  workspaceId: string;
  cardId?: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  semanticType: string;
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

type GuideLine = { type: "vertical" | "horizontal"; pos: number };
type PointerPoint = { x: number; y: number };
type DragMode = "idle" | "pan" | "marquee" | "object" | "pinch";

interface DragSession {
  mode: DragMode;
  pointerId: number | null;
  /** 螢幕座標起點 */
  startScreen: PointerPoint;
  /** 畫布平移起點 */
  startPan: PointerPoint;
  /** 選中物件的原始畫布座標 */
  initialPositions: Record<string, PointerPoint>;
  /** 框選的畫布座標起點 */
  marqueeStart?: PointerPoint;
  /** 雙指縮放基準 */
  pinchDistance?: number;
  pinchZoom?: number;
  pinchCenter?: PointerPoint;
  /** 是否真的移動過；避免拖完又觸發卡片 click 開啟 */
  moved: boolean;
}

const emptySession = (): DragSession => ({
  mode: "idle",
  pointerId: null,
  startScreen: { x: 0, y: 0 },
  startPan: { x: 0, y: 0 },
  initialPositions: {},
  moved: false,
});

const distance = (a: PointerPoint, b: PointerPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: PointerPoint, b: PointerPoint): PointerPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * 無限畫布（Pointer Events 統一桌機／平板／手機輸入）
 *
 * 操作規則：
 * - 空白處拖曳：平移畫布（所有裝置）
 * - Shift + 空白處拖曳：框選（桌機）
 * - 卡片／物件拖曳：移動物件（滑鼠、觸控筆、手指都支援）
 * - 雙指：縮放畫布
 * - Space + 拖曳、中鍵：平移畫布（桌機捷徑）
 */
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
}) => {
  // ---- view state ----
  const [zoom, setZoom] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [gridMode, setGridMode] = useState<"coarse" | "fine" | "none">("coarse");
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [pointerTool, setPointerTool] = useState<"hand" | "select">("hand");

  // ---- selection state ----
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMarquee, setSelectionMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [guideLines, setGuideLines] = useState<GuideLine[]>([]);
  const [editingMathObj, setEditingMathObj] = useState<CanvasObjectData | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragSession>(emptySession());
  const pointersRef = useRef<Map<number, PointerPoint>>(new Map());
  const selectedIdsRef = useRef<string[]>([]);
  const objectsRef = useRef<CanvasObjectData[]>(objects);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const rafRef = useRef<number | null>(null);
  const pendingUpdatesRef = useRef<Partial<CanvasObjectData>[] | null>(null);
  const lastDragUpdatesRef = useRef<Partial<CanvasObjectData>[]>([]);
  const movedObjectRef = useRef(false);

  const gridSize = gridMode === "coarse" ? 40 : gridMode === "fine" ? 15 : 0;

  // keep event handlers free of stale values
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const toCanvas = (clientX: number, clientY: number): PointerPoint => {
    const rect = containerRef.current?.getBoundingClientRect();
    const currentPan = panRef.current;
    const currentZoom = zoomRef.current;
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - currentPan.x) / currentZoom,
      y: (clientY - rect.top - currentPan.y) / currentZoom,
    };
  };

  /** 以 requestAnimationFrame 節流，移動不因 localStorage 寫入而掉幀 */
  const queueObjectUpdates = (updates: Partial<CanvasObjectData>[]) => {
    pendingUpdatesRef.current = updates;
    lastDragUpdatesRef.current = updates;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      if (pendingUpdatesRef.current) onUpdateObjects(pendingUpdatesRef.current, { final: false });
      pendingUpdatesRef.current = null;
      rafRef.current = null;
    });
  };

  const getInitialPositions = (ids: string[]) => {
    const map: Record<string, PointerPoint> = {};
    for (const id of ids) {
      const object = objectsRef.current.find((o) => o.id === id);
      if (object) map[id] = { x: object.x, y: object.y };
    }
    return map;
  };

  // ---- smart snapping ----
  const calculateObjectMove = (rawDelta: PointerPoint, session: DragSession) => {
    const ids = selectedIdsRef.current;
    const activeObj = objectsRef.current.find((o) => o.id === ids[0]);
    let dx = rawDelta.x;
    let dy = rawDelta.y;
    const guides: GuideLine[] = [];

    if (activeObj && snapToObjects) {
      const start = session.initialPositions[activeObj.id];
      if (start) {
        const left = start.x + rawDelta.x;
        const right = left + activeObj.width;
        const centerX = left + activeObj.width / 2;
        const top = start.y + rawDelta.y;
        const bottom = top + activeObj.height;
        const centerY = top + activeObj.height / 2;
        const threshold = 8 / zoomRef.current; // 同一螢幕像素觸發距離

        for (const other of objectsRef.current) {
          if (ids.includes(other.id)) continue;
          const oLeft = other.x;
          const oRight = other.x + other.width;
          const oCenterX = other.x + other.width / 2;
          const oTop = other.y;
          const oBottom = other.y + other.height;
          const oCenterY = other.y + other.height / 2;

          if (Math.abs(left - oLeft) < threshold) { dx = oLeft - start.x; guides.push({ type: "vertical", pos: oLeft }); }
          else if (Math.abs(right - oRight) < threshold) { dx = oRight - activeObj.width - start.x; guides.push({ type: "vertical", pos: oRight }); }
          else if (Math.abs(centerX - oCenterX) < threshold) { dx = oCenterX - activeObj.width / 2 - start.x; guides.push({ type: "vertical", pos: oCenterX }); }

          if (Math.abs(top - oTop) < threshold) { dy = oTop - start.y; guides.push({ type: "horizontal", pos: oTop }); }
          else if (Math.abs(bottom - oBottom) < threshold) { dy = oBottom - activeObj.height - start.y; guides.push({ type: "horizontal", pos: oBottom }); }
          else if (Math.abs(centerY - oCenterY) < threshold) { dy = oCenterY - activeObj.height / 2 - start.y; guides.push({ type: "horizontal", pos: oCenterY }); }
        }
      }
    }

    if (snapToGrid && gridSize > 0 && guides.length === 0) {
      dx = Math.round(dx / gridSize) * gridSize;
      dy = Math.round(dy / gridSize) * gridSize;
    }

    return { dx, dy, guides };
  };

  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      mode: "pan",
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startPan: { ...panRef.current },
      initialPositions: {},
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const startMarquee = (e: React.PointerEvent<HTMLDivElement>) => {
    const point = toCanvas(e.clientX, e.clientY);
    dragRef.current = {
      mode: "marquee",
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startPan: { ...panRef.current },
      initialPositions: {},
      marqueeStart: point,
      moved: false,
    };
    setSelectedIds([]);
    setSelectionMarquee({ startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  /** 空白畫布 PointerDown：預設平移；Shift／選取工具才框選 */
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 卡片、關係線標籤與互動控制項各有自己的操作；其餘任何空白處都可平移。
    if (
      (e.target as HTMLElement).closest(
        "[data-canvas-object], [data-relation-control], button, input, textarea, select"
      )
    ) return;
    if (e.button !== 0 && e.button !== 1) return;

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 第二根手指從任何空白位置加入時，立即切換雙指縮放。
    if (pointersRef.current.size >= 2 && e.pointerType === "touch") {
      beginPinch();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    // 觸控永遠單指平移，雙指將在第二根手指進入時切換成 pinch
    if (e.pointerType === "touch" || e.button === 1 || e.altKey || e.shiftKey || pointerTool === "select") {
      if (e.shiftKey || pointerTool === "select") startMarquee(e);
      else startPan(e);
    } else {
      // 桌機左鍵空白處的預設行為也改為平移，符合無限畫布直覺
      startPan(e);
    }
  };

  /** 物件 PointerDown：滑鼠、手指、觸控筆都走同一拖曳流程 */
  const handleObjectPointerDown = (e: React.PointerEvent<HTMLDivElement>, obj: CanvasObjectData) => {
    // 卡片內的預覽／編輯等控制項必須保留正常 click，不能被拖曳攔截。
    if ((e.target as HTMLElement).closest("button, input, textarea, select, a, [data-no-canvas-drag]")) return;
    if (obj.isLocked || e.button === 2) return;
    e.stopPropagation();

    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 雙指從卡片上開始也必須可縮放畫布。
    if (pointersRef.current.size >= 2 && e.pointerType === "touch") {
      beginPinch();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }

    let ids = selectedIdsRef.current;
    if (e.shiftKey && e.pointerType !== "touch") {
      ids = ids.includes(obj.id) ? ids.filter((id) => id !== obj.id) : [...ids, obj.id];
    } else if (!ids.includes(obj.id)) {
      ids = [obj.id];
    }

    // 群組物件一起移動
    if (obj.groupId) {
      const groupIds = objectsRef.current.filter((o) => o.groupId === obj.groupId).map((o) => o.id);
      ids = Array.from(new Set([...ids, ...groupIds]));
    }

    selectedIdsRef.current = ids;
    setSelectedIds(ids);
    movedObjectRef.current = false;
    dragRef.current = {
      mode: "object",
      pointerId: e.pointerId,
      startScreen: { x: e.clientX, y: e.clientY },
      startPan: { ...panRef.current },
      initialPositions: getInitialPositions(ids),
      moved: false,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const beginPinch = () => {
    const values = Array.from(pointersRef.current.values());
    if (values.length < 2) return;
    const [first, second] = values;
    const session = dragRef.current;
    dragRef.current = {
      ...session,
      mode: "pinch",
      pointerId: null,
      startScreen: midpoint(first, second),
      startPan: { ...panRef.current },
      pinchDistance: distance(first, second),
      pinchZoom: zoomRef.current,
      pinchCenter: midpoint(first, second),
      moved: true,
    };
    setSelectionMarquee(null);
    setGuideLines([]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const session = dragRef.current;

    // Two-pointer gesture works across iOS/Android/Surface, no TouchEvent duplication
    if (pointersRef.current.size >= 2 && (e.pointerType === "touch" || session.mode === "pinch")) {
      if (session.mode !== "pinch") beginPinch();
      const active = dragRef.current;
      const [a, b] = Array.from(pointersRef.current.values());
      const newDistance = distance(a, b);
      const scale = newDistance / (active.pinchDistance || newDistance || 1);
      const nextZoom = Math.min(2.5, Math.max(0.2, (active.pinchZoom || zoomRef.current) * scale));
      setZoom(nextZoom);
      return;
    }

    if (session.pointerId !== e.pointerId) return;
    const screenDx = e.clientX - session.startScreen.x;
    const screenDy = e.clientY - session.startScreen.y;
    if (Math.abs(screenDx) > 3 || Math.abs(screenDy) > 3) session.moved = true;

    if (session.mode === "pan") {
      setPan({ x: session.startPan.x + screenDx, y: session.startPan.y + screenDy });
      return;
    }

    if (session.mode === "marquee" && session.marqueeStart) {
      const p = toCanvas(e.clientX, e.clientY);
      const start = session.marqueeStart;
      setSelectionMarquee({ startX: start.x, startY: start.y, currentX: p.x, currentY: p.y });
      const left = Math.min(start.x, p.x);
      const right = Math.max(start.x, p.x);
      const top = Math.min(start.y, p.y);
      const bottom = Math.max(start.y, p.y);
      const enclosed = objectsRef.current.filter((o) =>
        o.x >= left && o.x + o.width <= right && o.y >= top && o.y + o.height <= bottom
      );
      const ids = enclosed.map((o) => o.id);
      selectedIdsRef.current = ids;
      setSelectedIds(ids);
      return;
    }

    if (session.mode === "object") {
      const rawDelta = { x: screenDx / zoomRef.current, y: screenDy / zoomRef.current };
      const { dx, dy, guides } = calculateObjectMove(rawDelta, session);
      setGuideLines(guides);
      const updates = selectedIdsRef.current
        .filter((id) => session.initialPositions[id])
        .map((id) => ({
          id,
          x: Math.round(session.initialPositions[id].x + dx),
          y: Math.round(session.initialPositions[id].y + dy),
        }));
      if (updates.length) {
        movedObjectRef.current = movedObjectRef.current || session.moved;
        queueObjectUpdates(updates);
      }
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    const session = dragRef.current;
    try {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch { /* capture may belong to child */ }

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    if (pointersRef.current.size === 1 && session.mode === "pinch") {
      const [remainingId, remaining] = Array.from(pointersRef.current.entries())[0];
      dragRef.current = {
        mode: "pan",
        pointerId: remainingId,
        startScreen: remaining,
        startPan: { ...panRef.current },
        initialPositions: {},
        moved: true,
      };
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // 放開時立即寫入最後座標；中途所有更新仍維持 rAF + localStorage 防抖。
    const finalUpdates = pendingUpdatesRef.current || lastDragUpdatesRef.current;
    if (finalUpdates.length > 0) onUpdateObjects(finalUpdates, { final: true });
    pendingUpdatesRef.current = null;
    lastDragUpdatesRef.current = [];
    setSelectionMarquee(null);
    setGuideLines([]);
    dragRef.current = emptySession();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 拖完卡片不開啟詳情；單擊卡片的開啟交給卡片自己的 click
    if ((e.target as HTMLElement).closest("[data-canvas-object]")) return;
    if (dragRef.current.moved) return;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const oldZoom = zoomRef.current;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextZoom = Math.min(2.5, Math.max(0.2, oldZoom * factor));
      // zoom toward mouse position (not just top-left)
      const worldX = (e.clientX - rect.left - panRef.current.x) / oldZoom;
      const worldY = (e.clientY - rect.top - panRef.current.y) / oldZoom;
      setZoom(nextZoom);
      setPan({
        x: e.clientX - rect.left - worldX * nextZoom,
        y: e.clientY - rect.top - worldY * nextZoom,
      });
    } else {
      setPan((prev) => ({ x: prev.x - e.deltaX * 0.9, y: prev.y - e.deltaY * 0.9 }));
    }
  };

  // ---- selection actions ----
  const selectedObjects = objects.filter((o) => selectedIds.includes(o.id));

  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    onUpdateObjects(selectedIds.map((id) => ({ id, groupId: `group-${Date.now()}` })));
  };
  const handleUngroup = () => onUpdateObjects(selectedIds.map((id) => ({ id, groupId: undefined })));
  const handleToggleLock = () => {
    const lock = selectedObjects.some((o) => !o.isLocked);
    onUpdateObjects(selectedIds.map((id) => ({ id, isLocked: lock })));
  };
  const handleChangeSemantic = (semanticType: string) =>
    onUpdateObjects(selectedIds.map((id) => ({ id, semanticType })));
  const handleZOrder = (front: boolean) => {
    const z = front
      ? Math.max(1, ...objects.map((o) => o.zIndex || 1)) + 1
      : Math.max(0, Math.min(1, ...objects.map((o) => o.zIndex || 1)) - 1);
    onUpdateObjects(selectedIds.map((id) => ({ id, zIndex: z })));
  };
  const handleAlign = (type: "left" | "center") => {
    if (selectedObjects.length < 2) return;
    if (type === "left") {
      const x = Math.min(...selectedObjects.map((o) => o.x));
      onUpdateObjects(selectedObjects.map((o) => ({ id: o.id, x })));
    } else {
      const center = selectedObjects.reduce((n, o) => n + o.x + o.width / 2, 0) / selectedObjects.length;
      onUpdateObjects(selectedObjects.map((o) => ({ id: o.id, x: center - o.width / 2 })));
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none flex flex-col">
      {/* 操作狀態：僅第一次使用時動畫提示，工具列保留明確切換 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 hidden sm:flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-200/80 shadow-sm text-[10px] text-slate-500 pointer-events-none">
        <Hand className="w-3 h-3" />
        <span>拖曳空白處平移 · Shift+拖曳框選 · 雙指縮放</span>
      </div>

      {/* 最小工具列 */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-200 shadow-lg text-xs">
        <button
          onClick={() => setPointerTool(pointerTool === "hand" ? "select" : "hand")}
          className={`p-1.5 rounded transition-colors ${pointerTool === "hand" ? "text-blue-600 bg-blue-50" : "text-slate-500 hover:bg-slate-100"}`}
          title={pointerTool === "hand" ? "目前：拖曳空白處平移（點擊切換框選）" : "目前：框選（點擊切換平移）"}
        >
          {pointerTool === "hand" ? <Hand className="w-3.5 h-3.5" /> : <MousePointer2 className="w-3.5 h-3.5" />}
        </button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="縮小">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[10px] w-9 text-center text-slate-500">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="放大">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-slate-200 mx-0.5" />
        <button
          onClick={() => setGridMode(gridMode === "coarse" ? "fine" : gridMode === "fine" ? "none" : "coarse")}
          className={`p-1.5 rounded transition-colors ${gridMode !== "none" ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:bg-slate-100"}`}
          title="切換網格：粗／細／關"
        >
          <Grid className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setSnapToGrid((v) => !v)}
          className={`p-1.5 rounded transition-colors ${snapToGrid ? "text-indigo-600 bg-indigo-50" : "text-slate-400 hover:bg-slate-100"}`}
          title="網格吸附"
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 選取列 */}
      {selectedIds.length > 0 && (
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 flex items-center gap-1 bg-slate-900 text-white px-2 py-1.5 rounded-lg shadow-xl text-[10px] max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar">
          <span className="text-slate-400 mr-1 whitespace-nowrap">{selectedIds.length} 選取</span>
          <select
            value={selectedObjects[0]?.semanticType || "AUXILIARY"}
            onChange={(e) => handleChangeSemantic(e.target.value)}
            className="bg-slate-800 text-slate-200 text-[10px] px-1.5 py-0.5 rounded border border-slate-700 outline-none"
          >
            <option value="WHAT">WHAT</option>
            <option value="WHY">WHY</option>
            <option value="HOW">HOW</option>
            <option value="ORIGIN">ORIGIN</option>
            <option value="AUXILIARY">輔助</option>
          </select>
          {selectedIds.length >= 2 && <>
            <button onClick={() => handleAlign("left")} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="靠左"><AlignLeft className="w-3 h-3" /></button>
            <button onClick={() => handleAlign("center")} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="水平置中"><AlignCenter className="w-3 h-3" /></button>
            <button onClick={handleGroup} className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 whitespace-nowrap">群組</button>
          </>}
          {selectedObjects.some((o) => o.groupId) && (
            <button onClick={handleUngroup} className="px-1.5 py-0.5 rounded hover:bg-slate-700 text-slate-300 whitespace-nowrap">解散</button>
          )}
          <button onClick={() => handleZOrder(true)} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="置頂"><Layers className="w-3 h-3" /></button>
          <button onClick={handleToggleLock} className="p-1 rounded hover:bg-slate-800 text-slate-300" title="鎖定／解鎖">
            {selectedObjects.some((o) => o.isLocked) ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
          </button>
          <button onClick={() => selectedIds.forEach(onDeleteObject)} className="p-1 rounded hover:bg-rose-900 text-rose-400" title="刪除"><Trash2 className="w-3 h-3" /></button>
        </div>
      )}

      {/* 畫布 input surface。touch-action:none 必須由 inline style 補強 iOS。 */}
      <div
        id="canvas-bg"
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={handleCanvasClick}
        className={`w-full h-full relative overflow-hidden ${pointerTool === "hand" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        style={{
          touchAction: "none",
          background: "transparent",
          backgroundImage: gridMode === "none" ? "none" : gridMode === "coarse" ? "radial-gradient(#cbd5e1 1.2px, transparent 1.2px)" : "radial-gradient(#e2e8f0 1px, transparent 1px)",
          backgroundSize: `${gridSize * zoom}px ${gridSize * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* Transform layer */}
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/*
            關係邊：SVG 本身不可接收事件，避免 5000×5000 的透明背景覆蓋畫布、
            製造「這塊空白不能拖」的死區；只有線段與標籤個別開啟互動。
          */}
          <svg className="absolute inset-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
            <defs>
              <marker id="arrowhead-indigo" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#6366f1" /></marker>
              <marker id="arrowhead-amber" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><polygon points="0 0, 8 4, 0 8" fill="#f59e0b" /></marker>
            </defs>
            {relations.map((rel) => {
              const from = objects.find((o) => o.cardId === rel.fromCardId);
              const to = objects.find((o) => o.cardId === rel.toCardId);
              if (!from || !to) return null;
              const x1 = from.x + from.width / 2;
              const y1 = from.y + from.height / 2;
              const x2 = to.x + to.width / 2;
              const y2 = to.y + to.height / 2;
              const isUnverified = rel.relationType === "analogy_unverified";
              const color = isUnverified ? "#f59e0b" : "#6366f1";
              return (
                <g
                  key={rel.id}
                  data-relation-control="true"
                  className="pointer-events-auto cursor-pointer group"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditRelation(rel);
                  }}
                >
                  <line
                    data-relation-control="true"
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth="10"
                    strokeOpacity="0"
                    fill="none"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth="2.5"
                    strokeDasharray={isUnverified ? "6,6" : "none"}
                    markerEnd={isUnverified ? "url(#arrowhead-amber)" : "url(#arrowhead-indigo)"}
                    pointerEvents="none"
                  />
                  <foreignObject data-relation-control="true" x={(x1 + x2) / 2 - 76} y={(y1 + y2) / 2 - 14} width={152} height={30} className="overflow-visible pointer-events-auto">
                    <div data-relation-control="true" className="flex items-center justify-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-xs ${isUnverified ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-white text-indigo-800 border-indigo-300"}`}>
                        {rel.label || rel.relationType}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>

          {/* 物件 */}
          {objects.map((obj) => {
            if (obj.isHidden) return null;
            const card = obj.cardId ? cards.find((c) => c.id === obj.cardId) : null;
            const isSelected = selectedIds.includes(obj.id);
            return (
              <div
                key={obj.id}
                data-canvas-object="true"
                onPointerDown={(e) => handleObjectPointerDown(e, obj)}
                className={`absolute pointer-events-auto transition-shadow ${isSelected ? "ring-2 ring-blue-500 shadow-2xl" : "shadow-md"} ${obj.isLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
                style={{
                  left: `${obj.x}px`, top: `${obj.y}px`, width: `${obj.width}px`, height: `${obj.height}px`,
                  transform: `rotate(${obj.rotation || 0}deg)`, zIndex: obj.zIndex || 1, touchAction: "none",
                }}
              >
                {obj.type === "card_node" && card && (
                  <KnowledgeCardNode
                    card={card}
                    isSelected={isSelected}
                    onSelect={() => { if (!movedObjectRef.current) onSelectCard(card); movedObjectRef.current = false; }}
                    onOpenPreview={() => onOpenPreview(card)}
                    onOpenDetail={() => onOpenCardDetail(card)}
                    onRunAudit={() => onRunAudit(card)}
                    onExpansionTest={() => onExpansionTest(card)}
                    fontFamily={fontFamily}
                  />
                )}

                {obj.type === "math" && (
                  <div className="w-full h-full bg-white rounded-xl border border-blue-200 p-3 shadow-sm flex flex-col justify-between overflow-hidden group">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-slate-700 font-semibold text-xs">
                      <span className="truncate">{obj.content?.title || "公式推導"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-100 text-blue-800">{obj.content?.epistemicMark || "⊢證"}</span>
                        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setEditingMathObj(obj)} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-blue-600 hover:text-blue-800 transition-opacity" title="編輯公式"><Edit3 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center p-2 overflow-x-auto"><KaTeXRenderer latex={obj.content?.latex || ""} displayMode={true} /></div>
                  </div>
                )}

                {obj.type === "plot" && (
                  <FunctionPlotCanvas
                    width={obj.width} height={obj.height} title={obj.content?.title} formula={obj.content?.formula} caption={obj.content?.caption}
                    onCheckIndependence={() => onImageTextIndependenceTest(obj.content?.caption || "圖文獨立性檢查：文字是否把推理偷偷交給了圖片")}
                  />
                )}

                {obj.type === "text" && (
                  <div className="w-full h-full p-4 rounded-xl shadow-xs overflow-y-auto leading-relaxed text-xs" style={{ backgroundColor: obj.style?.backgroundColor || "#ffffff", borderColor: obj.style?.borderColor || "#cbd5e1", borderWidth: obj.style?.borderWidth || 1, color: obj.style?.color || "#1e293b" }}>
                    {obj.content?.title && <h4 className="font-bold text-sm mb-2">{obj.content.title}</h4>}
                    <p className="whitespace-pre-wrap">{obj.content?.text}</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Canva 式對齊線 */}
          {guideLines.map((g, i) => (
            <div key={`${g.type}-${g.pos}-${i}`} className="absolute pointer-events-none" style={{ left: g.type === "vertical" ? `${g.pos}px` : "0px", top: g.type === "horizontal" ? `${g.pos}px` : "0px", width: g.type === "vertical" ? "1.5px" : "5000px", height: g.type === "horizontal" ? "1.5px" : "5000px", backgroundColor: "#ec4899", boxShadow: "0 0 4px rgba(236,72,153,.6)" }} />
          ))}

          {/* 框選 */}
          {selectionMarquee && (
            <div className="absolute pointer-events-none bg-blue-500/10 border border-blue-500 rounded" style={{ left: `${Math.min(selectionMarquee.startX, selectionMarquee.currentX)}px`, top: `${Math.min(selectionMarquee.startY, selectionMarquee.currentY)}px`, width: `${Math.abs(selectionMarquee.currentX - selectionMarquee.startX)}px`, height: `${Math.abs(selectionMarquee.currentY - selectionMarquee.startY)}px` }} />
          )}
        </div>
      </div>

      {editingMathObj && (
        <MathFormulaEditor
          initialLatex={editingMathObj.content?.latex}
          initialTitle={editingMathObj.content?.title}
          initialEpistemicMark={editingMathObj.content?.epistemicMark}
          onSave={(data) => {
            onUpdateObjects([{ id: editingMathObj.id, content: { ...editingMathObj.content, latex: data.latex, title: data.title, epistemicMark: data.epistemicMark } }]);
            setEditingMathObj(null);
          }}
          onCancel={() => setEditingMathObj(null)}
        />
      )}
    </div>
  );
};
