import type { NextConfig } from "next";

/**
 * 本應用是「純前端靜態應用」：不依賴資料庫，也不依賴 Node.js 後端邏輯。
 * 資料存在瀏覽器 localStorage，並提供 JSON 檔案匯入／匯出。
 *
 * 兩種建置模式：
 *  1. 一般預覽／本機開發：`npm run build && npm start`
 *  2. GitHub Pages（靜態託管）：`GITHUB_PAGES=1 npm run build`
 *     → 產生 out/， basePath 自動指向 /<repo>
 *
 * 仓库名可用 GH_REPO 覆寫（預設 semantic-science-note-workbench）。
 */
const isGhPages = process.env.GITHUB_PAGES === "1";
const repo = process.env.GH_REPO || "semantic-science-note-workbench";

const nextConfig: NextConfig = {
  ...(isGhPages
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
      }
    : {}),
};

export default nextConfig;
