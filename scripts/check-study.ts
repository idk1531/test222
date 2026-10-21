// v8.0 書房驗證腳本（npx tsx scripts/check-study.ts）
import assert from "node:assert/strict";
// 檢查：①卡↔書 1:1 ②書本排序/分類不影響畫布座標 ③刪分類書回未分類 ④舊檔遷移補齊。
// 不動審查引擎（inspect.ts）與種子資料（seedData.ts）；與 scripts/audit.ts 分開。
import {
  actions,
  getState,
  applyPatch,
  applySchemaMigrations,
  getExportPayload,
  resetToSeed,
} from "../src/lib/store";
import { DEFAULT_CAMERA, clampCamera, ensureStudyState, makeBookForCard, UNCATEGORIZED_ID, UNCATEGORIZED_NAME } from "../src/lib/study";
import { computeShelfLayout } from "../src/lib/room3d";
import { resolveAction } from "../src/lib/roomActions";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const snapshotCanvas = () =>
  JSON.stringify(getState().canvasObjects.map((o) => ({ id: o.id, x: o.x, y: o.y })));

// ---------- v8.4 落點選填欄位／放置 action ----------
console.log("v8.4 書本落點選填欄位");
{
  const freshBook = makeBookForCard("v84-fresh");
  check("新建書不寫 place（舊資料語意保持缺省）", !Object.prototype.hasOwnProperty.call(freshBook, "place"));
  const malformed = ensureStudyState({
    cards: [{ id: "legacy-desk", title: "舊卡" }],
    studyBooks: [{ cardId: "legacy-desk", categoryId: null, orderInShelf: 7, place: "desk" }],
  } as any);
  check("desk 缺座標時防禦性退回 shelf 且不造預設值", malformed.studyBooks[0].place === "shelf" && !malformed.studyBooks[0].desk);

  const legacy = ensureStudyState({
    cards: [{ id: "legacy-shelf", title: "舊書" }, { id: "desk-book", title: "桌上書" }],
    studyBooks: [
      { cardId: "legacy-shelf", categoryId: null, orderInShelf: 0 },
      { cardId: "desk-book", categoryId: null, orderInShelf: 1, place: "desk", desk: { x: 0, z: -1.9, yawDeg: 15 } },
    ],
  } as any);
  const shelfLayout = computeShelfLayout(legacy.studyCategories, legacy.studyBooks, legacy.cards, () => "#8a6440");
  const visibleShelfIds = shelfLayout.rows.flatMap((row) => row.boards.flatMap((board) => board.books.map((book) => book.cardId)));
  check("缺 place 的舊書仍在架上", visibleShelfIds.includes("legacy-shelf"));
  check("place=desk 的書不進 computeShelfLayout", !visibleShelfIds.includes("desk-book"));
}
{
  resetToSeed();
  const before = getState();
  const book = before.studyBooks[0];
  const originalOrder = book.orderInShelf;
  const canvasBefore = JSON.stringify(before.canvasObjects.map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height })));
  actions.setBookPlace(book.cardId, "desk", { x: 0.12, z: -1.92, yawDeg: 30 });
  const onDesk = getState().studyBooks.find((b) => b.cardId === book.cardId)!;
  check("放桌不改 orderInShelf", onDesk.orderInShelf === originalOrder);
  check("放桌只增加選填 desk 欄位", onDesk.place === "desk" && onDesk.desk?.x === 0.12 && onDesk.desk.z === -1.92);
  check("放桌不動畫布座標/尺寸", JSON.stringify(getState().canvasObjects.map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height }))) === canvasBefore);
  actions.setBookPlace(book.cardId, "shelf");
  const onShelf = getState().studyBooks.find((b) => b.cardId === book.cardId)!;
  check("回架保留原 orderInShelf 並清除桌面位置", onShelf.orderInShelf === originalOrder && onShelf.place === "shelf" && !onShelf.desk);

  const booksBeforePick = JSON.stringify(getState().studyBooks);
  const canvasBeforePick = JSON.stringify(getState().canvasObjects.map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height })));
  const pickAction = resolveAction("book", "KeyE", {
    mode: "room", flying: false, held: null, seated: false, bookOnDesk: false,
    hitDeskSurface: false, seatedCanStand: true, cardId: book.cardId,
  });
  check("拿起只返回瞬態 pickUp action", pickAction.type === "pickUp" && pickAction.cardId === book.cardId);
  check("拿起不寫 store/orderInShelf/畫布座標", JSON.stringify(getState().studyBooks) === booksBeforePick && JSON.stringify(getState().canvasObjects.map((o) => ({ id: o.id, x: o.x, y: o.y, width: o.width, height: o.height }))) === canvasBeforePick);
  resetToSeed();
}

// ---------- v8.4 桌上書開卡契約：只開 modal、不碰畫布/相機 ----------
{
  resetToSeed();
  const book = getState().studyBooks[0];
  actions.setBookPlace(book.cardId, "desk", { x: 0, z: -1.92, yawDeg: 0 });
  const cameraBefore = structuredClone(getState().studyLayout.camera);
  const canvasBefore = getState().canvasObjects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
  const workMode = false;
  const action = resolveAction("book", "click", {
    mode: "room", flying: false, held: null, seated: false, bookOnDesk: true,
    hitDeskSurface: false, seatedCanStand: true, cardId: book.cardId,
  });
  check("桌上書左鍵只產生 openCard(from=desk)", action.type === "openCard" && action.cardId === book.cardId && action.from === "desk");
  assert.deepEqual(getState().studyLayout.camera, cameraBefore);
  assert.deepEqual(getState().canvasObjects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height })), canvasBefore);
  check("桌上開卡契約：camera/canvasObjects deep-equal 且 workMode=false", !workMode);
  resetToSeed();
}

// ---------- ① 種子資料：卡↔書 1:1 ----------
console.log("① 卡↔書 1:1");
resetToSeed();
{
  const s = getState();
  const cardIds = new Set(s.cards.map((c) => c.id));
  const bookIds = s.studyBooks.map((b) => b.cardId);
  check("每張卡都有書", s.cards.every((c) => s.studyBooks.some((b) => b.cardId === c.id)));
  check("書不多於卡（無孤兒）", bookIds.every((id) => cardIds.has(id)));
  check("cardId 不重複", new Set(bookIds).size === bookIds.length);
  check("至少一筆保留分類", s.studyCategories.some((c) => c.id === UNCATEGORIZED_ID && c.name === UNCATEGORIZED_NAME));
  check("分類順序：保留分類最後", s.studyCategories[s.studyCategories.length - 1].id === UNCATEGORIZED_ID);
  console.log(`  （${s.cards.length} 張卡 / ${s.studyBooks.length} 本書 / ${s.studyCategories.length} 個分類）`);
}

// ---------- ② 書本佈置 ≠ 畫布座標 ----------
console.log("② 書本排序與畫布座標互不影響");
{
  const before = snapshotCanvas();
  const catId = actions.addCategory({ name: "測試分類", color: "#0f766e" });
  const s0 = getState();
  const book = s0.studyBooks[0];
  actions.assignCardCategory(book.cardId, catId);
  actions.reorderBook(book.cardId, catId, 0);
  actions.reorderBook(s0.studyBooks[1].cardId, null, 2);
  check("分類/排序後畫布座標不變", snapshotCanvas() === before);

  // 反向：移動畫布物件不得改 orderInShelf
  const orderBefore = JSON.stringify(getState().studyBooks.map((b) => ({ id: b.cardId, o: b.orderInShelf, c: b.categoryId })));
  const obj = getState().canvasObjects.find((o) => o.cardId);
  actions.updateCanvasObjects([{ id: obj!.id, x: obj!.x + 555, y: obj!.y + 555 }]);
  check("移動畫布卡片後書本排序不變", JSON.stringify(getState().studyBooks.map((b) => ({ id: b.cardId, o: b.orderInShelf, c: b.categoryId }))) === orderBefore);

  // ③ 刪分類 → 書回未分類、卡還在
  console.log("③ 刪除分類：書回未分類、不刪卡");
  const cardsBefore = getState().cards.length;
  actions.deleteCategory(catId);
  const s1 = getState();
  check("分類已刪除", !s1.studyCategories.some((c) => c.id === catId));
  check("書本還在", s1.studyBooks.length === s1.cards.length);
  check("該櫃板的書回未分類", s1.studyBooks.filter((b) => b.categoryId === null).length > 0 && !s1.studyBooks.some((b) => b.categoryId === catId));
  check("卡片未被刪除", s1.cards.length === cardsBefore);
}

// ---------- 刪卡 → 書一起消失 / 新卡 → 自動有書 ----------
{
  const s0 = getState();
  const victim = s0.cards[0];
  actions.deleteCard(victim.id);
  check("刪卡後書一起消失", !getState().studyBooks.some((b) => b.cardId === victim.id));
  const newId = actions.createCard({ workspaceId: getState().workspace.id, title: "測試新卡" }, { x: 1, y: 2 });
  check("新卡自動有書（未分類）", getState().studyBooks.some((b) => b.cardId === newId && b.categoryId === null));
  actions.deleteCard(newId);
}

// ---------- ④ 舊檔遷移：缺 study 欄位自動補齊 ----------
console.log("④ 遷移補齊（模擬 v7.1 匯入）");
{
  const legacy = {
    workspace: { id: "w-test", name: "測試" },
    cards: [
      { id: "legacy-a", title: "舊卡A", reasoningShape: "A" },
      { id: "legacy-b", title: "舊卡B", reasoningShape: "B" },
    ],
    canvasObjects: [],
    relations: [],
    processLogs: [],
    blindSpots: [],
    motherTopics: [],
    versions: [],
    savedAt: new Date().toISOString(),
  } as any;
  const migrated = applySchemaMigrations(legacy);
  check("遷移後每張舊卡都有書", migrated.cards.every((c: any) => migrated.studyBooks.some((b: any) => b.cardId === c.id)));
  check("舊檔無 place 的語意保持缺省", migrated.studyBooks.every((b: any) => !Object.prototype.hasOwnProperty.call(b, "place")));
  check("遷移後補上保留分類", migrated.studyCategories.some((c: any) => c.id === UNCATEGORIZED_ID));
  check("舊卡內容不掉", migrated.cards.length === 2 && migrated.cards[0].title === "舊卡A");
  check("shelfRows/視角欄位存在", typeof migrated.studyLayout.shelfRows === "number" && typeof migrated.studyLayout.camera.yaw === "number");
  check("舊相機自動補走動位置與視高", migrated.studyLayout.camera.x === DEFAULT_CAMERA.x && migrated.studyLayout.camera.z === DEFAULT_CAMERA.z && migrated.studyLayout.camera.height === DEFAULT_CAMERA.height);
  // 回歸：沒有 rawCam 時 yaw/pitch 也必須沿用 DEFAULT_CAMERA（曾誤用 0，導致永遠面向北牆）。
  check("新使用者的初始 yaw/pitch 對齊參考圖", migrated.studyLayout.camera.yaw === DEFAULT_CAMERA.yaw && migrated.studyLayout.camera.pitch === DEFAULT_CAMERA.pitch);
  const wrapped = clampCamera(725, -90);
  check("yaw 360° 連續正規化、pitch 限制 −70°", wrapped.yaw === 5 && wrapped.pitch === -70);
  console.log(`  （遷移 ${migrated.cards.length} 張卡 → ${migrated.studyBooks.length} 本書、${migrated.studyCategories.length} 個分類）`);

  // 純函式 applyPatch（下一輪 op log 接口）：套用 patch 不改其他欄位
  const base = getState();
  const patched = applyPatch(base, { studyLayout: { camera: { yaw: 12, pitch: 4 }, shelfRows: 3 } });
  check("applyPatch 只動 patch 欄位", patched.studyLayout.camera.yaw === 12 && patched.cards === base.cards && patched.studyBooks === base.studyBooks);
  const patched2 = ensureStudyState(legacy);
  check("ensureStudyState 純函式可單獨使用", patched2.studyBooks.length === 2);
}

// ---------- 匯出 payload 帶上書房資料 ----------
{
  const payload = getExportPayload();
  check("匯出含 studyCategories/studyBooks/studyLayout", !!payload.state.studyCategories && !!payload.state.studyBooks && !!payload.state.studyLayout);
  check("schemaVersion = 8", payload.schemaVersion === 8);
}

console.log("-".repeat(50));
console.log(failures === 0 ? "ALL STUDY CHECKS PASS" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
