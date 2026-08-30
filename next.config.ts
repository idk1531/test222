import type { NextConfig } from "next";

/**
 * 本應用本體為「純前端靜態應用」（使用瀏覽器本機儲存 + JSON 檔案匯入/匯出）。
 *
 * - 預設建置：用於平台預覽（`next start` 僅提供靜態服務與健康檢查 /api/health）。
 * - 想要完全不依賴 Node.js 伺服器時，執行：
 *     STATIC_EXPORT=1 npx next build
 *   會在 `out/` 產生純靜態站點，可用任何靜態伺服器提供（例如：
 *     python3 -m http.server -d out
 *   或直接託管到 GitHub Pages / Netlify / 自己的檔案伺服器）。
 *
 * - 部署到 GitHub Pages 的「專案頁面」時（網址形如
 *   https://<user>.github.io/<repo>/），網站不是放在網域根目錄，
 *   必須設定 basePath，否則 CSS/JS 會 404。設定方式：
 *     STATIC_EXPORT=1 NEXT_BASE_PATH=/<repo> npx next build
 *   本專案附的 .github/workflows/deploy.yml 会自動帶入正確的
 *   repo 名稱，一般情況不需要手動設定這個變數。
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
};

export default nextConfig;
