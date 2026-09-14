import type { NextConfig } from "next";

/**
 * 本應用是「純前端靜態應用」：不依賴資料庫，也不依賴 Node.js 後端邏輯。
 * 資料存在瀏覽器 localStorage，並提供 JSON 檔案匯入／匯出。
 *
 * 兩種建置模式（由 STATIC_EXPORT 環境變數切換）：
 *  1. 未設定 STATIC_EXPORT：一般預覽／本機開發，`next build` 走 Next.js
 *     正常的伺服器模式建置。
 *  2. STATIC_EXPORT=1：純靜態匯出（output: "export"），images 設為
 *     unoptimized，並開啟 trailingSlash。對應的一次性指令是
 *     package.json 裡的 `npm run export`。
 *
 * GitHub Pages 的專案頁面網址格式是 https://<帳號>.github.io/<repo名稱>/，
 * 不在網域根目錄，因此靜態匯出時需要 basePath / assetPrefix 指向
 * /<repo名稱>。這個 repo 名稱透過 NEXT_BASE_PATH 環境變數從外部帶入
 * （例如 GitHub Actions 用 github.event.repository.name 動態帶入），
 * 不寫死在這裡。若沒有帶入 NEXT_BASE_PATH，basePath 為空字串，相容於
 * 非 GitHub Pages 的部署方式（例如自訂網域根目錄）。
 *
 * 注意：STATIC_EXPORT 與 NEXT_BASE_PATH 這兩個變數名稱，必須與
 * package.json 的 `export` 指令、以及 .github/workflows/deploy.yml
 * 裡設定的環境變數名稱完全一致，三處任何一處對不上，靜態匯出邏輯
 * 就不會被觸發，但建置階段不會報錯。
 */
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        ...(basePath
          ? {
              basePath,
              assetPrefix: `${basePath}/`,
            }
          : {}),
      }
    : {}),
};

export default nextConfig;
