# 理科知識筆記工作台 (Semantic Science Note Workbench)

> **版面自由，語義結構化；使用者自由設計筆記，但系統理解每個內容的知識角色。**
> 
> 本專案為純前端靜態理科知識筆記工作台，不依賴後端資料庫或 Node.js 服務器，所有資料透過瀏覽器本機儲存（LocalStorage）與標準 JSON 檔案匯入／匯出進行管理，可一鍵部署至 GitHub Pages 或任何靜態託管平台。

---

## 🌟 核心理念與 v4 規範

本系統嚴格依據《理科筆記 · 使用手冊（樹狀圖版 · v4修正）》設計：

1. **WHY/HOW 正文完整不壓縮**：寫出來的即是唯一的完整教學稿，同時服務「教會零基礎的人」與「複習時加深理解鏈」。
2. **關鍵轉折處「追問點」與「追問測試（`[已推出]`）」**：在推理關鍵轉折處將思維模式寫成提問，讀者自己先想過再看答案；通過測試後標記 `[已推出]`。
3. **四點自我檢查**：
   - ① 人名檢查：歷史人物出現代表歷史觸發，應移至 ORIGIN。
   - ② 零基礎檢查：禁止「顯然」「容易看出」等跳步用語。
   - ③ 路徑檢查：探索過程不能只有問題與答案兩端。
   - ④ 精確檢查：出現對比（如離散 vs 連續）須精確定義對象，不可用比喻替代說明。
4. **五格標準順序**：`ORIGIN`（歷史觸發）→ `WHY`（機制性解釋）→ `WHAT`（概念本質）→ `HOW`（可執行步驟）→ `WHEN`（觸發線索與可用能力）。
5. **【直覺陷阱】全新子結構**：專門記錄推導正確但直覺容易誤判的盲點（例：負頻率 $-\omega$ 不是假象，而是複平面的反向旋轉向量）。
6. **認識論錨點**：每條認識論聲明須附帶指回 WHY 具體段落的錨點（如 `[地位:證明][見WHY視角2]`）。
7. **文字標籤化符號系統**：全面採用 `[前提]`、`[結構類比:d]`、`[表面相似:d]`、`[對照:d]`、`[正例]`、`[反例]`、`[框架衝突]`、`[地位:證明]`、`[已推出]`、`[未決]`、`[警示]` 等文字標籤。
8. **SOLO 網絡整合度診斷**：邊指向未決盲區 `[未決]` 時暫不計分，嚴格遵守「關係邊數量不等於 SOLO 等級」紅線。
9. **思維動作庫**：同一思維模式標籤在 ≥3 個不同知識點出現，系統方認可成立獨立條目。

---

## 🗂 專案目錄結構

```text
semantic-science-note-workbench/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 自動部署設定
├── .gitignore
├── README.md
├── eslint.config.mjs
├── next.config.ts              # 含 GitHub Pages 的 basePath 設定
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── api/
    │   │   └── health/
    │   │       └── route.ts    # 靜態健康檢查端點
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx             # 主頁面
    ├── components/
    │   ├── AIAuditDrawer.tsx
    │   ├── AnalogyWorkbenchModal.tsx      # 類比工作台(候選推理測試)
    │   ├── BackgroundCustomizer.tsx
    │   ├── BlindSpotsView.tsx             # 盲區清單
    │   ├── BlockageGuideModal.tsx         # 卡關/堵塞感引導
    │   ├── CardDetailModal.tsx            # 卡片詳細內容編輯
    │   ├── CardIndexView.tsx              # 卡片索引列表
    │   ├── CardPaperSections.tsx
    │   ├── ExpansionTestModal.tsx         # 展開測試(追問測試)
    │   ├── FieldCustomizer.tsx            # 自訂欄位
    │   ├── FontSelector.tsx
    │   ├── FunctionPlotCanvas.tsx
    │   ├── ImageTextCheckModal.tsx        # 圖文綁定檢查
    │   ├── InfiniteCanvas.tsx             # 無限畫布
    │   ├── KaTeXRenderer.tsx              # 數學公式渲染
    │   ├── KnowledgeCardNode.tsx          # 知識卡片節點
    │   ├── MathFormulaEditor.tsx
    │   ├── MathText.tsx
    │   ├── MotherTopicsView.tsx           # 母題管理
    │   ├── NetworkGraphView.tsx           # 知識圖譜視圖
    │   ├── OmniSearchModal.tsx            # 全域搜尋
    │   ├── ProcessLogsView.tsx            # 過程日誌
    │   ├── ShapeClassifier.tsx
    │   ├── SoloAssessmentPanel.tsx        # Bloom×SOLO診斷
    │   └── TemplateSelectorModal.tsx      # 卡片模板選擇
    └── lib/
        ├── fonts.ts
        ├── inspect.ts
        ├── seedData.ts          # 預設種子資料
        ├── solo.ts              # SOLO診斷邏輯
        ├── store.ts             # 狀態管理+localStorage持久化
        └── types.ts             # 資料型別定義
```

---

## 🚀 快速開始

### 1. 本地開發
```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```
瀏覽器開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

### 2. 匯出為純靜態 HTML
```bash
# 建置靜態站點（輸出至 out/ 目錄）
STATIC_EXPORT=1 npm run build

# 本地預覽純靜態站點（完全無 Node.js 執行期依賴）
npx serve out
# 或使用 Python
python3 -m http.server 8080 -d out
```

### 3. GitHub Pages 自動部署
本專案已配置 `.github/workflows/deploy.yml`。推送到 GitHub 倉庫後：
1. 進入倉庫 **Settings → Pages**。
2. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 推送至 `main` 或 `master` 分支即可自動建置發布。

---

## 💾 資料儲存與遷移

- **自動持久化**：所有編輯即時自動存入瀏覽器 `LocalStorage`。
- **匯出檔案（Download）**：頂欄點擊「匯出 JSON 檔案」即可下載完整的筆記資料包。
- **匯入檔案（Upload）**：點擊「匯入 JSON 檔案」可載入任何由本系統產生的筆記檔案。
- **多端同步**：純檔案導向設計，可搭配 Git、Dropbox、iCloud 或隨身碟輕鬆備份與跨裝置轉移。
