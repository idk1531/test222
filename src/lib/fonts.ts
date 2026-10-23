export interface FontOption {
  key: string;
  label: string;
  css: string;
  handwriting: boolean;
}

/** 內設手寫體 + 少數易讀字體，供每張卡片獨立選用 */
export const FONT_OPTIONS: FontOption[] = [
  // —— 手寫體 ——
  { key: "caveat", label: "Caveat 手寫", css: "'Caveat', cursive", handwriting: true },
  { key: "indie", label: "Indie Flower 童趣手寫", css: "'Indie Flower', cursive", handwriting: true },
  { key: "dancing", label: "Dancing Script 流暢手寫", css: "'Dancing Script', cursive", handwriting: true },
  { key: "brush", label: "Caveat Brush 粗筆手寫", css: "'Caveat Brush', cursive", handwriting: true },
  { key: "satisfy", label: "Satisfy 簽名體", css: "'Satisfy', cursive", handwriting: true },
  { key: "sacramento", label: "Sacramento 細緻手寫", css: "'Sacramento', cursive", handwriting: true },
  { key: "pacifico", label: "Pacifico 圓潤手寫", css: "'Pacifico', cursive", handwriting: true },
  { key: "playwrite", label: "Playwrite 教學手寫", css: "'Playwrite GB S', cursive", handwriting: true },
  // —— 易讀字體（長推導建議用）——
  { key: "quicksand", label: "Quicksand 圓體", css: "'Quicksand', sans-serif", handwriting: false },
  { key: "varela", label: "Varela Round 圓黑", css: "'Varela Round', sans-serif", handwriting: false },
  { key: "comfortaa", label: "Comfortaa 柔和", css: "'Comfortaa', cursive", handwriting: false },
  { key: "fredoka", label: "Fredoka 厚實", css: "'Fredoka One', cursive", handwriting: false },
];

export const FONT_MAP: Record<string, string> = FONT_OPTIONS.reduce(
  (acc, f) => ({ ...acc, [f.key]: f.css }),
  {} as Record<string, string>
);

export function resolveFont(key?: string): string {
  return FONT_MAP[key || "quicksand"] || FONT_MAP.quicksand;
}

const LOCAL_CJK_FAMILY = "SciNotes Noto Sans TC";
const CJK_FONT_SAMPLE = "書房筆記分類";
let cjkFontReady: Promise<void> | null = null;

/** Font-family stack used by CanvasRenderingContext2D and HTML labels. */
export function canvasCJKFont(): string {
  return `"${LOCAL_CJK_FAMILY}", "Noto Sans TC", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
}

/**
 * Wait for the bundled Traditional Chinese face before rasterizing canvas labels.
 * A failed local load is non-fatal: the returned stack still provides platform CJK fallbacks.
 */
export function ensureCanvasCJKFont(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  if (!cjkFontReady) {
    cjkFontReady = (async () => {
      try {
        await document.fonts.load(`700 16px "${LOCAL_CJK_FAMILY}"`, CJK_FONT_SAMPLE);
        await document.fonts.ready;
      } catch {
        // Canvas text still uses the explicit system fallback stack if the local face cannot load.
        await document.fonts.ready.catch(() => undefined);
      }
    })();
  }
  return cjkFontReady;
}
