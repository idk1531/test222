"use client";

import React from "react";
import { Palette, RotateCcw, X, Check } from "lucide-react";
import { AppTheme, APP_THEME_PRESETS, DEFAULT_APP_THEME } from "@/lib/appTheme";

interface AppThemeCustomizerProps {
  currentTheme: AppTheme;
  onUpdateTheme: (theme: AppTheme) => void;
  onResetTheme: () => void;
  onClose: () => void;
}

export const AppThemeCustomizer: React.FC<AppThemeCustomizerProps> = ({
  currentTheme,
  onUpdateTheme,
  onResetTheme,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm space-y-4 select-none max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* 標頭 */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
            <Palette className="w-4 h-4 text-blue-600" />
            <span>頂部工具列與介面配色</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 內容區 */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* 預設主題切換 */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 block">
              快速主題預設
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(APP_THEME_PRESETS).map(([key, preset]) => {
                const isSelected =
                  currentTheme.headerBg === preset.headerBg &&
                  currentTheme.headerText === preset.headerText &&
                  currentTheme.accent === preset.accent;
                return (
                  <button
                    key={key}
                    onClick={() => onUpdateTheme(preset)}
                    className="flex items-center justify-between p-2 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: isSelected ? "#2563eb" : "#e2e8f0",
                      backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full border shadow-2xs flex-shrink-0"
                        style={{
                          backgroundColor: preset.headerBg,
                          borderColor: preset.headerBorder,
                        }}
                      />
                      <span className="font-medium text-slate-800 text-[11px] truncate">
                        {preset.name}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 預覽條 */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-600 block">
              即時預覽
            </label>
            <div
              className="p-2.5 rounded-lg border flex items-center justify-between gap-2 shadow-2xs"
              style={{
                backgroundColor: currentTheme.headerBg,
                borderColor: currentTheme.headerBorder,
                color: currentTheme.headerText,
              }}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <span>SciNotes</span>
              </div>
              <div
                className="px-2 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: currentTheme.tabActiveBg,
                  color: currentTheme.tabActiveText,
                }}
              >
                畫布
              </div>
              <div
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: currentTheme.accent,
                  color: currentTheme.accentText,
                }}
              >
                + 新增
              </div>
            </div>
          </div>

          {/* 色彩微調選色器 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-600 block">
              自訂色彩細節
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">工具列底色</span>
                <input
                  type="color"
                  value={currentTheme.headerBg}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, headerBg: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">標題與主文字</span>
                <input
                  type="color"
                  value={currentTheme.headerText}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, headerText: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">次要文字與圖標</span>
                <input
                  type="color"
                  value={currentTheme.headerMuted}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, headerMuted: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">邊框與分隔線</span>
                <input
                  type="color"
                  value={currentTheme.headerBorder}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, headerBorder: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">Tab 條底色</span>
                <input
                  type="color"
                  value={currentTheme.tabBarBg}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, tabBarBg: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">活躍 Tab 底色</span>
                <input
                  type="color"
                  value={currentTheme.tabActiveBg}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, tabActiveBg: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">活躍 Tab 文字</span>
                <input
                  type="color"
                  value={currentTheme.tabActiveText}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, tabActiveText: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">主強調色（新增按鈕）</span>
                <input
                  type="color"
                  value={currentTheme.accent}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, accent: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600">強調文字顏色</span>
                <input
                  type="color"
                  value={currentTheme.accentText}
                  onChange={(e) =>
                    onUpdateTheme({ ...currentTheme, accentText: e.target.value })
                  }
                  className="w-8 h-6 rounded cursor-pointer border border-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            onClick={onResetTheme}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>還原預設配色</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
