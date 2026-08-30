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
