// 本檔由資料庫種子資料自動轉出（純前端靜態資料，不使用資料庫）
// eslint-disable-next-line @typescript-eslint/no-explicit-any

export const SEED_WORKSPACE = {
  "id": "default-scinotes-workspace",
  "name": "理科核心原理與知識圖譜工作台",
  "description": "理科知識筆記系統：涵蓋 WHAT/WHY/HOW/WHEN/ORIGIN、認識論地位、推理形狀、過程日志與認知診斷。",
  "settings": {
    "gridSize": 20,
    "showGrid": true,
    "snapToGrid": true,
    "snapToObjects": true,
    "zoom": 0.9,
    "panX": 40,
    "panY": 30,
    "theme": "light"
  }
};

export const SEED_CARDS: any[] = [
  {
    "id": "card-thermo-carnot",
    "workspaceId": "default-scinotes-workspace",
    "title": "熱力學第二定律與卡諾定理",
    "domain": "物理 / 熱力學與統計物理",
    "granularity": "L1 核心原理",
    "backgroundDescription": "工業革命後蒸汽機效率之爭的收束點。本卡處於「宏觀唯象熱力學」框架，位於熱力學第一定律（能量守恆）之後、熵狀態函數與統計力學之前，是連接工程實務與熵概念的樞紐節點。",
    "cardFont": "caveat",
    "pageMode": "paged",
    "constructionThinking": "蒸汽機效率上限當時無人能答，工程界各說各話。切入點不是在「工質是什麼、衝程怎麼排」這些直覺狀態上打轉，而是問：『如果存在一台效率超過可逆極限的機器，能不能用它造出違反熱二律的複合裝置？』——這個反證法的切入角度，把『求極值』問題轉化為『檢驗一致性』問題，才是整套推導真正的契機。",
    "thoughtPoints": [
      {
        "id": "tp-carnot-1",
        "modeName": "反證法起手式",
        "question": "為什麼不直接求極值，而要先假設超卡諾機存在？",
        "answer": "因為熱機效率的解析式尚未建立，無法直接求導。但我們已經有熱二律的兩個等價表述（克勞修斯、開爾文），可以檢驗『如果存在超極限會發生什麼』——把存在性問題轉化為一致性問題。這是典型的『先假後證』策略。",
        "passed": true,
        "note": "最初混淆了『求極值』與『檢驗一致性』兩種思路，經提示才意識到後者不依賴解析式。",
        "createdAt": "2024-03-15",
        "placement": "construction"
      },
      {
        "id": "tp-carnot-2",
        "modeName": "複合裝置構造法",
        "question": "為什麼要把超卡諾機和逆向可逆機串聯？",
        "answer": "單獨一台超卡諾機只違反開爾文表述（熱完全轉功），但要把這個違反升級到克勞修斯表述（熱量自發從低溫流向高溫），必須讓它輸出的功去驅動一台逆向機——把兩臺機器的『違規效果』疊加，才能看出複合系統的單一效果直接撞克勞修斯。這是『構造反例』的典型套路。",
        "passed": false,
        "createdAt": "2024-03-18",
        "placement": "why"
      }
    ],
    "reasoningShape": "A",
    "shapeRationale": "本知識點依據克勞修斯表述與開爾文表述之等價性，透過反證法構造可逆逆向機，形成嚴密的連鎖推導鏈條。",
    "shapeConfidence": 92,
    "shapeAccepted": true,
    "whatData": {
      "summary": "工作於兩恆溫熱庫之間的所有可逆熱機具有相同效率，且該效率是這兩熱庫間一切熱機的理論上限，僅由兩熱庫溫度決定。",
      "readings": [
        {
          "id": "carnot-r1",
          "name": "讀法1：克勞修斯禁令（熱不自發爬坡）",
          "description": "熱量不可能自發由低溫物體傳給高溫物體而不產生其他變化（不耗外功就不能把熱往高溫搬）。",
          "linkedPerspective": "物理視角：熱流單向性"
        },
        {
          "id": "carnot-r2",
          "name": "讀法2：開爾文禁令（單一熱庫不白做功）",
          "description": "不可能從單一熱源吸熱使之完全變為有用功而不產生其他影響（只要做功就必排廢熱 $Q_C > 0$，效率 $\\eta = 1 - T_C/T_H < 1$）。",
          "linkedPerspective": "代數視角：卡諾極限效率"
        },
        {
          "id": "carnot-r3",
          "name": "讀法3：孤立系總熵單調不減（$\\Delta S_{\\text{univ}} \\ge 0$）",
          "description": "任何熱力學過程必滿足 $\\Delta S_{\\text{sys}} + \\Delta S_{\\text{env}} = -\\frac{Q_H}{T_H} + \\frac{Q_C}{T_C} \\ge 0$，可逆時取等號。",
          "linkedPerspective": "幾何視角：T-S 圖面積與熵收支"
        }
      ],
      "readingQuestions": [
        {
          "id": "carnot-rq1",
          "question": "冷氣機／冰箱不插電能不能自己把室內熱量排到室外？",
          "cells": {
            "carnot-r1": { "text": "一步：這就是克勞修斯禁令本身，直接判不可能", "isCheapest": true },
            "carnot-r2": { "text": "要先構造一台熱機跟它複合才能看出矛盾，兩步" },
            "carnot-r3": { "text": "算 $\\Delta S = Q(1/T_H - 1/T_C) < 0$ 違規，兩步" }
          }
        },
        {
          "id": "carnot-rq2",
          "question": "船在海裡能不能直接抽海水降溫發電（第二類永動機）？",
          "cells": {
            "carnot-r1": { "text": "只涉及一個熱庫（海水），看不見高低溫熱流方向（見讀法2）", "isInvisible": true, "pointsToReadingId": "carnot-r2" },
            "carnot-r2": { "text": "一步：單一熱源完全轉功，開爾文禁令直接判死刑", "isCheapest": true },
            "carnot-r3": { "text": "海水放熱 $\\Delta S = -Q/T < 0$ 違反總熵不減，一步半" }
          }
        },
        {
          "id": "carnot-rq3",
          "question": "已知 $T_H=600\\text{K}, T_C=300\\text{K}$，吸熱 $100\\text{J}$ 最多能輸出多少功？",
          "cells": {
            "carnot-r1": { "text": "只有定性禁令，看不見定量上界公式（見讀法3）", "isInvisible": true, "pointsToReadingId": "carnot-r3" },
            "carnot-r2": { "text": "一步：代 $\\eta_{\\max} = 1 - 300/600 = 50\\%$，最多 $50\\text{J}$", "isCheapest": true },
            "carnot-r3": { "text": "一步：由 $Q_C/300 \\ge 100/600 \\Rightarrow Q_C \\ge 50\\text{J}$，故 $W \\le 50\\text{J}$", "isCheapest": true }
          }
        }
      ],
      "readingBridges": [
        {
          "id": "carnot-b12",
          "fromReadingId": "carnot-r1",
          "toReadingId": "carnot-r2",
          "type": "互通",
          "forwardProof": "若違反讀法2（存在單熱源全轉功機器 $W=Q_H$），用 $W$ 去驅動逆向冷機，複合機即可不耗外功把熱從低溫搬到高溫，違反讀法1；反之得證。",
          "backwardProof": "若違反讀法1（熱量 $Q_0$ 自發由 $T_C$ 流向 $T_H$），讓卡諾機從 $T_H$ 吸熱 $Q_0$ 並向 $T_C$ 排熱 $Q_0$，則低溫熱庫淨熱變為 0，複合機實現從單一熱源 $T_H$ 吸熱全轉為功，違反讀法2。"
        },
        {
          "id": "carnot-b23",
          "fromReadingId": "carnot-r2",
          "toReadingId": "carnot-r3",
          "type": "互通",
          "forwardProof": "由卡諾定理鎖定可逆機 $Q_C/Q_H = T_C/T_H$，不可逆機 $\\eta \\le 1 - T_C/T_H$ 移項即得 $\\Delta S_{\\text{univ}} = Q_C/T_C - Q_H/T_H \\ge 0$。",
          "backwardProof": "由 $\\Delta S_{\\text{univ}} = Q_C/T_C - Q_H/T_H \\ge 0$ 與第一定律 $W = Q_H - Q_C$，直接消去 $Q_C$ 得 $W/Q_H \\le 1 - T_C/T_H < 1$。"
        },
        {
          "id": "carnot-b13",
          "fromReadingId": "carnot-r1",
          "toReadingId": "carnot-r3",
          "type": "互通",
          "forwardProof": "由讀法1 ↔ 讀法2 互通且讀法2 ↔ 讀法3 互通，傳遞可得讀法1 推出 $\\Delta S_{\\text{univ}} \\ge 0$。",
          "backwardProof": "純導熱無功時 $W=0$，$\\Delta S_{\\text{univ}} = Q(1/T_{\\text{to}} - 1/T_{\\text{from}}) \\ge 0$ 迫使 $T_{\\text{from}} \\ge T_{\\text{to}}$，即熱不自發爬坡。"
        }
      ],
      "perspectives": [
        {
          "code": "代數視角",
          "label": "代數定義（熵收支不等式）",
          "content": "卡諾極限效率 $\\eta = 1 - \\frac{T_C}{T_H}$，由可逆循環熵積分為零 $\\oint \\frac{\\delta Q_{rev}}{T} = 0$ 保證。",
          "mappingTable": "吸熱 $Q_H$ ↔ 熵流入 $Q_H/T_H$；排熱 $Q_C$ ↔ 熵流出 $Q_C/T_C$；可逆循環 ↔ 熵收支剛好平衡 $Q_C/T_C = Q_H/T_H$",
          "derivedFact": "即使沒有任何摩擦，為了把流入的熵 $Q_H/T_H$ 排進低溫庫 $T_C$，至少必須丟棄 $Q_C = Q_H(T_C/T_H)$ 的廢熱。",
          "isAlsoReading": true,
          "linkedReadingId": "carnot-r3"
        },
        {
          "code": "幾何視角",
          "label": "T-S 圖矩形面積",
          "content": "T-S 圖上的可逆卡諾循環是一個長方形：高為 $(T_H - T_C)$、寬為 $\\Delta S$，圍成的面積即為對外輸出淨功 $W = (T_H - T_C)\\Delta S$。",
          "mappingTable": "T-S 圖長方形上底面積 $T_H\\Delta S$ ↔ 吸熱 $Q_H$；下底面積 $T_C\\Delta S$ ↔ 排熱 $Q_C$；中間夾層面積 $(T_H-T_C)\\Delta S$ ↔ 淨功 $W$",
          "derivedFact": "一眼看出效率就是兩個矩形面積比 $\\frac{(T_H-T_C)\\Delta S}{T_H\\Delta S} = 1 - \\frac{T_C}{T_H}$，連積分都不用算。"
        },
        {
          "code": "[借鏡視角:水輪機重力位能落差]",
          "label": "借鏡視角：水輪機跨水位做功",
          "kind": "mirror",
          "content": "借用重力場中水輪機由高水位 $h_H$ 向低水位 $h_C$ 落水做功的結構：能提取的最大功取決於「落差比例」$(h_H - h_C)/h_H$，未落到絕對基準面 $h=0$ 的水仍攜帶位能排入下游。",
          "mappingTable": "高水位 $h_H$ ↔ 高溫熱庫 $T_H$；低水位 $h_C$ ↔ 低溫熱庫 $T_C$；基準地面 $h=0$ ↔ 絕對零度 $0\\text{K}$；通過水輪機守恆的水量 ↔ 可逆傳遞的熵 $\\Delta S$",
          "derivedFact": "可逆過程守恆的是「熵 $\\Delta S$」（對應水量）而非熱量 $Q$（對應總位能 $mgh$）——這同時解釋了卡諾當年為何誤把熵當成守恆的「熱質」，以及為何落差 $T_H - T_C$ 乘上守恆量 $\\Delta S$ 就是最大有用功。"
        }
      ],
      "distinctionFromHow": "WHAT 闡明可逆熱機效率上限的必然約束本質；HOW 則是實際構建等溫-絕熱循環並計算各衝程狀態積分的工程執行步驟。",
      "extensions": {
        "deeper": "奠基在「熱二律的兩種表述等價」之上，而熱二律本身又是對大量宏觀經驗的歸納（[地位:歸納]）；再往下是統計力學的微觀狀態數趨向極大。",
        "shallower": "撐起熵作為狀態函數的定義（$dS=\\delta Q_{rev}/T$）、所有熱機／冷機／熱泵的性能上界，以及「不可逆度」的定量刻畫。",
        "generalize": "放寬「兩個恆溫熱庫」→ 多熱庫或連續變溫熱源時，效率上界改由 Clausius 不等式 $\\oint \\delta Q/T\\le 0$ 給出。",
        "specialize": "收緊到 $T_C\\to 0$：效率趨近 1 但第三定律禁止到達絕對零度，故 100% 效率不可能；收緊到 $T_H=T_C$：效率為 0，恆溫熱庫不能作功。",
        "translate": "用卡諾語言講「為什麼冰箱要插電」：冰箱是逆向卡諾機，把熱從低溫（箱內）搬到高溫（廚房）本身違反自發方向，所以必須輸入功 $W$；能搬多少熱有上界 $\\text{COP}\\le T_C/(T_H-T_C)$，冬天廚房越熱、越耗電——這句家電常識就是卡諾定理倒過來念。",
        "construct": "用卡諾極限效率當基準，可以造出「可用能（Exergy／㶲）」$B = Q(1 - T_0/T)$ 來度量一團熱量裡真正能轉成機械功的品質份額。",
        "constructDetails": {
          "name": "可用能（Exergy／㶲）$B = Q(1 - T_0/T)$",
          "choice": "選了「環境基準溫度 $T_0$」作為最低排熱死態（Dead State），把能轉成可逆功的那部分能量單獨定義為新狀態量。",
          "alternative": "若不乘卡諾折減因子 $(1 - T_0/T)$ 而直接看熱量 $Q$（即熱力學第一定律的焓差），則 $100^\\circ\\text{C}$ 的 $1\\text{MJ}$ 熱水與 $1000^\\circ\\text{C}$ 的 $1\\text{MJ}$ 蒸汽看似等值，完全看不出作功能力的天壤之別。",
          "linkBack": "連回對象：對溫度 $T$ 的熱源吸熱 $Q$ 接在環境 $T_0$ 跑一台可逆卡諾機，最大輸出功恰好就是 $W_{\\max} = \\eta_{\\text{Carnot}} Q = Q(1 - T_0/T)$。"
        },
        "questions": {
          "deeper": "為什麼卡諾定理不能純靠數學公理證出來，而必須依賴克勞修斯或開爾文這類經驗歸納起點？",
          "shallower": "為什麼 $\\delta Q_{\\text{rev}}$ 本身不是狀態函數的全微分，除以絕對溫度 $T$ 後的 $\\delta Q_{\\text{rev}}/T$ 卻突然變成路徑無關的狀態函數 $dS$？",
          "generalize": "當熱機與三個熱庫（$T_1, T_2, T_3$）交換熱量 $Q_1, Q_2, Q_3$ 完成循環時，如何不靠單一 $1-T_C/T_H$ 判斷該循環是否可能存在？",
          "specialize": "如果外太空有一個溫度恆定在 $300\\text{K}$ 的巨大單一熱源，沒有更冷的熱沉，這台熱機能輸出多少淨功？",
          "translate": "室內 $27^\\circ\\text{C}$（$300\\text{K}$）、冰箱冷凍室 $-23^\\circ\\text{C}$（$250\\text{K}$），要從冷凍室抽走 $500\\text{J}$ 熱量，至少要耗電多少焦耳？",
          "construct": "同為 $1000\\text{J}$ 的熱量，存在 $600\\text{K}$ 熱庫與存在 $400\\text{K}$ 熱庫（環境 $T_0=300\\text{K}$），兩者的最大可作功能力（㶲）差多少焦耳？"
        }
      }
    },
    "whyData": {
      "confidenceBefore": 3,
      "closedBookDraft": "若存在超卡諾熱機，其驅動反向卡諾機將把低溫熱庫熱量在無外界額外功輸入下抽往高溫熱庫，違反克勞修斯表述。",
      "fullReasoning": "設存在超卡諾機 $E'$ 使 $\\eta' > \\eta$。令 $E'$ 輸出功 $W$ 全額驅動逆向可逆卡諾熱機 $R$。因 $W = \\eta' Q'_H = \\eta Q_H$ 且 $\\eta' > \\eta$，必有 $Q'_H < Q_H$。考察複合系統（熱庫指熱容量極大、吸放熱時自身溫度不变的環境），高溫熱庫淨得熱 $Q_H - Q'_H > 0$，低溫熱庫淨放熱 $Q_C - Q'_C = (Q_H - W) - (Q'_H - W) = Q_H - Q'_H > 0$。此複合裝置在無任何外界功介入下，達成熱量由低溫自發流向高溫之單一效果，直接違反克勞修斯表述（heat 不可能自發由低溫物體傳給高溫物體而不產生其他變化）。故反證假設不成立，必然有 $\\eta' \\le \\eta$。",
      "confidenceAfter": 5,
      "perspective1": {
        "name": "反證法唯象熱力學約束",
        "failureMode": "無法給出微觀粒子分子運動與能階躍遷的時間演化動力學細節",
        "content": "反向聯動複合機破壞熱量流動方向性公設。"
      },
      "perspective2": {
        "name": "統計物理微觀相空間擴散",
        "failureMode": "在小體系或短時間尺度可能觀測到短暫微觀漲落",
        "content": "隔離系統微觀狀態數 $\\Omega$ 必然隨自發演化趨向最大值，宏觀玻爾茲曼熵 $S = k_B \\ln \\Omega$ 恆增。"
      },
      "subGoals": [
        {
          "id": "sg1",
          "goal": "證明同溫可逆機效率必相等",
          "requiredParts": [
            "正向機作功帶動逆向機",
            "互換正逆角色兩次反證"
          ],
          "whyNecessary": "若兩可逆機效率不等，較高者即可反轉另一台構造出違規永動機",
          "whySufficient": "兩次反證分別得出 $\\eta_1 \\le \\eta_2$ 與 $\\eta_2 \\le \\eta_1$，代數嚴格鎖定 $\\eta_1 = \\eta_2$"
        }
      ]
    },
    "assumptions": [
      {
        "id": "a1",
        "name": "兩熱庫溫度恆定且熱容無限大",
        "status": "locked",
        "description": "熱庫吸熱或放熱過程中自身溫度不發生可測變化"
      },
      {
        "id": "a2",
        "name": "循環過程為理想準靜態可逆",
        "status": "locked",
        "description": "無機械摩擦、無接觸熱阻溫差、無耗散擾動"
      }
    ],
    "claims": [
      {
        "id": "c1",
        "text": "所有可逆卡諾熱機效率僅取決於兩熱庫絕對溫度 $\\eta = 1 - T_C/T_H$",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY子目標1（雙重反證）]"
      },
      {
        "id": "c2",
        "text": "實際工程熱機熱效率必然嚴格小於卡諾極限",
        "epistemicMark": "⊢歸",
        "frameworkNote": "由工程耗散與摩擦力學之實驗總結",
        "anchor": "[見WHY視角1（唯象約束）]"
      },
      {
        "id": "c3",
        "text": "工質為理想氣體下的狀態方程 $PV = nRT$",
        "epistemicMark": "⊢近",
        "frameworkNote": "低壓稀薄氣體近似框架"
      }
    ],
    "intuitionTraps": [
      {
        "id": "it1",
        "description": "看到「效率 = 1 - T_C/T_H」總是正的，會誤以為溫度越高效率越接近 1",
        "whyMisleading": "直覺上會覺得『熱源更熱 → 效率更高』是線性關係，但實際上趨近上限很慢。當 $T_C = 273K, T_H = 373K$ 時 $\\eta \\approx 26\\%$，遠低於想像的 90%+。",
        "correctUnderstanding": "溫度比（而非溫度絕對差）才決定效率，必須用絕對溫標計算比值 $\\frac{T_C}{T_H}$。",
        "passed": true
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "carnot-chk-1",
          "cue": "看到「循環熱機」「理論最大效率」「冷熱源溫差」",
          "check": "檢查 溫標是否為絕對溫標，且是否誤把非可逆熱機套用卡諾公式",
          "source": "[源:定義]",
          "keywords": [
            "熱機",
            "卡諾效率",
            "絕對溫標"
          ]
        },
        {
          "id": "carnot-chk-2",
          "cue": "看到「號稱熱效率高達 80% 的常溫新型發動機」",
          "check": "檢查 $\\eta \\le 1 - T_{cold}/T_{hot}$ 是否被突破（若突破則必為偽科學永動機）",
          "source": "[源:WHAT-讀法2]",
          "keywords": [
            "反常熱機",
            "極限審查"
          ]
        }
      ],
      "branches": [
        {
          "id": "h1",
          "title": "確認高溫熱庫 $T_H$ 與低溫熱庫 $T_C$ 絕對數值",
          "action": "使用開爾文絕對溫標（K），嚴禁代入攝氏度（℃）",
          "source": "[源:定義]",
          "isCompiled": true
        },
        {
          "id": "h2",
          "title": "代入卡諾極限公式評估理論上界",
          "action": "$\\eta_{max} = 1 - \\frac{T_C}{T_H}$，界定任何熱機設計之天花板",
          "source": "[源:WHAT-讀法2]",
          "isCompiled": true
        },
        {
          "id": "h3",
          "title": "計算不可逆熵增耗散度與無外功熱流方向",
          "action": "評估 $\\Delta S_{univ} = \\Delta S_{sys} + \\Delta S_{env} \\ge 0$；若無外功輸入則由克勞修斯禁令直接判熱只由高溫流向低溫",
          "source": "[源:WHAT-讀法1][源:WHAT-讀法3]",
          "isCompiled": true
        }
      ],
      "can": [
        {
          "id": "carnot-can-1",
          "trigger": "看到任何熱機、冷機或熱泵的效能數字（含廣告宣稱）",
          "capability": "就能先寫出卡諾上界再估實際值，當場判斷「離物理極限還剩多少改善空間」與「這個宣稱可不可能」",
          "source": "[源:WHY-子目標1]"
        }
      ],
      "status": "compiled",
      "testNotes": "閉卷展開推導已通過驗證，各衝程功積分完備。",
      "boundaryNotes": "當熱庫熱容有限時，熱源溫度會隨排熱變化，需改用微分積分平均溫度。"
    },
    "originData": {
      "conflict": "↯ 19世紀蒸氣機改良陷入困境，工程界普遍爭論究竟何種工作介質（水蒸氣、空氣或乙醚）具有最高效率。卡諾跳脫工質細節，以思想實驗證明工質無關性與效率極限。"
    },
    "bloomLevel": "評鑑",
    "soloLevel": "關聯結構",
    "soloData": {
      "declaredLevel": "關聯結構",
      "evidence": [
        {
          "id": "se1",
          "level": "單點結構",
          "text": "能寫出 $\\eta = 1 - T_C/T_H$ 單一公式並代值計算。"
        },
        {
          "id": "se2",
          "level": "多點結構",
          "text": "能同時列出克勞修斯表述、開爾文表述、熵增判據三個獨立面向。"
        },
        {
          "id": "se3",
          "level": "關聯結構",
          "text": "能說明三個表述彼此等價，並用反證法把它們串成同一條推理鏈；且已與勒沙特列建立自由能凸性已驗證類比 ≈[1]。"
        }
      ],
      "autoSuggestedLevel": "關聯結構",
      "autoRationale": "此卡具 3 條關係邊（含 1 條已驗證類比 ≈、1 條推廣 ⊃），且屬於已成立母題，符合「關聯結構」門檻；尚未對跨領域新情境做出可證偽預測，故未達抽象拓展。",
      "accepted": true,
      "history": [
        {
          "at": "2024-03-02",
          "from": "多點結構",
          "to": "關聯結構",
          "reason": "完成與化學平衡自由能凸性的候選推理測試並驗證成功。"
        }
      ]
    },
    "blockageNotes": "曾因混淆攝氏溫標與開爾文溫標造成計算錯誤，已鎖定絕對溫標約束。",
    "thinkingPatterns": [
      {
        "id": "tp-lib-1",
        "modeName": "反證法起手式",
        "description": "遇到『要證明某件事不可能』或『要證明某事是唯一的』時，先不要直接證——反過來假設『車到了』，看它會導致什麼矛盾，這個矛盾就是反證。適用於：卡諾定理、哈密頓量不變、根號2無理性等『不可能性/唯一性』問題。",
        "occurrenceCount": 3,
        "sourceCardIds": [
          "card-thermo-carnot",
          "card-schrodinger-eq",
          "card-fourier-transform"
        ]
      },
      {
        "id": "tp-lib-2",
        "modeName": "退化情形排除",
        "description": "遇到『這個東西到底能不能存在』時，不要直接去想『怎麼構造它』，先去檢查『如果它存在，會不會導致退化情形（矛盾或毫無意義的結論）』。如果退化情形不成立，存在性就證明了。適用於：線性無關集合、特徵向量、可逆元素的存在性問題。",
        "occurrenceCount": 3,
        "sourceCardIds": [
          "card-fourier-transform",
          "card-thermo-carnot",
          "card-le-chatelier"
        ]
      },
      {
        "id": "tp-lib-3",
        "modeName": "離散-連續極限對照",
        "description": "遇到連續版本的概念時，退回去看對應的離散版本怎麼做。離散場合已有的技巧和恆等式，往往只要做一個量化極限（把求和變積分、把 Kronecker delta 變 Dirac delta），就能得到連續版的結果。適用於：傅立葉變換、離散傅立葉級數、積分換元等場合。",
        "occurrenceCount": 3,
        "sourceCardIds": [
          "card-fourier-transform",
          "card-schrodinger-eq",
          "card-thermo-carnot"
        ]
      }
    ],
    "constructionCalibration": {
      "confidenceBefore": 4,
      "confidenceAfter": 4
    },
    "backgroundData": {
      "situation": "蒸氣機在工業上已經常用，但工程師對「一台機器最多能把多少熱轉成有用功」一直沒有底：同樣的兩台熱機，換了工作介質（水蒸氣、空氣、乙醚）效率就差很多。情境二：同一台蒸氣機，接在高溫 800K、低溫 350K 的兩個熱庫上，與接在 400K、350K 上，效率天差地別——換的是「兩熱庫的溫度」這一個變數。",
      "preciseObject": "把熱機抽成「在兩個恆溫熱庫之間運作的循環裝置」，效率 $\\eta = W / Q_H$（$W$＝對外淨功，$Q_H$＝從高溫熱庫吸的熱）。先給形式：$\\eta \\le 1 - T_C/T_H$ 是這類機器效率的理論上界；這個式子想表達的念頭是「效率上限不由機器多巧妙決定，只由兩熱庫溫度決定」。",
      "preciseQuestion": "對這台具體的雙熱庫熱機，為什麼它的效率永遠不可能超過 $1 - T_C/T_H$ 這個數？是什麼約束把它卡死在這個上限？"
    },
    "candidate": {
      "requirement": "要證明「不可超過上限」，就需要一個能檢驗出違規的判據——如果存在超上限機器，它必須與某條公認不可違反的物理律衝突。",
      "candidateForm": "反證法起手式：假設存在超卡諾機，讓它去「開倒車」帶動一台逆向可逆熱機，組一台複合裝置。",
      "motivation": "為什麼偏偏是反證？因為效率的解析式尚未建立，直接求極值無從下手；但熱二律那兩條「不可能」表述（克勞修斯、開爾文）就是現成的、可機械檢驗的矛盾基準——把「求極值」問題反轉成「檢驗一致性」問題，才走得出這條路。"
    },
    "plan": {
      "steps": [
        {
          "id": "p1",
          "label": "證明兩可逆機效率必相等",
          "rationale": "這是先決條件：不先鎖死「可逆機效率只隨溫度」，後面「超卡諾機」就沒有乾淨的對照基準"
        },
        {
          "id": "p2",
          "label": "用反證法把超卡諾機與逆向機串成複合裝置",
          "rationale": "依賴第 1 步：要先有一個確定效率的可逆機，反證假設才有撞上去的對象"
        },
        {
          "id": "p3",
          "label": "證明複合裝置違反克勞修斯表述",
          "rationale": "第 2 步把複合裝置的淨效果算出來，這一步是唯一能下結論的關口；三步缺一不可"
        }
      ],
      "ranges": "「熱二律本身如何從微觀統計導出」超出本卡範圍，此處把熱二律當 [地位:公設(宏觀熱力學)] 使用（見 WHY 的認識論標記），需另開「統計力學導出熵」一卡。"
    }
  },
  {
    "id": "card-fourier-transform",
    "workspaceId": "default-scinotes-workspace",
    "title": "傅立葉變換與頻域正交分解",
    "domain": "數學 / 泛函分析與訊號處理",
    "granularity": "L2 定理/機制",
    "backgroundDescription": "位於「無窮維希爾伯特空間 $L^2(\\mathbb{R})$」框架下。前置背景為線性代數的正交基底與內積投影；本卡是把有限維正交分解推廣到連續譜的關鍵一步，下游支撐濾波、偏微分方程求解與量子力學表象變換。",
    "cardFont": "quicksand",
    "pageMode": "single",
    "constructionThinking": "真正的起點是一個具體困難：熱傳導方程的初始溫度分佈是任意的，而手上只有正弦解。問題於是變成——『任意初值如何分解為簡單諧波疊加？』切入點是把有限維內積投影 $c_k = \\langle f, e_k\\rangle$（這裡的內積就是『兩向量重疊程度』的加總 $\\langle f,e\\rangle=\\sum_i f_i e_i^*$）直接推廣到連續情形：把離散求和 $\\sum c_k e_k$ 寫成連續積分 $\\int \\hat{f}(\\omega) e^{i\\omega t} d\\omega$。關鍵跳步是：『無窮維下內積仍成立嗎？正交性如何推廣？』——答案是用 Dirac delta 取代 Kronecker delta，這一步把有限維的基底概念『自然延伸』到連續譜。此處必須說清楚：離散與連續指的是「可用來疊加的那組頻率本身」，而不是時間變數 t——t 從頭到尾都是連續的；週期訊號的頻率只能取離散值，非週期訊號的頻率可以連續取值，這才是差別所在。此處必須說清楚：離散與連續指的是「可用來疊加的那組頻率本身」，而不是時間變數 t——t 從頭到尾都是連續的；週期訊號的頻率只能取離散值，非週期訊號的頻率可以連續取值，這才是差別所在（鋼琴鍵之類的比喻只能在此之後當輔助，不能取代這句話）。",
    "thoughtPoints": [
      {
        "id": "tp-fourier-1",
        "modeName": "離散-連續極限對照",
        "question": "離散求和怎麼過渡到連續積分？為什麼 $c_k$ 變成 $\\hat{f}(\\omega)$ 時還要除以 $2\\pi$？",
        "answer": "把週期 $T\\to\\infty$ 看：離散頻間隔 $\\Delta\\omega = 2\\pi/T \\to 0$，求和 $\\sum$ 變成 $\\frac{T}{2\\pi}\\int d\\omega$。係數 $c_k$ 在極限下變成 $\\hat{f}(\\omega)\\cdot\\Delta\\omega$，所以逆变换公式裡自然出現 $\\frac{1}{2\\pi}$。這個歸一化常數不是人爲約定，是極限過程的副產品。",
        "passed": true,
        "note": "最初誤以為 $\\frac{1}{2\\pi}$ 是『對稱化約定』，後來追到週期極限才發現是物理量綱導出的。",
        "createdAt": "2024-02-20",
        "placement": "construction"
      }
    ],
    "reasoningShape": "E",
    "shapeRationale": "本質是無窮維希爾伯特空間 $L^2$ 中選取連續複指數函數族作為正交基底之自同態投影定義與坐標變換。",
    "shapeConfidence": 94,
    "shapeAccepted": true,
    "whatData": {
      "summary": "將時域/空間域訊號分解為連續複指數正交基函數 $e^{i\\omega t}$ 之連續線性權重疊加，建立時頻雙射投影。",
      "readings": [
        {
          "id": "fourier-r1",
          "name": "讀法1：連續頻譜分析與合成（正反積分對）",
          "description": "正變換 $\\hat{f}(\\omega) = \\int f(t)e^{-i\\omega t}dt$ 挑出各頻率成分，逆變換 $f(t) = \\frac{1}{2\\pi}\\int \\hat{f}(\\omega)e^{i\\omega t}d\\omega$ 將諧波合成原訊號。",
          "linkedPerspective": "物理視角：物理波動"
        },
        {
          "id": "fourier-r2",
          "name": "讀法2：微分算子對角化器（$\\frac{d}{dt} \\leftrightarrow i\\omega$）",
          "description": "在頻域基底下，時域微分 $\\frac{d^n}{dt^n}$ 變為乘上代數因子 $(i\\omega)^n$，時域卷積 $f*g$ 變為頻域逐點相乘 $\\hat{f}(\\omega)\\hat{g}(\\omega)$。",
          "linkedPerspective": "算符視角：算符代數"
        },
        {
          "id": "fourier-r3",
          "name": "讀法3：希爾伯特空間等距正交投影（Plancherel 能量守恆）",
          "description": "$\\hat{f}(\\omega) = \\langle f, e^{i\\omega t}\\rangle$，時域總能量等於頻域總能量：$\\int |f(t)|^2 dt = \\frac{1}{2\\pi}\\int |\\hat{f}(\\omega)|^2 d\\omega$。",
          "linkedPerspective": "幾何視角：幾何投影"
        }
      ],
      "readingQuestions": [
        {
          "id": "fourier-rq1",
          "question": "給你方波或高斯脈衝 $f(t)$，求它包含哪些頻率成分？",
          "cells": {
            "fourier-r1": { "text": "一步：直接代正變換積分公式算 $\\hat{f}(\\omega)$", "isCheapest": true },
            "fourier-r2": { "text": "可藉微分性質輔助，但仍需回讀法1定常數，兩步" },
            "fourier-r3": { "text": "只知總能量守恆，看不見單一頻率相位與振幅（見讀法1）", "isInvisible": true, "pointsToReadingId": "fourier-r1" }
          }
        },
        {
          "id": "fourier-rq2",
          "question": "解常係數線性微分方程 $y'' + 3y' + 2y = g(t)$？",
          "cells": {
            "fourier-r1": { "text": "硬代積分號進微分方程並交換次序，三步且繞" },
            "fourier-r2": { "text": "一步：直接換成 $[(-\\omega^2)+3(i\\omega)+2]\\hat{y} = \\hat{g}$，除法解出 $\\hat{y}$", "isCheapest": true },
            "fourier-r3": { "text": "看不見微分算子如何變代數乘法（見讀法2）", "isInvisible": true, "pointsToReadingId": "fourier-r2" }
          }
        },
        {
          "id": "fourier-rq3",
          "question": "求積分 $\\int_{-\\infty}^{\\infty} \\left(\\frac{\\sin t}{t}\\right)^2 dt$ 的精確值？",
          "cells": {
            "fourier-r1": { "text": "直接對 $\\sin^2 t / t^2$ 做實變或留數積分，繁瑣三步" },
            "fourier-r2": { "text": "無微分方程可對角化，看不見捷徑（見讀法3）", "isInvisible": true, "pointsToReadingId": "fourier-r3" },
            "fourier-r3": { "text": "一步：$\\text{sinc}$ 的頻譜是方波，算矩形面積即得 $\\pi$", "isCheapest": true }
          }
        }
      ],
      "readingBridges": [
        {
          "id": "fourier-b12",
          "fromReadingId": "fourier-r1",
          "toReadingId": "fourier-r2",
          "type": "互通",
          "forwardProof": "對讀法1 正變換 $\\int f'(t)e^{-i\\omega t}dt$ 分部積分（邊界項歸零）即得 $(i\\omega)\\hat{f}(\\omega)$（讀法2）。",
          "backwardProof": "由讀法2 平移生成元關係 $e^{i\\omega \\tau}$ 為時移算子本徵值，對衝激分解 $f(t)=\\int f(\\tau)\\delta(t-\\tau)d\\tau$ 作用即還原讀法1 積分對。"
        },
        {
          "id": "fourier-b13",
          "fromReadingId": "fourier-r1",
          "toReadingId": "fourier-r3",
          "type": "互通",
          "forwardProof": "將讀法1 逆變換代入 $\\int f(t)f^*(t)dt$，交換積分次序即得讀法3 的 Plancherel 等距式。",
          "backwardProof": "由讀法3 極化恆等式（Polarization Identity）$\\langle f, g\\rangle = \\frac{1}{2\\pi}\\langle \\hat{f}, \\hat{g}\\rangle$，取 $g$ 為頻域局部化序列即可還原讀法1 逆變換。"
        },
        {
          "id": "fourier-b23",
          "fromReadingId": "fourier-r2",
          "toReadingId": "fourier-r3",
          "type": "互通",
          "forwardProof": "讀法2 中對稱算子 $-i\\frac{d}{dt}$ 在頻域為實數乘法 $\\omega$，由譜定理保證特徵基底正交且保持內積範數（讀法3）。",
          "backwardProof": "讀法3 的平移等距正交基底必然將平移群生成元 $\\frac{d}{dt}$ 對角化為純虛數乘法 $i\\omega$（讀法2）。"
        }
      ],
      "perspectives": [
        {
          "code": "算符視角",
          "label": "算符代數（LTI 共同特徵基底）",
          "content": "微分算子 $\\frac{d}{dt}$ 的連續譜特徵函數展開，將微分運算簡化為頻域代數相乘。",
          "mappingTable": "微分算子 $\\frac{d}{dt}$ ↔ 頻域乘子 $i\\omega$；時移算子 $T_\\tau$ ↔ 相位因子 $e^{-i\\omega\\tau}$；時域卷積 $h*x$ ↔ 頻域傳遞函數相乘 $H(\\omega)X(\\omega)$",
          "derivedFact": "任何常係數線性微分方程 $\\sum a_k D^k y = x(t)$ 在頻域必定退化為多項式代數方程 $(\\sum a_k (i\\omega)^k)\\hat{y}(\\omega) = \\hat{x}(\\omega)$。",
          "isAlsoReading": true,
          "linkedReadingId": "fourier-r2"
        },
        {
          "code": "幾何視角",
          "label": "幾何投影（希爾伯特正交變換）",
          "content": "希爾伯特空間 $L^2(\\mathbb{R})$ 中的基底正交變換：$\\hat{f}(\\omega) = \\langle f, e^{i\\omega t} \\rangle$。",
          "mappingTable": "訊號 $f(t)$ ↔ 向量 $\\mathbf{v}$；基函數 $e^{i\\omega t}$ ↔ 正交單位基 $\\mathbf{e}_\\omega$；頻譜 $\\hat{f}(\\omega)$ ↔ 投影座標 $\\langle \\mathbf{v}, \\mathbf{e}_\\omega\\rangle$；Parseval 等式 ↔ 畢氏定理 $\\|\\mathbf{v}\\|^2 = \\sum |v_k|^2$",
          "derivedFact": "正交基底旋轉不改變向量長度，故時域總能量 $\\int |f(t)|^2 dt$ 必然嚴格等於頻域總能量 $\\frac{1}{2\\pi}\\int |\\hat{f}(\\omega)|^2 d\\omega$。",
          "isAlsoReading": true,
          "linkedReadingId": "fourier-r3"
        },
        {
          "code": "[借鏡視角:光學稜鏡色散與食譜拆解]",
          "label": "借鏡視角：光學稜鏡分光",
          "kind": "mirror",
          "content": "如同光學稜鏡將一道混色白光按折射率展開為各單一波長的空間光譜，再由逆向透鏡重新匯聚還原白光。",
          "mappingTable": "入射複合白光 $E(t)$ ↔ 時域訊號 $f(t)$；稜鏡分光角位置 $\\theta(\\omega)$ ↔ 頻率軸 $\\omega$；各色光振幅與初相 ↔ 複頻譜 $\\hat{f}(\\omega) = |\\hat{f}|e^{i\\phi(\\omega)}$；遮光狹縫 ↔ 頻域帶通濾波器",
          "derivedFact": "在稜鏡焦平面用黑紙擋住高頻藍紫光再合光（頻域乘截斷窗），出射光斑邊緣必然出現衍射振鈴（對應時域卷積 $\\text{sinc}$ 函數產生的 Gibbs 現象）。"
        }
      ],
      "distinctionFromHow": "WHAT 闡述信號在特徵基底上的正交座標展開；HOW 則是利用換元積分、留數定理或 FFT 快速演算法計算頻譜。",
      "extensions": {
        "deeper": "奠基在「平移群的不可約表示是複指數」與希爾伯特空間的正交完備基底概念；再往下是線性代數的內積投影。",
        "shallower": "撐起卷積定理（時域卷積＝頻域相乘）、取樣定理、線性 PDE 的頻域求解，以及量子力學座標／動量表象互換。",
        "generalize": "放寬「函數定義在實數線」→ 任意局部緊緻阿貝爾群，得到 Pontryagin 對偶；放寬「$L^2$」→ 緩增分佈，得到廣義傅立葉變換。",
        "specialize": "收緊到週期函數：頻率只能取離散值，退化為傅立葉級數；收緊到有限長離散序列：退化為 DFT／FFT。",
        "translate": "用頻域語言講「為什麼隔著牆只聽得到低音」：牆是一個低通濾波器，把聲音訊號的高頻成分衰減、低頻留下；「聽起來悶」翻譯成傅立葉語言就是「頻譜的高頻端被乘上一個趨近 0 的傳遞函數」。同一套語言也能把「照片變模糊」翻成「空間頻率的高頻被抹掉」。",
        "construct": "用傅立葉頻譜模平方當權重，可以造出「功率譜密度（PSD）」$S_{xx}(\\omega) = \\lim_{T\\to\\infty}\\frac{1}{T}|\\hat{x}_T(\\omega)|^2$ 與「時頻不確定性乘積」$\\Delta t \\cdot \\Delta \\omega \\ge 1/2$。",
        "constructDetails": {
          "name": "功率譜密度（PSD）與時頻寬度積 $\\Delta t \\cdot \\Delta \\omega$",
          "choice": "為了處理持續不斷、總能量發散但平均功率有限的隨機或長時訊號，選了「先截斷到 $[-T/2, T/2]$ 算頻譜模平方再除以 $T$ 取極限」，丟棄相位資訊、只保留各頻率單位時間能量貢獻。",
          "alternative": "若不取模平方而直接對振幅 $\\hat{x}_T(\\omega)/T$ 取極限，所有非週期連續譜訊號都會變成 0；若保留相位，則對平穩隨機過程無法收斂成確定分佈。",
          "linkBack": "連回對象：由讀法3 的 Parseval 等式 $\\frac{1}{T}\\int_{-T/2}^{T/2}|x(t)|^2 dt = \\frac{1}{2\\pi}\\int \\frac{|\\hat{x}_T(\\omega)|^2}{T}d\\omega$，直接保證 PSD 對全頻域積分就是時域平均功率（Wiener-Khinchin 定理）。"
        },
        "questions": {
          "deeper": "為什麼傅立葉變換的基底偏偏選 $e^{i\\omega t}$ 而不是多項式 $t^n$？這跟時間平移不變性有什麼必然關係？",
          "shallower": "已知輸入訊號 $x(t)$ 與系統衝激響應 $h(t)$，如何不計算時域卷積積分 $\\int x(\\tau)h(t-\\tau)d\\tau$ 就求出輸出 $y(t)$？",
          "generalize": "常數訊號 $f(t)=1$ 在 $L^2(\\mathbb{R})$ 裡不可積，在廣義分佈意義下它的傅立葉變換是什麼？",
          "specialize": "當訊號滿足週期條件 $f(t+T)=f(t)$ 時，其連續頻譜 $\\hat{f}(\\omega)$ 會退化成什麼形狀？",
          "translate": "一張照片經過均值模糊濾鏡處理後邊緣變糊，在空間頻率域裡對應抹掉了哪一部分頻譜？",
          "construct": "為什麼把時域脈衝壓窄為原來的 $1/2$（$f(2t)$），其頻譜寬度 $\\Delta\\omega$ 必然展寬為原來的 $2$ 倍？"
        }
      }
    },
    "whyData": {
      "confidenceBefore": 3,
      "closedBookDraft": "因為線性時不變（LTI）系統對複指數信號的響應僅改變振幅與相位，不產生新的頻率成分，故複指數是天然特徵基底。",
      "fullReasoning": "（工具選擇的理由：需要一個操作，能把埋在加總裡的某一項單獨挑出來、把其他項清成 0——選「乘上共軛 $e^{-i\\omega t}$ 再對 $t$ 積分」，在前面的正交性內積式裡已被驗證恰好達成此效果：不同頻項積分為 0、同頻項積分為 $2\\pi$。）對任意線性時不變算子 $\\mathcal{L}$ 與輸入 $x(t) = e^{i\\omega t}$，響應為 $\\mathcal{L}[e^{i\\omega t}] = \\int h(\\tau) e^{i\\omega (t-\\tau)} d\\tau = [\\int h(\\tau) e^{-i\\omega \\tau} d\\tau] e^{i\\omega t} = H(\\omega) e^{i\\omega t}$。這說明所有連續複指數函數構成 LTI 系統的共同特徵向量。再由分佈正交性 $\\int_{-\\infty}^\\infty e^{i(\\omega - \\omega')t} dt = 2\\pi \\delta(\\omega - \\omega')$，可保證在狄利克雷條件下反變換完備性。",
      "confidenceAfter": 5,
      "perspective1": {
        "name": "LTI 特徵算子代數視角",
        "failureMode": "對於非線性或時變系統（如調頻、倍頻介質）特徵基底不復成立",
        "content": "複指數函數為平移群的唯一連續單維不可約表示。"
      },
      "perspective2": {
        "name": "能量守恆幾何等距同構",
        "failureMode": "對發散信號（非 $L^2$）需要引入廣義函數狄拉克 Delta 或拉普拉斯收斂因子",
        "content": "Plancherel 定理保證時頻空間內積與範數嚴格等距同構。"
      },
      "subGoals": [
        {
          "id": "fsg1",
          "goal": "證明卷積定理 $\\mathcal{F}\\{f * g\\} = \\hat{f}(\\omega) \\cdot \\hat{g}(\\omega)$",
          "requiredParts": [
            "重積分換元",
            "複指數指數加法性質"
          ],
          "whyNecessary": "時域時移在頻域轉化為純相位旋轉因子 $e^{-i\\omega \\tau}$",
          "whySufficient": "積分可拆為兩個獨立的單元傅立葉積分乘積"
        }
      ]
    },
    "assumptions": [
      {
        "id": "fa1",
        "name": "訊號絕對可積或能量有限 $\\int_{-\\infty}^\\infty |f(t)|^2 dt < \\infty$",
        "status": "locked",
        "description": "滿足 $L^2(\\mathbb{R})$ 希爾伯特空間內積存在條件"
      }
    ],
    "claims": [
      {
        "id": "fc1",
        "text": "Parseval 能量守恆恆等式 $\\int |f(t)|^2 dt = \\frac{1}{2\\pi} \\int |\\hat{f}(\\omega)|^2 d\\omega$",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY內積正交性]"
      },
      {
        "id": "fc2",
        "text": "有限頻帶訊號以採樣頻率 $f_s \\ge 2f_{max}$ 可無失真還原",
        "epistemicMark": "⊢證"
      },
      {
        "id": "fc3",
        "text": "工程 FIR 濾波器階數截斷之窗函數法",
        "epistemicMark": "⊢近",
        "frameworkNote": "數值實現有限項截斷近似"
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "fourier-chk-1",
          "cue": "看到「卷積微分方程」「濾波分析」「週期/擬週期信號頻譜」",
          "check": "檢查 系統是否為線性時不變（LTI），若存在非線性則不能直接套用疊加",
          "source": "[源:WHY-視角1]",
          "keywords": [
            "LTI",
            "卷積",
            "頻譜分解"
          ]
        }
      ],
      "branches": [
        {
          "id": "fh1",
          "title": "1. 驗證狄利克雷條件與有界變差",
          "action": "確認訊號在有限區間內間斷點有限且絕對可積",
          "source": "[源:定義]",
          "isCompiled": true
        },
        {
          "id": "fh2",
          "title": "2. 進行連續傅立葉積分或微分算子代數替換",
          "action": "$\\hat{f}(\\omega) = \\int_{-\\infty}^\\infty f(t) e^{-i\\omega t} dt$；遇常係數 ODE 直接將 $\\frac{d^n}{dt^n}$ 換為 $(i\\omega)^n$",
          "source": "[源:WHAT-讀法1][源:WHAT-讀法2]",
          "isCompiled": false
        },
        {
          "id": "fh3",
          "title": "3. 逆變換驗證特徵峰或用 Plancherel 算總能量",
          "action": "$f(t) = \\frac{1}{2\\pi} \\int_{-\\infty}^\\infty \\hat{f}(\\omega) e^{i\\omega t} d\\omega$；若只求平方積分則直接算頻譜面積 $\\frac{1}{2\\pi}\\int|\\hat{f}|^2 d\\omega$",
          "source": "[源:WHAT-讀法1][源:WHAT-讀法3]",
          "isCompiled": false
        }
      ],
      "can": [
        {
          "id": "fe1",
          "trigger": "看到線性時不變系統的微分方程",
          "capability": "就能把微分運算轉換為頻域代數相乘，直接解出頻譜",
          "source": "[源:WHAT-讀法2]"
        },
        {
          "id": "fe2",
          "trigger": "看到量子力學的座標表象問題",
          "capability": "就能切換到動量表象，把微分算子轉化為代數運算",
          "source": "[源:關係邊-薛丁格波動方程]"
        },
        {
          "id": "fe3",
          "trigger": "看到訊號處理的濾波需求",
          "capability": "就能設計頻域濾波器，實現時域卷積的等價操作",
          "source": "[源:WHY-子目標1]"
        }
      ],
      "status": "uncompiled",
      "testNotes": "包含未編譯分支：非週期廣義信號之奇點留數積分尚未閉卷驗證完畢。"
    },
    "originData": {
      "conflict": "↯ 傅立葉研究熱傳導時提出任意函數均可展開為三角級數，遭拉格朗日強烈反對（認為不連續函數不可能由光滑正弦疊加），直接逼使柯西與黎曼建立嚴格的微積分極限定義。"
    },
    "intuitionTraps": [
      {
        "id": "ft-it1",
        "description": "看到頻譜圖上的負頻率 $-\\omega$ 成分，會誤以為是『無意義的數學假象』或冗餘解",
        "whyMisleading": "實信號一定是偶對稱（$\\hat{f}(-\\omega) = \\hat{f}(\\omega)^*$），直覺上會覺得『震動怎麼可能有負的次數』——這是把它當成了物理量而非『複平面上的旋轉向量』。",
        "correctUnderstanding": "負頻率 $-\\omega$ 不是假象。它是複平面中與 $+\\omega$ 反向旋轉的向量；$+$與$-$疊加才能抵消虛部，構成實信號。這是『實信號必然是共軛對稱』的必然推論。",
        "passed": false
      }
    ],
    "bloomLevel": "分析",
    "soloLevel": "關聯結構",
    "soloData": {
      "declaredLevel": "關聯結構",
      "evidence": [
        {
          "id": "fse1",
          "level": "單點結構",
          "text": "能背出傅立葉積分變換式本身。"
        },
        {
          "id": "fse2",
          "level": "多點結構",
          "text": "能分別說明正交性、Plancherel 等距、卷積定理三件事。"
        },
        {
          "id": "fse3",
          "level": "關聯結構",
          "text": "能說明三者同源於 LTI 特徵基底這一個機制，並作為薛丁格表象變換的前提節點 →。"
        }
      ],
      "autoSuggestedLevel": "多點結構",
      "autoRationale": "此卡僅 1 條關係邊（→ 前提），關係密度偏低；雖屬母題成員，但缺少已驗證類比 ≈，系統建議暫列多點結構。",
      "accepted": false,
      "history": []
    },
    "blockageNotes": "注意負頻率 $-\\omega$ 的物理意義是旋轉複平面的反向向量，不可視為無意義數學假象。",
    "constructionCalibration": {
      "confidenceBefore": 3,
      "confidenceAfter": 4
    },
    "backgroundData": {
      "situation": "手上一篇「錄音訊號」——把一段人聲 x(t) 先作 2 倍放大、再延遲 0.5 秒，得到 L[x(t)] = 2x(t-0.5)。情境二：同一個 L 作用在「一段背景音樂 x(t)」上，還是 2 倍放大延遲 0.5 秒——換的只是輸入這一個對象，操作本身不變。",
      "preciseObject": "把「放大＋延遲」寫成精確式子 L[x] = 2x(t−0.5)，再推廣成線性：L[ax+by] = a·L[x] + b·L[y]。先給這個形式，動機是：凡是「放大、平移、加法」這三件事組合的操作都滿足它，而「錄音＋背景音樂疊加後再處理」正是這種情形——這裡仍用「人聲」「背景音樂」講，不跳去純抽象。",
      "preciseQuestion": "對「這段錄音 x(t)」，有沒有什麼簡單的組成單位，能把它拆解這種單位疊加，好讓 L 的放大延遲處理可以一個單位一個單位分開做？"
    },
    "candidate": {
      "requirement": "要的單位必須「通過 L 之後形式不變、只乘一個數」——這樣每個單位自己算、最後再疊加才有意義。",
      "candidateForm": "e^(iωt) 指數型函數。",
      "motivation": "從「對微分而言，微分完還是自己乘個係數」這個想法往下摸：什麼函數對 L 的「放大（乘 2）、延遲（變 t-0.5）」這種操作只會乘一個常數？——指數函數 e^(iω(t-0.5)) = e^(-iω·0.5)·e^(iωt)，延遲只乘了一個相位因子。是這個「形式不變」的摸索把它挑出來，不是因為「電路裡常用」這種泛泛優點。"
    },
    "plan": {
      "steps": [
        {
          "id": "p1",
          "label": "證明 e^(iωt) 通過 L 後形式不變（只乘常數）",
          "rationale": "先決條件：候選人到底能不能用，全看這一步成立不成立"
        },
        {
          "id": "p2",
          "label": "框定可用的 ω 範圍（週期約束）",
          "rationale": "依賴第 1 步：要先確認候選人可用，才有資格談哪些 ω 能進這個分解"
        },
        {
          "id": "p3",
          "label": "求每個單位的係數 cₙ（正交性挑出單一項）",
          "rationale": "範圍定完後只剩係數是唯一未知數；三步的順序由第 1→2→3 的依賴鎖死，不能調換"
        }
      ],
      "ranges": "「任意 f 是否真的能被這種單位疊加還原、係數是否唯一」超出本卡範圍，先當 [地位:公設] 使用，需另開「傅立葉級數完備性」一卡。"
    }
  },
  {
    "id": "card-le-chatelier",
    "workspaceId": "default-scinotes-workspace",
    "title": "勒沙特列原理",
    "domain": "化學 · 化學平衡",
    "granularity": "核心卡（判準 1/2 命中：被眾多平衡移動判斷題依賴）",
    "backgroundDescription": "位於「近平衡態熱力學穩定分支」框架。前置背景為質量作用定律與化學平衡狀態的定義（見 [前提] 關係邊）；本卡把「平衡向減弱擾動方向移動」這句現象口訣，轉譯成「比較 Q 與 K 大小」的可計算判據——考場與工廠都能即時判斷方向，不必每次重新解平衡方程。",
    "cardFont": "indie",
    "pageMode": "paged",
    "constructionCalibration": {
      "confidenceBefore": 5,
      "confidenceAfter": 5
    },
    "backgroundData": {
      "situation": "情境(1)：反應 $N_2+3H_2 \\rightleftharpoons 2NH_3$ 達到平衡後，往容器裡額外加入更多 $N_2$，直覺的猜測是什麼——系統會怎麼響應？（具體的現象描述「系統受擾動後向抵消擾動方向移動」：大概會消耗掉一些額外加入的 $N_2$，生成更多 $NH_3$。）情境(2)：換個操作，恆容條件下額外加入不參與反應的惰性氣體，系統會不會也產生類似的響應（同樣先憑直覺猜一次）？——兩個情境共用同一組具體對象（同一個平衡、同樣是「往容器加東西」），只換「加進來的東西會不會進入反應式」這一個變數做對照。",
      "preciseObject": "反應商 $Q=[NH_3]^2/([N_2][H_2]^3)$——用當下的瞬時濃度直接代入質量作用定律形式算出的值；平衡常數 $K$，是這個反應商在真正平衡時的定值，只隨溫度變化。情境(1)：加 $N_2$ 使 $Q$ 的分母變大，$Q$ 變小（小於 $K$）。情境(2)：恆容下惰性氣體不參與反應、不改變容器體積，$N_2$、$H_2$、$NH_3$ 各自的濃度都不變，所以 $Q$ 不變，仍等於 $K$。先給形式、再給動機：這兩個量把「平衡有沒有被擾動、往哪邊擾動」變成當場可算的數字；以下推導仍貼著「這段反應的濃度」講，不跳去純抽象符號。",
      "preciseQuestion": "能不能只靠比較 $Q$ 和 $K$ 的大小關係，不必每次憑直覺猜「抵消擾動」是什麼意思，就直接判斷擾動後系統會往哪個方向淨反應？"
    },
    "constructionThinking": "從【背景】已經精確表述的問題出發：要的是一個不靠直覺、可以直接計算比較的數值判據。已知 $Q$ 是瞬時濃度算出的反應商、$K$ 是平衡時的反應商定值——如果瞬時值偏離了平衡值，往「$Q$ 值向 $K$ 值靠攏」的方向調整，就是最自然的候選猜測。這裡只提出候選、表達計畫；「淨反應方向真的會讓 $Q$ 趨近 $K$」這件事不在此下結論，驗證留給 WHY。觸發點是邏輯上的：現象描述「向抵消擾動方向移動」沒有說明原因，換一個人重新推，也會撞到「平衡在數學上是什麼」這個點（＝$Q=K$ 的狀態），不依賴任何歷史人物。",
    "candidate": {
      "requirement": "不靠直覺，用一個可以直接計算、直接比較大小的數值，判斷擾動後的淨反應方向（構造思路已確立的要求：判據必須當場可算，不能是「重新解一遍平衡方程」）。",
      "candidateForm": "比較 $Q$ 與 $K$ 的大小：$Q<K$ → 淨正向；$Q>K$ → 淨反向。（候選猜測：淨反應方向會讓 $Q$ 趨近 $K$——此處不下結論，驗證留給 WHY。）",
      "motivation": "從「平衡＝$Q=K$」這個翻譯出發：任何擾動都變成「$Q$ 偏離 $K$ 多少、偏向哪一邊」的計算問題。是這個「把口訣翻譯成可計算量」的摸索把「$Q$ 趨近 $K$」挑出來，不是因為 $Q$、$K$ 這兩個記號好記這種泛泛理由——把候選換成任何別的記號，這條動機就不再成立。"
    },
    "thoughtPoints": [
      {
        "id": "tp-lc-path-1",
        "modeName": "候選判據具體怎麼用",
        "question": "如果 $Q<K$，按「$Q$ 趨近 $K$」這個候選判據，淨反應該往哪個方向？",
        "answer": "問題本身指向的方向：$Q$ 的分子是 $NH_3$、分母是 $N_2$ 和 $H_2$，要讓 $Q$ 變大趨近 $K$，需要 $NH_3$ 變多、$N_2$ 和 $H_2$ 變少——也就是淨正向反應。（完整驗證見 WHY 代數推論 ①）",
        "passed": true,
        "placement": "construction",
        "createdAt": "2026-01-15"
      },
      {
        "id": "tp-lc-path-2",
        "modeName": "候選判據能不能預測情境(2)",
        "question": "情境(2)裡 $Q$ 沒變（仍等於 $K$），按這個候選判據，代表什麼？",
        "answer": "代表 $Q$ 已經等於 $K$，不需要再淨反應調整——這預測了「恆容加惰性氣體，平衡不移動」。這是候選判據的一個可檢驗預測：如果這個預測將來被證實，能支持候選判據是對的；這裡只是提出這個預測，不代表候選判據本身已經驗證過。",
        "passed": true,
        "placement": "construction",
        "createdAt": "2026-01-15"
      }
    ],
    "plan": {
      "steps": [
        {
          "id": "p1",
          "label": "證明 $Q \\neq K$ 時淨反應方向確實會讓 $Q$ 趨近 $K$",
          "rationale": "這是候選判據能不能用的先決條件——如果這件事不成立，後面全部沒有意義"
        },
        {
          "id": "p2",
          "label": "依據這個原理，推導出 $Q<K$ 和 $Q>K$ 各自對應的淨反應方向",
          "rationale": "把抽象的「趨近」原理，轉成具體、可直接套用的方向判斷規則——依賴第 1 步：原理站不住，規則就沒有依據"
        },
        {
          "id": "p3",
          "label": "用這個規則檢驗幾種具體擾動（加 $N_2$／加壓／加惰性氣體／升溫）分別落在哪種情況",
          "rationale": "前兩步確立規則本身，第三步才是把規則套到實際情境上——順序不能打亂：跳過前兩步直接套規則，等於在用未驗證的判據"
        }
      ],
      "ranges": "溫度對 $K$ 本身的影響需要額外引入范特霍夫方程，不在這個計畫範圍內，只標注結論、不展開推導（對應 WHY 推論 ③ 的 [地位:歸納] 標記）。"
    },
    "reasoningShape": "C",
    "shapeRationale": "外層是可執行的判別程序（算擾動瞬間的 Q → 與 K 比大小 → 輸出方向），每一支的成立理由由 WHY「Q 趨近 K」同一原理的三個推論 ①②③ 支撐，屬 C 判別程序型。",
    "shapeConfidence": 90,
    "shapeAccepted": true,
    "whatData": {
      "summary": "擾動後的淨反應方向由 $Q$ 與 $K$ 的大小關係完全決定：$Q<K$ 淨正向、$Q>K$ 淨反向、$Q=K$ 不動——「平衡向減弱擾動的方向移動」這句口訣，只是這個判據的現象版描述。",
      "v6DemoPreservedNote": "【v7 手冊前言註記】本示範卡依手冊 v7 前言保留 v6 寫法（五個方向延伸、無讀法表）作為版本對照；完整 v7 寫法（含讀法、問題×讀法表、橋、六個方向延伸與『造』）請見《算術平均數（附錄 C 完整範例）》及其他卡片。",
      "perspectives": [
        {
          "code": "質量作用定律視角",
          "label": "反應商與平衡常數",
          "content": "平衡時 $Q=[NH_3]^2/([N_2][H_2]^3)$ 等於一個只隨溫度變的常數 $K$；非平衡時 $Q$ 可以是任意值。[地位:近似於質量作用定律框架]",
          "mappingTable": "瞬時濃度比 $[NH_3]^2/([N_2][H_2]^3)$ ↔ 反應商 $Q$；平衡態定值 ↔ $K(T)$；偏離平衡 ↔ $Q \\neq K$",
          "derivedFact": "恆容充入不參與反應的惰性氣體時，各反應物與產物的莫耳濃度完全不變，因此 $Q$ 保持等於 $K$，平衡零移動。"
        },
        {
          "code": "現象描述視角",
          "label": "動態平衡的現象",
          "content": "$N_2+3H_2 \\rightleftharpoons 2NH_3$，正逆反應速率相等時叫平衡，濃度不再變，不是反應停了。[地位:歸納]",
          "mappingTable": "正反應速率 $v_f$ ＝ 逆反應速率 $v_r$ ↔ 宏觀濃度不隨時間變化的動態平衡；$v_f > v_r$ ↔ 淨正向移動",
          "derivedFact": "加入同位素標記的 $^{15}N_2$ 於已達平衡的容器中，雖然宏觀總濃度不變，但一段時間後 $^{15}N$ 必然出現在 $NH_3$ 中（證明正逆反應仍在持續進行）。"
        },
        {
          "code": "[借鏡視角:負回饋溫控器]",
          "label": "借鏡視角：自動調節負回饋回路",
          "kind": "mirror",
          "content": "系統像一個自動調節的負回饋溫控回路——偏離設定值（$K$）時，會產生一個把自己往設定值拉回去的淨反應，不需要外部干預。",
          "mappingTable": "溫控器目標設定溫度 $T_{\\text{set}}$ ↔ 平衡常數 $K$；室溫感測瞬時值 $T_{\\text{now}}$ ↔ 反應商 $Q$；誤差訊號 $(T_{\\text{now}} - T_{\\text{set}})$ ↔ $\\ln(Q/K)$；冷暖氣修正輸出 ↔ 淨正／逆反應速率差 $(v_f - v_r)$",
          "derivedFact": "若改變的是「設定值 $T_{\\text{set}}$ 本身」（對應升溫改變 $K$），即使瞬時室溫 $T_{\\text{now}}$（對應瞬間 $Q$）還沒變，誤差訊號立刻不為零，系統必然啟動反向調整直到對齊新設定值 $K(T')$。"
        }
      ],
      "distinctionFromHow": "WHAT 描述「$Q$ 與 $K$ 的大小關係決定方向」這個判據本身；HOW 是實際算出擾動瞬間的 $Q$ 並輸出方向判斷的執行流程——知道判據不等於會瞬間算對 $Q$（加壓那步的 $f^2$ 縮放正是兩者的分界）。",
      "extensions": {
        "deeper": "這條判據的根本原因是 WHY 邏輯視角（質量作用定律的動力學關係驅動 $Q$ 趨近 $K$），比「$Q$ 和 $K$」這兩個符號本身更基礎。",
        "shallower": "有這條原理，才能不靠直覺、直接靠計算判斷任意擾動的方向，免去每次都要重新代入質量作用定律推導的麻煩。",
        "generalize": "如果考慮非理想溶液（濃度不能直接代表活度），$Q$ 的計算式需要換成活度表示，是本卡範圍之外需要另開一張卡處理的推廣方向。",
        "specialize": "如果限定「只討論恆容加惰性氣體」這一種擾動，判據直接退化成「$Q$ 不變，平衡不移動」這個最簡單的特例。",
        "translate": "溫控器這類負回饋控制系統，跟這條判據背後的機制（偏離設定值 → 驅動系統反向修正）是同一種結構——候選推理測試：由此可以推測，溫控器測量到偏離時，應該也是「測量偏離 → 驅動系統反向拉回」，這個推測與實際溫控器原理一致，驗證通過，見【關係邊】。"
      }
    },
    "whyData": {
      "confidenceBefore": 2,
      "closedBookDraft": "如果淨反應方向是讓 Q 更偏離 K，偏離只會越推越大、永遠回不到平衡——這跟「擾動後系統最終會重新靜止在一個平衡」的日常觀察矛盾，所以淨反應方向必然是把 Q 拉回 K。",
      "fullReasoning": "（歸屬交代：「$Q \\neq K$ 這個狀態會自動驅動淨反應把 $Q$ 拉回 $K$」這一步，是質量作用定律的推論——質量作用定律以 [前提] 關係邊指向本卡（見【關係邊】），本卡引用而不重證；下面三條擾動的具體代數推導，才是本卡在「$Q$ 趨近 $K$」原理下自證的 [地位:證明]。）\n\n邏輯視角：$Q \\neq K$ 時，系統淨反應把 $Q$ 拉回 $K$——不是系統「想要」抵消擾動，而是 $Q \\neq K$ 這個狀態本身，按質量作用定律的動力學關係就會自動驅動淨反應：正反應速率 $v_f = k_f[N_2][H_2]^3$、逆反應速率 $v_r = k_r[NH_3]^2$，$Q<K$ 時 $v_f > v_r$、淨變化消耗反應物，$Q>K$ 時 $v_f < v_r$、淨變化消耗產物——濃度的調整方向恰好把 $Q$ 往 $K$ 拉，直到 $Q$ 重新等於 $K$。[地位:近似於質量作用定律框架]\n\n代數推導（子目標聲明：下面三條擾動分別推，不是三條獨立規則，是同一原理的三個推論，分別檢驗構造思路計畫第三步列出的擾動）：\n① 加 $N_2$ → $[N_2]$ 變大 → $Q$（分母含 $[N_2]$）變小 → $Q<K$ → 淨正向 [地位:證明][給定原理下的代數推導，見構造思路②路徑追問點 1]\n② 加壓至 $f$ 倍（$f<1$，體積變為原來 $1/f$）→ 各濃度變為原來 $1/f$ 倍 → 分子 $[NH_3]^2$ 是 2 個物質相乘、變 $(1/f)^2$ 倍，分母 $[N_2][H_2]^3$ 是 4 個物質相乘、變 $(1/f)^4$ 倍，相除得 $Q' = f^2 K$ → $f^2 < 1$，$Q' < K$ → 淨正向 [地位:證明][同 ①，冪次來自化學計量數]\n③ 升溫 → 正向放熱，由范特霍夫方程使 $K$ 變小 → 瞬間 $Q$ 不變但 $K$ 變小 → 變成 $Q>K$ → 淨反向 [地位:歸納]（$K$ 隨溫度變化的具體方向來自范特霍夫方程，本卡未展開推導——這是計畫範圍標注裡明講不展開的部分）",
      "confidenceAfter": 4,
      "perspective1": {
        "name": "邏輯視角（質量作用定律動力學）",
        "failureMode": "遠離平衡態的耗散結構（如 B-Z 震盪反應）中，「淨反應趨近平衡」的圖像會失效，可能出現自催化正回授震盪",
        "content": "$Q \\neq K$ 時，系統淨反應把 $Q$ 拉回 $K$——不是系統「想要」抵消擾動，是 $Q \\neq K$ 這個狀態本身按質量作用定律的動力學關係，就會自動驅動淨反應，直到 $Q$ 重新等於 $K$。[地位:近似於質量作用定律框架]"
      },
      "perspective2": {
        "name": "代數推導視角（三條擾動推論）",
        "failureMode": "③ 升溫那條依賴范特霍夫方程的 [地位:歸納] 引用；若反應焓變 $\\Delta H$ 在討論的溫區間內變號，升溫對 $K$ 的影響方向會跟著反轉",
        "content": "① 加 $N_2$ → $Q<K$ → 淨正向；② 加壓至 $f$ 倍 → $Q'=f^2K<K$ → 淨正向；③ 升溫 → $K$ 變小 → $Q>K$ → 淨反向——三條不是獨立規則，是「$Q$ 趨近 $K$」同一原理的三個推論，分別檢驗構造思路計畫第三步列出的擾動。"
      },
      "subGoals": [
        {
          "id": "lsg1",
          "goal": "三條擾動（①加 $N_2$、②加壓、③升溫）分別推導淨反應方向",
          "requiredParts": [
            "① 加 $N_2$：$Q$ 分母變大",
            "② 加壓 $f$ 倍：$Q' = f^2 K$",
            "③ 升溫：$K$ 變小"
          ],
          "whyNecessary": "不是三條獨立規則，是同一原理（$Q$ 趨近 $K$）的三個推論——分開推是為了逐一檢驗構造思路計畫第三步列出的具體擾動",
          "whySufficient": "三條推論都只用到「$Q$ 趨近 $K$」這一個原理加基本代數，推完即覆蓋計畫第三步的全部檢驗對象，判據的適用面收束完成"
        }
      ]
    },
    "claims": [
      {
        "id": "lc1",
        "text": "$Q \\neq K$ 時，系統淨反應方向會把 $Q$ 拉回 $K$（質量作用定律動力學機制）",
        "epistemicMark": "⊢近",
        "frameworkNote": "質量作用定律框架",
        "anchor": "[見WHY視角1（邏輯：動力學驅動Q趨近K）]"
      },
      {
        "id": "lc2",
        "text": "① 加 $N_2$ → $[N_2]$ 變大 → $Q$ 變小（$Q<K$）→ 淨正向",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY代數推導①（構造思路②路徑追問點1）]"
      },
      {
        "id": "lc3",
        "text": "② 加壓至 $f$ 倍（$f<1$）→ 各濃度變 $1/f$ 倍 → $Q' = f^2 K < K$ → 淨正向",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY代數推導②（分子2物質相乘、分母4物質相乘）]"
      },
      {
        "id": "lc4",
        "text": "③ 升溫 → 正向放熱、$K$ 變小 → 瞬間 $Q$ 不變但 $Q>K$ → 淨反向",
        "epistemicMark": "⊢歸",
        "frameworkNote": "K 隨溫度變化的具體方向來自范特霍夫方程，本卡未展開推導（對應計畫裡明講不展開的部分）",
        "anchor": "[見WHY代數推導③]"
      }
    ],
    "intuitionTraps": [
      {
        "id": "lc-it1",
        "description": "恆容條件下額外加入不參與反應的惰性氣體，直覺上「總壓變大了」，會讓人以為平衡也該跟著移動。",
        "whyMisleading": "常見誤判是把「總壓變大」直接等同於「擾動了平衡」——總壓變大是真的，但 $Q$ 的計算式裡只看得到反應物／產物自己的濃度，惰性氣體的濃度根本不在 $Q$ 的算式裡出現。",
        "correctUnderstanding": "恆容下惰性氣體不改變 $N_2$、$H_2$、$NH_3$ 各自的分壓（濃度），$Q$ 沒變、仍等於 $K$，按候選判據平衡不移動——這正是構造思路②路徑追問點 2 的預測，也是本卡最容易被直覺誤導的地方。",
        "passed": false
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "lc-chk-1",
          "cue": "看到「催化劑」字樣",
          "check": "先確認 $K$ 的定義式裡沒有催化劑的位置——催化劑只加快雙向速率，$K$ 不變，平衡位置不變，只是變快到達平衡；結論：看到催化劑直接判定「平衡不移動」，再把題目轉成動力學問題。常見誤判是把「反應變快」和「平衡移動」混為一談",
          "source": "[源:定義]",
          "keywords": [
            "催化劑",
            "K不變",
            "平衡位置"
          ]
        },
        {
          "id": "lc-chk-2",
          "cue": "看到「遠離平衡態／自催化／震盪反應」",
          "check": "檢查這條判據的動力學基礎是否還成立——這是 WHY 邏輯視角的失效模式：B-Z 震盪等耗散結構中「淨反應趨近平衡」的圖像會失效；結論：此類體系不能套 Q/K 判據，需改用非平衡動力學分析",
          "source": "[源:WHY-視角1]",
          "keywords": [
            "耗散結構",
            "B-Z震盪",
            "自催化"
          ]
        }
      ],
      "branches": [
        {
          "id": "lh1",
          "title": "1. 算出擾動瞬間的 $Q$（先辨認擾動類型，再走對應子分支）",
          "action": "擾動瞬間（濃度／體積還沒被淨反應調整前）代入 $Q=[NH_3]^2/([N_2][H_2]^3)$ 算新值",
          "source": "[源:定義]",
          "isCompiled": false,
          "branches": [
            {
              "id": "lh1a",
              "title": "子分支 1a · 加反應物（加 $N_2$）",
              "action": "$[N_2]$ 變大 → 分母變大 → $Q$ 變小（$Q<K$）",
              "source": "[源:WHY-推導①]",
              "isCompiled": true
            },
            {
              "id": "lh1b",
              "title": "子分支 1b · 加壓至 $f$ 倍（$f<1$，體積變為原來 $1/f$）",
              "action": "各濃度變 $1/f$ 倍：分子 $[NH_3]^2$ 是 2 個物質相乘、變 $(1/f)^2$ 倍，分母 $[N_2][H_2]^3$ 是 4 個物質相乘、變 $(1/f)^4$ 倍，相除得 $Q' = f^2 K$——這個分支的 $f^2$ 推導還需要臨場重新算 [未編譯]",
              "source": "[源:WHY-推導②]",
              "isCompiled": false,
              "checks": [
                {
                  "id": "lh1b-chk-1",
                  "cue": "加壓／改體積的場合裡看到「再充入惰性氣體」",
                  "twoStageTransform": "先辨識容器是「恆容」還是「恆壓」，把「充惰氣」轉譯成「各反應物分壓（莫耳濃度 $n_i/V$）有沒有變」",
                  "check": "先分恆容還是恆壓：恆容——各分壓不變、$Q$ 不變、平衡不動；恆壓——總壓不變但體積擴大、各分壓減小，等效於減壓，平衡向氣體分子數減少方向移動。常見誤判：把「總壓變大」直接當成「擾動了平衡」",
                  "source": "[源:WHAT-視角1][源:WHY-推導②]",
                  "keywords": [
                    "恆容",
                    "恆壓",
                    "惰性氣體"
                  ]
                }
              ]
            },
            {
              "id": "lh1c",
              "title": "子分支 1c · 升溫",
              "action": "瞬間 $Q$ 不變，但 $K$ 變小（方向引用范特霍夫方程結論）",
              "source": "[源:WHY-推導③]",
              "isCompiled": true,
              "checks": [
                {
                  "id": "lh1c-chk-1",
                  "cue": "升溫／降溫的場合裡，要先知道反應是吸熱還是放熱",
                  "check": "確認 ΔH 符號再套「升溫 → 平衡往吸熱方向移動」；若反應焓變 ΔH 在討論的溫區間內變號（范特霍夫 $d\\ln K/dT = \\Delta H/RT^2$ 分子變號），升溫對 $K$ 的影響方向會跟著反轉——這是 WHY 代數推導視角的失效模式",
                  "source": "[源:WHY-視角2]",
                  "keywords": [
                    "ΔH符號",
                    "范特霍夫",
                    "變號"
                  ]
                }
              ]
            }
          ]
        },
        {
          "id": "lh2",
          "title": "2. 判斷 $Q<K$ 還是 $Q>K$",
          "action": "與 $K$（只隨溫度變）比大小；升溫的場合先記得 $K$ 本身變小了（方向引用范特霍夫方程結論）",
          "source": "[源:WHAT-借鏡視角:負回饋溫控器]",
          "isCompiled": true
        },
        {
          "id": "lh3",
          "title": "3. 輸出淨反應方向",
          "action": "$Q<K$ → 淨正向；$Q>K$ → 淨反向；$Q=K$ → 不移動（恆容加惰性氣體即此情形）",
          "source": "[源:WHY-視角1]",
          "isCompiled": true
        }
      ],
      "can": [
        {
          "id": "lc-can-1",
          "trigger": "看到「改變條件後平衡往哪邊挪」這類判斷題",
          "capability": "就能直接比較 $Q$ 與 $K$ 大小，不用每次重寫自由能或質量作用定律",
          "source": "[源:WHY-視角1]"
        }
      ],
      "status": "uncompiled",
      "testNotes": "[已推出]：①加 $N_2$、②加壓、③升溫三條推論都能不看資料重新推出（追問測試通過）；但「會推出」不等於「不假思索就能執行」——加壓那個子分支的 $f^2$ 推導尚未編譯，兩者是不同的門檻。"
    },
    "originData": {
      "conflict": "19 世紀末化學工業迅速擴張，高溫高壓合成氨（Haber-Bosch 法）面臨產率與反應速率的尖銳矛盾——低溫產率高但速率極慢，高溫速率快但產率極低，迫切需要理清熱力學平衡響應規律，逼出一個不用每次重新解方程、只看 $Q$ 與 $K$ 相對大小就能判斷方向的統一原理。",
      "historicalContext": "歷史上工業界真正卡住的，是「溫度這一個變數」造成的產率／速率矛盾，跟第一段情境 (1)(2) 用的加 $N_2$／加惰性氣體不是同一種擾動——歷史事件其實更貼近計畫第三步裡「升溫」這個情況，而不是最先講的加 $N_2$ 情境。這提醒一件事：邏輯線為了講清楚「$Q$ 和 $K$」這個判據本身，挑了最乾淨的例子（加 $N_2$）當切入點；但真正逼出這條原理被廣泛需要的歷史壓力，反而來自最複雜、需要額外引入范特霍夫方程的那個情況（溫度）——邏輯上最好懂的情境，不一定是歷史上最重要的情境，這兩條線在這張卡上沒有完全對齊，這個落差本身值得記錄，不用假裝兩者完美吻合。"
    },
    "bloomLevel": "應用",
    "soloLevel": "關聯結構",
    "soloData": {
      "declaredLevel": "關聯結構",
      "evidence": [
        {
          "id": "lse1",
          "level": "單點結構",
          "text": "能背出「平衡向減弱擾動方向移動」這句話。"
        },
        {
          "id": "lse2",
          "level": "多點結構",
          "text": "能分別處理濃度、壓強、溫度、催化劑四類擾動，但四者尚未收束成單一判據。"
        },
        {
          "id": "lse3",
          "level": "關聯結構",
          "text": "能用「比較 $Q$ 與 $K$」這個單一判據統一處理各類擾動（WHY 三條推論同源）；計 2 條類型化邊（[前提] 質量作用定律、[對照] SN1/SN2）＋ 2 條已過候選推理測試的 [結構類比]（負回饋控制系統、卡諾·自由能凸性）＝ 4 條。"
        }
      ],
      "autoSuggestedLevel": "關聯結構",
      "autoRationale": "此卡已有 [前提]、[對照] 兩條類型化邊，與 2 條已驗證 [結構類比]（負回饋控制系統、卡諾·自由能凸性）；WHY 已把四類擾動統一到「$Q$ 與 $K$ 大小比較」單一判據，符合「關聯結構」門檻；尚未對整張知識網做出新的可證偽預測（溫控器類比屬兩節點之間的候選推理測試），故未達抽象拓展。",
      "accepted": true,
      "history": [
        {
          "at": "2024-02-11",
          "from": "單點結構",
          "to": "多點結構",
          "reason": "補齊恆容/恆壓惰氣差異與催化劑防呆後，四類擾動皆可獨立處理。"
        },
        {
          "at": "2026-01-16",
          "from": "多點結構",
          "to": "關聯結構",
          "reason": "WHY 收束到「比較 Q 與 K」單一判據（三條推論同源），並補上 [前提]、[對照] 與已驗證 [結構類比] 關係邊。"
        }
      ]
    },
    "blockageNotes": "曾引發堵塞，已定位：把恆壓充惰氣（體積擴大分壓減小）與恆容充惰氣（分壓不變）混淆——現由直覺陷阱 lc-it1 承接提醒。"
  },
  {
    "id": "card-schrodinger-eq",
    "workspaceId": "default-scinotes-workspace",
    "title": "薛丁格波動方程與量子力學公設體系",
    "domain": "物理 / 量子力學與現代物理",
    "granularity": "L1 核心原理",
    "backgroundDescription": "位於「非相對論量子力學」框架（$v \\ll c$、封閉體系、無測量退相干）。前置背景為德布羅意物質波與愛因斯坦光量子關係；本卡是整個波動力學體系的出發公設，不可由牛頓力學推導而得，向下支撐能階量子化、穿隧與化學鍵理論。",
    "cardFont": "dancing",
    "pageMode": "single",
    "constructionThinking": "既然粒子被假定具有波動性，核心問題就變成：描述這道波的方程式長什麼樣？（這裡的波函數是複值函數，其绝对值平方代表在某處找到粒子的機率密度）切入點是光學-力學類比（Hamilton-Jacobi）：幾何光學是波動光學的短波極限，經典力學應該對應某種波動力學的短波極限。切入角度『反過來』用極限關係推：既然經典力學之於某波動理論，像幾何光學之於波動光學，就像「只追蹤光線路徑的近似圖像」（波長 λ 趨近 0 的極限，只保留射線方向這一個自由度）之於「完整考慮波動相位干涉的圖像」，那完整的『波動版』該長什麼樣？把 $E=p^2/(2m)+V$ 直接替換 $E\\to i\\hbar\\partial_t, p\\to -i\\hbar\\nabla$，作用到波函數，就得到薛丁格方程。這不是推導，是公設的構造——但它的構造邏輯有跡可循。",
    "thoughtPoints": [
      {
        "id": "tp-sch-1",
        "modeName": "類比反推構造法",
        "question": "為什麼可以從『幾何光學是波動光學的短波極限』反推出薛丁格方程？類比的合法性在哪？",
        "answer": "不是直接類比，是用『已知極限關係』反推完整理論的構造策略。幾何光學（射線）↔ 波動光學（波動方程）的極限關係已知；經典力學（牛頓軌道）↔ ？的極限關係也已知（$\\hbar\\to 0$）。構造完整波動方程的策略是：找到一個波動方程，讓它在 $\\hbar\\to 0$ 極限下退化回 Hamilton-Jacobi。代入檢驗後發現線性 $i\\hbar\\partial_t$ 形式恰好符合——這是『極限反推構造』的典型套路。",
        "passed": true,
        "note": "最初把類比當成直接推導，後來意識到這只是『構造啟發』，不是『邏輯必然』，才接受它是公設而非定理。",
        "createdAt": "2024-04-02",
        "placement": "construction"
      }
    ],
    "reasoningShape": "D",
    "shapeRationale": "薛丁格方程式在非相對論量子力學中無法由牛頓力學或經典電磁學直接推導，其地位是體系的基礎公設與演化框架。",
    "shapeConfidence": 95,
    "shapeAccepted": true,
    "whatData": {
      "summary": "非相對論微觀體系的量子態由複值波函數 $\\Psi(\\mathbf{r}, t)$ 完全表徵，其時間演化由薛丁格方程決定，對應哈密頓算符作用。",
      "readings": [
        {
          "id": "sch-r1",
          "name": "讀法1：含時偏微分演化方程（$i\\hbar\\partial_t\\Psi = \\hat{H}\\Psi$）",
          "description": "時間一階偏微分等於空間二階拉普拉斯加勢能算符作用：給定初態 $\\Psi(\\mathbf{r},0)$，唯一決定任意時刻的機率幅演化。",
          "linkedPerspective": "物理視角：機率波詮釋"
        },
        {
          "id": "sch-r2",
          "name": "讀法2：定態算符本徵值方程（$\\hat{H}\\psi_n = E_n\\psi_n$）",
          "description": "分離時間變數後，允許的穩定能量值 $E_n$ 就是哈密頓算符 $\\hat{H}$ 在邊界條件下的離散或連續特徵值。",
          "linkedPerspective": "算符視角：算符代數"
        },
        {
          "id": "sch-r3",
          "name": "讀法3：希爾伯特空間么正旋轉流（$|\\Psi(t)\\rangle = e^{-i\\hat{H}t/\\hbar}|\\Psi(0)\\rangle$）",
          "description": "態向量在複希爾伯特空間中只做保內積、保長度的么正相位旋轉，定態基底展開下各分量只轉相位 $e^{-iE_n t/\\hbar}$。",
          "linkedPerspective": "幾何視角：幾何希爾伯特向量"
        }
      ],
      "readingQuestions": [
        {
          "id": "sch-rq1",
          "question": "粒子關在寬度 $L$ 的無限深方勢阱裡，允許的能量有哪些？",
          "cells": {
            "sch-r1": { "text": "帶著時間偏導數無法直接看駐波邊界，要先分離變數，兩步" },
            "sch-r2": { "text": "一步：解 $-\\frac{\\hbar^2}{2m}\\psi'' = E\\psi$ 配兩端為 0，立得 $E_n \\propto n^2$", "isCheapest": true },
            "sch-r3": { "text": "未給出空間微分形式，看不見勢阱邊界如何卡死波長（見讀法2）", "isInvisible": true, "pointsToReadingId": "sch-r2" }
          }
        },
        {
          "id": "sch-rq2",
          "question": "初態為兩能階疊加 $|\\Psi(0)\\rangle = c_1|\\psi_1\\rangle + c_2|\\psi_2\\rangle$，$t$ 時刻的態是什麼？",
          "cells": {
            "sch-r1": { "text": "重解含時偏微分方程，三步且繞" },
            "sch-r2": { "text": "只有定態本徵值，看不見疊加態隨時間的相對相位演化（見讀法3）", "isInvisible": true, "pointsToReadingId": "sch-r3" },
            "sch-r3": { "text": "一步：各本徵態直接乘上各自相位因子 $c_1 e^{-iE_1 t/\\hbar}|\\psi_1\\rangle + c_2 e^{-iE_2 t/\\hbar}|\\psi_2\\rangle$", "isCheapest": true }
          }
        },
        {
          "id": "sch-rq3",
          "question": "局部空間機率密度 $|\\Psi(\\mathbf{r},t)|^2$ 隨時間變化的連續性方程（機率流 $\\mathbf{j}$）長什麼樣？",
          "cells": {
            "sch-r1": { "text": "一步：用 $i\\hbar\\partial_t\\Psi$ 與其共軛式相減，直接湊出 $\\partial_t\\rho + \\nabla\\cdot\\mathbf{j}=0$", "isCheapest": true },
            "sch-r2": { "text": "定態機率密度不隨時間變，看不見一般非定態機率流（見讀法1）", "isInvisible": true, "pointsToReadingId": "sch-r1" },
            "sch-r3": { "text": "抽象ケット記號只見全域總機率為 1，看不見局部空間散度 $\\nabla\\cdot\\mathbf{j}$（見讀法1）", "isInvisible": true, "pointsToReadingId": "sch-r1" }
          }
        }
      ],
      "readingBridges": [
        {
          "id": "sch-b12",
          "fromReadingId": "sch-r1",
          "toReadingId": "sch-r2",
          "type": "限定範圍",
          "forwardProof": "當哈密頓量 $\\hat{H}$ 不顯含時間 $t$ 時，令 $\\Psi(\\mathbf{r},t)=\\psi(\\mathbf{r})e^{-iEt/\\hbar}$ 代入讀法1，消去時間因子即得讀法2。",
          "scopeCondition": "哈密頓算符 $\\hat{H}$ 不顯含時間（$\\partial\\hat{H}/\\partial t = 0$，守恆力場／時不變系統）。",
          "counterExample": "當外場隨時間劇烈振盪（如雷射場驅動 $\\hat{H}(t) = \\hat{H}_0 - d E_0\\cos(\\omega t)$）時，無法分離出單一能量定態 $\\hat{H}\\psi=E\\psi$，能量不再守恆。"
        },
        {
          "id": "sch-b13",
          "fromReadingId": "sch-r1",
          "toReadingId": "sch-r3",
          "type": "互通",
          "forwardProof": "對讀法1 的一階算符微分方程 $\\partial_t|\\Psi\\rangle = (-i\\hat{H}/\\hbar)|\\Psi\\rangle$（$\\hat{H}$ 不含時）積分，即得指數算符解 $|\\Psi(t)\\rangle = e^{-i\\hat{H}t/\\hbar}|\\Psi(0)\\rangle$。",
          "backwardProof": "對讀法3 的么正演化群 $U(t)=e^{-i\\hat{H}t/\\hbar}$ 求 $t$ 的一階導數並乘 $i\\hbar$，由 Stone 定理唯一還原讀法1。"
        },
        {
          "id": "sch-b23",
          "fromReadingId": "sch-r2",
          "toReadingId": "sch-r3",
          "type": "互通",
          "forwardProof": "將初態按讀法2 的完備本徵基底展開 $|\\Psi(0)\\rangle = \\sum c_n|\\psi_n\\rangle$，作用指數算符即得讀法3 各分量相位旋轉。",
          "backwardProof": "在讀法3 中取隨時間只轉整體相位的特例 $|\\Psi(t)\\rangle = e^{-iEt/\\hbar}|\\psi\\rangle$，即刻鎖定讀法2 的本徵態定義。"
        }
      ],
      "perspectives": [
        {
          "code": "算符視角",
          "label": "算符代數（生成元與本徵譜）",
          "content": "波函數的時間一階微分由哈密頓能量算子生成：$i\\hbar \\frac{\\partial}{\\partial t} |\\Psi(t)\\rangle = \\hat{H} |\\Psi(t)\\rangle$。",
          "mappingTable": "經典動量 $p$ ↔ 微分算符 $-i\\hbar\\nabla$；經典能量 $E$ ↔ 時間生成元 $i\\hbar\\partial_t$；可觀測量可能值 ↔ 厄米算符實本徵值 $E_n$",
          "derivedFact": "因為 $\\hat{H}$ 是自伴（厄米）算符，所有定態能量本徵值 $E_n$ 必然為實數，且不同能階本徵態必然正交。",
          "isAlsoReading": true,
          "linkedReadingId": "sch-r2"
        },
        {
          "code": "幾何視角",
          "label": "幾何希爾伯特向量",
          "content": "複希爾伯特空間中的單位態向量隨時間進行由么正算子 $U(t) = e^{-i\\hat{H}t/\\hbar}$ 驅動之純旋轉。",
          "mappingTable": "歸一化波函數 $\\int|\\Psi|^2=1$ ↔ 單位球面上的向量 $\\|\\Psi\\|=1$；時間演化 ↔ 么正旋轉 $U^\\dagger U = I$；測量機率 ↔ 內積投影平方 $|\\langle\\phi_n|\\Psi\\rangle|^2$",
          "derivedFact": "么正旋轉保持向量長度不變，因此若 $t=0$ 時總機率 $\\langle\\Psi(0)|\\Psi(0)\\rangle = 1$，則任意時刻 $t$ 總機率必恆為 $1$。",
          "isAlsoReading": true,
          "linkedReadingId": "sch-r3"
        },
        {
          "code": "[借鏡視角:兩端固定吉他弦駐波]",
          "label": "借鏡視角：吉他弦邊界駐波",
          "kind": "mirror",
          "content": "如同兩端栓死的吉他弦，只有半波長整數倍剛好嵌進弦長 $L$ 的諧波才能穩定存在，其餘頻率因邊界反射相消而無法成駐波。",
          "mappingTable": "吉他弦長 $L$ 與兩端固定節點 ↔ 無限深方勢阱寬度 $L$ 與邊界 $\\psi(0)=\\psi(L)=0$；基音與泛音頻率 $f_n = n f_1$ ↔ 離散本徵能階 $E_n = n^2 E_1$；同時撥出基音＋泛音的音色 ↔ 量子疊加態 $c_1\\psi_1 + c_2\\psi_2$",
          "derivedFact": "弦越短（$L$ 越小）基音頻率越高；對應粒子被束縛的空間越窄（$L\\to 0$），零點基態能量 $E_1 = \\frac{\\pi^2\\hbar^2}{2mL^2}$ 必然急遽升高（不能為 0）。"
        }
      ],
      "distinctionFromHow": "WHAT 確立波動力學的基本態空間與演化定律；HOW 則是針對特定勢阱（如無限深方勢阱、諧振子）求解二階常微分方程本徵值。",
      "extensions": {
        "translate": "用波動力學語言講「為什麼原子不會塌縮」：古典電子會輻射能量螺旋墜入原子核；但翻成波函數語言，電子是滿足邊界條件的駐波，最低能量態 $\\psi_0$ 已是能譜下界，沒有更低的態可以躍遷——「原子穩定」這個日常事實在本卡語言裡就是「基態存在且能量離散」。",
        "deeper": "奠基在希爾伯特空間的態向量公設、么正時間演化，以及愛因斯坦-德布羅意關係 $E=\\hbar\\omega,\\ p=\\hbar k$（後者為 [地位:歸納]）。",
        "shallower": "撐起能階量子化、穿隧效應、原子軌域與化學鍵理論；一切「解定態問題」的操作都從這條方程出發。",
        "generalize": "放寬「非相對論」→ 克萊因-高登／狄拉克方程；放寬「封閉體系」→ 開放系統的 Lindblad 主方程（么正性不再保持）。",
        "specialize": "收緊到 $V=0$ 自由粒子：解為平面波、能譜連續；收緊到無限深方勢阱：能譜 $E_n\\propto n^2$ 離散。",
        "construct": "用波函數 $\\Psi$ 與其空間梯度當零件，可以造出「機率流密度（Probability Current）」$\\mathbf{j} = \\frac{\\hbar}{m}\\text{Im}(\\Psi^*\\nabla\\Psi)$ 來刻畫量子機率在空間中的定向流動。",
        "constructDetails": {
          "name": "機率流密度 $\\mathbf{j} = \\frac{\\hbar}{2mi}(\\Psi^*\\nabla\\Psi - \\Psi\\nabla\\Psi^*)$",
          "choice": "為了讓機率密度 $\\rho = |\\Psi|^2$ 的時間變化率寫成局部守恆律 $\\partial_t\\rho + \\nabla\\cdot\\mathbf{j}=0$，選了取「$\\Psi^*\\nabla\\Psi$ 的虛部（反對稱組合）」，把純相位梯度 $\\nabla S$ 提取為流速。",
          "alternative": "若選實部 $\\text{Re}(\\Psi^*\\nabla\\Psi) = \\frac{1}{2}\\nabla(|\\Psi|^2)$，只會得到機率密度的高低起伏梯度，對實駐波也不為 0，完全無法反映粒子實際有否淨定向穿隧。",
          "linkBack": "連回對象：對 $\\partial_t(\\Psi^*\\Psi)$ 代入讀法1 的薛丁格方程與共軛方程，利用拉普拉斯恆等式 $\\Psi^*\\nabla^2\\Psi - \\Psi\\nabla^2\\Psi^* = \\nabla\\cdot(\\Psi^*\\nabla\\Psi - \\Psi\\nabla\\Psi^*)$，實勢能 $V$ 剛好相消，精確導出 $\\partial_t\\rho = -\\nabla\\cdot\\mathbf{j}$。"
        },
        "questions": {
          "deeper": "為什麼薛丁格方程對時間只能是一階導數 $\\partial_t$，而不能像經典波動方程那樣是二階導數 $\\partial_t^2$？",
          "shallower": "當粒子總能量 $E < V_0$（經典禁區）遇到有限高勢壘時，波函數在勢壘內會變成什麼形式，為什麼能穿隧過去？",
          "generalize": "當量子系統與外部環境熱庫耦合產生退相干時，純態薛丁格方程為何失效，需改用密度矩陣演化？",
          "specialize": "一維無限深方勢阱寬度擴大為原來的 2 倍時，基態與各激發態能階會變成原來的幾倍？",
          "translate": "為什麼氫原子的基態電子不會像繞地衛星摩擦減速那樣一路輻射電磁波掉進原子核裡？",
          "construct": "對於實數定態駐波 $\\psi_n(x)$，其空間各處的機率流密度 $\\mathbf{j}$ 是多少？換成行進平面波 $A e^{i(kx-\\omega t)}$ 時 $\\mathbf{j}$ 又是多少？"
        }
      }
    },
    "whyData": {
      "confidenceBefore": 3,
      "closedBookDraft": "為使物質波假設與能量-動量關係 $E = \\frac{p^2}{2m} + V$ 兼容，且波函數時間一階可保證因果預測性與機率守恆。",
      "fullReasoning": "經典平面波可寫為 $\\Psi = A e^{i(kx - \\omega t)}$。由愛因斯坦-德布羅意關係 $E = \\hbar \\omega$，$p = \\hbar k$。為將物理量提取為算符作用，定義動量算子 $\\hat{p} = -i\\hbar \\nabla$，能量算子 $\\hat{E} = i\\hbar \\frac{\\partial}{\\partial t}$。將非相對論經典能量關係 $E = \\frac{p^2}{2m} + V$ 作用於波函數，立即得到 $i\\hbar \\frac{\\partial}{\\partial t} \\Psi = \\left( -\\frac{\\hbar^2}{2m}\\nabla^2 + V \\right) \\Psi$。注意：這不是數學證明，而是基於對應原理與量子化約定的公設構建！",
      "confidenceAfter": 5,
      "perspective1": {
        "name": "哈密頓-雅可比光學力學類比",
        "failureMode": "當粒子速度接近光速時，一階時間非對稱與二階空間導致不相容，需進階至狄拉克旋量方程",
        "content": "短波極限（$\\hbar \\to 0$）波動光學退化為幾何光學，對應量子力學退化為牛頓軌道力學。"
      },
      "perspective2": {
        "name": "么正群連續對稱演化",
        "failureMode": "開體系測量坍縮過程非么正",
        "content": "機率總和恆為 1 要求時間演化算子必然么正 $U^\\dagger U = I$。"
      },
      "subGoals": [
        {
          "id": "ssg1",
          "goal": "證明全空間總機率隨時間守恆 $\\frac{d}{dt}\\int |\\Psi|^2 d^3r = 0$",
          "requiredParts": [
            "共軛薛丁格方程",
            "連續性方程機率流散度高斯定理"
          ],
          "whyNecessary": "波函數若機率不能保持為 1，則統計詮釋崩潰",
          "whySufficient": "由哈密頓算符自伴性（Hermitian $\\hat{H}^\\dagger = \\hat{H}$）保證本徵值為實數且範數不變"
        }
      ]
    },
    "assumptions": [
      {
        "id": "sa1",
        "name": "粒子運動處於非相對論能量區間 $v \\ll c$",
        "status": "locked",
        "description": "動能近似為 $p^2/(2m)$，未引入靜止質量能量對消"
      },
      {
        "id": "sa2",
        "name": "封閉孤立量子體系，無不可逆測量退相干",
        "status": "locked",
        "description": "波函數演化完全滿足么正性"
      }
    ],
    "claims": [
      {
        "id": "sc1",
        "text": "狀態演化遵循時間一階薛丁格方程式 $i\\hbar \\partial_t \\Psi = \\hat{H}\\Psi$",
        "epistemicMark": "⊢公設",
        "frameworkNote": "非相對論量子力學框架之第一公設"
      },
      {
        "id": "sc2",
        "text": "可觀測力學量以厄米算符表示，其本徵值為測量可能結果",
        "epistemicMark": "⊢公設",
        "frameworkNote": "測量公設"
      },
      {
        "id": "sc3",
        "text": "氫原子光譜能級精細結構計算中的微擾修正",
        "epistemicMark": "⊢近",
        "frameworkNote": "相對論動能修正與自旋-軌道耦合微擾近似"
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "sch-chk-1",
          "cue": "看到「微觀原子能級」「電子穿隧效應」「光子波包疊加」",
          "check": "檢查 德布羅意波長 $\\lambda = h/p$ 是否與系統特徵尺度相當，若相當則經典牛頓軌道失效",
          "source": "[源:定義]",
          "keywords": [
            "德布羅意波長",
            "量子穿隧",
            "能階量子化"
          ]
        },
        {
          "id": "sch-chk-2",
          "cue": "看到「粒子相對論動能可比擬靜質量」",
          "check": "檢查 是否越界套用了非相對論薛丁格方程（應切換至克萊因-高登或狄拉克方程）",
          "source": "[源:WHY-視角1]",
          "keywords": [
            "相對論修正",
            "狄拉克方程"
          ]
        }
      ],
      "branches": [
        {
          "id": "sh1",
          "title": "1. 寫出經典哈密頓量 $H(p, x)$ 並完成正則算符替換",
          "action": "寫出動能項與勢能項 $V(x)$，替換 $x \\to x, p \\to -i\\hbar \\frac{\\partial}{\\partial x}$ 得含時演化方程",
          "source": "[源:WHAT-讀法1]",
          "isCompiled": true
        },
        {
          "id": "sh2",
          "title": "2. 分離變量法求解定態本徵方程 $\\hat{H}\\psi_n = E_n \\psi_n$",
          "action": "套用邊界條件（波函數有限、連續、可微）篩選量子化能量特徵值 $E_n$",
          "source": "[源:WHAT-讀法2]",
          "isCompiled": true
        },
        {
          "id": "sh3",
          "title": "3. 展開任意初態並用么正相位因子演化",
          "action": "將初態投影為 $|\\Psi(0)\\rangle = \\sum c_n|\\psi_n\\rangle$，直接乘上各自相位因子 $\\sum c_n e^{-iE_n t/\\hbar}|\\psi_n\\rangle$",
          "source": "[源:WHAT-讀法3]",
          "isCompiled": true
        }
      ],
      "can": [
        {
          "id": "sch-can-1",
          "trigger": "看到「粒子被束縛在某個勢場裡求能階」的定態問題",
          "capability": "就能走「寫哈密頓 → 算符替換 → 分離變量＋邊界條件」這條固定生產線，把量子化能譜解出來",
          "source": "[源:WHAT-讀法2]"
        }
      ],
      "status": "compiled",
      "testNotes": "一維無限深方勢阱與諧振子閉卷展開推導已驗證。"
    },
    "originData": {
      "conflict": "↯ 德布羅意提出物質波假說後，德拜在學術報告中向薛丁格提出靈魂考問：「既然有波，就必須有一條描述波在時空傳播的波動方程式！」薛丁格從光學-力學類比出發，閉關構造出波動方程。"
    },
    "bloomLevel": "評鑑",
    "soloLevel": "抽象拓展",
    "soloData": {
      "declaredLevel": "抽象拓展",
      "evidence": [
        {
          "id": "sse1",
          "level": "多點結構",
          "text": "能分別操作波函數演化、算符本徵值、Born 機率詮釋。"
        },
        {
          "id": "sse2",
          "level": "關聯結構",
          "text": "能說明么正性、厄米性、機率守恆三者互相決定，並以傅立葉變換作為表象轉換前提 →。"
        },
        {
          "id": "sse3",
          "level": "抽象拓展",
          "text": "能跳出量子框架，用「連續對稱性 ↔ 守恆量」母題預測新體系行為，並反向推廣至宏觀熱力學熵 ⊃。"
        }
      ],
      "autoSuggestedLevel": "抽象拓展",
      "autoRationale": "此卡具 2 條關係邊（→ 前提、⊃ 推廣），屬已驗證母題成員，且已對母題外的新情境（馮諾依曼熵退化）做出成功預測，符合抽象拓展門檻。",
      "accepted": true,
      "history": [
        {
          "at": "2024-04-20",
          "from": "關聯結構",
          "to": "抽象拓展",
          "reason": "諾特母題預測在量子微擾論中驗證成功，可跨框架遷移。"
        }
      ]
    },
    "blockageNotes": "曾引發堵塞，已定位：將公設 ⊢公設 誤當成由牛頓力學 ⊢證 出來的推論，造成邏輯死結。",
    "intuitionTraps": [
      {
        "id": "it-sch1",
        "description": "看到「第一公設」時，會誤以為這是『已經被證明的結論』，因為它被定義為體系的起點",
        "whyMisleading": "公設語意上像是『被證明出來的東西』，但實際上它是『不再向下追問的邏輯起點』——既不對也不錯，而是不必證明也不能被證明。把公設當成『已證定理』，會在問『為什麼這條為真』時進入邏輯死結。",
        "correctUnderstanding": "公設的『不可問為什麼』不是因為它已經確證，而是因為它是邏輯上『不可再退』的出發點。檢查方法：如果問『這條是從哪一步推導出來的』只能回答『它是公設』，那它就是公設，不是定理。",
        "passed": true
      }
    ],
    "constructionCalibration": {
      "confidenceBefore": 4,
      "confidenceAfter": 3,
      "blindSpotNote": "原以為題目在問「怎麼從經典力學推導出波動方程」；寫完①②才發現真正的問題是「一個不可推導的公設，其構造邏輯為何有跡可循」——問的是構造而非推導。"
    },
    "backgroundData": {
      "situation": "電子繞原子核運轉時，古典物理會預測它會一路輻射能量、最後螺旋墜入原子核——但真實的原子是穩定的。情境二：同一個電子，換成「被束縛在一個小盒裡（無限深方勢阱）」這個情境，能量居然只能取離散值——換的是束縛條件這一個變數。",
      "preciseObject": "把電子狀態寫成一個複值波函數 $\\Psi(\\mathbf{r},t)$，其時間演化的形式是 $i\\hbar\\partial_t\\Psi = \\hat{H}\\Psi$。先給這個形式，動機是：它把「粒子」由一點彈珠改成「帶相位的機率幅」，用「電子在原子核旁」這個情境語言講，不是跳去純抽象算符。",
      "preciseQuestion": "對這個被束縛在原子核旁的電子，它的波函數 $\\Psi$ 隨時間怎麼演化、允許的能量值 $E_n$ 怎麼被這條方程逼成離散的——這條形式是怎麼構造出來的？"
    },
    "candidate": {
      "requirement": "需要一條描述波隨時間演化的方程，且要在 $\\hbar\\to 0$ 的極限下退化回古典力學（Hamilton-Jacobi）。",
      "candidateForm": "$i\\hbar\\partial_t\\Psi=\\hat{H}\\Psi$，其中動量 $p$、能量 $E$ 換成算符 $\\hat p=-i\\hbar\\nabla$、$\\hat E=i\\hbar\\partial_t$。",
      "motivation": "從「光學-力學類比」這個極限關係反推：幾何光學（只追光線路徑）是波動光學在短波極限的近似；那把古典力學也看成某種「波動力學」的短波極限，反著問完整版長什麼樣。算符替換不是推導、是構造啟發——是「用已知極限關係反推完整理論」這個摸索把它挑出來，不是因為 $i\\hbar$ 看起來高級。"
    },
    "plan": {
      "steps": [
        {
          "id": "p1",
          "label": "寫出經典能量關係 E=p²/2m+V",
          "rationale": "先決條件：算符替換要有對象，得先有經典非相對論的 E-p 關係"
        },
        {
          "id": "p2",
          "label": "做算符替換 p→-iℏ∇、E→iℏ∂_t 作用到波函數",
          "rationale": "依賴第 1 步：把同一條能量關係從數值升級成算子"
        },
        {
          "id": "p3",
          "label": "（範圍須誠實標記）證明這是公設而非定理",
          "rationale": "第 2 步得到的方程無法從古典力學「推導」出來，只能誠實標 [地位:公設]；這步不是可有可無，是守住認識論地位不越級"
        }
      ],
      "ranges": "「這條方程能否由更底層的原理導出」超出本卡範圍——它就是非相對論量子力學的出發公設，需另開「量子化對應原理」一卡。"
    }
  },
  {
    "id": "card-arithmetic-mean",
    "workspaceId": "default-scinotes-workspace",
    "title": "算術平均數（v7 附錄 C 完整範例）",
    "domain": "數學 / 統計與數據分析",
    "granularity": "L1 核心原理",
    "backgroundDescription": "位於「描述統計與歐氏空間正交投影」框架。本卡為手冊 v7 附錄 C 完整範例，展示 WHAT「讀法」（三個讀法、問題×讀法表、互通之橋）、視角×讀法雙獨立軸（天平支點等）、六個方向延伸與第 6 方向「造」（造出方差並以 [衍生]/[前提] 雙向邊連接）。",
    "cardFont": "caveat",
    "pageMode": "paged",
    "cardTags": ["[有分支]", "[純約定]"],
    "skillType": "通用技巧",
    "constructionCalibration": {
      "confidenceBefore": 4,
      "confidenceAfter": 5
    },
    "backgroundData": {
      "situation": "情境(1)：4 個人考試分別拿了 65、72、68、75 分，想用「一個數」代表這組人的整體表現，且希望把每個人的分數都拉平時總分不變。情境(2)：同樣這 4 個人的數據，若把每個人的分數看成數線上的釘子，想找一個支點位置 $c$，讓左右兩邊的偏差剛好正負抵消——兩個情境共用同一組數據，只換「總量守恆拉平」與「正負偏差平衡」這兩種要求。",
      "preciseObject": "對 $n$ 個實數 $x_1, x_2, \\dots, x_n$，算術平均數定義為 $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$。先給形式、再給動機：這個數同時是「拉平後保持總和 $\\sum x_i = n\\bar{x}$ 不變的高度」，也是「讓各數偏差和 $\\sum (x_i - \\bar{x}) = 0$ 歸零的唯一平衡點」。",
      "preciseQuestion": "對給定的一組數 $x_1,\\dots,x_n$，為什麼「總和除以個數」、「偏差正負相消的支點」、「削峰填谷拉平的高度」與「最小化平方誤差和 $\\sum(x_i-c)^2$ 的中心」全都指向同一個數 $\\bar{x}$，且在不同問題下哪種讀法最便宜？"
    },
    "constructionThinking": "從【背景】的問題出發：我們希望用單一代表值 $c$ 概括整組數 $x_1,\\dots,x_n$。如果要求「把每個 $x_i$ 都換成 $c$ 之後總和仍然等於原本總和」，就會直接得到 $nc = \\sum x_i$；如果要求「各數對 $c$ 的有向偏差加起來剛好相消」，就會得到 $\\sum (x_i - c) = 0$。這兩種看似不同的要求在代數上一步就能互推，但在解題時卻各自照亮完全不同的題型（見 WHAT 問題×讀法表）。",
    "candidate": {
      "requirement": "找到一個代表值 $c$，使得所有數據對它的有向偏差正負完全抵消 $\\sum_{i=1}^n (x_i - c) = 0$（同時保持總量 $\\sum x_i = nc$ 守恆）。",
      "candidateForm": "$\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$（等權重線性平均）。",
      "motivation": "由 $\\sum_{i=1}^n (x_i - c) = 0$ 把求和拆開得 $\\sum x_i - nc = 0$，唯一解出 $c = \\frac{1}{n}\\sum x_i$——不是隨便挑一個對稱式，而是「線性偏差相消」這個要求唯一逼出等權重總和除以 $n$。"
    },
    "thoughtPoints": [
      {
        "id": "tp-mean-1",
        "modeName": "恆等式拆項法（加減同項）",
        "question": "要證明 $c = \\bar{x}$ 能讓平方誤差和 $\\sum (x_i - c)^2$ 最小，能不能不用微積分求導，直接用讀法2 的 $\\sum(x_i - \\bar{x}) = 0$ 一眼看出來？",
        "answer": "在 $(x_i - c)$ 裡面插入 $-\\bar{x} + \\bar{x}$：$\\sum[(x_i - \\bar{x}) + (\\bar{x} - c)]^2 = \\sum(x_i - \\bar{x})^2 + 2(\\bar{x}-c)\\sum(x_i - \\bar{x}) + n(\\bar{x}-c)^2$。因為讀法2 保證中間交叉項 $\\sum(x_i - \\bar{x}) = 0$，只剩 $\\sum(x_i - \\bar{x})^2 + n(\\bar{x}-c)^2$，當 $c = \\bar{x}$ 時第二項為 0 達到嚴格最小！",
        "passed": true,
        "placement": "why",
        "createdAt": "2026-02-01"
      }
    ],
    "plan": {
      "steps": [
        {
          "id": "mp1",
          "label": "建立三個讀法（總和÷個數、偏差相消點、削峰填谷拉平高度）並證明兩兩互通",
          "rationale": "先鎖定三個讀法在實數域上完全等價，後續才能放心按題目切換最便宜的讀法"
        },
        {
          "id": "mp2",
          "label": "由讀法2 推導平方誤差分解恆等式 $\\sum(x_i-c)^2 = \\sum(x_i-\\bar{x})^2 + n(\\bar{x}-c)^2$",
          "rationale": "依賴第 1 步的 $\\sum(x_i-\\bar{x})=0$ 消去交叉項，這是連接平均數與下游「方差」的關鍵橋樑"
        }
      ],
      "ranges": "連續機率分佈的期望值 $\\mathbb{E}[X] = \\int x f(x)dx$ 測度論收斂性超出本卡範圍，本卡聚焦有限組實數 $x_1,\\dots,x_n$。"
    },
    "reasoningShape": "E",
    "shapeRationale": "核心結構為代表值的定義約定與三種等價讀法（總和÷個數、偏差相消、拉平高度）之間的雙射轉換。",
    "shapeConfidence": 95,
    "shapeAccepted": true,
    "whatData": {
      "summary": "算術平均數 $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$ 是將 $n$ 個數一視同仁拉平後的高度，也是各數有向偏差正負相消的唯一平衡支點。",
      "readings": [
        {
          "id": "mean-r1",
          "name": "讀法1：總和÷個數",
          "description": "$\\bar{x} = \\frac{x_1 + x_2 + \\cdots + x_n}{n}$——全部加起來再平分給 $n$ 份。"
        },
        {
          "id": "mean-r2",
          "name": "讀法2：各數偏差正負相消的平衡點",
          "description": "$\\sum_{i=1}^n (x_i - \\bar{x}) = 0$——高出 $\\bar{x}$ 的正偏差總和恰好抵消低於 $\\bar{x}$ 的負偏差總和。",
          "linkedPerspective": "可配視角：天平支點"
        },
        {
          "id": "mean-r3",
          "name": "讀法3：削峰填谷拉平後的高度",
          "description": "$n\\bar{x} = \\sum_{i=1}^n x_i$——把高的削下來填進低的，全部拉平後的共同高度。"
        }
      ],
      "readingQuestions": [
        {
          "id": "mean-rq1",
          "question": "給你一組數，算平均",
          "cells": {
            "mean-r1": { "text": "一步：加起來除以 n", "isCheapest": true },
            "mean-r2": { "text": "要解方程，繞" },
            "mean-r3": { "text": "要試高度，繞" }
          }
        },
        {
          "id": "mean-rq2",
          "question": "4個人平均70，前3人65、72、68，第4人？",
          "cells": {
            "mean-r1": { "text": "先乘回280再減，兩步" },
            "mean-r2": { "text": "一步：偏差 −5, +2, −2，差 +5，所以 75", "isCheapest": true },
            "mean-r3": { "text": "同讀法2，或同讀法1" }
          }
        },
        {
          "id": "mean-rq3",
          "question": "全部加 3，平均變多少？",
          "cells": {
            "mean-r1": { "text": "展開分子多出 3n 再除，兩步" },
            "mean-r2": { "text": "原點平移 3，一步" },
            "mean-r3": { "text": "整體抬高 3，零步", "isCheapest": true }
          }
        },
        {
          "id": "mean-rq4",
          "question": "新來一個比平均大的數，平均往哪動？",
          "cells": {
            "mean-r1": { "text": "代進公式通分比較，三步" },
            "mean-r2": { "text": "多了一個正偏差，支點右移，零步", "isCheapest": true },
            "mean-r3": { "text": "多了一塊高出來的，拉平後變高，零步", "isCheapest": true }
          }
        },
        {
          "id": "mean-rq5",
          "question": "$\\sum(x_i-\\bar{x})=0$ 為什麼恆成立？",
          "cells": {
            "mean-r1": { "text": "展開代進 $\\bar{x}$，兩步" },
            "mean-r2": { "text": "這就是讀法2本身", "isCheapest": true },
            "mean-r3": { "text": "高出的體積＝填進的體積，一步" }
          }
        },
        {
          "id": "mean-rq6",
          "question": "為什麼一個極端值就會把平均拉跑？",
          "cells": {
            "mean-r1": { "text": "$x_n$ 變大，$\\bar{x}$ 跟著線性變大，看得出但無感" },
            "mean-r2": { "text": "力臂長，1個遠的抵10個近的，一眼看見", "isCheapest": true },
            "mean-r3": { "text": "一座高山削平會抬高全場，看得見" }
          }
        }
      ],
      "readingBridges": [
        {
          "id": "mean-b12",
          "fromReadingId": "mean-r1",
          "toReadingId": "mean-r2",
          "type": "互通",
          "forwardProof": "由讀法1 $\\bar{x} = \\frac{1}{n}\\sum x_i$，算 $\\sum_{i=1}^n (x_i - \\bar{x}) = \\sum x_i - n\\bar{x} = \\sum x_i - \\sum x_i = 0$（得讀法2）。",
          "backwardProof": "由讀法2 $\\sum_{i=1}^n (x_i - c) = 0$ 展開得 $\\sum x_i - nc = 0$，兩邊除以 $n$ 得 $c = \\frac{1}{n}\\sum x_i = \\bar{x}$（得讀法1）。"
        },
        {
          "id": "mean-b13",
          "fromReadingId": "mean-r1",
          "toReadingId": "mean-r3",
          "type": "互通",
          "forwardProof": "由讀法1 $\\bar{x} = \\frac{1}{n}\\sum x_i$ 兩邊同乘 $n$ 得 $n\\bar{x} = \\sum x_i$，即 $n$ 個拉平高度 $\\bar{x}$ 的總和等於原總和（得讀法3）。",
          "backwardProof": "由讀法3 削峰填谷前後總量守恆 $\\sum_{i=1}^n x_i = n\\bar{x}$，兩邊除以 $n$ 即還原讀法1。"
        },
        {
          "id": "mean-b23",
          "fromReadingId": "mean-r2",
          "toReadingId": "mean-r3",
          "type": "互通",
          "forwardProof": "把讀法2 的 $\\sum(x_i - \\bar{x}) = 0$ 按高於／低於 $\\bar{x}$ 拆成兩半：$\\sum_{x_i > \\bar{x}}(x_i - \\bar{x}) = \\sum_{x_i < \\bar{x}}(\\bar{x} - x_i)$，左邊是削下的峰、右邊是填進的谷（得讀法3）。",
          "backwardProof": "讀法3 削下的體積等於填進的體積，移項合寫即得 $\\sum_{i=1}^n (x_i - \\bar{x}) = 0$（得讀法2）。"
        }
      ],
      "perspectives": [
        {
          "code": "天平支點視角",
          "label": "力學天平支點（附錄 C 範例）",
          "content": "把每個數 $x_i$ 當作在數線座標 $x_i$ 處放一顆等重砝碼，平均數 $\\bar{x}$ 就是放上去能讓整根橫桿水平不倒的支點。",
          "mappingTable": "每個數 $x_i$ ↔ 位置 $x_i$ 上放一個等重的東西；平均數 $\\bar{x}$ ↔ 支點位置；偏差 $(x_i-\\bar{x})$ ↔ 力臂（帶正負號）；$\\sum(x_i-\\bar{x})=0$ ↔ 力矩平衡，桿子水平",
          "derivedFact": "離支點 10 倍遠的 1 顆砝碼，力矩抵得過反方向 1 倍遠的 10 顆砝碼——直接導出算術平均數對單一極端值（outlier）極度敏感。",
          "isAlsoReading": true,
          "linkedReadingId": "mean-r2"
        },
        {
          "code": "幾何正交投影視角",
          "label": "歐氏空間全 1 向量正交投影",
          "content": "把 $(x_1,\\dots,x_n)$ 看成 $\\mathbb{R}^n$ 中的向量 $\\mathbf{x}$，拉平後的 $(\\bar{x},\\dots,\\bar{x})$ 就是 $\\mathbf{x}$ 在對角線方向 $\\mathbf{1}=(1,\\dots,1)$ 上的正交投影。",
          "mappingTable": "數據組 $(x_1,\\dots,x_n)$ ↔ 向量 $\\mathbf{x}\\in\\mathbb{R}^n$；常數向量 $(c,\\dots,c)$ ↔ 子空間 $c\\mathbf{1}$；偏差向量 $(x_i-\\bar{x})$ ↔ 垂直殘差 $\\mathbf{x}-\\bar{x}\\mathbf{1}$",
          "derivedFact": "正交投影殘差與基底垂直 $\\langle \\mathbf{x}-\\bar{x}\\mathbf{1}, \\mathbf{1}\\rangle = \\sum(x_i-\\bar{x}) = 0$，且由畢氏定理 $\\|\\mathbf{x}-c\\mathbf{1}\\|^2 = \\|\\mathbf{x}-\\bar{x}\\mathbf{1}\\|^2 + n(\\bar{x}-c)^2$ 直接導出 $c=\\bar{x}$ 使距離平方和最小。"
        },
        {
          "code": "[借鏡視角:並聯電容電荷平攤]",
          "label": "借鏡視角：相同電容器並聯均壓",
          "kind": "mirror",
          "content": "將 $n$ 個電容值皆為 $C$、初始電壓分別為 $V_1,\\dots,V_n$ 的電容器並聯導通，電荷重新分佈達到靜電平衡後的共同電壓就是算術平均 $\\bar{V} = \\frac{1}{n}\\sum V_i$。",
          "mappingTable": "初始電壓 $V_i$ ↔ 數據 $x_i$；單顆電容值 $C$（皆相等）↔ 等權重 $1$；總電荷守恆 $\\sum C V_i = n C \\bar{V}$ ↔ 削峰填谷總和守恆 $\\sum x_i = n\\bar{x}$；導通後共同電位 $\\bar{V}$ ↔ 算術平均數 $\\bar{x}$",
          "derivedFact": "並聯瞬間總電荷守恆但總靜電能由 $\\frac{1}{2}C\\sum V_i^2$ 降為 $\\frac{1}{2}nC\\bar{V}^2$（差額化為導線焦耳熱耗散 $\\ge 0$），直接導出平方平均大於等於算術平均：$\\frac{1}{n}\\sum x_i^2 \\ge \\bar{x}^2$。"
        }
      ],
      "distinctionFromHow": "WHAT 揭示平均數的三種讀法（總和÷個數、偏差相消支點、削峰填谷拉平）與正交投影本質；APPLY 則是依題目特徵切換最便宜的讀法（如用偏差法口算未知項、用拉平法秒答平移縮放）。",
      "extensions": {
        "deeper": "平均數把每個數一視同仁（權重都是 $1/n$）——這預設了每個數同等重要。",
        "shallower": "由 $\\sum(x_i-\\bar{x})=0$ 可推得 $\\sum(x_i-c)^2 = \\sum(x_i-\\bar{x})^2 + n(\\bar{x}-c)^2$，所以 $c=\\bar{x}$ 使平方誤差和最小。",
        "generalize": "權重放開為 $w_i$ → 加權平均；離散換連續 → 期望值 $\\int x f(x)\\,dx$；加法換乘法 → 幾何平均 $(\\prod x_i)^{1/n}$。",
        "specialize": "$n=2$ 時就是中點 $(x_1+x_2)/2$。",
        "translate": "質心座標 $x_{\\text{cm}} = \\frac{\\sum m_i x_i}{\\sum m_i}$，等質量時就是算術平均。（這條在手冊 v7 標為「翻譯」而非「視角」：因為等質量質心與算術平均是同一個式子換物理名詞，沒有第二個獨立結構。）",
        "construct": "用平均數當基準，可以造出「方差」來量一組數有多分散：$\\sigma^2 = \\frac{1}{n}\\sum(x_i-\\bar{x})^2$。",
        "constructDetails": {
          "name": "方差（Variance）$\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2$",
          "choice": "每個數離平均數有正有負，直接加會相消（讀法2）。為了不讓正負抵消，選了「平方」$(x_i-\\bar{x})^2$。",
          "alternative": "換一個選擇：選「絕對值」$\\frac{1}{n}\\sum|x_i-\\bar{x}|$（平均絕對偏差 MAD）——對極端值沒那麼敏感，但不可微、代數展開不漂亮，且使絕對偏差和 $\\sum|x_i-c|$ 最小的中心會變成「中位數」而非算術平均數。",
          "linkBack": "連回對象：為什麼方差裡減的是 $\\bar{x}$ 而不是別的數？因為由推淺恆等式 $\\sum(x_i-c)^2 = \\sum(x_i-\\bar{x})^2 + n(\\bar{x}-c)^2$，$\\bar{x}$ 剛好是讓 $\\sum(x_i-c)^2$ 最小的那個 $c$。"
        },
        "questions": {
          "deeper": "一門課期中考佔 30%、期末考佔 70%，小華考 60 和 80，他的學期總評是 (60+80)/2 = 70 嗎？",
          "shallower": "找一個數 $c$，讓 $(c-1)^2+(c-3)^2+(c-8)^2$ 最小，$c$ 是多少？",
          "generalize": "資產第一年漲 100%（變 2 倍）、第二年跌 50%（變 0.5 倍），兩年平均複合年化成長率是 (+100%−50%)/2 = +25% 嗎？該換哪種平均？",
          "specialize": "數線上座標 $-6$ 與 $+14$ 兩點的中點座標是多少？",
          "translate": "平面上三個質量皆為 $1\\text{kg}$ 的質點位於 $(0,0), (6,0), (0,9)$，系統質心座標在哪裡？",
          "construct": "甲組數據 70, 70, 70 與乙組數據 40, 70, 100 的算術平均數都是 70，如何構造一個可微的量來區分兩組的分散程度，且為何以 70 為中心時平方和最小？"
        }
      }
    },
    "whyData": {
      "confidenceBefore": 4,
      "closedBookDraft": "把 $\\bar{x} = (\\sum x_i)/n$ 乘過去就是 $n\\bar{x} = \\sum x_i$，移項就是 $\\sum(x_i - \\bar{x}) = 0$；平方和展開後交叉項因為 $\\sum(x_i - \\bar{x}) = 0$ 消失，所以 $c=\\bar{x}$ 最小。",
      "fullReasoning": "① 讀法等價推導：由定義 $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$ [地位:約定]，兩邊乘 $n$ 得 $\\sum_{i=1}^n x_i = n\\bar{x}$（讀法3：削峰填谷拉平總和守恆）；將右邊寫成 $\\sum_{i=1}^n \\bar{x}$ 移項即得 $\\sum_{i=1}^n (x_i - \\bar{x}) = 0$（讀法2：偏差正負相消） [地位:證明]。\n\n② 最小平方誤差性質（推淺與「造」方差的基礎）：對任意候選中心 $c\\in\\mathbb{R}$，將誤差拆為 $(x_i - c) = (x_i - \\bar{x}) + (\\bar{x} - c)$，平方求和得：\n$$\\sum_{i=1}^n (x_i - c)^2 = \\sum_{i=1}^n (x_i - \\bar{x})^2 + 2(\\bar{x} - c)\\underbrace{\\sum_{i=1}^n (x_i - \\bar{x})}_{=0\\text{（由讀法2）}} + n(\\bar{x} - c)^2 = \\sum_{i=1}^n (x_i - \\bar{x})^2 + n(\\bar{x} - c)^2$$\n因為 $n(\\bar{x} - c)^2 \\ge 0$，若且唯若 $c = \\bar{x}$ 時取等號，故 $\\bar{x}$ 是使平方誤差和最小的唯一中心 [地位:證明]。",
      "confidenceAfter": 5,
      "perspective1": {
        "name": "代數偏差分解視角（讀法2 消交叉項）",
        "failureMode": "當誤差度量改為絕對值 $\\sum|x_i-c|$ 時，無法展開出線性交叉項 $\\sum(x_i-\\bar{x})$，最優解不再是 $\\bar{x}$ 而是中位數",
        "content": "利用 $\\sum(x_i-\\bar{x})=0$ 直接令二次展開的交叉項歸零，一眼看出極小值點與最小殘差 $\\sum(x_i-\\bar{x})^2$。"
      },
      "perspective2": {
        "name": "幾何正交投影視角（畢氏定理）",
        "failureMode": "若空間不具歐氏內積結構（如 $L^1$ 或流形測地線距離），正交投影畢氏定理不再直接適用",
        "content": "向量 $\\mathbf{x}$ 到直線 $\\text{span}(\\mathbf{1})$ 的最短距離即正交投影 $\\bar{x}\\mathbf{1}$，殘差 $\\mathbf{x}-\\bar{x}\\mathbf{1} \\perp \\mathbf{1}$。"
      },
      "subGoals": [
        {
          "id": "msg1",
          "goal": "證明三個讀法兩兩互通，且 $c=\\bar{x}$ 唯一最小化平方誤差和 $\\sum(x_i-c)^2$",
          "requiredParts": [
            "① 由定義導出 $n\\bar{x}=\\sum x_i$ 與 $\\sum(x_i-\\bar{x})=0$",
            "② 展開 $\\sum((x_i-\\bar{x})+(\\bar{x}-c))^2$ 並用讀法2 消去交叉項"
          ],
          "whyNecessary": "沒有①的 $\\sum(x_i-\\bar{x})=0$，②的交叉項就消不掉；沒有②，就無法解釋為何下游「方差」必須以 $\\bar{x}$ 為減數中心",
          "whySufficient": "①鎖死一次線性平衡點，②鎖死二次平方誤差極小點，完整覆蓋本卡核心結論"
        }
      ]
    },
    "assumptions": [
      {
        "id": "ma1",
        "name": "各數據點權重相等（皆為 $1/n$）且屬於線性加法空間",
        "status": "locked",
        "kind": "scope",
        "description": "若各數據代表不同樣本量或不同重要度，需改用加權平均；若為比率／成長率連乘過程，需改用幾何平均。"
      }
    ],
    "claims": [
      {
        "id": "mc1",
        "text": "算術平均數定義為 $\\bar{x} = \\frac{1}{n}\\sum_{i=1}^n x_i$",
        "epistemicMark": "⊢約",
        "anchor": "[見WHAT讀法1]"
      },
      {
        "id": "mc2",
        "text": "各數對算術平均數之偏差總和恆為零 $\\sum_{i=1}^n (x_i - \\bar{x}) = 0$",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY推導①與讀法1↔讀法2之橋]"
      },
      {
        "id": "mc3",
        "text": "平方誤差分解恆等式 $\\sum(x_i-c)^2 = \\sum(x_i-\\bar{x})^2 + n(\\bar{x}-c)^2$，故 $c=\\bar{x}$ 使平方誤差和最小",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY推導②]"
      }
    ],
    "intuitionTraps": [
      {
        "id": "mean-it1",
        "description": "上山時速 30 公里、原路下山時速 60 公里，直覺會直接算往返平均速率為 $(30+60)/2 = 45$ 公里/小時。",
        "whyMisleading": "把「對速率求算術平均」誤當成「總路程除以總時間」——上下山相同的是「路程 $L$」而非「時間 $t$」，上山花了 $2$ 份時間、下山只花 $1$ 份時間，兩段速率的時間權重是 $2:1$ 而非 $1:1$。",
        "correctUnderstanding": "先檢查分母基底：平均速率定義是總路程÷總時間 $= \\frac{2L}{L/30 + L/60} = 40$（調和平均），不是算術平均！只有「同時間開兩段」才是算術平均。",
        "passed": true
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "mean-chk-1",
          "cue": "看到「求平均速率／平均成長率／不同人數班級合併平均」",
          "twoStageTransform": "先問「每個數背後的分母基底（時間、人數、本金）是否全部相同？組合方式是加法還是乘法？」",
          "check": "檢查 是否滿足等權重線性加總前提：等時間才用算術平均，等路程要用調和平均，連乘複利要用幾何平均，不同人數要用加權平均",
          "source": "[源:WHAT-延伸-推深][源:WHAT-延伸-推廣]",
          "keywords": ["平均速率", "調和平均", "幾何平均", "加權平均"]
        },
        {
          "id": "mean-chk-2",
          "cue": "看到「用平均數代表整體薪資／房價水平」",
          "check": "檢查 數據中是否有極端離群值（Outlier）：由天平支點視角，1 個極遠的大數力臂極長，會把支點 $\\bar{x}$ 嚴重拉偏，此時應同時檢查中位數",
          "source": "[源:WHAT-讀法2][源:WHAT-視角1]",
          "keywords": ["離群值", "極端值", "力臂"]
        }
      ],
      "branches": [
        {
          "id": "mb1",
          "title": "分支 1 · 直接求一組數的平均",
          "action": "直接全部相加除以個數 $\\bar{x} = (\\sum x_i)/n$；若數值都接近某基準數 $a$，先減 $a$ 算偏差平均再加回 $a$",
          "source": "[源:WHAT-讀法1][源:WHAT-讀法3]",
          "isCompiled": true
        },
        {
          "id": "mb2",
          "title": "分支 2 · 已知目標平均 $\\bar{x}$ 與前 $n-1$ 個數，反推第 $n$ 個數",
          "constructionAction": "不乘回總和 $n\\bar{x}$，改以目標平均 $\\bar{x}$ 為 0 基準線，寫出各已知數的有向偏差 $d_i = x_i - \\bar{x}$",
          "action": "利用偏差總和為 0（$\\sum d_i = 0$），口算前 $n-1$ 個偏差和，最後一項即為 $\\bar{x} - \\sum_{i=1}^{n-1} d_i$（例：4人平均70，前3人65,72,68 → 偏差 −5,+2,−2 合為 −5 → 第4人必為 70+5=75）",
          "source": "[源:WHAT-讀法2]",
          "isCompiled": true
        },
        {
          "id": "mb3",
          "title": "分支 3 · 全體數據平移 $+b$、縮放 $\\times a$ 或跨組拉平合併",
          "action": "由削峰填谷拉平高度直接得新平均 $a\\bar{x}+b$（零步）；跨組合併則先用 $n_1\\bar{x}_1 + n_2\\bar{x}_2$ 還原總量再除以 $(n_1+n_2)$",
          "source": "[源:WHAT-讀法3]",
          "isCompiled": true
        }
      ],
      "can": [
        {
          "id": "mean-can-1",
          "trigger": "看到「求一個數 $c$ 使平方距離和 $\\sum(x_i-c)^2$ 最小」的最優化問題",
          "capability": "不用微分求導，直接由平方誤差分解恆等式鎖定唯一最優解 $c = \\bar{x}$，且最小平方和即為 $n\\sigma^2$",
          "source": "[源:WHY-推導②]"
        },
        {
          "id": "mean-can-2",
          "trigger": "需要度量一組數據圍繞中心 $\\bar{x}$ 的離散程度時",
          "capability": "以 $\\bar{x}$ 為基準、取平方消除正負抵消，構造出下游核心量「方差 $\\sigma^2 = \\frac{1}{n}\\sum(x_i-\\bar{x})^2$」",
          "source": "[源:WHAT-延伸-造][源:關係邊-方差]"
        }
      ],
      "status": "compiled",
      "testNotes": "三個讀法切換與問題×讀法表 6 道題皆已閉卷秒答通過。"
    },
    "originData": {
      "conflict": "↯ 早期天文觀測同一顆星體位置時，多次測量值彼此矛盾。第谷與高斯等人面對「該挑最順眼的一次測量，還是把所有含誤差觀測結合成一個最佳估計值」的衝突，高斯結合最小平方法證明算術平均正是誤差服從常態分佈時的最大概似估計。"
    },
    "bloomLevel": "評鑑",
    "soloLevel": "關聯結構",
    "soloData": {
      "declaredLevel": "關聯結構",
      "evidence": [
        {
          "id": "mse1",
          "level": "單點結構",
          "text": "能背出總和除以個數 $\\bar{x} = (\\sum x_i)/n$。"
        },
        {
          "id": "mse2",
          "level": "多點結構",
          "text": "能分別使用讀法1（總和÷個數）、讀法2（偏差相消點）、讀法3（拉平高度）解各自最便宜的題。"
        },
        {
          "id": "mse3",
          "level": "關聯結構",
          "text": "能用互通之橋連接三個讀法，並透過「造」衍生出下游《方差》卡片（具 [衍生] 與反向 [前提] 邊對齊）。"
        }
      ],
      "autoSuggestedLevel": "關聯結構",
      "autoRationale": "具備 3 個互通讀法、完整問題×讀法表，且與《方差》形成雙向對齊的 [衍生]↔[前提] 關係邊。",
      "accepted": true,
      "history": []
    }
  },
  {
    "id": "card-variance",
    "workspaceId": "default-scinotes-workspace",
    "title": "方差（由平均數「造」出的離散度量）",
    "domain": "數學 / 統計與數據分析",
    "granularity": "L2 定理/機制",
    "backgroundDescription": "由《算術平均數》第六方向「造」衍生而來的核心量（對應關係邊：算術平均數 [衍生]→ 方差，且本卡具 [前提]→ 算術平均數）。用於量化數據圍繞平均數的分散程度。",
    "cardFont": "caveat",
    "pageMode": "single",
    "cardTags": ["[前提依賴]", "[純約定]"],
    "skillType": "通用技巧",
    "constructionCalibration": {
      "confidenceBefore": 4,
      "confidenceAfter": 5
    },
    "backgroundData": {
      "situation": "甲班成績 70, 70, 70，乙班成績 40, 70, 100。兩班的算術平均數都是 70，但甲班全員同分、乙班兩極分化——單靠平均數完全無法區分這兩種結構。",
      "preciseObject": "方差 $\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2$。它以算術平均數 $\\bar{x}$ 為基準，對每個偏差 $(x_i - \\bar{x})$ 先平方再取算術平均。",
      "preciseQuestion": "為什麼度量分散程度時不能直接把偏差 $(x_i - \\bar{x})$ 平均？選「平方」而非「絕對值」帶來什麼代數與幾何優勢？"
    },
    "constructionThinking": "直接把偏差加總 $\\sum(x_i - \\bar{x})$ 恆等於 0（見《算術平均數》讀法2），正負完全抵消。要消掉正負號，邏輯上有兩個主要候選：①取絕對值 $|x_i - \\bar{x}|$；②取平方 $(x_i - \\bar{x})^2$。選「平方」是因為它可微、能展開成平方之平均減平均之平方 $\\overline{x^2} - \\bar{x}^2$，且正好對應歐氏空間的畢氏定理與力學轉動慣量！",
    "candidate": {
      "requirement": "構造一個非負、對正負偏差對稱、且在全體數據相等時為 0 的離散度量。",
      "candidateForm": "$\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2 = \\left(\\frac{1}{n}\\sum_{i=1}^n x_i^2\\right) - \\bar{x}^2$。",
      "motivation": "選平方而非絕對值，不僅避開了 $\\sum(x_i-\\bar{x})=0$ 的正負相消，還讓獨立隨機變數相加時方差可以直接相加 $\\text{Var}(X+Y)=\\text{Var}(X)+\\text{Var}(Y)$。"
    },
    "plan": {
      "steps": [
        {
          "id": "vp1",
          "label": "由偏差平方平均定義導出速算恆等式 $\\sigma^2 = \\overline{x^2} - \\bar{x}^2$",
          "rationale": "這是連接讀法1（定義式）與讀法2（平方的平均減平均的平方）的互通之橋"
        }
      ],
      "ranges": "樣本方差除以 $n-1$（Bessel 修正無偏估計）需引入抽樣分佈自由度，另開卡片處理。"
    },
    "reasoningShape": "E",
    "shapeRationale": "以算術平均數為零件構造的新統計量定義，並具備定義式與展開速算式兩種等價讀法。",
    "shapeConfidence": 92,
    "shapeAccepted": true,
    "whatData": {
      "summary": "方差 $\\sigma^2 = \\frac{1}{n}\\sum(x_i-\\bar{x})^2 = \\overline{x^2} - \\bar{x}^2$ 度量數據偏離平均數 $\\bar{x}$ 的平方平均距離。",
      "readings": [
        {
          "id": "var-r1",
          "name": "讀法1：偏差平方的平均（$\\frac{1}{n}\\sum(x_i-\\bar{x})^2$）",
          "description": "先算每個數離平均數 $\\bar{x}$ 的偏差，平方後求平均——直接反映圍繞中心的離散度。",
          "linkedPerspective": "幾何視角：殘差向量長度平方"
        },
        {
          "id": "var-r2",
          "name": "讀法2：平方的平均減去平均的平方（$\\overline{x^2} - \\bar{x}^2$）",
          "description": "$\\sigma^2 = \\frac{1}{n}\\sum x_i^2 - \\left(\\frac{1}{n}\\sum x_i\\right)^2$——不必先對每一項減 $\\bar{x}$，可同步累加 $\\sum x_i$ 與 $\\sum x_i^2$。",
          "linkedPerspective": "力學視角：平行軸定理"
        }
      ],
      "readingQuestions": [
        {
          "id": "var-rq1",
          "question": "全體數據同時加 100（平移 $x_i + 100$），方差變多少？",
          "cells": {
            "var-r1": { "text": "零步：$x_i$ 與 $\\bar{x}$ 同加 100，相減偏差 $(x_i-\\bar{x})$ 完全不變，方差不變", "isCheapest": true },
            "var-r2": { "text": "要展開 $(x_i+100)^2$ 再減 $(\\bar{x}+100)^2$ 消項，三步且繞" }
          }
        },
        {
          "id": "var-rq2",
          "question": "已知 $\\sum_{i=1}^{10} x_i = 20$ 且 $\\sum_{i=1}^{10} x_i^2 = 90$，求方差？",
          "cells": {
            "var-r1": { "text": "不知道個別 $x_i$，看不見每項偏差 $(x_i-\\bar{x})$（見讀法2）", "isInvisible": true, "pointsToReadingId": "var-r2" },
            "var-r2": { "text": "一步：$\\overline{x^2} - \\bar{x}^2 = 90/10 - (20/10)^2 = 9 - 4 = 5$", "isCheapest": true }
          }
        }
      ],
      "readingBridges": [
        {
          "id": "var-b12",
          "fromReadingId": "var-r1",
          "toReadingId": "var-r2",
          "type": "互通",
          "forwardProof": "展開讀法1：$\\frac{1}{n}\\sum(x_i^2 - 2\\bar{x}x_i + \\bar{x}^2) = \\frac{1}{n}\\sum x_i^2 - 2\\bar{x}(\\frac{1}{n}\\sum x_i) + \\bar{x}^2 = \\overline{x^2} - \\bar{x}^2$（得讀法2）。",
          "backwardProof": "將讀法2 的 $\\overline{x^2} - \\bar{x}^2$ 改寫為 $\\frac{1}{n}\\sum x_i^2 - 2\\bar{x}^2 + \\bar{x}^2 = \\frac{1}{n}\\sum(x_i - \\bar{x})^2$（得讀法1）。"
        }
      ],
      "perspectives": [
        {
          "code": "幾何視角",
          "label": "殘差向量長度平方（畢氏定理）",
          "content": "在 $\\mathbb{R}^n$ 中，$\\frac{1}{\\sqrt{n}}\\mathbf{x}$ 分解為平行於 $\\mathbf{1}$ 的平均分量與垂直於 $\\mathbf{1}$ 的偏差分量，方差就是垂直殘差份額的長度平方。",
          "mappingTable": "$\\overline{x^2}$ ↔ 斜邊平方；$\\bar{x}^2$ ↔ 投影鄰邊平方；$\\sigma^2 = \\overline{x^2}-\\bar{x}^2$ ↔ 對邊殘差平方",
          "derivedFact": "斜邊平方必大於等於鄰邊平方，故 $\\sigma^2 = \\overline{x^2} - \\bar{x}^2 \\ge 0$（等價於柯西不等式），等號若且唯若所有 $x_i$ 全相等時成立。",
          "isAlsoReading": true,
          "linkedReadingId": "var-r1"
        },
        {
          "code": "力學視角",
          "label": "剛體轉動慣量與平行軸定理",
          "content": "把每個數據點看成單位質量質點，方差 $\\sigma^2$ 就是繞質心 $\\bar{x}$ 旋轉的比轉動慣量。",
          "mappingTable": "質心位置 $x_{\\text{cm}}$ ↔ 平均數 $\\bar{x}$；繞原點轉動慣量 $I_0/n = \\overline{x^2}$ ↔ 平方的平均；繞質心轉動慣量 $I_{\\text{cm}}/n = \\sigma^2$ ↔ 方差；平行軸定理 $I_0 = I_{\\text{cm}} + n\\bar{x}^2$ ↔ $\\overline{x^2} = \\sigma^2 + \\bar{x}^2$",
          "derivedFact": "繞任何偏離質心 $c\\neq \\bar{x}$ 的軸轉動慣量 $\\frac{1}{n}\\sum(x_i-c)^2 = \\sigma^2 + (\\bar{x}-c)^2$ 都比繞質心 $\\bar{x}$ 更大。",
          "isAlsoReading": true,
          "linkedReadingId": "var-r2"
        },
        {
          "code": "[借鏡視角:交流電有效值與直流紋波功率]",
          "label": "借鏡視角：電流直流分量與交流紋波功率",
          "kind": "mirror",
          "content": "電阻 $R=1\\Omega$ 上的電流訊號 $I(t)$ 拆為直流平均分量 $\\bar{I}$ 與交流波動分量 $I(t)-\\bar{I}$，交流紋波的平均發熱功率就是方差。",
          "mappingTable": "瞬時電流 $x_i$ ↔ 數據點；直流分量 $\\bar{x}$ ↔ 算術平均；直流功率 $\\bar{x}^2$ ↔ 平均之平方；總平均功率 $\\overline{x^2}$ ↔ 平方之平均；交流紋波功率 $\\sigma^2$ ↔ 方差",
          "derivedFact": "把訊號加上直流偏置（平移 $+b$）只改變直流功率，完全不改變交流紋波功率 $\\sigma^2$。"
        }
      ],
      "distinctionFromHow": "WHAT 說明方差由平均數經「選平方」構造而成及其兩種讀法；APPLY 則是根據題目給定「平移縮放」或「累加和 $\\sum x_i, \\sum x_i^2$」選擇讀法1 或讀法2。",
      "extensions": {
        "deeper": "奠基在《算術平均數》的偏差相消性質 $\\sum(x_i-\\bar{x})=0$ 與最小平方誤差性質上（見 [前提] 關係邊）。",
        "shallower": "開根號即得與原數據同量綱的「標準差 $\\sigma$」，並直接支撐柴比雪夫不等式 $P(|X-\\mu|\\ge k\\sigma)\\le 1/k^2$。",
        "generalize": "從單一變數 $(x_i-\\bar{x})^2$ 推廣為兩個變數的交叉乘積 $\\frac{1}{n}\\sum(x_i-\\bar{x})(y_i-\\bar{y})$，即得「共變異數（Covariance）」。",
        "specialize": "當數據只有 0 和 1（伯努利分佈，比例為 $p$）時，$\\overline{x^2} = \\bar{x} = p$，方差退化為 $p - p^2 = p(1-p)$。",
        "translate": "在投資組合中，資產報酬率的方差就是「波動風險（Volatility）」——分散投資降低風險就是利用不相關資產的平均使方差除以 $n$。",
        "construct": "將方差開根號得標準差 $\\sigma$ 後，用 $(x_i - \\bar{x})$ 除以 $\\sigma$ 可造出無量綱的「標準化分數（Z-score）」$z_i = \\frac{x_i - \\bar{x}}{\\sigma}$。",
        "constructDetails": {
          "name": "標準化分數（Z-score）$z_i = \\frac{x_i - \\bar{x}}{\\sigma}$",
          "choice": "為了跨不同單位（如身高 cm 與體重 kg）比較相對位置，選了先減 $\\bar{x}$ 歸零中心，再除以 $\\sigma = \\sqrt{\\sigma^2}$ 將尺度歸一化。",
          "alternative": "若除以全距 $(\\max x - \\min x)$（Min-Max 正規化），則只要有一個極端離群值就會把所有正常數據壓扁到 0 附近。",
          "linkBack": "連回對象：對 $z_i = (x_i-\\bar{x})/\\sigma$ 重新計算方差，因 $\\frac{1}{n}\\sum z_i^2 = \\frac{1}{\\sigma^2}\\cdot\\frac{1}{n}\\sum(x_i-\\bar{x})^2 = \\frac{\\sigma^2}{\\sigma^2} = 1$，恆鎖定方差為 1。"
        },
        "questions": {
          "deeper": "為什麼展開 $\\frac{1}{n}\\sum(x_i-\\bar{x})^2$ 時，中間項 $-\\frac{2\\bar{x}}{n}\\sum x_i$ 能跟 $+\\bar{x}^2$ 合併成 $-\\bar{x}^2$？依賴了平均數的哪一條定義？",
          "shallower": "若一組數據的方差 $\\sigma^2 = 4$（單位：$\\text{cm}^2$），它與原數據同單位的標準差是多少？",
          "generalize": "當兩個變數 $X, Y$ 變成同一個變數 $X=Y$ 時，共變異數 $\\text{Cov}(X,Y)$ 會退化成什麼？",
          "specialize": "投擲一枚正面機率 $p=0.5$ 的公正硬幣（正=1、反=0），得分的方差是多少？",
          "translate": "兩支基金年化報酬平均都是 8%，A 基金方差為 4、B 基金方差為 64，哪支基金的報酬波動風險較小？",
          "construct": "小華數學考 85 分（班平均 75、方差 25），英文考 80 分（班平均 70、方差 100），他在哪一科的相對排名位置較高？"
        }
      }
    },
    "whyData": {
      "confidenceBefore": 4,
      "closedBookDraft": "展開 $(x_i - \\bar{x})^2 = x_i^2 - 2\\bar{x}x_i + \\bar{x}^2$ 求平均，中間項變成 $-2\\bar{x}^2$，加最後一項得 $\\overline{x^2} - \\bar{x}^2$。",
      "fullReasoning": "由定義 $\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n (x_i - \\bar{x})^2$ [地位:約定]，展開平方並由線性性逐項求平均（引用 [前提] 算術平均數定義 $\\frac{1}{n}\\sum x_i = \\bar{x}$）：\n$$\\sigma^2 = \\frac{1}{n}\\sum_{i=1}^n x_i^2 - \\frac{2\\bar{x}}{n}\\sum_{i=1}^n x_i + \\frac{1}{n}\\sum_{i=1}^n \\bar{x}^2 = \\overline{x^2} - 2\\bar{x}^2 + \\bar{x}^2 = \\overline{x^2} - \\bar{x}^2$$\n[地位:證明]。再對線性變換 $y_i = a x_i + b$，因 $\\bar{y} = a\\bar{x} + b$，偏差 $(y_i - \\bar{y}) = a(x_i - \\bar{x})$，平移常數 $b$ 完全消去，平方平均後得 $\\sigma_y^2 = a^2 \\sigma_x^2$ [地位:證明]。",
      "confidenceAfter": 5,
      "perspective1": {
        "name": "代數展開視角（二階矩減一階矩平方）",
        "failureMode": "在浮點數數值計算中，當 $\\overline{x^2}$ 與 $\\bar{x}^2$ 非常接近且數值極大時，相減會發生災難性相消（Catastrophic Cancellation）導致精度喪失",
        "content": "$\\sigma^2 = \\overline{x^2} - \\bar{x}^2$ 把中心化平方和拆成原點二階矩與平均數平方之差。"
      },
      "perspective2": {
        "name": "幾何平移不變殘差視角",
        "failureMode": "對偏態或重尾分佈（如 Cauchy 分佈），二階矩發散，方差不再存在",
        "content": "偏差向量 $\\mathbf{x}-\\bar{x}\\mathbf{1}$ 對全體常數平移 $+b\\mathbf{1}$ 絕對不變，對縮放 $a$ 長度平方乘 $a^2$。"
      }
    },
    "assumptions": [
      {
        "id": "va1",
        "name": "二階矩有限且以算術平均數 $\\bar{x}$ 為中心",
        "status": "locked",
        "kind": "scope",
        "description": "依賴前置概念《算術平均數》存在且平方可積。"
      }
    ],
    "claims": [
      {
        "id": "vc1",
        "text": "方差定義為各數對算術平均數偏差之平方平均 $\\sigma^2 = \\frac{1}{n}\\sum(x_i-\\bar{x})^2$",
        "epistemicMark": "⊢約",
        "anchor": "[見WHAT讀法1]"
      },
      {
        "id": "vc2",
        "text": "方差速算恆等式 $\\sigma^2 = \\overline{x^2} - \\bar{x}^2$ 及平移縮放律 $\\text{Var}(aX+b) = a^2\\text{Var}(X)$",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY推導]"
      }
    ],
    "howData": {
      "checks": [
        {
          "id": "var-chk-1",
          "cue": "看到程式實作或大數值手算「$\\overline{x^2} - \\bar{x}^2$」（如數據為 100001, 100002, 100003）",
          "check": "檢查 是否會發生大數相減精度喪失（WHY 視角1 失效模式）：應先用讀法1 的平移不變性減去 100000 化為 1, 2, 3 再算！",
          "source": "[源:WHAT-讀法1][源:WHY-視角1]",
          "keywords": ["大數相減", "平移不變", "精度"]
        }
      ],
      "branches": [
        {
          "id": "vb1",
          "title": "分支 1 · 數據經線性變換 $y_i = a x_i + b$ 求新方差",
          "action": "直接砍掉平移項 $+b$，將原方差乘上 $a^2$：$\\sigma_y^2 = a^2 \\sigma_x^2$",
          "source": "[源:WHAT-讀法1]",
          "isCompiled": true
        },
        {
          "id": "vb2",
          "title": "分支 2 · 已知累加和 $\\sum x_i$ 與平方和 $\\sum x_i^2$ 求方差",
          "action": "直接代讀法2：$\\sigma^2 = \\frac{1}{n}\\sum x_i^2 - (\\frac{1}{n}\\sum x_i)^2$",
          "source": "[源:WHAT-讀法2]",
          "isCompiled": true
        }
      ],
      "can": [
        {
          "id": "var-can-1",
          "trigger": "看到不同單位或不同平均數的兩組分數要比較誰的相對表現更突出",
          "capability": "除以標準差 $\\sigma = \\sqrt{\\sigma^2}$ 轉為標準化 Z-score $(x_i - \\bar{x})/\\sigma$ 直接比大小",
          "source": "[源:WHAT-延伸-造]"
        }
      ],
      "status": "compiled",
      "testNotes": "平移縮放與展開式切換已閉卷驗證。"
    },
    "originData": {
      "conflict": "↯ 皮爾森與費雪（R. A. Fisher）在建立現代變異數分析（ANOVA）時，發現平均絕對偏差 $|x_i-\\bar{x}|$ 無法將組間變異與組內變異乾淨拆解相加，而平方形式（Variance）因滿足畢氏定理正交分解，能完美把總變異拆成獨立來源之和，遂定名為 Variance。"
    },
    "bloomLevel": "應用",
    "soloLevel": "關聯結構",
    "soloData": {
      "declaredLevel": "關聯結構",
      "evidence": [
        {
          "id": "vse1",
          "level": "關聯結構",
          "text": "與《算術平均數》形成雙向對齊的 [前提]↔[衍生] 關係邊，並連通歐氏空間畢氏定理與力學平行軸定理。"
        }
      ],
      "autoSuggestedLevel": "關聯結構",
      "autoRationale": "具雙向對齊的 [前提]/[衍生] 邊與多個讀法、視角，符合關聯結構。",
      "accepted": true,
      "history": []
    }
  }
]

export const SEED_CANVAS_OBJECTS: any[] = [
  {
    "id": "obj-card-carnot",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-thermo-carnot",
    "type": "card_node",
    "x": 60,
    "y": 60,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHAT",
    "content": {
      "cardId": "card-thermo-carnot"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#3b82f6",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1)"
    }
  },
  {
    "id": "obj-carnot-math",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-thermo-carnot",
    "type": "math",
    "x": 60,
    "y": 600,
    "width": 440,
    "height": 140,
    "rotation": 0,
    "zIndex": 3,
    "semanticType": "WHY",
    "content": {
      "latex": "\\eta_{\\text{Carnot}} = 1 - \\frac{T_C}{T_H} = \\frac{W_{\\text{net}}}{Q_H} \\le 1 - \\frac{T_{\\text{sink}}}{T_{\\text{source}}}",
      "title": "卡諾極限定理推導核心式",
      "epistemicMark": "⊢證"
    },
    "style": {
      "backgroundColor": "#f8fafc",
      "borderColor": "#93c5fd",
      "borderWidth": 1.5,
      "borderRadius": 8
    }
  },
  {
    "id": "obj-card-lechatelier",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-le-chatelier",
    "type": "card_node",
    "x": 560,
    "y": 60,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "HOW",
    "content": {
      "cardId": "card-le-chatelier"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#10b981",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(16, 185, 129, 0.1)"
    }
  },
  {
    "id": "obj-card-fourier",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-fourier-transform",
    "type": "card_node",
    "x": 1060,
    "y": 60,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHAT",
    "content": {
      "cardId": "card-fourier-transform"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#8b5cf6",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(139, 92, 246, 0.1)"
    }
  },
  {
    "id": "obj-card-schrodinger",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-schrodinger-eq",
    "type": "card_node",
    "x": 1060,
    "y": 600,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHY",
    "content": {
      "cardId": "card-schrodinger-eq"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#f59e0b",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(245, 158, 11, 0.1)"
    }
  },
  {
    "id": "obj-plot-wave",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-schrodinger-eq",
    "type": "plot",
    "x": 560,
    "y": 600,
    "width": 440,
    "height": 280,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHY_VISUAL",
    "content": {
      "title": "量子機率波包干涉圖形 $\\Psi(x) = e^{-x^2/4} \\cos(4x)$",
      "equationType": "wave_packet",
      "xMin": -5,
      "xMax": 5,
      "yMin": -1.2,
      "yMax": 1.2,
      "formula": "Math.exp(-x*x/4) * Math.cos(4*x)",
      "caption": "圖文獨立性檢查：文字必須自述波包包絡與載波相位的分離，不能把算符推導偷偷丟給圖示。"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#cbd5e1",
      "borderWidth": 1.5,
      "borderRadius": 8
    }
  },
  {
    "id": "obj-text-banner",
    "workspaceId": "default-scinotes-workspace",
    "type": "text",
    "x": 60,
    "y": 760,
    "width": 440,
    "height": 180,
    "rotation": 0,
    "zIndex": 1,
    "semanticType": "ASSUMPTION",
    "content": {
      "title": "理科認識論標記速查指南",
      "text": "【認識論標記五大地位】\n• ⊢證：由前提邏輯必然導出，無例外（嚴禁將經驗歸納或近似冒充為證）\n• ⊢歸：由有限實驗觀測總結，具可證偽性\n• ⊢近[框架]：在特定約束尺度（如低速、稀薄氣體）下的有效簡化\n• ⊢約：定義與符號協議（如 Born 統計詮釋）\n• ⊢公設[框架]：不可在體系內證明之出發基石"
    },
    "style": {
      "backgroundColor": "#eff6ff",
      "borderColor": "#bfdbfe",
      "borderWidth": 1,
      "borderRadius": 8,
      "color": "#1e3a8a",
      "fontSize": 13
    }
  },
  {
    "id": "obj-card-mean",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-arithmetic-mean",
    "type": "card_node",
    "x": 1560,
    "y": 60,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHAT",
    "content": {
      "cardId": "card-arithmetic-mean"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#0284c7",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(2, 132, 199, 0.12)"
    }
  },
  {
    "id": "obj-card-variance",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-variance",
    "type": "card_node",
    "x": 1560,
    "y": 600,
    "width": 440,
    "height": 520,
    "rotation": 0,
    "zIndex": 2,
    "semanticType": "WHAT",
    "content": {
      "cardId": "card-variance"
    },
    "style": {
      "backgroundColor": "#ffffff",
      "borderColor": "#0d9488",
      "borderWidth": 2,
      "borderRadius": 12,
      "shadow": "0 10px 25px -5px rgba(13, 148, 136, 0.12)"
    }
  }
];

export const SEED_RELATIONS: any[] = [
  {
    "id": "rel-carnot-lechatelier",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-thermo-carnot",
    "toCardId": "card-le-chatelier",
    "relationType": "analogy_verified",
    "distance": 1,
    "label": "≈[1] 熱力學自由能凸性與平衡自發回覆結構類比",
    "status": "active",
    "candidatePrediction": "若兩者均基於自由能極小原理，則化學平衡常數對溫度的響應方程（凡特霍夫）必然可精確退化為克勞修斯-克拉佩龍相變熱機方程。",
    "verificationResult": "已驗證：$\\frac{d\\ln K}{dT} = \\frac{\\Delta H}{RT^2}$ 與 $\\frac{dP}{dT} = \\frac{L}{T \\Delta V}$ 共享同源吉布斯自由能二階導數對稱矩陣。",
    "notes": "結構類比候選推理測試已通過，計入知識網整合度。"
  },
  {
    "id": "rel-schrodinger-fourier",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-schrodinger-eq",
    "toCardId": "card-fourier-transform",
    "relationType": "prerequisite",
    "distance": 1,
    "label": "→ 座標表象與動量表象之希爾伯特對偶依賴傅立葉積分",
    "status": "active",
    "notes": "波動力學算符對易關係 $[\\hat{x}, \\hat{p}] = i\\hbar$ 的連續基底展開嚴格以前提依賴傅立葉正交變換。"
  },
  {
    "id": "rel-thermo-schrodinger",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-schrodinger-eq",
    "toCardId": "card-thermo-carnot",
    "relationType": "generalization",
    "distance": 2,
    "label": "⊃ 量子統計系綜對象可推廣宏觀熱力學熵與能量極限",
    "status": "active",
    "notes": "馮諾依曼熵 $S = -k_B \\text{Tr}(\\rho \\ln \\rho)$ 在大微觀狀態數熱力學極限下退化為宏觀熱力學第二定律。"
  },
  {
    "id": "rel-lc-prereq-mass-action",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-le-chatelier",
    "toCardId": "ext-mass-action-law",
    "toTitle": "質量作用定律、化學平衡狀態的定義",
    "relationType": "prerequisite",
    "label": "[前提] 質量作用定律、化學平衡狀態的定義",
    "status": "active",
    "breakStep": "少了質量作用定律，「Q≠K 會驅動淨反應把 Q 拉回 K」這一步就沒有動力學依據，整條 WHY 的邏輯視角斷在起點",
    "notes": "手冊 v4 範例卡【關係邊】的 [前提] 邊；外部知識節點（非工作區卡片），故不畫進圖譜。"
  },
  {
    "id": "rel-lc-contrast-sn1sn2",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-le-chatelier",
    "toCardId": "ext-sn1-sn2",
    "toTitle": "SN1/SN2 機理選擇",
    "relationType": "contrast",
    "dimension": "決速步驟／底物結構偏好",
    "label": "[對照:d=決速步驟／底物結構偏好] SN1/SN2 機理選擇",
    "status": "active",
    "notes": "同樣是「擾動→系統如何響應」的判斷題型，但判斷依據完全不同，容易在解題時張冠李戴。手冊 v4 範例卡【關係邊】的 [對照] 邊；外部知識節點（非工作區卡片）。"
  },
  {
    "id": "rel-lc-analogy-negative-feedback",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-le-chatelier",
    "toCardId": "ext-negative-feedback-control",
    "toTitle": "負回饋控制系統（溫控器）",
    "relationType": "analogy_verified",
    "dimension": "偏離-回歸機制",
    "label": "[結構類比:d=偏離-回歸機制] 負回饋控制系統",
    "status": "active",
    "candidatePrediction": "由「偏離設定值→系統自動反向修正」這個共享結構，可以推測——溫控器的原理應該也是「測量偏離→驅動系統反向拉回」。",
    "verificationResult": "此推測與實際溫控器原理一致，驗證通過 → 升級為 [結構類比]。",
    "notes": "手冊 v4 範例卡【關係邊】的 [結構類比] 邊，已過候選推理測試；外部知識節點（非工作區卡片）。"
  },
  {
    "id": "rel-mean-derived-variance",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-arithmetic-mean",
    "toCardId": "card-variance",
    "relationType": "derived",
    "distance": 1,
    "label": "[衍生] 以平均數 x̄ 為基準，選「平方」消除正負偏差相消，造出方差 σ²",
    "status": "active",
    "notes": "v7 新增關係邊類型：A [衍生]→ B 表示 B 是用 A 造出來的（對應《算術平均數》WHAT 六方向延伸的第 6 方向「造」）。機械檢查：B（方差）必須有 [前提] 指回 A（算術平均數）。"
  },
  {
    "id": "rel-variance-prereq-mean",
    "workspaceId": "default-scinotes-workspace",
    "fromCardId": "card-variance",
    "toCardId": "card-arithmetic-mean",
    "relationType": "prerequisite",
    "distance": 1,
    "label": "[前提] 方差定義 σ² = (1/n)∑(xᵢ - x̄)² 與展開式依賴算術平均數 x̄",
    "status": "active",
    "breakStep": "少了算術平均數 x̄ 與 ∑(xᵢ - x̄) = 0，方差既無基準中心，展開式 σ² = x²̄ - x̄² 的交叉項也無法相消",
    "notes": "與 rel-mean-derived-variance 配對，通過 v7「A [衍生]→ B 則 B 須有 [前提] 指回 A」雙向機械檢查。"
  }
];

export const SEED_PROCESS_LOGS: any[] = [
  {
    "id": "log-schrodinger-understanding-blindspot",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-schrodinger-eq",
    "logType": "[增量]",
    "title": "理解問題階段盲區：以為在問「推導」，其實在問「公設的構造邏輯」",
    "oldContent": "動筆前信心 4★：以為題目是「如何從經典力學推導出薛丁格方程」，準備照 $E=p^2/2m+V$ 做算符替換當成證明。",
    "newContent": "寫完①契機②路徑後信心降為 3★：算符替換不是推導，是公設的構造啟發（光學-力學類比的極限反推）。題目真正在問的是「一個不可推導的起點，為何仍有跡可循」。",
    "explanation": "理解問題信心校準掉分（4→3）。依 v4 規則先不進 WHY，回頭補完①②，並把 [地位:公設(非相對論量子力學)] 明確標出，避免把公設寫成已證定理。這輪與 WHY 的 IOED 是獨立的兩次校準。",
    "createdAt": "2024-04-01T09:30:00.000Z"
  },
  {
    "id": "log-carnot-upgrade",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-thermo-carnot",
    "logType": "[框架衝突]",
    "title": "熱質守恆觀向熵增與能量守恆的框架升級",
    "oldContent": "卡諾 1824 原稿借用水輪機落水比喻，認為「熱質（Caloric）」在從高溫向低溫流動時總量守恆，僅是重力勢能落差對外作功。",
    "newContent": "克勞修斯與開爾文指出：高溫熱量吸入 $Q_H$ 中有一部分被實質轉化為功 $W$，其餘 $Q_C$ 排入低溫，熱質並不守恆；守恆的是總能量，而單向增加的是熵。",
    "explanation": "跨時間維度的重大理論框架升級（⚡），新舊理解並排陳列，警示不可將熱質落水模型與現代能量耗散混為一談。"
  },
  {
    "id": "log-schrodinger-orbit",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-schrodinger-eq",
    "logType": "[框架衝突]",
    "title": "波爾舊量子軌道模型 vs 薛丁格幾何機率幅雲",
    "oldContent": "波爾軌道假設：電子沿著半徑確定的圓周軌道繞原子核運轉，基態具有非零角動量 $L = 1\\hbar$。",
    "newContent": "波動力學：電子無經典軌跡，基態波函數為球對稱 $s$ 態，軌道角動量量子數嚴格為零（$L = 0$），位置以空間機率幅分佈。",
    "explanation": "直覺模型與精確公設體系的實質性衝突，揭示經典可想像的軌跡在量子尺度徹底失效。"
  },
  {
    "id": "log-lechatelier-incremental",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-le-chatelier",
    "logType": "[增量]",
    "title": "補充恆容與恆壓通入惰性氣體之本質差異",
    "oldContent": "原筆記僅籠統記錄「加壓平衡向氣體分子數減少方向移動」。",
    "newContent": "明確細分：只有引起『反應組分分壓改變』的加壓才影響平衡；恆容充惰氣雖然總壓增大，但反應物分壓不變，$Q_p$ 不變，平衡絲毫不動！",
    "explanation": "針對常見易混淆盲區進行的增量認知修正（⟲）。"
  },
  {
    "id": "log-lechatelier-catalyst-when",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-le-chatelier",
    "logType": "[增量]",
    "title": "催化劑卡關 → 轉折：K 的定義式裡沒有催化劑的位置",
    "oldContent": "[2026-01-15] 卡關：一開始以為催化劑會改變平衡位置，把「反應變快」和「平衡移動」混為一談。",
    "newContent": "[2026-01-16] 轉折：意識到 K 只隨溫度變，催化劑對正逆反應速率的加速倍數相同，K 的定義式裡沒有催化劑的位置 → WHEN 格補 [警示]（看到「催化劑」→ 判平衡不移動）。",
    "explanation": "對應 WHEN·警示第 1 條與盲區記錄「誤以為催化劑能增加平衡產率」：催化劑只加快雙向速率，不改變平衡常數與平衡位置。",
    "createdAt": "2026-01-16T00:00:00.000Z"
  }
];

export const SEED_BLIND_SPOTS: any[] = [
  {
    "id": "blindspot-catalyst-k",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-le-chatelier",
    "title": "誤以為催化劑能增加平衡產率或改變平衡常數",
    "description": "在複雜多步反應中，直覺容易被『反應加快了、產量變多了』的錯覺誤導，混淆了化學動力學速率與熱力學平衡位置的根本界限。",
    "domain": "化學 / 動力學",
    "severity": "high",
    "status": "open",
    "resolutionNotes": "需反覆檢查：催化劑僅降低活化能壁壘，同比例加速正逆反應速率，平衡常數 $K = k_f / k_r$ 分子分母同步放大，比值絕對不變。"
  },
  {
    "id": "blindspot-kelvin-temp",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-thermo-carnot",
    "title": "卡諾效率計算誤套用攝氏溫標造成虛假超額",
    "description": "例如 $T_H = 100^\\circ\\text{C}, T_C = 0^\\circ\\text{C}$，誤算為 $1 - 0/100 = 100\\%$，而實際絕對溫標為 $1 - 273/373 \\approx 26.8\\%$。",
    "domain": "物理 / 熱力學",
    "severity": "critical",
    "status": "resolved",
    "resolutionNotes": "已在 WHEN 觸發清單中加入第一條強制防呆條款：所有熱力學公式必須先將攝氏溫標轉換為開爾文絕對溫標（K）。"
  },
  {
    "id": "blindspot-negative-freq",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-fourier-transform",
    "title": "對傅立葉變換中負頻率 $-\\omega$ 的幾何物理意義感到困惑",
    "description": "常人難以想像震動怎麼會有負的次數，容易誤以為是純數學產生的冗餘偽解。",
    "domain": "數學 / 訊號處理",
    "severity": "medium",
    "status": "open",
    "resolutionNotes": "本質是複平面中向量旋轉的角速度方向：$+\\omega$ 表示逆時針旋轉，$-\\omega$ 表示順時針旋轉；實信號的共軛對稱性要求兩者疊加抵消虛部。"
  }
];

export const SEED_MOTHER_TOPICS: any[] = [
  {
    "id": "motif-noether-symmetry",
    "workspaceId": "default-scinotes-workspace",
    "title": "諾特定理母題：連續對稱性與守恆律的深層對偶",
    "description": "物理系統凡具備某個連續李群變換下的作用量不變性，必然對應一個物理守恆量（時間平移 ↔ 能量守恆；空間平移 ↔ 動量守恆；空間旋轉 ↔ 角動量守恆；U(1) 規範不變 ↔ 電荷守恆）。",
    "instanceCardIds": [
      "card-thermo-carnot",
      "card-schrodinger-eq",
      "card-fourier-transform"
    ],
    "hypothesisTest": "能否從該對稱母題推出新系統預測？在量子相干態中，若哈密頓量具備時間平移不變性，則定態波函數的能量期望值必然恆定，且能量算子與時間演化算子對易。",
    "predictionVerification": "已於量子力學一階微擾論與微觀能量守恆中嚴格驗證。滿足 ≥3 個實例 + 候選推理測試 + 新預測驗證成功，正式晉升為正規母題。",
    "isVerified": true
  }
];
