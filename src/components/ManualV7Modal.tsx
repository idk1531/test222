"use client";

import React, { useState } from "react";
import { X, BookOpen, GitBranch, Table2, Compass, AlertCircle, ExternalLink } from "lucide-react";
import { MathText } from "./MathText";

interface ManualV7ModalProps {
  onClose: () => void;
  onOpenCardById?: (cardId: string) => void;
}

export const ManualV7Modal: React.FC<ManualV7ModalProps> = ({
  onClose,
  onOpenCardById,
}) => {
  const [tab, setTab] = useState<"tree" | "readings" | "appendixC" | "appendixD">("tree");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 text-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-sky-400" />
            <div>
              <h3 className="font-bold text-sm">
                理科筆記 · 使用手冊（樹狀圖版 · v7 修正 & v6 完整規範）
              </h3>
              <p className="text-[11px] text-slate-300">
                涵蓋 WHAT「讀法／問題×讀法表／橋」、視角×讀法雙獨立軸、借鏡視角、六向延伸「造」與 [衍生] 邊、功能判準洞見檢查、APPLY [源:___] 標籤及附錄 B/C/D
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-4 bg-slate-100 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {[
            { key: "tree", label: "0. 樹狀圖總覽 & 符號速查表（v7修正）", icon: GitBranch },
            { key: "readings", label: "1. 讀法 · 視角×讀法軸 · 附錄B（12原則）", icon: Table2 },
            { key: "appendixC", label: "2. 附錄C：四種橋 &「平均數」完整範例", icon: Compass },
            { key: "appendixD", label: "3. 附錄D：尚未解決的問題（5項開放議題）", icon: AlertCircle },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-1.5 px-3 py-2.5 font-bold whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? "border-sky-600 text-sky-900 bg-white"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-slate-800 leading-relaxed">
          {/* ==================== TAB 0: 樹狀圖總覽 & 符號速查 ==================== */}
          {tab === "tree" && (
            <div className="space-y-5">
              <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 space-y-1.5">
                <div className="font-bold text-sky-950 text-sm">
                  v7 修正重點總覽（建立於 v6 之上）
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>
                    <b>WHAT 新增第一子節點「讀法」</b>：區分同一個知識點的不同表述／取用方式，以「問題×讀法表」對照哪個讀法在哪道題最便宜，並以「橋」（互通／單向／限定範圍／走不通）記錄讀法之間的推導關係。
                  </li>
                  <li>
                    <b>視角與讀法是兩條獨立的軸</b>：視角問「有沒有第二個對象、結構貼不貼」；讀法問「有沒有題變容易」。兩者構成 2×2 四種組合。
                  </li>
                  <li>
                    <b>五個方向延伸改為六個方向，新增「造」</b>：用本概念當零件，經一個邏輯沒有強迫的選擇，造出新的量／對象／操作（必寫三件事：①選了什麼、②換一個選擇會怎樣、③連回對象）。關係邊同步新增 <code className="font-mono font-bold text-teal-800">[衍生]</code>（B 須有 <code className="font-mono font-bold text-blue-800">[前提]</code> 指回 A）。
                  </li>
                  <li>
                    <b>洞見檢查改為功能判準（取代 v4 感覺判準）</b>：每一句延伸附一道「拿掉這句就會答錯或做不出來」的題；寫不出，就刪掉這句。
                  </li>
                  <li>
                    <b>示範卡對照說明</b>：《勒沙特列原理》依 v7 手冊前言保留 v6 寫法（五個方向、無讀法表）作為對照；新增《算術平均數（v7 附錄 C 完整範例）》與《方差》展示完整 v7 結構。
                  </li>
                </ul>
              </div>

              {/* 樹狀圖結構 */}
              <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto">
                <div className="text-sky-400 font-bold mb-2">
                  知識點卡片（樹狀圖結構 · v7 修正）
                </div>
                <pre className="whitespace-pre">{`知識點卡片
├── 卡頭 + 關係邊 + 診斷標籤（第 1 頁：名稱 · 領域 · 顆粒度 · 推理形狀 A~E · 省略聲明 · 單行摘要）
│   ├── 關係邊：[前提] / [衍生](v7新增：B須有[前提]指回A) / [結構類比:d] / [表面相似:d] / [對照:d] / [正反例] / [特例/推廣] / [歸屬母題]
│   └── 診斷標籤：Bloom（單點深度 6 級） × SOLO（知識網整合度 5 級，未決盲區邊與未驗類比不計分）
├── 【背景】（第 2 頁：梯形收窄條 + 理解問題信心校準 1~5★）
│   ├── 第一段·情境（最寬） → 第二段·精確對象+情境語言（收窄） → 第三段·精確對應的問題（最窄）
│   └── 第四段·歷史線 [歷史起源] + 與第一段情境的聯繫
├── 【構造思路】（第 3 頁：收斂漏斗，選填）
│   └── 候選登場（要求 → 具體形式 → 扣住形式的摸索動機） → 路徑【追問·思維模式名】 → 【計畫】（步驟順序依賴 + 範圍誠實標註）
├── 【WHY】（第 4 頁：不對稱塔木德式，正文 + 右側認識論/假設/失效模式評註欄）
│   └── IOED 信心校準 → 閉卷草稿 → 子目標聲明 → 雙失效模式視角 → 認識論錨點 [地位:證明/歸納/近似/約定/公設]
├── 【WHAT】（第 5 頁：v7 三大子節點）
│   ├── ① 讀法（v7新增）：讀法清單 + 問題×讀法表 + 橋（互通/單向/限定範圍/走不通） + 機械檢查
│   ├── ② 視角（至少 3 個 + 借鏡視角 [借鏡視角:標題]）：(1) 顯式對應表 (2) 可獨立核對的具體事實
│   └── ③ 六個方向延伸：推深 / 推淺 / 推廣 / 推窄 / 翻譯 / 造（v7新增：選了什麼+換選擇會怎樣+連回對象） + 功能判準題
├── 【APPLY】（第 6 頁：原 HOW+WHEN 合併，每條必掛來源標籤 [源:___]）
│   ├── ‖ CHECK（橫跨性前置關卡，支援兩段式變換）
│   ├── ⑂ 分支（可巢狀，含區域性 CHECK、觸發點兩段式構造、標明 [源:WHAT-讀法n] 等）
│   └── ★ CAN（下游解鎖能力，不綁定卡片類型）
└── 【過程日誌】（第 7 頁：方格填色進度條 [增量] / [框架衝突] / [同session矛盾] / [未編譯]）`}</pre>
              </div>

              {/* 符號速查表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-bold text-slate-900">認識論地位 & 關係邊標籤</div>
                  <div className="space-y-1 text-[11px]">
                    <p><code className="font-mono font-bold text-blue-700">[地位:證明]</code> 由前提邏輯必然推出，無例外</p>
                    <p><code className="font-mono font-bold text-blue-700">[地位:歸納]</code> 由有限觀察／實驗歸納，可被反例推翻</p>
                    <p><code className="font-mono font-bold text-blue-700">[地位:近似於___]</code> 在指定框架下的簡化，脫離框架不可靜默當普遍結論</p>
                    <p><code className="font-mono font-bold text-blue-700">[地位:約定]</code> 人為定義與記號規定，無所謂對錯</p>
                    <p><code className="font-mono font-bold text-blue-700">[地位:公設(___)]</code> 在指定框架內作為不證自明的出發點</p>
                    <hr className="my-1.5 border-slate-200" />
                    <p><code className="font-mono font-bold text-indigo-700">[前提]</code> A 是 B 成立的必要基礎（擦掉 A，B 的 WHY 斷在哪一步）</p>
                    <p><code className="font-mono font-bold text-teal-700">[衍生]（v7新增）</code> A [衍生]→ B 表示 B 是用 A 造出來的；<b>機械檢查：B 必須有 [前提] 指回 A</b></p>
                    <p><code className="font-mono font-bold text-purple-700">[結構類比:d=___]</code> 已過候選推理測試，計入 SOLO</p>
                    <p><code className="font-mono font-bold text-amber-700">[表面相似:d=___]</code> 未驗證類比，不計入 SOLO</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-bold text-slate-900">v7 新增：讀法標記 & APPLY 來源標籤</div>
                  <div className="space-y-1 text-[11px]">
                    <p><code className="font-mono font-bold text-rose-700">[已證無橋]</code> 兩個讀法之間已證明不存在直接推導</p>
                    <p><code className="font-mono font-bold text-amber-700">[未找到橋]</code> 暫時沒找到推導，不等於無橋</p>
                    <p><code className="font-mono font-bold text-slate-700">[未查]</code> 這對讀法還沒檢驗過</p>
                    <p><code className="font-mono font-bold text-slate-700">僅理解用</code> 此讀法沒有對應任何 APPLY 分支</p>
                    <p><code className="font-mono font-bold text-amber-800">單一讀法，盲區未驗</code> 只有一個讀法時，提醒盲區尚未透過第二讀法暴露</p>
                    <hr className="my-1.5 border-slate-200" />
                    <p className="font-bold text-slate-800">APPLY 來源標籤（句尾必填）：</p>
                    <p><code className="font-mono text-indigo-700">[源:定義]</code> · <code className="font-mono text-indigo-700">[源:WHY-推導X]</code> · <code className="font-mono text-indigo-700">[源:WHAT-視角X]</code> · <code className="font-mono text-indigo-700">[源:WHAT-借鏡視角:標題]</code> · <code className="font-mono text-sky-700 font-bold">[源:WHAT-讀法n]</code> · <code className="font-mono text-indigo-700">[源:關係邊-X]</code></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 1: 讀法 · 視角×讀法軸 · 附錄B ==================== */}
          {tab === "readings" && (
            <div className="space-y-5">
              {/* 視角 vs 讀法 2x2 表 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="font-bold text-slate-900 text-sm">
                  視角與讀法是兩條獨立的軸（v7 核心修正）
                </div>
                <p className="text-slate-600">
                  <b>視角</b>問：「有沒有第二個具體對象，且結構完整貼合？」 ｜ <b>讀法</b>問：「有沒有某道題在此表述下明顯變容易？」
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300 bg-white text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="p-2 border border-slate-300 text-left">組合類型</th>
                        <th className="p-2 border border-slate-300 text-left">特徵說明</th>
                        <th className="p-2 border border-slate-300 text-left">手冊範例</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold text-emerald-800">是視角，也是讀法</td>
                        <td className="p-2 border border-slate-300">有第二個具體對象且結構貼合，同時讓某類題變容易</td>
                        <td className="p-2 border border-slate-300">平均數的「天平支點」（有天平對象，且湊平均／離群值題一眼看出）</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold text-indigo-800">是視角，不是讀法</td>
                        <td className="p-2 border border-slate-300">有第二個對象的對應表，但沒有任何題因此減少步驟</td>
                        <td className="p-2 border border-slate-300">純結構同構演示（僅加深理解，無專屬便宜題型）</td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold text-sky-800">是讀法，不是視角</td>
                        <td className="p-2 border border-slate-300">沒有外部第二對象，純粹是同一概念的不同代數／操作表述，但讓特定題變容易</td>
                        <td className="p-2 border border-slate-300">
                          <MathText text="平均數「總和÷個數」vs「$\sum(x_i-\bar{x})=0$」" />
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 border border-slate-300 font-bold text-slate-600">兩者都不是</td>
                        <td className="p-2 border border-slate-300">既無第二個對象，也沒有任何問題因此變容易（純換寫法）</td>
                        <td className="p-2 border border-slate-300">
                          <MathText text="$3\times 4 = 12$ 改寫成 $12 = 3\times 4$" />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 附錄 B：讀法的 12 條原則 */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-2.5">
                <div className="font-bold text-sky-950 text-sm">
                  附錄 B：讀法的原則（12 條完整收錄）
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-slate-800">
                  <li><b>讀法是取用知識的方式</b>，不是知識本身。</li>
                  <li><b>不同讀法的判準</b>：存在某個問題，在其中一種下明顯比另一種容易。</li>
                  <li><b>沒有問題因此變容易的改寫</b>，只是換寫法，不算新讀法（例：$3\times 4=12$ 和 $12=3\times 4$）。</li>
                  <li><b>讀法沒有普遍優劣</b>，只有「對哪道題哪個便宜」。</li>
                  <li><b>問題×讀法表是讀法的核心工具</b>：列是問題，欄是讀法，格子填幾步或「看不見」。</li>
                  <li><b>每個讀法至少有一題它最便宜</b>；沒有，就併入別的讀法。</li>
                  <li><b>某個讀法下「看不見」的題</b>，必須指向另一個看得見它的讀法。</li>
                  <li><b>當事人在單一讀法下看不見自己的盲區</b>；盲區要靠第二個讀法才暴露。</li>
                  <li><b>只有一個讀法時，標「單一讀法，盲區未驗」</b>；某題在所有讀法下都貴，是「缺讀法」的徵兆。</li>
                  <li><b>讀法之間要有「橋」</b>：互通、單向、限定範圍、走不通，四選一；沒查過標 <code className="font-mono">[未查]</code>。</li>
                  <li><b>讀法服務 APPLY</b>：每個分支標明用哪個讀法 <code className="font-mono">[源:WHAT-讀法n]</code>；沒被任何分支用到的讀法標「僅理解用」。</li>
                  <li><b>視角和讀法是兩條獨立的軸</b>：視角問「有沒有第二個對象、結構貼不貼」，讀法問「有沒有題變容易」。</li>
                </ol>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: 附錄 C 四種橋 & 平均數範例 ==================== */}
          {tab === "appendixC" && (
            <div className="space-y-5">
              {/* 四種橋的典型例子 */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="font-bold text-slate-900 text-sm">
                  附錄 C 第一部分：四種「橋」的標準範例
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white border border-emerald-200 space-y-1">
                    <div className="font-bold text-emerald-900">1. 【互通】（雙向推導）</div>
                    <p className="text-slate-700">
                      <b>例子：算術平均數的三個讀法</b>（<MathText text="讀法1 總和÷個數 $\bar{x}=\frac{1}{n}\sum x_i$ ↔ 讀法2 偏差相消 $\sum(x_i-\bar{x})=0$ ↔ 讀法3 削峰填谷拉平 $n\bar{x}=\sum x_i$" />）。在實數上無條件雙向互推。
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-blue-200 space-y-1">
                    <div className="font-bold text-blue-900">2. 【單向】（推導＋反方向反例）</div>
                    <p className="text-slate-700">
                      <b>例子：連續函數 vs 介值性質（中間值性質）</b>。<br />
                      • 推導：連續 ⇒ 必滿足中間值性質（介值定理）。<br />
                      • 反方向反例：<MathText text="$f(x)=\sin(1/x)$（$x\neq 0$）、$f(0)=0$" /> 在包含 0 的區間滿足中間值性質，但在 $x=0$ 不連續！
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-amber-200 space-y-1">
                    <div className="font-bold text-amber-900">3. 【限定範圍】（推導＋範圍條件＋範圍外反例）</div>
                    <p className="text-slate-700">
                      <b>例子：質數的兩個讀法</b>——讀法1「不可約：拆不下去」vs 讀法2「<MathText text="素元：$p\mid ab \Rightarrow p\mid a$ 或 $p\mid b$" />（歐幾里得引理）」。<br />
                      • 範圍條件：在整數環 <MathText text="$\mathbb{Z}$" />（唯一分解整環 UFD）上兩者互通。<br />
                      • 範圍外反例：擴張到 <MathText text="$\mathbb{Z}[\sqrt{-5}]$" /> 時，2 拆不下去（滿足讀法1），但 <MathText text="$2 \mid (1+\sqrt{-5})(1-\sqrt{-5})=6$" /> 卻不整除任一因子（不滿足讀法2）！
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-rose-200 space-y-1">
                    <div className="font-bold text-rose-900">4. 【走不通】（理由＋[已證無橋] 或 [未找到橋]）</div>
                    <p className="text-slate-700">
                      <b>例子：費馬方程 <MathText text="$x^n+y^n=z^n$" /></b>。<br />
                      • <MathText text="$n=2$ 時有「單位圓有理點參數化／勾股數」讀法；但 $n\ge 3$ 時虧格 $g\ge 1$，不存在有理參數化" /> <code className="font-mono font-bold text-rose-700">[已證無橋]</code>，必須改走橢圓曲線與模形式（Wiles 證明）。
                    </p>
                  </div>
                </div>
              </div>

              {/* 附錄 C 第二部分：平均數完整範例 */}
              <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sky-950 text-sm">
                      附錄 C 第二部分：「平均數」WHAT 完整範例（已內建為工作區卡片）
                    </div>
                    <p className="text-[11px] text-slate-600">
                      本工作區已將附錄 C 的《算術平均數》與其「造」出的《方差》建為完整可互動卡片，並附有雙向對齊的 [衍生] ↔ [前提] 關係邊。
                    </p>
                  </div>
                  {onOpenCardById && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onClose();
                          onOpenCardById("card-arithmetic-mean");
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        打開《算術平均數》範例卡
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onOpenCardById("card-variance");
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        打開衍生卡《方差》
                      </button>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-white border border-sky-200 space-y-2">
                  <div className="font-bold text-slate-900">三個讀法：</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li><b>讀法1：總和÷個數</b>（<MathText text="$\bar{x} = \frac{1}{n}\sum x_i$" />）</li>
                    <li><b>讀法2：各數偏差正負相消的平衡點</b>（<MathText text="$\sum(x_i-\bar{x})=0$" />，可配視角：天平支點）</li>
                    <li><b>讀法3：削峰填谷拉平後的高度</b>（<MathText text="$n\bar{x} = \sum x_i$" /> 總和守恆）</li>
                  </ul>
                  <div className="font-bold text-slate-900 pt-1">第 6 方向「造」示範（從平均數造出方差）：</div>
                  <p className="text-slate-700">
                    用平均數當基準，可以造出「<b>方差</b>」來量一組數有多分散：<MathText text="$\sigma^2 = \frac{1}{n}\sum(x_i-\bar{x})^2$" />。<br />
                    • <b>① 選了什麼</b>：每個數離平均數有正有負，直接加會相消（讀法2）。為了不讓正負抵消，<b>選了「平方」</b>。<br />
                    • <b>② 換一個選擇會怎樣</b>：選「絕對值」<MathText text="$\frac{1}{n}\sum|x_i-\bar{x}|$" />（平均絕對偏差）——對極端值沒那麼敏感，但不可微、展開不漂亮，中心也會變成中位數。<br />
                    • <b>③ 連回對象</b>：為什麼方差裡減的是 <MathText text="$\bar{x}$" /> 而不是別的數？因為 <MathText text="$\bar{x}$" /> 剛好是讓 <MathText text="$\sum(x_i-c)^2$" /> 最小的那個 $c$（見推淺：<MathText text="$\sum(x_i-c)^2 = \sum(x_i-\bar{x})^2 + n(\bar{x}-c)^2$" />）。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: 附錄 D 尚未解決的問題 ==================== */}
          {tab === "appendixD" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <div className="font-bold text-sm mb-1">
                  附錄 D：尚未解決的問題（v7 誠實列出的 5 項開放方法論議題）
                </div>
                <p className="text-[11px]">
                  手冊 v7 不假裝所有邊界都已完美封閉，而是將實作中發現的 5 個邊界張力顯式列出供持續迭代：
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-slate-300 bg-white text-xs">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2.5 border border-slate-300 text-left w-12">#</th>
                      <th className="p-2.5 border border-slate-300 text-left w-48">問題</th>
                      <th className="p-2.5 border border-slate-300 text-left">卡在哪裡（v6 vs v7 現況與張力）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold">1</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-slate-900">視角 vs 翻譯的邊界</td>
                      <td className="p-2.5 border border-slate-300">
                        v7 把視角定義為「第二個具體對象，結構完整貼合」、翻譯定義為「結構不完全貼合」；但 v6 把翻譯定義為「用本知識點的語言講外部現象（對外部現象的理解變多）」。兩版對「翻譯」的定義不同，尚未統一（例：質心與平均數是同一個式子換名字，算視角還是翻譯？）。
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold">2</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-slate-900">找新讀法沒有機械方法</td>
                      <td className="p-2.5 border border-slate-300">
                        「某題在所有讀法下都貴」只能事後提醒「這裡缺讀法」，但還沒給出「怎麼主動找到新讀法」的可操作步驟；目前只有三個被動信號（全欄都貴、卡關、做錯題）。
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold">3</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-slate-900">橋的「限定範圍」在卡片上怎麼標最清楚</td>
                      <td className="p-2.5 border border-slate-300">
                        當兩個讀法只在某個範圍內互通（如質數的兩種讀法在 <MathText text="$\mathbb{Z}$" /> 上等價、在 <MathText text="$\mathbb{Z}[\sqrt{-5}]$" /> 上不等價），這個範圍條件該只寫在橋那欄，還是也要同步進 APPLY 的 CHECK？目前還沒規定。
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold">4</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-slate-900">「造」的粒度邊界</td>
                      <td className="p-2.5 border border-slate-300">
                        什麼時候「造出來的東西」該留在本卡的「造」那一欄（寫三行），什麼時候該獨立開一張新卡並畫 <code className="font-mono font-bold text-teal-800">[衍生]</code> 邊？目前靠「它自己有沒有讀法／WHY」判斷，但邊界案例還沒測過。
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 border border-slate-300 font-mono font-bold">5</td>
                      <td className="p-2.5 border border-slate-300 font-bold text-slate-900">跨卡的讀法關係</td>
                      <td className="p-2.5 border border-slate-300">
                        有些「讀法切換」其實跨了兩張卡（例如微積分基本定理把「導數」和「面積」連起來；指數和對數互為逆讀法）。這算一張卡內的橋，還是兩張卡之間的某種新關係邊？目前關係邊只有 <code className="font-mono">[前提]</code>、<code className="font-mono">[衍生]</code>、<code className="font-mono">[結構類比]</code> 等，還沒處理這種情況。
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span className="text-[11px] text-slate-500">
            理科筆記 · 使用手冊（樹狀圖版 · v7 修正）—— 可隨時於卡片預覽或編輯器檢驗各項機械規則
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            關閉手冊
          </button>
        </div>
      </div>
    </div>
  );
};
