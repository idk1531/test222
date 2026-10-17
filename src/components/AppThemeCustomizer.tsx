"use client";

import React from "react";
import { Palette, RotateCcw } from "lucide-react";
import { APP_THEME_PRESETS, AppTheme, DEFAULT_APP_THEME } from "@/lib/appTheme";

const UI = "'Varela Round', sans-serif";

interface AppThemeCustomizerProps {
  currentTheme: AppTheme;
  onUpdateTheme: (theme: AppTheme) => void;
  onResetTheme: () => void;
  onClose: () => void;
}

/** 可調色欄位（沿用 CardThemeCustomizer 的「色票 + <input type="color">」樣板） */
const COLOR_FIELDS: Array<{ key: keyof AppTheme; label: string }> = [
  { key: "headerBg", label: "工具列底色" },
  { key: "headerText", label: "主要文字" },
  { key: "headerMuted", label: "次要文字 / icon" },
  { key: "headerBorder", label: "下邊線 / 分隔線" },
  { key: "tabBarBg", label: "分頁條底" },
  { key: "tabActiveBg", label: "active 分頁底" },
  { key: "tabActiveText", label: "active 分頁字" },
  { key: "tabInactiveText", label: "inactive 分頁字" },
  { key: "hoverBg", label: "hover 底色" },
  { key: "accent", label: "強調色（新增 / focus）" },
  { key: "accentText", label: "強調色上的文字" },
  { key: "panelBg", label: "彈窗外框底" },
];

function isHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export const AppThemeCustomizer: React.FC<AppThemeCustomizerProps> = ({
  currentTheme,
  onUpdateTheme,
  onResetTheme,
  onClose,
}) => {
  const isPresetActive = (preset: AppTheme) =>
    (Object.keys(DEFAULT_APP_THEME) as Array<keyof AppTheme>).every(
      (key) => key === "name" || currentTheme[key] === preset[key]
    );

  return (
    <div
      className="p-4 bg-white rounded-xl shadow-2xl border border-slate-200 w-[calc(100vw-16px)] max-w-80 space-y-4 select-none max-h-[80vh] overflow-y-auto"
      style={{ fontFamily: UI }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
          <Palette className="w-4 h-4 text-blue-600" />
          工具列配色
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xs" title="關閉">
          ✕
        </button>
      </div>

      {/* 預設配色 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-600 block">快速主題預設</label>
        <div className="grid grid-cols-1 gap-1.5">
          {Object.entries(APP_THEME_PRESETS).map(([key, preset]) => {
            const active = isPresetActive(preset);
            return (
              <button
                key={key}
                onClick={() => onUpdateTheme(preset)}
                className="flex items-center justify-between p-2 rounded border hover:bg-slate-50 text-left text-xs transition-all"
                style={{
                  borderColor: active ? "#2563eb" : "#e2e8f0",
                  backgroundColor: active ? "#eff6ff" : "#ffffff",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full border shadow-xs flex-shrink-0"
                    style={{ backgroundColor: preset.headerBg, borderColor: preset.headerBorder }}
                  />
                  <span className="font-medium text-slate-800">{preset.name}</span>
                </div>
                {active && <span className="text-[10px] text-blue-600 font-bold">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 色彩微調 */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-[11px] font-bold text-slate-600 block">自訂色彩細節</label>
        <div className="space-y-2 text-xs">
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="flex items-center justify-between gap-2">
              <span className="text-slate-600">{field.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-slate-400">
                  {isHex(String(currentTheme[field.key])) ? currentTheme[field.key] : ""}
                </span>
                <input
                  type="color"
                  value={isHex(String(currentTheme[field.key])) ? String(currentTheme[field.key]) : "#ffffff"}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, name: "自訂配色", [field.key]: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                  aria-label={field.label}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={onResetTheme}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          還原預設配色
        </button>
      </div>
    </div>
  );
};
