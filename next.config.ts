import type { NextConfig } from "next";

/**
 * 本應用為「純前端靜態應用」（使用瀏覽器本機儲存 + JSON 檔案匯入/匯出）。
 *
 * 支援 GitHub Pages 自動部署：
 * - 當設定 NEXT_PUBLIC_BASE_PATH（例如 /semantic-science-note-workbench）或 GITHUB_REPOSITORY 時，
 *   自動設定對應的 basePath 與 assetPrefix。
 * - 當 STATIC_EXPORT=1 或在 GitHub Actions CI 環境（GITHUB_ACTIONS=true）中，啟用純靜態匯出（output: 'export'）。
 */
const isStaticExport = process.env.STATIC_EXPORT === "1" || process.env.GITHUB_ACTIONS === "true";
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || (process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}` : "");
const basePath = rawBasePath && rawBasePath !== "/" ? rawBasePath : undefined;

const nextConfig: NextConfig = {
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(isStaticExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
