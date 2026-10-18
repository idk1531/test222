# 理科知識筆記工作台 · Semantic Science Note Workbench

自由畫布 ＋ 結構化理科知識卡 ＋ 知識圖譜 ＋ 理解檢查 ＋ 認知歷史。

> **版面自由，語義結構化**：使用者像用 Canva 一樣自由排列、縮放、拖曳、對齊、分組；
> 同時系統理解每一塊內容的**知識角色**（WHAT / WHY / HOW / ORIGIN、關係邊、
> 認識論地位、過程日誌、診斷狀態；v5 起 WHEN 併入 HOW）。

本專案是**純前端靜態應用**——沒有資料庫、沒有後端服務邏輯。資料存在瀏覽器
`localStorage`，並可隨時以 **JSON 檔案匯出／匯入**備份或遷移。

---

## Quick Start

```bash
npm install
npm run dev      # 開發
npm run build    # 一般伺服器模式建置（含 /api/health 靜態端點）
npm run export   # 一次性靜態匯出（= STATIC_EXPORT=1 next build），產出 out/
```

### 部署到 GitHub Pages（純靜態，不需要伺服器）

```bash
# 不帶 NEXT_BASE_PATH：basePath 為空字串（部署在網域根目錄時用）
npm run export

# 帶入 repo 名稱（含前導斜線，直接作為 basePath 使用，與 deploy.yml 帶入
# 的 "/<repo名稱>" 同格式）：對應 GitHub Pages 專案頁網址
NEXT_BASE_PATH=/<你的倉庫名> npm run export   # 產出 out/
npx serve out                                  # 本機驗證
```

推到 `main` 後，`.github/workflows/deploy.yml` 會自動執行 `npm run export`
（並以 `NEXT_BASE_PATH` 動態帶入實際 repo 名稱），
建置並發佈到 GitHub Pages，也支援手動觸發（workflow_dispatch）。
需在倉庫 Settings → Pages 將 Source 設為 **GitHub Actions**。

---

## 資料層

| 檔案 | 職責 |
|---|---|
| `src/lib/store.ts` | 全域狀態倉庫（`useSyncExternalStore`）、CRUD actions、localStorage 自動持久化、`exportFile` / `importFile` / `resetToSeed`、**v4→v5 結構遷移**（WHEN 併入 HOW：triggers→checks、steps→branches、enables→can；本機載入與 JSON 匯入都會自動跑）、**v7.1→v8.0 書房資料遷移（v8.1 相機欄位相容補齊）**、純函式 `applyPatch`（預留 op log/同步介接） |
| `src/lib/study.ts` | 虛擬書房資料型別、分類／書本 helper、v8.1 相機欄位補齊與 360° yaw/pitch 限制 |
| `src/lib/room3d.ts` | v8.1 房間尺寸、光源／相機參數、移動限制、3D→CSS 投影與書架佈局純函式 |
| `src/lib/seedData.ts` | 預設種子資料（4 張完整例卡＋畫布物件＋關係邊＋日誌＋盲區＋母題） |
| `src/lib/types.ts` | 資料型別與匯出檔格式（`schemaVersion`，v8.1 仍為 8） |

- **自動保存**：任何編輯立即寫入 localStorage，重新整理不遺失；畫布拖曳採「畫面立即更新＋250ms 防抖寫入」，放開手指／滑鼠後立即提交最後座標，低階平板不會因保存而卡頓。
- **備份／遷移**：頭部 `下載` 圖標匯出 JSON、`上傳` 圖標匯入、`重轉` 還原為範例。畫布節點的 `style.accentColor`（v7.2 節點顏色）會一併匯出／匯入。
  - 手機／平板優先使用系統**分享面板**，請選「儲存到檔案」。
  - 桌機使用原生 JSON 下載。
  - Safari／WebView 無法直接下載時會開啟 JSON 備份頁面，使用瀏覽器的分享／另存。
  - 任一匯出提示列都提供「複製 JSON」；手機側欄也有「複製 JSON 備份」，可貼入文字檔另存。
- **離線可用**：無任何網路請求依賴。

---

## 知識模型

### 卡片本體（v5：四格為預設骨架，WHEN 併入 HOW）

```
卡頭（名稱｜領域｜顆粒度 L1-L4｜推理形狀 A-E + 複合型｜四格省略聲明）
 └ 背景（獨立主幹）三段式：①情境（同領域對象）②精確對象＋情境語言（先給形式再給動機）③精確對應的問題
 └ 構造思路        邏輯觸發：候選登場（扣住要求的摸索）＋ ②路徑（只放決策不放推導）＋ 計畫（收尾、含順序依賴）
                   · 動筆前後跑「理解問題信心校準」（Polya 理解問題階段；與 WHY 的 IOED 獨立，掉分→先不進 WHY、記盲區）
                   · 路徑不是被動敘述：真的問過自己的問題以【追問·思維模式名】標出，與 WHY 共用標籤庫
 └ ORIGIN ↯        歷史觸發：哪個矛盾／問題逼出這個概念
 └ WHY             IOED 三步信心校準、兩個失效模式不同的視角、子目標聲明、假設鎖定清單、場/分布「形狀」三問
 └ 追問點           【追問·思維模式名】問題 →（答案）；可放「構造思路路徑」或「WHY 關鍵轉折」；預覽時答案預設收合，先想再看
 └ WHAT            多視角自由命名（不限 G/L/I/C/O/A/P，下限 3 個、不設上限）＋ 五方向延伸（推深／推淺／推廣／推窄／翻譯——翻譯＝把外面的知識用這個知識點的語言重講，與視角相反）＋ 洞見檢查（每個延伸要點出「為什麼重要」，純事實陳述不夠格），與 HOW 強制分離
 └ HOW             v5 程序三段式（WHEN 併入）：
                   ① CHECK 橫跨性前置關卡——看到__→檢查__，橫跨整個程序、不限單一分支（原 WHEN·警示）
                   ② 分支（可巢狀）——原 HOW 步驟升級為分支樹，每個分支可帶「區域性 CHECK」（只在該分支內要過的關卡）
                   ③ CAN 下游解鎖——看到__→就能做__，HOW 編譯後才真正解鎖（原 WHEN·可用）
                   · 編譯狀態以分支為單位：[未編譯] ⋯ ／ ✓展；另有邊界約束欄（原 WHEN·邊界）
 └ 直覺陷阱         以【追問·直覺陷阱】呈現：先預測「我大概會怎麼誤會」再揭曉；標籤「直覺陷阱」計入 ≥3 次思維動作庫門檻
 └ 認識論聲明       [地位:證明|歸納|近似於X|約定|公設(X)]，獨立列表每條須帶回指 WHY 的錨點
 └ 診斷            Bloom 單點深度 × SOLO 網絡整合度（兩軸正交，不合併成單一分數）
```

### 推理形狀（內部形狀，不取代四格）

`A` 推導鏈型 · `B` 存在性+技法型 · `C` 判別程序型 · `D` 前提/框架型 · `E` 定義/約定型 · **`COMPOSITE` 複合型**（須標明哪一段屬哪一型、缺了會怎樣）

### 關係邊

`[前提]` `[結構类比:d]`（已過候選推理測試）/ `[表面相似:d]`（**不計入整合度**） `[对照:d]`（必須點名分歧維度） `[正例]`/`[反例]` `[特例]`/`[推廣]` `[归属母題]`（需 ≥3 實例 ＋ 候選推理測試雙達標）

---

## 檢查引擎（全部本機執行，`src/lib/inspect.ts` / `src/lib/solo.ts`）

### 八點自我檢查 ＋ 符號綁定（背景／構造思路與 WHY 正文共用同一套規則）

| | 檢查 | 判定方式 |
|---|---|---|
| ① | **人名檢查** | 人名 ±16 字內出現敘事動詞 → 歷史觸發混入邏輯觸發，該搬去 ORIGIN；「克勞修斯表述」類**命名術語不誤報** |
| ② | **零基础檢查** | 「顯然」「容易看出」「從略」等跳步用語＝違規；領域術語附近無定義線索＝待確認 |
| ③ | **路徑檢查** | 有問題端與答案端、卻無中問摸索動作（先/再/轉化為/代入/檢驗…）＝只有結論沒有路徑；WHY 正文不重複要求問題端 |
| ④ | **精確檢查** | 12 組 A/B 對照（離散/連續、微觀/宏觀…）若僅以「就像/好比」類比帶過、缺乏精確主語＝違規 |
| ⑤ | **具體化測試** | 每個描述詞（重疊/靠近/一致/對應…）三問：主語是誰、能否換成算式、拿掉是否散掉（例：「兩頻率不重疊」→「∫e^(iω₁t)e^(−iω₂t)dt = 0」） |
| ⑥ | **工具選擇檢查** | 引入操作/工具（積分/取共軛/構造函數/分解）須交代「為何能達到效果、如何被驗證」；從①契機第一個念頭就要查 |
| ⑦ | **證明鏈完整性檢查** | 貼 [地位:證明] 前強制回溯每步，只能歸入：本卡已證結論／[前提] 邊／公設或歸納假設，否則改標 [地位:公設] 或補證 |
| ⑦ | **證明鏈完整性檢查** | 貼 [地位:證明] 前強制回溯每步，只能歸入：本卡已證結論／[前提] 邊／公設或歸納假設，否則改標 [地位:公設] 或補證 |
| ⑧ | **新角色登場檢查** | 新符號／新對象／角色首次出現三交代：是什麼（能精確就給定義式）、與既有東西的關係（是否扮演前面某角色）、為何現在引入——②⑥與符號綁定三者之上的上位原則 |
| ⌘ | **符號綁定檢查** | 每次引入新符號核對是否重用、重用時是否同指一物；不同物同符號 → 加下標或改名 |

每條發現都附**原文引用＋問題＋建議動作**；結果會計入卡片健全指數與摺疊卡的 ⚠ 標記。

### 其他審查

WHY 只有結論 · 推理跳步 · 循環解釋 · **偷渡前提**（與假設鎖定清單比對）· 認識論越級（`[地位:近似]` 被當 `[地位:證明]`）· WHAT/HOW 混淆 · **圖文獨立性**（移除圖片後文字能否獨立完成推理）· 類比未驗證 · 追問點缺失 · 省略未交代理由 · 視角失效模式在 HOW 的 CHECK（橫跨性／區域性）無對應檢查（斷鏈）

### SOLO 判定規則（`src/lib/solo.ts`）

依真實關係邊計算，且：
- `[表面相似]` **不計分**
- **邊指向的目標本身未驗證（仍有 ▲ 未決盲區）→ 該邊暫不計入**
- 五級：前結構 → 單點 → 多點 → 關聯 → 抽象拓展；系統建議與使用者宣告比對後，會明確指出「宣告過高 ⚠ / 可升級 ↑ / 一致 ✓」，並列出升級阻擋項

### 追問測試（原「展開測試」）

測的對象是「**能不能不看答案，自己推出追問點的答案**」。逐個追問點閉卷作答（至少寫下嘗試才能揭曉）→ 對照答案自評：順暢推出 → `[已推出]`；卡殼／要查資料／需要新頓悟 → 不算過，**必須寫下卡在哪一步**。上次通過不代表這次也算過。納入三種來源：構造思路路徑的追問點、WHY 正文的追問點、直覺陷阱。另保留「HOW 閉卷重推」作為 `[未編譯]` 的唯一出口。

---

## 畫布操作

無限畫布 · 框選/多選/群組 · 對齊與等距 · 圖層 · 鎖定 · Canva 式智慧對齊參考線 · 粗/細網格吸附 · 文字/卡片/LaTeX 公式/函數圖像/圖片/SVG 等物件，皆可指派語義身份。

| 裝置 | 移動畫布 | 移動卡片 | 縮放 | 框選 |
|---|---|---|---|---|
| 桌機／筆電 | 左鍵拖曳空白處；中鍵／Alt 亦可 | 左鍵按住卡片拖動 | Ctrl/⌘＋滾輪，或底部 ± | Shift＋拖曳空白處；或切換底部游標工具 |
| 平板／手機 | 一根手指拖曳空白處 | 一根手指按住卡片拖動 | 兩指張開／合攏，或底部 ± | 切換底部游標工具後拖曳 |
| 觸控筆 | 筆拖曳空白處 | 筆按住卡片拖動 | 兩指或底部 ± | 切換游標工具後拖曳 |

互動層使用 **Pointer Events** 統一實作，卡片拖到螢幕邊緣、指標離開卡片範圍後依然持續追蹤；卡片內的預覽／編輯按鈕不會被誤判成拖曳。

**使用教學動畫**：首次開啟會自動播放 4 步示範（平移、卡片拖動、雙指縮放、JSON 備份）；之後桌機點頂欄學士帽圖示，手機從側邊選單的「使用教學」可重播。

**字體**：12 種（8 手寫體 Caveat / Indie Flower / Dancing Script / Caveat Brush / Satisfy / Sacramento / Pacifico / Playwrite ＋ 4 易讀體），**每張卡片可單獨選用**，全域字體作預設。
**背景**：純色／漸層／圖案／自訂 CSS／背景圖，即時預覽。
**LaTeX**：`$…$` 行內、`$$…$$` 獨立公式，KaTeX 渲染，編輯時即時預覽。
**版面**：預覽模式可選「一頁式」（連續長紙）或「分頁 A4」（794×1123 多張紙）。

---

## 虛擬書房（v8.1 全景書房）

開站預設進入可 360° 環顧、可走動的 three.js 真 3D 書房：窗景庭園、柔和日光與窗框影條、窗下無桌腿壁掛桌、另一側 3D 書架。房間是可操作空間，不是影片。**WebGL 僅呈現環境與家具；畫布、書封預覽、HUD、分類面板、虛擬搖桿都是原生 HTML 浮層。**

- **桌面工作視角**：點桌上畫布後相機約 0.52 秒飛到桌面正上方；此時原有 `InfiniteCanvas` 以螢幕平行 HTML 層完整接手，無 CSS 3D 透視，`getBoundingClientRect()` 座標換算保持純仿射，輸入框／IME／拖卡／框選／雙指縮放均沿用原實作。Esc 或「回到房間」飛回進入前精確位置與朝向。房間模式下畫布只顯示靜態縮圖，不接收精細操作。
- **走動與環顧**：桌機 WASD／方向鍵行走、Shift 加速、滑鼠拖曳轉頭；手機左下虛擬搖桿行走、畫面拖曳轉頭。yaw 360° 連續，pitch 約 −70°～+40°，移動受牆面邊界限制；輸入框聚焦時不會觸發走動。房間模式滾輪調整視高。
- **光影與效能**：ACES Filmic、抗鋸齒、PCFSoftShadowMap（桌機 2048／手機 1024）、pixelRatio 上限 2／1.5；程序化木紋、牆面顆粒、分層庭園窗景。桌機可有淡光柱與 140 顆塵埃；手機關閉粒子／光柱並降低陰影與像素比。
- **照片級材質（v8.2）**：`public/textures/study-room/` 的照片級 albedo 非同步換掉程序化紋理，**載入失敗自動退回程序化視覺**；`src/lib/room3d.ts` 的 `TEXTURES.floor` 可在 `oak`（暖橡木）與 `marble`（圖一的淺灰大理石地坪）之間一鍵切換。產製流程見 [`docs/v8.2-room-textures.md`](docs/v8.2-room-textures.md)。
- **完全復刻圖一（v8.3）**：書牆搬到**西牆**（`SHELF.wallSign = -1`，站東南角 `yaw=-45°` 即「左書牆、右窗」）、房高 2.75、4 排 **0.40 間距懸浮薄層板**（無側板／頂板／底座，板下暖光暈＋LED）、腰高長檯面＋矮擱板、**L 形大理石連續檯面**（窗台＝桌板）、桌下落地深炭櫃、透光橫紋簾、皮革單椅／筆電／黑色小物／龜背竹、淺灰大理石地坪、天花燈槽＋2 個方形嵌燈；`SUN 4.6`＋`exposure 1.22`＋`AMBIENT 0.15/0.34` 拉出亮窗與暖暗書牆的高對比，大理石柔反射用同一張窗景做 PMREM envMap（手機跳過）。`FIDELITY` 逐項可退步。詳見 [`docs/v8.3-match-reference-room.md`](docs/v8.3-match-reference-room.md)。
- **書架與分類**：書架與書本為 3D 幾何；書脊顏色依 `spineColor → 節點 accentColor → 形狀色`，卡片標題／形狀色即時同步。點書本開 HTML 書封預覽，可沿用 `CardDetailModal` 開卡、飛入畫布定位、選擇分類櫃板及上下排序；「書架目錄」提供可 Tab 操作的大按鈕入口。分類 CRUD 與刪分類回未分類、不刪卡的規則沿用 v8.0。
- **資料相容**：一卡一書（1:1），書本佈置與 `CanvasObjectData.x/y` 分離。`STORAGE_KEY=scinotes-workspace-v8.0`、`SCHEMA_VERSION=8` 不變；相機只新增選填 `x/z/height`，舊 JSON／本機資料載入時補上預設值；匯出仍整包帶出書房資料。
- **列印**：書房 UI 不印，沿用 v7.2 規則只輸出卡片紙面。

設計、光影取捨與驗收細節見 [`docs/v8.1-panorama-room.md`](docs/v8.1-panorama-room.md)。

---

## 編輯體驗（v7.2）

- **紙上編輯 ≡ 預覽**：同一棵 `V6Page*` / `V6ContinuousPaper` 元件樹，只差外層 `CardEditContext.Provider` 的 `editable` 旗標；不再有另一套「編輯版面」。點擊紙上的任一格即可就地編輯，LaTeX 以 `MathText`（KaTeX）顯示、編輯時回到原始碼 textarea，不對 KaTeX DOM 做 contentEditable。
- **鍵盤**：`Esc` 取消此格；`Ctrl/⌘+Enter` 提交並跳下一格；輸入時 `stopPropagation`，不會誤觸全域快捷鍵。
- **清單**：構造步驟、思考點、直覺陷阱、claims、assumptions、子目標、readings、readingQuestions、bridges、perspectives、HOW 的 CHECK / CAN / 分支，皆可新增、刪除、上下移動；分支支援巢狀子分支與區域 CHECK。
- **標記即控件**：APPLY 的 `[已編譯]/[未編譯]`、`[已推出]`、僅理解用、cheapest / invisible、`epistemicMark`、信心 1–5、形狀 A–E 都是可操作的控制項，列印時自動隱藏（`print:hidden`）。
- **還原未儲存變更**：進入編輯時深拷貝整張卡片為快照，工具列可一鍵還原（含分頁與頁碼），不影響已儲存的資料。
- **進階表單**：舊有的分頁表單完整保留，於編輯模式切換「紙上編輯 / 進階表單」即可，功能沒有被移除。
- **節點顏色**：畫布上的卡片節點可開啟「節點顏色」Palette，改寫 `style.accentColor`（hex），即時套用到頂部色帶與形狀徽章；可選形狀預設色或自訂色，亦可還原為形狀預設。顏色跟著 JSON 匯出／匯入走，舊資料（無 `accentColor`）行為完全不變。
- **工具列配色**：頂部工具列、分頁條與強調色可自訂（`src/lib/appTheme.ts`，localStorage `scinotes-app-theme`），內建四組預設、12 個顏色欄位（原生 `<input type="color">`），可一鍵還原預設；手機版側欄同樣能開啟配色面板。

---

## 快捷鍵

`⌘/Ctrl+K` 全域搜尋 · `T` 文字 · `C` 卡片 · `L` 線 · `A` 箭頭 · `G` 群組 · `Space` 平移

---

## 專案結構

```
src/
├── app/
│   ├── api/health/route.ts        靜態健康檢查端點
│   ├── globals.css                字體、響應式、安全區、背景圖樣
│   ├── layout.tsx                 Root layout + viewport
│   └── page.tsx                   主頁面（視圖切換、匯入匯出、各彈窗組裝）
├── components/
│   ├── AIAuditDrawer.tsx          AI 假懂審查抽屜
│   ├── AnalogyWorkbenchModal.tsx  類比工作台（候選推理測試）
│   ├── BackgroundCustomizer.tsx   背景自訂
│   ├── BlindSpotsView.tsx         盲區清單
│   ├── BlockageGuideModal.tsx     卡關／堵塞感引導
│   ├── Book3D.tsx                 v8.1：three.js 書本與 3D 櫃板標籤
│   ├── BookSpine.tsx              v8.0 HTML 書脊（舊版元件，保留相容）
│   ├── BookshelfView.tsx          v8.0 HTML 書架（舊版元件，保留相容）
│   ├── CardDetailModal.tsx        卡片詳細（預覽／編輯、一頁式／分頁、每卡字體）
│   ├── CardIndexView.tsx          卡片索引
│   ├── AppThemeCustomizer.tsx     工具列配色面板（v7.2）
│   ├── CardPaperEditor.tsx        紙上編輯原子元件 + CardEditContext（v7.2）
│   ├── CardPaperSections.tsx      紙張區塊渲染 + 四點自我檢查面板
│   ├── CameraRig.tsx              v8.1：WASD/搖桿、360° 環顧與桌面飛行
│   ├── DeskCanvas.tsx             v8.0 HTML 書桌（舊版元件，保留相容）
│   ├── DeskWorkView.tsx           v8.1：工作視角 HTML InfiniteCanvas 浮層
│   ├── ExpansionTestModal.tsx     展開測試（追問測試）
│   ├── FieldCustomizer.tsx        自訂欄位
│   ├── FontSelector.tsx           字體選擇
│   ├── FunctionPlotCanvas.tsx     函數圖像
│   ├── ImageTextCheckModal.tsx    圖文綁定檢查
│   ├── InfiniteCanvas.tsx         無限畫布
│   ├── KaTeXRenderer.tsx          公式渲染
│   ├── KnowledgeCardNode.tsx      卡片節點（摺疊態僅顯示重點）
│   ├── MathFormulaEditor.tsx      LaTeX 公式編輯器
│   ├── MathText.tsx               行內 LaTeX 解析
│   ├── MotherTopicsView.tsx       母題管理
│   ├── NetworkGraphView.tsx       知識圖譜
│   ├── OmniSearchModal.tsx        全域語義搜尋
│   ├── ProcessLogsView.tsx        過程日誌
│   ├── ShapeClassifier.tsx        推理形狀判型（含複合型）
│   ├── SoloAssessmentPanel.tsx    Bloom × SOLO 診斷
│   ├── Joystick.tsx               v8.1：手機虛擬搖桿
│   ├── RoomGeometry.tsx            v8.1：真 3D 房間／窗／桌／書架；v8.2：貼圖材質、燈帶、燈槽、捲簾；v8.3：西牆懸浮層板＋L 形大理石檯面＋落地櫃＋透光簾
│   ├── RoomFurniture.tsx           v8.3：皮革單椅／筆電／黑色小物／龜背竹（程序化，不參與 raycast）
│   ├── ShelfDecor.tsx              v8.3：層板間裝飾書（InstancedMesh）與斜靠相框
│   ├── StudyCategoryPanel.tsx     書房分類櫃板 CRUD
│   ├── StudyRoomView.tsx          v8.1：全景書房＋HTML 浮層
│   ├── StudyScene.tsx              v8.1：three.js 生命週期／渲染器
│   ├── WindowLight.tsx            v8.1：窗景植物、陽光與柔影；v8.2：遠景換照片級庭園
│   └── TemplateSelectorModal.tsx  模板選擇
└── lib/
    ├── appTheme.ts                工具列配色主題 + localStorage（v7.2）
    ├── fonts.ts                   字體清單
    ├── inspect.ts                 審查引擎 ＋ 四點自我檢查
    ├── seedData.ts                預設種子資料
    ├── solo.ts                    SOLO 診斷邏輯
    ├── store.ts                   狀態管理 ＋ localStorage 持久化
    ├── room3d.ts                  v8.1 房間尺寸、光源與 3D 書架計算；v8.3 西牆書牆／L 形檯面／FIDELITY／MATCH_VIEW
    ├── roomTextures.ts            v8.2：照片級 albedo 非同步介接（含 basePath 解析與退回）；v8.3：alphaMap 槽與 PMREM envMap
    ├── study.ts                   書房資料型別／helper／遷移（v8.1）
    └── types.ts                   型別定義
```

---

## 範例資料

四張完整例卡，可直接觀察各機制如何運作：

1. **熱力學第二定律與卡諾定理**（A 推導鏈型，反證法＋複合裝置，HOW 已編譯）
2. **傅立葉變換與頻域正交分解**（E 定義/約定型，含「負頻率不是數學假象」直覺陷阱、CAN·下游解鎖三項）
3. **勒夏特列原理**（**複合型 C + A**：外層判別程序、內核自由能凸性推導；HOW 展示**巢狀分支**——「算擾動瞬間的 $Q$」之下加反應物／加壓／升溫三個子分支，加壓與升溫各帶**區域性 CHECK**；含恆容/恆壓惰氣盲區）
4. **薛丁格波動方程**（D 前提/框架型，公設綁定框架、SOLO 抽象拓展）

母題：「連續對稱性與守恆律對偶」（3 實例 ＋ 候選推理測試 ＋ 新預測驗證 → 已成立）

v8.1／v8.3 回歸檢查：`npx tsx scripts/check-room3d.ts`（相機邊界／360°／飛行 easing／日光／375px 投影／SSR／**v8.2 貼圖資產齊備**／**v8.3 西牆書牆＋對照視角投影＋層板堆疊**）。v8.2 換材質來源後重生貼圖：`bash scripts/make-room-textures.sh <來源圖目錄>`（需 ImageMagick，會順手輸出 `tile-check-*.jpg` 2×2 平貼檢查圖）；詳見 [`docs/v8.2-room-textures.md`](docs/v8.2-room-textures.md)。2026-10-18 補強包含輸入焦點移動隔離、可見的返回飛行，以及書本預覽即時讀取 store；詳見 v8.1 文件 §7。
