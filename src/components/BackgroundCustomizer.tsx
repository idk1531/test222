"use client";

import React, { useState } from "react";
import { Palette, RefreshCw, Download, Upload, Copy, Check } from "lucide-react";

interface BackgroundConfig {
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
  overlayColor?: string;
  overlayOpacity?: number;
}

interface BackgroundCustomizerProps {
  currentConfig: BackgroundConfig;
  onUpdate: (config: BackgroundConfig) => void;
  onClose: () => void;
}

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  currentConfig,
  onUpdate,
  onClose,
}) => {
  const [config, setConfig] = useState<BackgroundConfig>(currentConfig);
  const [copied, setCopied] = useState(false);
  const [presets] = useState<Record<string, BackgroundConfig>>({
    minimal_light: {
      type: "solid",
      solidColor: "#f8fafc",
    },
    minimal_dark: {
      type: "solid",
      solidColor: "#1e293b",
    },
    gradient_warm: {
      type: "gradient",
      gradientStart: "#ffecd2",
      gradientEnd: "#fcb69f",
      gradientAngle: 135,
    },
    gradient_cool: {
      type: "gradient",
      gradientStart: "#e0f7ff",
      gradientEnd: "#b3e5fc",
      gradientAngle: 135,
    },
    gradient_forest: {
      type: "gradient",
      gradientStart: "#1b3a42",
      gradientEnd: "#265359",
      gradientAngle: 135,
    },
    gradient_sunset: {
      type: "gradient",
      gradientStart: "#ff6b6b",
      gradientEnd: "#ffbe0b",
      gradientAngle: 135,
    },
    gradient_ocean: {
      type: "gradient",
      gradientStart: "#0066cc",
      gradientEnd: "#00ccff",
      gradientAngle: 135,
    },
    pattern_dots: {
      type: "pattern",
      solidColor: "#ffffff",
      patternType: "dots",
      patternColor: "#cbd5e1",
    },
    pattern_grid: {
      type: "pattern",
      solidColor: "#ffffff",
      patternType: "grid",
      patternColor: "#e5e7eb",
    },
    pattern_lines: {
      type: "pattern",
      solidColor: "#ffffff",
      patternType: "lines",
      patternColor: "#f3f4f6",
    },
  });

  const generateCSS = () => {
    if (config.type === "solid") {
      return `background-color: ${config.solidColor};`;
    }
    if (config.type === "gradient") {
      return `background: linear-gradient(${config.gradientAngle || 135}deg, ${
        config.gradientStart
      }, ${config.gradientEnd});`;
    }
    if (config.type === "pattern") {
      let patternCSS = "";
      if (config.patternType === "dots") {
        patternCSS = `background-color: ${config.solidColor};
background-image: radial-gradient(circle, ${config.patternColor} 1.5px, transparent 1.5px);
background-size: 20px 20px;`;
      } else if (config.patternType === "grid") {
        patternCSS = `background-color: ${config.solidColor};
background-image: 
  linear-gradient(${config.patternColor} 1px, transparent 1px),
  linear-gradient(90deg, ${config.patternColor} 1px, transparent 1px);
background-size: 20px 20px;`;
      } else if (config.patternType === "lines") {
        patternCSS = `background-color: ${config.solidColor};
background-image: repeating-linear-gradient(
  45deg,
  ${config.patternColor},
  ${config.patternColor} 10px,
  ${config.solidColor} 10px,
  ${config.solidColor} 20px
);`;
      }
      if (config.imageUrl) {
        patternCSS += `
background-image: url('${config.imageUrl}');
background-size: cover;
background-position: center;
opacity: ${config.imageOpacity ?? 1};`;
      }
      return patternCSS;
    }
    if (config.type === "custom") {
      return config.customCss || "";
    }
    return "";
  };

  const handleCopyCSS = () => {
    navigator.clipboard.writeText(generateCSS());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92dvh] overflow-hidden flex flex-col safe-bottom">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            <h3 className="font-bold text-sm">無限背景自訂調色板 & 圖樣編輯器</h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preview */}
          <div>
            <label className="font-bold text-slate-700 block mb-2">即時預覽：</label>
            <div
              className="w-full h-40 rounded-xl border-2 border-slate-300 shadow-inner"
              style={{
                backgroundImage:
                  config.type === "gradient"
                    ? `linear-gradient(${config.gradientAngle || 135}deg, ${
                        config.gradientStart
                      }, ${config.gradientEnd})`
                    : undefined,
                backgroundColor: config.type === "solid" ? config.solidColor : undefined,
              }}
            >
              <div className="flex items-center justify-center h-full text-slate-600 font-bold">
                背景預覽
              </div>
            </div>
          </div>

          {/* Type Selector */}
          <div>
            <label className="font-bold text-slate-700 block mb-2">背景類型：</label>
            <div className="grid grid-cols-4 gap-2">
              {(["solid", "gradient", "pattern", "custom"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setConfig({ ...config, type: t })}
                  className={`p-3 rounded-lg border-2 text-sm font-bold transition-all ${
                    config.type === t
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {t === "solid" && "純色"}
                  {t === "gradient" && "漸層"}
                  {t === "pattern" && "圖樣"}
                  {t === "custom" && "自訂"}
                </button>
              ))}
            </div>
          </div>

          {/* Solid Color Config */}
          {config.type === "solid" && (
            <div>
              <label className="font-bold text-slate-700 block mb-2">顏色選擇：</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.solidColor || "#ffffff"}
                  onChange={(e) => setConfig({ ...config, solidColor: e.target.value })}
                  className="w-16 h-16 rounded-lg cursor-pointer border border-slate-300"
                />
                <input
                  type="text"
                  value={config.solidColor || "#ffffff"}
                  onChange={(e) => setConfig({ ...config, solidColor: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                  placeholder="#ffffff"
                />
              </div>
            </div>
          )}

          {/* Gradient Config */}
          {config.type === "gradient" && (
            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">起始色：</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.gradientStart || "#ffffff"}
                    onChange={(e) =>
                      setConfig({ ...config, gradientStart: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={config.gradientStart || "#ffffff"}
                    onChange={(e) =>
                      setConfig({ ...config, gradientStart: e.target.value })
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">結束色：</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.gradientEnd || "#000000"}
                    onChange={(e) =>
                      setConfig({ ...config, gradientEnd: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={config.gradientEnd || "#000000"}
                    onChange={(e) =>
                      setConfig({ ...config, gradientEnd: e.target.value })
                    }
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  角度：{config.gradientAngle || 135}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={config.gradientAngle || 135}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      gradientAngle: parseInt(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Pattern Config */}
          {config.type === "pattern" && (
            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-2">圖樣類型：</label>
                <div className="grid grid-cols-4 gap-2">
                  {(["dots", "grid", "lines", "none"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() =>
                        setConfig({ ...config, patternType: p })
                      }
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                        config.patternType === p
                          ? "border-blue-600 bg-blue-50 text-blue-800"
                          : "border-slate-300 bg-white hover:border-slate-400"
                      }`}
                    >
                      {p === "dots" && "點點"}
                      {p === "grid" && "方格"}
                      {p === "lines" && "斜線"}
                      {p === "none" && "無"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">底色：</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.solidColor || "#ffffff"}
                    onChange={(e) =>
                      setConfig({ ...config, solidColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">圖樣色：</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.patternColor || "#cbd5e1"}
                    onChange={(e) =>
                      setConfig({ ...config, patternColor: e.target.value })
                    }
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">背景圖片 URL：</label>
                <input
                  type="text"
                  value={config.imageUrl || ""}
                  onChange={(e) =>
                    setConfig({ ...config, imageUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {config.imageUrl && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    圖片透明度：{config.imageOpacity ?? 1}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.imageOpacity ?? 1}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        imageOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}

          {/* Custom CSS */}
          {config.type === "custom" && (
            <div>
              <label className="font-bold text-slate-700 block mb-1">自訂 CSS：</label>
              <textarea
                rows={4}
                value={config.customCss || ""}
                onChange={(e) =>
                  setConfig({ ...config, customCss: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs"
                placeholder="background: linear-gradient(...); background-image: url(...);"
              />
            </div>
          )}

          {/* Presets */}
          <div>
            <label className="font-bold text-slate-700 block mb-2">預設背景：</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(presets).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setConfig(preset)}
                  className="h-20 rounded-lg border-2 border-slate-300 hover:border-slate-500 shadow-sm transition-all overflow-hidden"
                  style={{
                    backgroundImage:
                      preset.type === "gradient"
                        ? `linear-gradient(135deg, ${preset.gradientStart}, ${preset.gradientEnd})`
                        : undefined,
                    backgroundColor:
                      preset.type === "solid" ? preset.solidColor : undefined,
                  }}
                  title={key}
                >
                  <span className="text-[10px] font-mono text-slate-500 px-1">
                    {key.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Generated CSS */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">生成的 CSS：</label>
            <div className="relative">
              <textarea
                rows={3}
                readOnly
                value={generateCSS()}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-xs bg-slate-50"
              />
              <button
                onClick={handleCopyCSS}
                className="absolute top-2 right-2 p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={() => {
              onUpdate(config);
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            應用背景設定
          </button>
        </div>
      </div>
    </div>
  );
};
