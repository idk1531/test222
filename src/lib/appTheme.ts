"use client";

import { useCallback, useState } from "react";

/**
 * v7.2：頂部工具列（以及 modal 外框）的可自訂配色。
 *
 * Tailwind 的 class 是編譯期字串，無法在使用者改色後動態生效，
 * 因此 header 內所有顏色都改由這份 theme 以 inline style 套用。
 */
export interface AppTheme {
  name: string;
  headerBg: string;        // header 底色
  headerText: string;      // header 主文字
  headerMuted: string;     // 次要文字 / icon 預設
  headerBorder: string;    // 下邊線、分隔線
  tabBarBg: string;        // tab 條底
  tabActiveBg: string;     // active tab 底
  tabActiveText: string;   // active tab 字
  tabInactiveText: string; // inactive tab 字
  hoverBg: string;         // icon / tab hover 底
  accent: string;          // 「新增」按鈕、focus ring
  accentText: string;      // accent 上的文字
  panelBg: string;         // 卡片預覽 modal 外框底
}

export const APP_THEME_PRESETS: Record<string, AppTheme> = {
  light: {
    name: "經典白（預設）",
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
    panelBg: "#f1f5f9",
  },
  dark: {
    name: "石墨黑",
    headerBg: "#0f172a",
    headerText: "#e2e8f0",
    headerMuted: "#94a3b8",
    headerBorder: "#1e293b",
    tabBarBg: "#1e293b",
    tabActiveBg: "#334155",
    tabActiveText: "#f8fafc",
    tabInactiveText: "#94a3b8",
    hoverBg: "#334155",
    accent: "#3b82f6",
    accentText: "#ffffff",
    panelBg: "#0f172a",
  },
  warm: {
    name: "暖紙米黃",
    headerBg: "#faf7ee",
    headerText: "#3f3f46",
    headerMuted: "#78716c",
    headerBorder: "#d6cbb8",
    tabBarBg: "#f1e9d8",
    tabActiveBg: "#fffdf7",
    tabActiveText: "#292524",
    tabInactiveText: "#78716c",
    hoverBg: "#efe5d1",
    accent: "#b45309",
    accentText: "#ffffff",
    panelBg: "#efe5d1",
  },
  ocean: {
    name: "海霧天青",
    headerBg: "#ecfeff",
    headerText: "#164e63",
    headerMuted: "#0e7490",
    headerBorder: "#a5f3fc",
    tabBarBg: "#cffafe",
    tabActiveBg: "#ffffff",
    tabActiveText: "#164e63",
    tabInactiveText: "#0e7490",
    hoverBg: "#a5f3fc",
    accent: "#0891b2",
    accentText: "#ffffff",
    panelBg: "#cffafe",
  },
};

export const DEFAULT_APP_THEME: AppTheme = APP_THEME_PRESETS.light;
export const APP_THEME_STORAGE_KEY = "scinotes-app-theme";

/** 讀取本機自訂配色；格式不完整時補回預設值，避免舊資料缺欄位。 */
export function loadAppTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  try {
    const raw = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (!raw) return DEFAULT_APP_THEME;
    const parsed = JSON.parse(raw) as Partial<AppTheme>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_APP_THEME;
    return { ...DEFAULT_APP_THEME, ...parsed, name: parsed.name || "自訂配色" };
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function saveAppTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // 容量不足時僅放棄持久化，畫面仍套用本次設定
  }
}

/**
 * header 配色 hook（SSR 安全）。
 * 初始值延遲到瀏覽器端才讀 localStorage；page.tsx 在 mounted 前只渲染啟動畫面，
 * 因此不會出現 hydration mismatch。
 */
export function useAppTheme(): {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  resetTheme: () => void;
} {
  const [theme, setThemeState] = useState<AppTheme>(() => loadAppTheme());

  const setTheme = useCallback((next: AppTheme) => {
    const normalized = { ...DEFAULT_APP_THEME, ...next, name: next.name || "自訂配色" };
    setThemeState(normalized);
    saveAppTheme(normalized);
  }, []);

  const resetTheme = useCallback(() => {
    setThemeState(DEFAULT_APP_THEME);
    saveAppTheme(DEFAULT_APP_THEME);
  }, []);

  return { theme, setTheme, resetTheme };
}
