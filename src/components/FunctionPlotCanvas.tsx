"use client";

import React, { useEffect, useRef, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";

interface FunctionPlotCanvasProps {
  equationType?: string;
  formula?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  width?: number;
  height?: number;
  title?: string;
  caption?: string;
  onCheckIndependence?: () => void;
}

export const FunctionPlotCanvas: React.FC<FunctionPlotCanvasProps> = ({
  equationType = "wave_packet",
  formula = "Math.exp(-x*x/4) * Math.cos(4*x)",
  xMin = -5,
  xMax = 5,
  yMin = -1.2,
  yMax = 1.2,
  width = 380,
  height = 200,
  title = "物理函數/波動座標系可視化",
  caption,
  onCheckIndependence,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentFormula, setCurrentFormula] = useState(formula);
  const [currentType, setCurrentType] = useState(equationType);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);

  const presets: Record<string, { formula: string; xMin: number; xMax: number; yMin: number; yMax: number; label: string }> = {
    wave_packet: {
      formula: "Math.exp(-x*x/4) * Math.cos(4*x)",
      xMin: -5,
      xMax: 5,
      yMin: -1.2,
      yMax: 1.2,
      label: "量子波包干涉",
    },
    carnot_cycle: {
      formula: "2 / Math.pow(Math.max(0.2, x), 1.4)",
      xMin: 0.2,
      xMax: 4,
      yMin: 0,
      yMax: 5,
      label: "絕熱膨脹 P-V 曲線",
    },
    gaussian: {
      formula: "Math.exp(-x*x/2) / Math.sqrt(2 * Math.PI)",
      xMin: -4,
      xMax: 4,
      yMin: -0.1,
      yMax: 0.5,
      label: "高斯正態分佈",
    },
    damped_wave: {
      formula: "Math.exp(-0.35 * Math.max(0, x)) * Math.sin(3 * x)",
      xMin: 0,
      xMax: 8,
      yMin: -1,
      yMax: 1,
      label: "阻尼諧震動",
    },
    lechatelier_logistic: {
      formula: "1 / (1 + Math.exp(-2 * x))",
      xMin: -4,
      xMax: 4,
      yMin: -0.1,
      yMax: 1.1,
      label: "化學反應商動態回覆 S型",
    },
  };

  const handleSelectPreset = (key: string) => {
    setCurrentType(key);
    if (presets[key]) {
      setCurrentFormula(presets[key].formula);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    const activePreset = presets[currentType];
    const xRangeMin = activePreset ? activePreset.xMin : xMin;
    const xRangeMax = activePreset ? activePreset.xMax : xMax;
    const yRangeMin = activePreset ? activePreset.yMin : yMin;
    const yRangeMax = activePreset ? activePreset.yMax : yMax;

    const padding = 35;
    const plotW = w - padding * 2;
    const plotH = h - padding * 2;

    const toScreenX = (x: number) => padding + ((x - xRangeMin) / (xRangeMax - xRangeMin)) * plotW;
    const toScreenY = (y: number) => h - padding - ((y - yRangeMin) / (yRangeMax - yRangeMin)) * plotH;

    // Draw Grid Lines
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;

    for (let xVal = Math.ceil(xRangeMin); xVal <= Math.floor(xRangeMax); xVal++) {
      const sx = toScreenX(xVal);
      ctx.beginPath();
      ctx.moveTo(sx, padding);
      ctx.lineTo(sx, h - padding);
      ctx.stroke();
    }
    for (let yVal = Math.ceil(yRangeMin); yVal <= Math.floor(yRangeMax); yVal++) {
      const sy = toScreenY(yVal);
      ctx.beginPath();
      ctx.moveTo(padding, sy);
      ctx.lineTo(w - padding, sy);
      ctx.stroke();
    }

    // Draw Axes
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;

    // X Axis
    const originY = toScreenY(0);
    const clampedOriginY = Math.max(padding, Math.min(h - padding, originY));
    ctx.beginPath();
    ctx.moveTo(padding, clampedOriginY);
    ctx.lineTo(w - padding, clampedOriginY);
    ctx.stroke();

    // Y Axis
    const originX = toScreenX(0);
    const clampedOriginX = Math.max(padding, Math.min(w - padding, originX));
    ctx.beginPath();
    ctx.moveTo(clampedOriginX, padding);
    ctx.lineTo(clampedOriginX, h - padding);
    ctx.stroke();

    // Axis labels & ticks
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";

    for (let xVal = Math.ceil(xRangeMin); xVal <= Math.floor(xRangeMax); xVal += 2) {
      const sx = toScreenX(xVal);
      ctx.fillText(xVal.toString(), sx, clampedOriginY + 14);
    }
    ctx.textAlign = "right";
    for (let yVal = Math.ceil(yRangeMin); yVal <= Math.floor(yRangeMax); yVal += 1) {
      if (yVal === 0) continue;
      const sy = toScreenY(yVal);
      ctx.fillText(yVal.toString(), clampedOriginX - 6, sy + 3);
    }

    // Plot Function curve
    let evalFn: (x: number) => number;
    try {
      evalFn = new Function("x", `return ${currentFormula};`) as (x: number) => number;
    } catch {
      evalFn = (x: number) => Math.sin(x);
    }

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    let isFirst = true;
    const steps = 250;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = xRangeMin + t * (xRangeMax - xRangeMin);
      try {
        const y = evalFn(x);
        if (!isNaN(y) && isFinite(y)) {
          const sx = toScreenX(x);
          const sy = toScreenY(y);
          if (isFirst) {
            ctx.moveTo(sx, Math.max(padding, Math.min(h - padding, sy)));
            isFirst = false;
          } else {
            ctx.lineTo(sx, Math.max(padding, Math.min(h - padding, sy)));
          }
        }
      } catch {
        // ignore math domain error
      }
    }
    ctx.stroke();

    // Fill under curve lightly
    ctx.lineTo(toScreenX(xRangeMax), clampedOriginY);
    ctx.lineTo(toScreenX(xRangeMin), clampedOriginY);
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fill();
  }, [currentFormula, currentType, xMin, xMax, yMin, yMax, width, height]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span className="truncate">{title}</span>
        </div>
        <select
          value={currentType}
          onChange={(e) => handleSelectPreset(e.target.value)}
          className="text-[11px] px-2 py-0.5 rounded border border-slate-300 bg-white text-slate-700 outline-none focus:border-blue-500"
        >
          {Object.entries(presets).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative flex-1 p-2 flex items-center justify-center bg-slate-50/40">
        <canvas
          ref={canvasRef}
          width={width - 24}
          height={height - 75}
          className="rounded border border-slate-200 shadow-sm bg-white"
        />
      </div>

      {caption && (
        <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-slate-600 border-t border-slate-100 flex items-center justify-between">
          <span className="truncate">{caption}</span>
          {onCheckIndependence && (
            <button
              onClick={onCheckIndependence}
              className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium whitespace-nowrap transition-colors"
            >
              圖文獨立性檢查
            </button>
          )}
        </div>
      )}
    </div>
  );
};
