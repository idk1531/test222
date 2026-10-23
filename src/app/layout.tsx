import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "katex/dist/katex.min.css";
import { CollaborationProvider } from "@/components/CollaborationProvider";

export const metadata: Metadata = {
  title: "理科知識筆記工作台 | SciNotes Workbench",
  description: "自由畫布 + 結構化理科知識卡片 + 知識圖譜 + AI 理解檢查 + 認知歷史",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="bg-slate-100 text-slate-900 antialiased overscroll-none">
        <CollaborationProvider>{children}</CollaborationProvider>
      </body>
    </html>
  );
}
