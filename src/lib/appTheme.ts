"use client";

import { useState, useEffect } from "react";

export interface AppTheme {
  name: string;
  headerBg: string;        // 頂部導覽列底色
  headerText: string;      // 主要標題/Logo文字顏色
  headerMuted: string;     // 次要文字 / icon 預設色
  headerBorder: string;    // 下邊線、分隔線顏色
  tabBarBg: string;        // 視圖切換 tab 條容器底色
  tabActiveBg: string;     // 活躍 tab 底色
  tabActiveText: string;   // 活躍 tab 文字顏色
  tabInactiveText: string; // 非活躍 tab 文字顏色
  hoverBg: string;         // 按鈕 hover 常用底色
  accent: string;          // 強調色（「新增」按鈕、高亮等）
  accentText: string;      // 強調按鈕文字顏色
  panelBg?: string;        // 彈窗/面板背景底色
}

export const APP_THEME_PRESETS: Record<string, AppTheme> = {
  default: {
    name: "簡約清爽（預設）",
    headerBg: "#ffffff",
    headerText: "#1e293b",
    headerMuted: "#64748b",
    headerBorder: "#e2e8f0",
    tabBarBg: "#f1f5f9",
    tabActiveBg: "#ffffff",
    tabActiveText: "#0f172a",
    tabInactiveText: "#64748b",
    hoverBg: "#f1f5f9",
    accent: "#2563eb",
    accentText: "#ffffff",
    panelBg: "#f8fafc",
  },
  darkSlate: {
    name: "深邃黑曜",
    headerBg: "#0f172a",
    headerText: "#f8fafc",
    headerMuted: "#94a3b8",
    headerBorder: "#1e293b",
    tabBarBg: "#1e293b",
    tabActiveBg: "#334155",
    tabActiveText: "#ffffff",
    tabInactiveText: "#94a3b8",
    hoverBg: "#1e293b",
    accent: "#3b82f6",
    accentText: "#ffffff",
    panelBg: "#0f172a",
  },
  warmPaper: {
    name: "米黃暖紙",
    headerBg: "#fcf8ee",
    headerText: "#451a03",
    headerMuted: "#78350f",
    headerBorder: "#e7dfc6",
    tabBarBg: "#f3ebd4",
    tabActiveBg: "#ffffff",
    tabActiveText: "#451a03",
    tabInactiveText: "#92400e",
    hoverBg: "#ece2c5",
    accent: "#b45309",
    accentText: "#ffffff",
    panelBg: "#faf5e8",
  },
  deepIndigo: {
    name: "夜幕靛藍",
    headerBg: "#1e1b4b",
    headerText: "#e0e7ff",
    headerMuted: "#a5b4fc",
    headerBorder: "#312e81",
    tabBarBg: "#312e81",
    tabActiveBg: "#4338ca",
    tabActiveText: "#ffffff",
    tabInactiveText: "#c7d2fe",
    hoverBg: "#3730a3",
    accent: "#6366f1",
    accentText: "#ffffff",
    panelBg: "#1e1b4b",
  },
  mintForest: {
    name: "薄荷森綠",
    headerBg: "#f0fdf4",
    headerText: "#064e3b",
    headerMuted: "#047857",
    headerBorder: "#bbf7d0",
    tabBarBg: "#dcfce7",
    tabActiveBg: "#ffffff",
    tabActiveText: "#064e3b",
    tabInactiveText: "#059669",
    hoverBg: "#bbf7d0",
    accent: "#059669",
    accentText: "#ffffff",
    panelBg: "#f0fdf4",
  },
  softRose: {
    name: "柔和櫻粉",
    headerBg: "#fff1f2",
    headerText: "#881337",
    headerMuted: "#be123c",
    headerBorder: "#fecdd3",
    tabBarBg: "#ffe4e6",
    tabActiveBg: "#ffffff",
    tabActiveText: "#881337",
    tabInactiveText: "#e11d48",
    hoverBg: "#fecdd3",
    accent: "#e11d48",
    accentText: "#ffffff",
    panelBg: "#fff1f2",
  },
};

export const DEFAULT_APP_THEME: AppTheme = APP_THEME_PRESETS.default;

const APP_THEME_STORAGE_KEY = "scinotes-app-theme";

export function useAppTheme() {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          return { ...DEFAULT_APP_THEME, ...parsed };
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
    return DEFAULT_APP_THEME;
  });

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, JSON.stringify(nextTheme));
      } catch (e) {
        // ignore storage errors
      }
    }
  };

  const resetTheme = () => {
    setTheme(DEFAULT_APP_THEME);
  };

  return { theme, setTheme, resetTheme };
}
