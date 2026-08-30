import { NextResponse } from "next/server";

// 讓 /api/health 也能在 `STATIC_EXPORT=1` 靜態匯出時生成為靜態 JSON
export const dynamic = "force-static";

/**
 * 純靜態健康檢查端點。
 * 本應用不依賴資料庫或 Node.js 後端邏輯——資料全部在瀏覽器端保存，
 * 透過檔案匯入/匯出（JSON）持久化。此端點僅供部署環境健康檢查使用。
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: "static-frontend",
    database: "none (browser-local storage + JSON file import/export)",
    timestamp: new Date().toISOString(),
  });
}
