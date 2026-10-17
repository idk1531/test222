# v7.2 規格說明書：方格紙 WYSIWYG 行內編輯、節點自訂強調色與頂部主題定製

**版本**：v7.2  
**發布日期**：2026-10-17  
**適用架構**：Next.js 16 + React 19 + TypeScript + Tailwind CSS  
**相容性**：向前相容 v7、v6、v5、v4 知識卡片資料格式與審查規範  

---

## 一、需求背景與設計目標

在 v7 規格（《取用的設計：讀法、視角與六向延伸》）中，卡片預覽已全面採用 **7 頁方格紙版面**（卡頭概覽、背景梯形收窄條、構造思路漏斗、WHY 塔木德、WHAT 平行多視角、APPLY 程序表、過程日誌方格進度）。然而，使用者在編輯內容時，原先需要跳轉至傳統的「進階表單 (工程表)」，導致「編輯時看到的介面」與「預覽/導出的方格紙排版」產生斷層。

v7.2 的主要升級目標包含三大核心能力：

1. **R1: WYSIWYG 行內方格紙編輯 (Inline Paper Editing)**
   - 預設打開卡片即進入「紙上編輯」模式。
   - 預覽模式與編輯模式共用**同一套元件樹**（`V6ContinuousPaper` / `V6Page1HeaderOverview` ~ `V6Page7ProcessLogs`），以 `CardEditContext` 控制編輯態。
   - 所有文字欄位、公式、信心打分、清單項、認識論地位標記、讀法與問題矩陣、橋關係、六向延伸與「造」三要素、CHECK/分支樹均支援行內編輯、新增、重排序與刪除。
   - 公式與富文本支援「平時渲染 KaTeX MathText，點擊/聚焦即進入源碼編輯態」，避免在 rendered KaTeX 內直接 contentEditable 損壞公式結構。
   - 頂部保留模式切換：`紙上編輯` ↔ `紙上預覽` ↔ `進階表單 (工程表)`，並支援「復原初始」快照還原。

2. **R2: 畫布卡片節點自訂強調色 (Card Node Accent Color)**
   - 畫布上的卡片節點在未開啟彈窗前，即可直接在卡片節點外框、標題列、圖示上呈現自訂的強調色（Accent Color）。
   - 提供快速調色盤浮層（預設形狀色彩、經典色系及自訂色彩），並支援一鍵「重設回形狀預設色」。
   - 色彩設定持久化儲存於畫布物件的 `style.accentColor`。

3. **R3: 頂部工具列與介面主題自訂 (Header & App Theme Customization)**
   - 提供 `useAppTheme` hook 與 `AppThemeCustomizer` 面板。
   - 支援 6 款精選主題預設（預設深邃板岩、極簡白、溫潤方格紙、深靛工作坊、薄荷森林、柔和玫瑰）及自訂背景色、文字色、邊框色、品牌強調色。
   - 主題設定自動持久化於 `localStorage`（鍵值 `scinotes-app-header-theme`），跨頁面與刷新保持一致。

---

## 二、架構與技術實作

### 1. R1: WYSIWYG 行內編輯架構 (`src/components/CardPaperEditor.tsx` & `CardPaperSections.tsx`)

#### (1) `CardEditContext`
```typescript
export interface CardEditContextType {
  editable: boolean;
  patch: (p: Partial<CardData>) => void;
  card?: CardData;
}
```
透過 React Context 貫穿整個方格紙元件樹，避免每一層元件重複 props drilling。

#### (2) 原子級行內可編輯元件
- `EditableText`: 平時渲染漂亮的 `<MathText />`，點擊即流暢切換為 `<input>` 或 `<textarea>`。支援 Enter 提交、Escape 取消、防止鍵盤事件冒泡至畫布。
- `EditableRating`: 1~5 星級/點數信心校準打分，支援點擊直接切換信心分數。
- `EditableToggle`: 輕量切換標籤（如「僅理解用」、「已推出/未推出」、「✓已編譯」）。
- `EditableSelect`: 行內下拉選擇（如認識論地位 `⊢證 / ⊢歸 / ⊢近 / ⊢約 / ⊢公設`、橋類型 `互通 / 單向 / 限定範圍 / 走不通`）。
- `EditableListItemControls`: 清單項目的上移（`↑`）、下移（`↓`）、插入（`+`）、刪除（`Trash2`）。
- `EditableListAddButton`: 頁底一鍵新增項目按鈕。
- `updateBranchDeep` / `removeBranchDeep` / `addBranchDeep`: 支援 HOW 分支樹與巢狀子分支的不可變深層更新。

#### (3) 7 頁方格紙全覆蓋
- **Page 1 (卡頭概覽)**: 標題、領域、粒度、核心問題、直覺泵、省略格聲明、SOLO 評估。
- **Page 2 (背景)**: 理解問題信心校準打分（動筆前/寫完後）、情境三段式（情境/精確對象/精確問題）、歷史起源與矛盾焦點。
- **Page 3 (構造思路)**: 構造信心打分、啟發式路徑追問①②（可切換已推出）、直覺陷阱清單（誤判/為何錯/正確理解）、收斂計畫步驟與範圍標註。
- **Page 4 (WHY)**: WHY 信心打分、閉卷草稿、詳細推導正文、關鍵轉折追問、子目標聲明（目標/必要性/充分性）、認識論地位聲明清單、假設鎖定清單。
- **Page 5 (WHAT)**: 讀法清單（名稱/說明/僅理解用/配對視角）、問題×讀法矩陣表（最便宜/看不見/格內說明）、讀法之間的橋（4 種關係/推導/反例/走不通理由）、平行多視角（對應表/內容/可核對具體事實/借鏡視角）、六向延伸（推深/推淺/推廣/推窄/翻譯/造）與「造」三要素、功能判準洞見檢查題。
- **Page 6 (APPLY)**: CHECK 關卡（看到/兩段式變換/檢查/來源）、CAN 下游解鎖（看到/能/來源）、分支與巢狀子分支（看到/兩段式構造/流程/區域 CHECK/來源/編譯標記）。
- **Page 7 (過程日誌)**: 方格紙視覺進度條與日誌歷史記錄。

#### (4) 彈窗三態切換與快照復原 (`src/components/CardDetailModal.tsx`)
- 三態切換器：`紙上編輯 (WYSIWYG)` ↔ `紙上預覽` ↔ `進階表單 (工程表)`。
- 一頁式長紙（`V6ContinuousPaper`）與 7 頁分頁模式自由切換。
- 復原初始按鈕：即時偵測 `isDirty`，一鍵復原回開啟時的快照狀態。

---

### 2. R2: 畫布節點自訂強調色 (`src/components/KnowledgeCardNode.tsx` & `InfiniteCanvas.tsx`)

- 在 `KnowledgeCardNode.tsx` 新增 `accentColor` 屬性與選色浮層。
- 節點邊框、標題列、圖示、徽章背景動態套用 `accentColor`。
- 提供調色盤快速選擇常見色系、自訂 Color Picker，以及一鍵「重設回形狀預設色」。
- `InfiniteCanvas.tsx` 中將更新同步至物件的 `style.accentColor`，並觸發畫布狀態更新與自動儲存。

---

### 3. R3: 頂部工具列與介面主題定製 (`src/lib/appTheme.ts` & `src/components/AppThemeCustomizer.tsx`)

- 內建 6 款主題預設：
  1. `default`: 深邃板岩 (Dark Slate)
  2. `pureLight`: 極簡純白 (Clean Light)
  3. `warmPaper`: 溫潤方格紙 (Warm Graph Paper)
  4. `deepIndigo`: 深靛工作坊 (Deep Indigo)
  5. `mintForest`: 薄荷森林 (Mint Forest)
  6. `softRose`: 柔和玫瑰 (Soft Rose)
- 支援個別微調：頂欄背景色、文字顏色、次要文字顏色、邊框顏色、強調色、徽章背景色。
- `useAppTheme` hook 提供響應式主題狀態並同步至 `localStorage`。
- `src/app/page.tsx` 頂部 Header、按鈕、選單全面綁定 `appTheme` 動態樣式。

---

## 三、驗證結果

執行驗證測試套件，結果如下：

1. **TypeScript 型別檢查** (`npm run typecheck`):
   ```
   > semantic-science-note-workbench@0.1.0 typecheck
   > tsc --noEmit
   (Pass with 0 errors)
   ```

2. **Next.js 生產環境建置** (`npm run build`):
   ```
   > semantic-science-note-workbench@0.1.0 build
   > next build
   ✓ Compiled successfully in 6.2s
   ✓ Generating static pages (4/4)
   (Pass with 0 errors)
   ```

3. **6 張種子卡片 v7 審查驗證** (`npx tsx scripts/audit.ts`):
   ```
   card-thermo-carnot      | Score: 100 | Total Issues: 0 | Critical: 0
   card-fourier-transform  | Score: 100 | Total Issues: 0 | Critical: 0
   card-le-chatelier       | Score: 100 | Total Issues: 0 | Critical: 0
   card-schrodinger-eq     | Score: 100 | Total Issues: 0 | Critical: 0
   card-arithmetic-mean    | Score: 100 | Total Issues: 0 | Critical: 0
   card-variance           | Score: 100 | Total Issues: 0 | Critical: 0
   ALL CARDS PASS (100 / 0 issues / 0 critical)
   ```

4. **ESLint 靜態代碼檢查** (`npm run lint`):
   - 檢查結果：11 個既有項目（6 錯誤、5 警告），低於初始基準線 12 個項目（7 錯誤、5 警告）。
   - 新增與修改的程式碼皆完全符合 ESLint 規則。
