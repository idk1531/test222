# 理科知識筆記工作台（SciNotes Workbench）

一個純前端的理科知識筆記工具：自由畫布排版知識卡片、結構化的五格內核（WHAT / WHY / HOW / WHEN / ORIGIN）、類型化關係邊、知識圖譜視覺化、理解深度自我檢查（展開測試 / 圖文綁定檢查 / 類比工作台）、以及 Bloom × SOLO 雙軸認知診斷。

不依賴任何資料庫或後端伺服器——所有資料存在瀏覽器本機（`localStorage`），並可隨時匯出成單一 JSON 檔案備份，或匯入還原。

## 功能總覽

- **無限畫布**：自由拖放、排列知識卡片與手繪/自訂圖形
- **結構化知識卡片**：卡頭、構造思路、WHAT/WHY/HOW/WHEN/ORIGIN 五格、關係邊、過程日誌、診斷標籤
- **類型化關係邊**：前提、結構類比（需通過候選推理測試）、表面相似、對照、正反例、母題歸屬
- **知識圖譜視圖**（`NetworkGraphView`）：把卡片與關係邊畫成可探索的網路圖
- **理解深度檢查工具**：
  - 展開測試（`ExpansionTestModal`）：驗證簡寫是否能不看資料重新展開
  - 圖文綁定檢查（`ImageTextCheckModal`）
  - 類比工作台（`AnalogyWorkbenchModal`）：類比的候選推理測試
  - 卡關/困惑引導（`BlockageGuideModal`）
- **過程日誌與盲區追蹤**（`ProcessLogsView` / `BlindSpotsView`）：記錄增量補充、框架衝突、同一次講解內矛盾
- **母題管理**（`MotherTopicsView`）：跨學科抽象機制的歸納與候選推理驗證
- **Bloom × SOLO 雙軸診斷**（`SoloAssessmentPanel`）：單點認知深度 × 知識網整合度
- **數學公式**：KaTeX 渲染（`KaTeXRenderer` / `MathFormulaEditor` / `MathText`）
- **全域搜尋**（`OmniSearchModal`）、卡片模板選擇（`TemplateSelectorModal`）、自訂欄位（`FieldCustomizer`）、字型/背景客製化

## 技術棧

- [Next.js 16](https://nextjs.org/)（App Router）+ React 19 + TypeScript
- Tailwind CSS 4
- KaTeX（數學公式渲染）
- 純前端狀態管理，資料持久化於瀏覽器 `localStorage`

本專案**不使用資料庫**，`package.json` 中不含任何資料庫相關套件；`/api/health` 端點僅回報靜態健康檢查資訊，不連接任何後端服務。

## 開發

```bash
npm install
npm run dev
```

開啟 http://localhost:3000

## 建置

一般建置（Next.js 伺服器模式，用於平台預覽）：

```bash
npm run build
npm run start
```

**純靜態匯出**（不需要任何 Node.js 伺服器，可用於 GitHub Pages / Netlify / 任何靜態檔案伺服器）：

```bash
npm run export
```

輸出在 `out/` 目錄，可直接用任何靜態伺服器提供，例如：

```bash
python3 -m http.server -d out
```

## 部署到 GitHub Pages

本 repo 已附上 `.github/workflows/deploy.yml`，推送到 `main` 分支會自動建置並部署到 GitHub Pages。啟用方式：

1. 到 repo 的 **Settings → Pages**，Source 選擇 **GitHub Actions**
2. 推送到 `main` 分支即可自動部署，網址是 `https://<你的帳號>.github.io/<repo名稱>/`

> **注意**：GitHub Pages 的專案頁面網址帶有 repo 名稱這一層路徑（`/<repo>/`），不是網域根目錄。workflow 已經自動把這個路徑設成建置時的 `basePath`，抓的是 repo 的實際名稱，通常不需要手動調整。如果之後改用自訂網域（在 repo 加 `CNAME`），網站會變成在網域根目錄，這時候要把 workflow 裡 `NEXT_BASE_PATH` 那一行改成空字串再重新部署。

也可以手動建置後把 `out/` 目錄的內容推到 `gh-pages` 分支，效果一樣。

## 資料儲存與備份

所有筆記資料保存在瀏覽器的 `localStorage`，**清除瀏覽器資料或換裝置會遺失資料**。請定期使用介面上的匯出功能，把資料存成 JSON 檔案備份；需要還原或搬到別台裝置時，用匯入功能讀回。

## 專案結構

```
src/
├── app/                 # Next.js App Router 頁面與 API 路由
├── components/          # 所有 UI 元件（畫布、卡片、各種檢查工具的 modal）
└── lib/
    ├── types.ts         # 資料型別定義
    ├── store.ts         # 前端狀態管理與 localStorage 持久化
    ├── seedData.ts      # 預設種子資料
    ├── solo.ts          # Bloom × SOLO 診斷邏輯
    ├── inspect.ts        # 稽核/檢查相關邏輯
    └── fonts.ts         # 字型設定
```

## 授權

本 repo 目前未附加開源授權條款，預設保留所有權利（All Rights Reserved）——原始碼公開可見，但未經作者同意不得複製、修改或再散布。
