# 嵌套之城：實作假設、視覺驗收與回歸紀錄

更新日期：2026-10-24。這份記錄區分「參考圖可見的構圖要求」與「為可執行場景所採用的尺寸假設」；不宣稱按概念圖精確量得。

## 尺寸與幾何假設

概念圖沒有比例尺，背面也沒有可核對的視圖。以下為本版建模座標，供場景、移動與碰撞共用：

- 房間：24 × 20 × 16 m；樓面標高 0、4、8、12 m。
- 外木構盒框：22.7 × 18.2 m、約 15.4 m 高，位於原點，方向 0°；橫梁帶對應 4、8、12 m。
- 中層石構穿插體：21.6 × 12.6 m、底標高 3.6 m、厚高 4.8 m；中心 (0, −1.4) m、旋轉 10°，南側保留樓梯口。
- 內核：7 × 4.9 m、底標高 4.15 m、跨高 7.7 m；中心 (1.2, −0.8) m、旋轉 30°。不同中心、方向與尺度是設計假設，不是參考圖的精確尺寸。
- 上層使用錯位的局部平台、1F/2F 橋道與 4F 四側觀景環廊，保留中央挑空；平台邊界及斜梯落點共用 `NESTED_CITY` 真相。
- 三段開放踏階由 `(-5.2, 0, 0) → (-5.2, 6.9, 4)`、`(-5.2, 6.9, 4) → (-5.2, −5.65, 8)`、`(-5.2, 4.55, 8) → (-5.2, −6.7, 12)` 連接樓層；視覺上以 23/25/23 個踏面批次繪製，行走高度由同一階梯路徑函式提供。

`NESTED_CITY`、`cityFrameMembers`、平台與碰撞位於 `src/lib/room3d.ts`；`NestedCityGeometry` 使用相同構件資料繪製，因此旋轉框架的視覺位置與玩家／相機碰撞不再用不同的矩形近似。尺寸、承重與背面閉合方式仍是模型假設。

## 材質、光線與 renderer

- 外框木色、穿插體灰石色、較深內核分別使用 `MeshStandardMaterial`；本版主要 PBR 假設為：木 roughness 0.78 / metalness 0.02、石 roughness 0.91 / metalness 0.015、內核 roughness 0.84 / metalness 0.025。這是材質參數選擇，不是從概念圖量得的實際材質值。
- 保留北側近透明玻璃、高窗山景圖、方向日光、窗光補光、局部暖色閱讀燈與書架 LED。窗外全景是生成式景觀素材 `public/textures/study-room/mountain-courtyard-view.png`，表示一個設計場景，不代表真實地點或地理還原。
- `StudyScene.tsx` 的桌機 renderer 使用 antialias、`quality.pixelRatio`、啟用陰影（`PCFShadowMap`、shadow map 尺寸依品質設定）、ACES Filmic tone mapping、曝光 0.96；本版沒有另行覆寫 Three.js 輸出色彩空間，也未加霧來掩飾遮擋或幾何。場景環境貼圖只以低強度反射，避免室內牆面被窗外綠色染色。
- 效能處理：結構共用單位盒體幾何，階梯踏面／踏鼻用 `InstancedMesh` 批次，場景釋放以 Set 避免共享幾何、材質、貼圖重複 dispose。這些是結構性優化；本輪沒有量測 FPS 或做跨裝置效能基準，因此不宣稱達到特定幀率。

## 既有學習資料與互動

實際卡片書本、分類、書架排列、桌面預覽、工作畫布、儲存與協作仍由原 `RoomGeometry`、`Book3D`、`ShelfDecor`、`StudyRoomView` 及資料層提供；新增的少量書格色塊僅為建築示意，不替代資料書。三維結構碰撞使用構件高度及旋轉 OBB footprint；玩家、第三人稱相機、家具與樓層高度各由共用房間模型處理。

## 瀏覽器驗收設定與真實截圖

2026-10-24 以 headless Chromium／SwiftShader 開啟本機 Next.js 預覽；每張全頁擷取為 1440 × 900，使用同一桌機品質設定。白模按鈕狀態在前三張確認為開啟，後三張為關閉；山景 PNG 回應 HTTP 200；擷取期間 page errors 為 0。截圖保留 SciNotes UI，外部字型受沙箱網路限制而使用 fallback。這些是實際網站 WebGL 擷取，不是概念圖、合成模型渲染或部署截圖。

相機資料以 `(x, z, eye height, floorY, yaw°, pitch°)` 記錄；瀏覽器 HUD 分別顯示 12 m、4 m、0 m：

| 用途 | 相機 | 白模／材質截圖 |
| --- | --- | --- |
| 主視角：4F 西北廊道斜望內核與挑空 | `(-5.2, -8.4, 1.52, 12, 135, -12)` | [白模](evidence/nested-city/white-main.png) · [材質](evidence/nested-city/material-main.png) |
| 輔助：1F 跨橋、階梯與樓層套疊 | `(0, 8, 2.3, 4, 0, -12)` | [白模](evidence/nested-city/white-aux-level1-bridge.png) |
| 輔助：地面層書牆與窗側 | `(10, 3, 2.3, 0, -60, -24)` | [白模](evidence/nested-city/white-aux-ground-bookshelves.png) · [材質](evidence/nested-city/material-aux-bookshelves.png) |
| 補充：地面層正望高窗山景 | `(0, 4, 1.52, 0, 0, 0)` | [材質](evidence/nested-city/material-aux-mountains.png) |

## 驗收矩陣

每列只使用規格要求的三種狀態；差異與證據放在狀態後方。

| 項目 | 狀態 | 證據與差異 |
| --- | --- | --- |
| P0：外框、中層穿插體、偏心旋轉內核可讀成不同方向／尺度的三維前中後景 | **通過** | 白模主視角可見三組框架、錯位環廊及向下挑空；材質主視角能區分木、石與深色內核。不是逐像素複刻概念圖。 |
| P0：中央挑空、不同高度的局部樓板、橋道與環廊 | **通過** | 白模主視角、1F 跨橋輔助圖；`check-room3d.ts` 檢查每層平台連通、同層不重疊及中央樣點保持開放。 |
| P0：跨層階梯、落腳平台、踏高／踏深、頭部淨高與可行走碰撞 | **通過** | 白模跨橋輔助圖；`check-room3d.ts` 對三段階梯逐段採樣，核對落點、上層板淨高、碰撞及高度連續。視覺截圖僅顯示部分樓梯，不代表所有踏階都在同一畫面。 |
| P1：梁柱、平台、書架及玩家／第三人稱相機的碰撞一致 | **通過** | 房間檢查涵蓋旋轉框架 OBB、玩家路徑、第三人稱候選相機、牆角退距及家具遮擋；這是程式幾何回歸，不是結構工程驗證。 |
| P1：真實書籍與分類資料不被裝飾替代，書架預覽仍可互動 | **通過** | 材質輔助書牆截圖可見資料書架；瀏覽器點開書架目錄顯示 6 筆書，第一筆「算術平均數（v7 附錄 C 完整範例）」成功開啟真實書本預覽；共享內容與協作測試通過。 |
| P2 主要項目：木／石／玻璃層次、自然窗光、局部暖光、陰影、窗外山景 | **通過** | 同機位白模／材質主視角，以及材質書牆與山景輔助圖；山景在高窗視野可辨識，未使用霧遮掩。 |
| P2：概念圖等級的高細節木紋、石材微表面、玻璃反射與精緻電影式光影 | **未通過** | 本版以色彩、roughness、玻璃與場景光源建立材質分層；結構大構件仍較平面、細紋與反射層次弱於參考圖，需後續材質細化，不能稱為完美還原。 |
| 背面幾何、真實尺度、承重安全、真實地理位置、參考圖未顯示的構造 | **無法從參考圖判定** | 依上方假設實作，需建築／結構資料或更多參考視角才能驗證。 |
| 目標硬體 FPS／長時間裝置效能 | **無法從參考圖判定** | 已做幾何共享與踏階批次，但本輪沒有真機效能基準。 |

## 回歸命令與本輪結果

- `npx tsx scripts/check-room3d.ts`：`ALL ROOM CHECKS PASS`；涵蓋三框架、4 層、中央挑空、平台拓撲、階梯踏面／頭部淨高／碰撞、相機、互動動作與角色回歸。
- `npm run typecheck`：通過。
- 定向 ESLint：`src/components/NestedCityGeometry.tsx`、`src/components/StudyScene.tsx`、`src/components/WindowLight.tsx`、`src/lib/room3d.ts`、`scripts/check-room3d.ts` 通過。
- `npm run test:connection`：14/14；`npm run test:collaboration`：5/5；`npm run test:collaboration-editing`：8/8；`npm run test:shared-content`：8/8。
- `git diff --check`：通過。
- `NEXT_BASE_PATH=/test222 npm run export`：通過；與 GitHub Pages workflow 相同的靜態匯出模式，產生 `/`、`/_not-found`、`/api/health`、`/connect` 靜態路由。部署仍需合入 `main` 後由 Pages workflow 執行。

## 歷史結構檢查記錄

早期多視角檢查曾發現第 2 層環廊轉角與橋端同高縫隙／重疊、局部橋欄支柱落在板外及承重柱未完全落在樓板聯集；後續調整平台邊界與支承範圍。另將旋轉中框梁的 AABB 假碰撞改為 OBB footprint，並限制第三人稱相機候選點不得貼近玩家。以上歷史紀錄不替代本輪重新執行的測試結果。
