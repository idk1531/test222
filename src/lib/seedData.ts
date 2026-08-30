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
    "constructionThinking": "卡諾時代蒸汽機效率上限不明，工程界爭論不休。切入點不是直接算效率，而是問：『如果存在一台效率超過可逆極限的機器，能不能用它造出違反熱二律的複合裝置？』——這個反證法的切入角度，把『求極值』問題轉化為『檢驗一致性』問題，才是整套推導真正的契機。",
    "thoughtPoints": [
      {
        "id": "tp-carnot-1",
        "modeName": "反證法起手式",
        "question": "為什麼不直接求極值，而要先假設超卡諾機存在？",
        "answer": "因為熱機效率的解析式尚未建立，無法直接求導。但我們已經有熱二律的兩個等價表述（克勞修斯、開爾文），可以檢驗『如果存在超極限會發生什麼』——把存在性問題轉化為一致性問題。這是典型的『先假後證』策略。",
        "passed": true,
        "note": "最初混淆了『求極值』與『檢驗一致性』兩種思路，經提示才意識到後者不依賴解析式。",
        "createdAt": "2024-03-15"
      },
      {
        "id": "tp-carnot-2",
        "modeName": "複合裝置構造法",
        "question": "為什麼要把超卡諾機和逆向可逆機串聯？",
        "answer": "單獨一台超卡諾機只違反開爾文表述（熱完全轉功），但要把這個違反升級到克勞修斯表述（熱量自發從低溫流向高溫），必須讓它輸出的功去驅動一台逆向機——把兩臺機器的『違規效果』疊加，才能看出複合系統的單一效果直接撞克勞修斯。這是『構造反例』的典型套路。",
        "passed": false,
        "createdAt": "2024-03-18"
      }
    ],
    "reasoningShape": "A",
    "shapeRationale": "本知識點依據克勞修斯表述與開爾文表述之等價性，透過反證法構造可逆逆向機，形成嚴密的連鎖推導鏈條。",
    "shapeConfidence": 92,
    "shapeAccepted": true,
    "whatData": {
      "summary": "工作於兩恆溫熱庫之間的所有可逆熱機具有相同效率，且該效率是這兩熱庫間一切熱機的理論上限，僅由兩熱庫溫度決定。",
      "perspectives": [
        {
          "code": "L",
          "label": "代數定義",
          "content": "卡諾極限效率 $\\eta = 1 - \\frac{T_C}{T_H}$，由可逆循環熵積分為零 $\\oint \\frac{\\delta Q_{rev}}{T} = 0$ 保證。"
        },
        {
          "code": "G",
          "label": "幾何圖示",
          "content": "P-V 圖與 T-S 圖上的封閉等溫-絕熱四邊形圍成的面積即為對外輸出淨功。"
        },
        {
          "code": "P",
          "label": "物理機制",
          "content": "微觀機率分佈向高重數態擴散，宏觀表現為不可逆能量耗散，單一熱庫不可能自發無耗損作功。"
        },
        {
          "code": "I",
          "label": "直覺比喻",
          "content": "熱量不能自發從低溫流向高溫，正如水流在無外力泵送下絕不可能由低處自發湧向高處。"
        }
      ],
      "distinctionFromHow": "WHAT 闡明可逆熱機效率上限的必然約束本質；HOW 則是實際構建等溫-絕熱循環並計算各衝程狀態積分的工程執行步驟。"
    },
    "whyData": {
      "confidenceBefore": 3,
      "closedBookDraft": "若存在超卡諾熱機，其驅動反向卡諾機將把低溫熱庫熱量在無外界額外功輸入下抽往高溫熱庫，違反克勞修斯表述。",
      "fullReasoning": "設存在超卡諾機 $E'$ 使 $\\eta' > \\eta$。令 $E'$ 輸出功 $W$ 全額驅動逆向可逆卡諾熱機 $R$。因 $W = \\eta' Q'_H = \\eta Q_H$ 且 $\\eta' > \\eta$，必有 $Q'_H < Q_H$。考察複合系統，高溫熱庫淨得熱 $Q_H - Q'_H > 0$，低溫熱庫淨放熱 $Q_C - Q'_C = (Q_H - W) - (Q'_H - W) = Q_H - Q'_H > 0$。此複合裝置在無任何外界功介入下，達成熱量由低溫自發流向高溫之單一效果，直接違反熱力學第二定律之克勞修斯表述。故反證假設不成立，必然有 $\\eta' \\le \\eta$。",
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
        "correctUnderstanding": "溫度比（而非溫度絕對差）才決定效率，必須用絕對溫標計算比值 $\\frac{T_C}{T_H}$。"
      }
    ],
    "howData": {
      "steps": [
        {
          "id": "h1",
          "title": "確認高溫熱庫 $T_H$ 與低溫熱庫 $T_C$ 絕對數值",
          "action": "使用開爾文絕對溫標（K），嚴禁代入攝氏度（℃）",
          "isCompiled": true
        },
        {
          "id": "h2",
          "title": "代入卡諾極限公式評估理論上界",
          "action": "$\\eta_{max} = 1 - \\frac{T_C}{T_H}$，界定任何熱機設計之天花板",
          "isCompiled": true
        },
        {
          "id": "h3",
          "title": "計算不可逆熵增耗散度",
          "action": "評估 $\\Delta S_{univ} = \\Delta S_{sys} + \\Delta S_{env} \\ge 0$",
          "isCompiled": true
        }
      ],
      "status": "compiled",
      "testNotes": "閉卷展開推導已通過驗證，各衝程功積分完備。"
    },
    "whenData": {
      "triggers": [
        {
          "id": "w1",
          "cue": "看到「循環熱機」「理論最大效率」「冷熱源溫差」",
          "check": "檢查 溫標是否為絕對溫標，且是否誤把非可逆熱機套用卡諾公式",
          "keywords": [
            "熱機",
            "卡諾效率",
            "絕對溫標"
          ]
        },
        {
          "id": "w2",
          "cue": "看到「號稱熱效率高達 80% 的常溫新型發動機」",
          "check": "檢查 $\\eta \\le 1 - T_{cold}/T_{hot}$ 是否被突破（若突破則必為偽科學永動機）",
          "keywords": [
            "反常熱機",
            "極限審查"
          ]
        }
      ],
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
          "text": "能說明三個表述彼此等價，並用反證法把它們串成同一條推理鏈；且已與勒夏特列自由能凸性建立已驗證類比 ≈[1]。"
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
    ]
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
    "constructionThinking": "傅立葉研究熱傳導 PDE 時，遇到『任意初值如何分解為簡單諧波疊加』的問題。切入點是把有限維內積投影 $c_k = \\langle f, e_k\\rangle$ 直接推廣到連續情形：把離散求和 $\\sum c_k e_k$ 寫成連續積分 $\\int \\hat{f}(\\omega) e^{i\\omega t} d\\omega$。關鍵跳步是：『無窮維下內積仍成立嗎？正交性如何推廣？』——答案是用 Dirac delta 取代 Kronecker delta，這一步把有限維的基底概念『自然延伸』到連續譜。",
    "thoughtPoints": [
      {
        "id": "tp-fourier-1",
        "modeName": "離散-連續極限對照",
        "question": "離散求和怎麼過渡到連續積分？為什麼 $c_k$ 變成 $\\hat{f}(\\omega)$ 時還要除以 $2\\pi$？",
        "answer": "把週期 $T\\to\\infty$ 看：離散頻間隔 $\\Delta\\omega = 2\\pi/T \\to 0$，求和 $\\sum$ 變成 $\\frac{T}{2\\pi}\\int d\\omega$。係數 $c_k$ 在極限下變成 $\\hat{f}(\\omega)\\cdot\\Delta\\omega$，所以逆变换公式裡自然出現 $\\frac{1}{2\\pi}$。這個歸一化常數不是人爲約定，是極限過程的副產品。",
        "passed": true,
        "note": "最初誤以為 $\\frac{1}{2\\pi}$ 是『對稱化約定』，後來追到週期極限才發現是物理量綱導出的。",
        "createdAt": "2024-02-20"
      }
    ],
    "reasoningShape": "E",
    "shapeRationale": "本質是無窮維希爾伯特空間 $L^2$ 中選取連續複指數函數族作為正交基底之自同態投影定義與坐標變換。",
    "shapeConfidence": 94,
    "shapeAccepted": true,
    "whatData": {
      "summary": "將時域/空間域訊號分解為連續複指數正交基函數 $e^{i\\omega t}$ 之連續線性權重疊加，建立時頻雙射投影。",
      "perspectives": [
        {
          "code": "O",
          "label": "算符代數",
          "content": "微分算子 $\\frac{d}{dt}$ 的連續譜特徵函數展開，將微分運算簡化為頻域代數相乘。"
        },
        {
          "code": "G",
          "label": "幾何投影",
          "content": "希爾伯特空間 $L^2(\\mathbb{R})$ 中的基底正交變換：$\\hat{f}(\\omega) = \\langle f, e^{i\\omega t} \\rangle$。"
        },
        {
          "code": "P",
          "label": "物理波動",
          "content": "複合波分解為彼此獨立傳播、互不干涉的簡諧單色波疊加。"
        },
        {
          "code": "I",
          "label": "直覺比喻",
          "content": "如同光學稜鏡將白光折射解構為各單一頻率之彩虹光譜。"
        }
      ],
      "distinctionFromHow": "WHAT 闡述信號在特徵基底上的正交座標展開；HOW 則是利用換元積分、留數定理或 FFT 快速演算法計算頻譜。"
    },
    "whyData": {
      "confidenceBefore": 3,
      "closedBookDraft": "因為線性時不變（LTI）系統對複指數信號的響應僅改變振幅與相位，不產生新的頻率成分，故複指數是天然特徵基底。",
      "fullReasoning": "對任意線性時不變算子 $\\mathcal{L}$ 與輸入 $x(t) = e^{i\\omega t}$，響應為 $\\mathcal{L}[e^{i\\omega t}] = \\int h(\\tau) e^{i\\omega (t-\\tau)} d\\tau = [\\int h(\\tau) e^{-i\\omega \\tau} d\\tau] e^{i\\omega t} = H(\\omega) e^{i\\omega t}$。這說明所有連續複指數函數構成 LTI 系統的共同特徵向量。再由分佈正交性 $\\int_{-\\infty}^\\infty e^{i(\\omega - \\omega')t} dt = 2\\pi \\delta(\\omega - \\omega')$，可保證在狄利克雷條件下反變換完備性。",
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
      "steps": [
        {
          "id": "fh1",
          "title": "1. 驗證狄利克雷條件與有界變差",
          "action": "確認訊號在有限區間內間斷點有限且絕對可積",
          "isCompiled": true
        },
        {
          "id": "fh2",
          "title": "2. 進行連續傅立葉積分",
          "action": "$\\hat{f}(\\omega) = \\int_{-\\infty}^\\infty f(t) e^{-i\\omega t} dt$",
          "isCompiled": false
        },
        {
          "id": "fh3",
          "title": "3. 逆變換驗證特徵峰",
          "action": "$f(t) = \\frac{1}{2\\pi} \\int_{-\\infty}^\\infty \\hat{f}(\\omega) e^{i\\omega t} d\\omega$",
          "isCompiled": false
        }
      ],
      "status": "uncompiled",
      "testNotes": "包含未編譯步驟：非週期廣義信號之奇點留數積分尚未閉卷驗證完畢。"
    },
    "whenData": {
      "triggers": [
        {
          "id": "fw1",
          "cue": "看到「卷積微分方程」「濾波分析」「週期/擬週期信號頻譜」",
          "check": "檢查 系統是否為線性時不變（LTI），若存在非線性則不能直接套用疊加",
          "keywords": [
            "LTI",
            "卷積",
            "頻譜分解"
          ]
        }
      ],
      "enables": [
        {
          "id": "fe1",
          "trigger": "看到線性時不變系統的微分方程",
          "capability": "就能把微分運算轉換為頻域代數相乘，直接解出頻譜"
        },
        {
          "id": "fe2",
          "trigger": "看到量子力學的座標表象問題",
          "capability": "就能切換到動量表象，把微分算子轉化為代數運算"
        },
        {
          "id": "fe3",
          "trigger": "看到訊號處理的濾波需求",
          "capability": "就能設計頻域滤波器，實現時域卷積的等價操作"
        }
      ]
    },
    "originData": {
      "conflict": "↯ 傅立葉研究熱傳導時提出任意函數均可展開為三角級數，遭拉格朗日強烈反對（認為不連續函數不可能由光滑正弦疊加），直接逼使柯西與黎曼建立嚴格的微積分極限定義。"
    },
    "intuitionTraps": [
      {
        "id": "ft-it1",
        "description": "看到頻譜圖上的負頻率 $-\\omega$ 成分，會誤以為是『無意義的數學假象』或冗餘解",
        "whyMisleading": "實信號一定是偶對稱（$\\hat{f}(-\\omega) = \\hat{f}(\\omega)^*$），直覺上會覺得『震動怎麼可能有負的次數』——這是把它當成了物理量而非『複平面上的旋轉向量』。",
        "correctUnderstanding": "負頻率 $-\\omega$ 不是假象。它是複平面中與 $+\\omega$ 反向旋轉的向量；$+$與$-$疊加才能抵消虛部，構成實信號。這是『實信號必然是共軛對稱』的必然推論。"
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
    "blockageNotes": "注意負頻率 $-\\omega$ 的物理意義是旋轉複平面的反向向量，不可視為無意義數學假象。"
  },
  {
    "id": "card-le-chatelier",
    "workspaceId": "default-scinotes-workspace",
    "title": "勒夏特列原理與化學動態平衡響應",
    "domain": "化學 / 熱力學與平衡動力學",
    "granularity": "L3 技法/程序",
    "backgroundDescription": "位於「近平衡態熱力學穩定分支」框架。前置背景為化學平衡常數 $K$ 與反應商 $Q$ 的定義，以及吉布斯自由能極小判據；本卡是把抽象自由能判據轉譯為考場與工廠可即時操作的方向判定流程。",
    "cardFont": "indie",
    "pageMode": "paged",
    "constructionThinking": "原始表述『系統受擾動後向抵消擾動方向移動』只是現象描述，未說明為什麼。更 precise 的問法：平衡在數學上是什麼——就是 Q=K 的狀態。任何讓 Q 偏離 K 的操作，系統必然淨反應把 Q 拉回 K。切入點是『把化學平衡從口語翻譯成 Q 和 K 的相對大小』，這個翻譯把定性口訣變成可定量操作的判斷流程。",
    "thoughtPoints": [
      {
        "id": "tp-lc-1",
        "modeName": "Q/K 比較判別法",
        "question": "為什麼加壓那步的 f² 推導中，分子變 (1/f)² 倍、分母變 (1/f)⁴ 倍，相除得 f² 倍？",
        "answer": "反應 $N_2+3H_2 \\rightleftharpoons 2NH_3$，$Q = [NH_3]^2/([N_2][H_2]^3)$。加壓至 f 倍（體積變 1/f），各濃度變原來 1/f 倍。分子 $[NH_3]^2$ 變 $(1/f)^2$；分母 $[N_2][H_2]^3$ 變 $(1/f)(1/f)^3 = (1/f)^4$。相除 $(1/f)^2/(1/f)^4 = f^2$。因 $f<1$（加壓），$f^2<1$，故 $Q'<K$，淨正向。",
        "passed": false,
        "createdAt": "2024-01-15"
      }
    ],
    "reasoningShape": "COMPOSITE",
    "compositeShapes": [
      "C",
      "A"
    ],
    "compositeNote": "複合型：外層是 C 判別程序型（識別擾動 → 分支判定 → 輸出移動方向），但其正當性內核是 A 推導鏈型（由 $dG = \\sum \\mu_i dn_i$ 自由能凸性推出回覆方向）。若只背 C 的流程而缺 A 的內核，遇到恆容充惰氣、催化劑等陷阱必然誤判。",
    "shapeRationale": "外層可執行流程具備明確輸入、條件分支與輸出判定（C 型）；但其成立理由必須回到自由能極小與二階凸性的嚴格演繹鏈（A 型），兩者缺一不可，故判為複合型。",
    "shapeConfidence": 88,
    "shapeAccepted": true,
    "whatData": {
      "summary": "處於動態平衡的體系若受外在條件（濃度、壓強、溫度）擾動，平衡將向著減弱該擾動的方向移動以重新建立平衡。",
      "perspectives": [
        {
          "code": "L",
          "label": "反應商判據",
          "content": "比較反應商 $Q$ 與平衡常數 $K(T)$：$Q < K$ 朝正向自發移動，$Q > K$ 朝逆向移動。"
        },
        {
          "code": "P",
          "label": "微觀速率差",
          "content": "外在擾動使正逆反應速率 $v_f$ 與 $v_r$ 出現暫態失衡，差值驅動宏觀組分調整直至 $v_f = v_r$。"
        },
        {
          "code": "I",
          "label": "彈性負回授",
          "content": "如同受壓彈簧產生抵抗形變的反作用力，熱力學體系內在具有抑制外加改變的負回授傾向。"
        }
      ],
      "distinctionFromHow": "WHAT 描述熱力學自發趨穩的平衡方向性；HOW 則是具體寫出各組分分壓、溫度梯度與反應商的逐步判定流程。"
    },
    "whyData": {
      "confidenceBefore": 2,
      "closedBookDraft": "如果平衡朝著增強擾動的方向移動，系統自由能將越發背離極小值，導致爆炸或發散，無法維持穩定相態。",
      "fullReasoning": "在恆溫恆壓下，化學平衡對應吉布斯自由能全局極小值點 $dG = \\sum \\mu_i dn_i = 0$ 且 $\\frac{\\partial^2 G}{\\partial \\xi^2} > 0$（自由能凸性）。外加擾動（如增加反應物濃度）實質上改變了反應物的化學勢 $\\mu_{react}$，造成化學親和力 $A = -\\Delta_r G_m > 0$。根據熱力學第二定律，自發過程必然沿著自由能梯度下降方向進行（$dG < 0$），故反應進度 $\\xi$ 必然向前推進以消耗新加入之反應物，宏觀表現為減弱擾動。",
      "confidenceAfter": 4,
      "perspective1": {
        "name": "自由能極小凸性機制",
        "failureMode": "在遠離平衡態的耗散結構（如 B-Z 震盪反應）中可能出現自催化正回授震盪",
        "content": "熱力學穩定條件 $\\partial^2 G / \\partial \\xi^2 > 0$ 決定回覆力符號。"
      },
      "perspective2": {
        "name": "質量作用定律微觀動力學",
        "failureMode": "非基元反應需考慮多步活化能屏障與催化吸附飽和效應",
        "content": "活度增加直接增加分子碰撞機率，正向速率暫態超前。"
      },
      "subGoals": [
        {
          "id": "lsg1",
          "goal": "證明恆容充入惰性氣體平衡不移動",
          "requiredParts": [
            "各反應組分分壓公式",
            "濃度商定義式"
          ],
          "whyNecessary": "總壓雖然上升，但各反應物與產物的分壓 $P_i = \\frac{n_i RT}{V}$ 保持不變",
          "whySufficient": "$Q_p = \\prod P_i^{\\nu_i}$ 數值完全未變，$Q_p = K_p$ 平衡條件依然嚴格滿足"
        }
      ]
    },
    "assumptions": [
      {
        "id": "la1",
        "name": "反應處於近平衡態之熱力學穩定分支",
        "status": "locked",
        "description": "無外加持續強能量驅動引發非線性混沌"
      }
    ],
    "claims": [
      {
        "id": "lc1",
        "text": "凡特霍夫方程式給出溫度對平衡常數的定量影響 $\\frac{d\\ln K}{dT} = \\frac{\\Delta_r H_m^\\circ}{RT^2}$",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY自由能凸性]"
      },
      {
        "id": "lc2",
        "text": "催化劑同等比例降低正逆活化能，絕對不改變平衡常數與平衡產率",
        "epistemicMark": "⊢證",
        "anchor": "[見WHY視角2（微觀動力學）]"
      },
      {
        "id": "lc3",
        "text": "一般溶液中將活度係數 $\\gamma_i$ 視為 1 採用摩爾濃度代入",
        "epistemicMark": "⊢近",
        "frameworkNote": "稀溶液理想溶體近似"
      }
    ],
    "howData": {
      "steps": [
        {
          "id": "lh1",
          "title": "1. 識別擾動類別（溫度 / 濃度 / 總壓 / 體積）",
          "action": "明確該擾動是改變了 $K(T)$ 還是僅改變了反應商 $Q$",
          "isCompiled": true
        },
        {
          "id": "lh2",
          "title": "2. 檢查催化劑防呆條件",
          "action": "看到催化劑：立即判定平衡位置完全不變，僅改變抵達平衡所需時間",
          "isCompiled": true
        },
        {
          "id": "lh3",
          "title": "3. 依據反應焓變符號判定溫度效應",
          "action": "吸熱反應 $\\Delta H > 0$ 升溫使 $K$ 增大平衡正移；放熱相反",
          "isCompiled": true
        }
      ],
      "status": "compiled",
      "testNotes": "判別程序完備且各分支防呆條款已驗證。"
    },
    "whenData": {
      "triggers": [
        {
          "id": "lw1",
          "cue": "看到「容器加壓 / 充入惰性氣體」",
          "check": "檢查 容器為『恆容』還是『恆壓』！恆容下充惰氣平衡絕對不移動",
          "keywords": [
            "恆容",
            "惰性氣體",
            "分壓不變"
          ]
        },
        {
          "id": "lw2",
          "cue": "看到「加入高效催化劑」",
          "check": "檢查 平衡轉化率或 $K$ 值是否被誤判為增加（嚴格無效）",
          "keywords": [
            "催化劑",
            "平衡不變"
          ]
        }
      ]
    },
    "originData": {
      "conflict": "↯ 19世紀末化學工業迅速擴張，高溫高壓合成氨（Haber-Bosch法）面臨產率與反應速率的尖銳矛盾（低溫產率高但速率極慢，高溫速率快但產率極低），迫切需要理清熱力學平衡響應規律。"
    },
    "bloomLevel": "應用",
    "soloLevel": "多點結構",
    "soloData": {
      "declaredLevel": "多點結構",
      "evidence": [
        {
          "id": "lse1",
          "level": "單點結構",
          "text": "能背出「平衡向減弱擾動方向移動」這句話。"
        },
        {
          "id": "lse2",
          "level": "多點結構",
          "text": "能分別處理濃度、壓強、溫度、催化劑四類擾動，但四者尚未收束成單一自由能判據。"
        }
      ],
      "autoSuggestedLevel": "關聯結構",
      "autoRationale": "此卡已有 1 條已驗證結構類比 ≈[1] 指向卡諾定理，且其 WHY 已把四類擾動統一到自由能凸性，實質已達關聯結構，建議升級。",
      "accepted": false,
      "history": [
        {
          "at": "2024-02-11",
          "from": "單點結構",
          "to": "多點結構",
          "reason": "補齊恆容/恆壓惰氣差異與催化劑防呆後，四類擾動皆可獨立處理。"
        }
      ]
    },
    "blockageNotes": "曾引發堵塞，已定位：把恆壓充惰氣（體積擴大分壓減小）與恆容充惰氣（分壓不變）混淆。"
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
    "constructionThinking": "德布羅意提出物質波後，核心問題是：波動方程長什麼樣？切入點是光學-力學類比（Hamilton-Jacobi）：幾何光學是波動光學的短波極限，經典力學應該對應某種波動力學的短波極限。薛丁格『反過來』問：既然經典力學像幾何光學，那完整的『波動版』是什麼？把 $E=p^2/(2m)+V$ 直接替換 $E\\to i\\hbar\\partial_t, p\\to -i\\hbar\\nabla$，作用到波函數，就得到薛丁格方程。這不是推導，是公設的構造——但它的構造邏輯有跡可循。",
    "thoughtPoints": [
      {
        "id": "tp-sch-1",
        "modeName": "類比反推構造法",
        "question": "為什麼可以從『幾何光學是波動光學的短波極限』反推出薛丁格方程？類比的合法性在哪？",
        "answer": "不是直接類比，是用『已知極限關係』反推完整理論的構造策略。幾何光學（射線）↔ 波動光學（波動方程）的極限關係已知；經典力學（牛頓軌道）↔ ？的極限關係也已知（$\\hbar\\to 0$）。構造完整波動方程的策略是：找到一個波動方程，讓它在 $\\hbar\\to 0$ 極限下退化回 Hamilton-Jacobi。代入檢驗後發現線性 $i\\hbar\\partial_t$ 形式恰好符合——這是『極限反推構造』的典型套路。",
        "passed": true,
        "note": "最初把類比當成直接推導，後來意識到這只是『構造啟發』，不是『邏輯必然』，才接受它是公設而非定理。",
        "createdAt": "2024-04-02"
      }
    ],
    "reasoningShape": "D",
    "shapeRationale": "薛丁格方程式在非相對論量子力學中無法由牛頓力學或經典電磁學直接推導，其地位是體系的基礎公設與演化框架。",
    "shapeConfidence": 95,
    "shapeAccepted": true,
    "whatData": {
      "summary": "非相對論微觀體系的量子態由複值波函數 $\\Psi(\\mathbf{r}, t)$ 完全表徵，其時間演化由薛丁格方程決定，對應哈密頓算符作用。",
      "perspectives": [
        {
          "code": "O",
          "label": "算符代數",
          "content": "波函數的時間一階微分由哈密頓能量算子生成：$i\\hbar \\frac{\\partial}{\\partial t} |\\Psi(t)\\rangle = \\hat{H} |\\Psi(t)\\rangle$。"
        },
        {
          "code": "P",
          "label": "機率波詮釋",
          "content": "Born 統計詮釋：$|\\Psi(\\mathbf{r},t)|^2 d^3r$ 代表在時空點找到粒子的客觀機率密度。"
        },
        {
          "code": "G",
          "label": "幾何希爾伯特向量",
          "content": "複希爾伯特空間中的單位態向量隨時間進行由么正算子 $U(t) = e^{-i\\hat{H}t/\\hbar}$ 驅動之純旋轉。"
        },
        {
          "code": "I",
          "label": "直覺比喻",
          "content": "微觀粒子不是一顆定點彈珠，而是一團攜帶相位資訊與干涉特性的幾何機率振幅雲。"
        }
      ],
      "distinctionFromHow": "WHAT 確立波動力學的基本態空間與演化定律；HOW 則是針對特定勢阱（如無限深方勢阱、諧振子）求解二階常微分方程本徵值。"
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
      "steps": [
        {
          "id": "sh1",
          "title": "1. 寫出經典哈密頓量 $H(p, x)$",
          "action": "寫出動能項與勢能項 $V(x)$",
          "isCompiled": true
        },
        {
          "id": "sh2",
          "title": "2. 正則量子化算符替換",
          "action": "$x \\to x, p \\to -i\\hbar \\frac{\\partial}{\\partial x}$",
          "isCompiled": true
        },
        {
          "id": "sh3",
          "title": "3. 分離變量法求解定態本徵方程 $\\hat{H}\\psi_n = E_n \\psi_n$",
          "action": "套用邊界條件（波函數有限、連續、可微）篩選量子化能量特徵值",
          "isCompiled": true
        }
      ],
      "status": "compiled",
      "testNotes": "一維無限深方勢阱與諧振子閉卷展開推導已驗證。"
    },
    "whenData": {
      "triggers": [
        {
          "id": "sw1",
          "cue": "看到「微觀原子能級」「電子穿隧效應」「光子波包疊加」",
          "check": "檢查 德布羅意波長 $\\lambda = h/p$ 是否與系統特徵尺度相當，若相當則經典牛頓軌道失效",
          "keywords": [
            "德布羅意波長",
            "量子穿隧",
            "能階量子化"
          ]
        },
        {
          "id": "sw2",
          "cue": "看到「粒子相對論動能可比擬靜質量」",
          "check": "檢查 是否越界套用了非相對論薛丁格方程（應切換至克萊因-高登或狄拉克方程）",
          "keywords": [
            "相對論修正",
            "狄拉克方程"
          ]
        }
      ]
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
        "correctUnderstanding": "公設的『不可問為什麼』不是因為它已經確證，而是因為它是邏輯上『不可再退』的出發點。檢查方法：如果問『這條是從哪一步推導出來的』只能回答『它是公設』，那它就是公設，不是定理。"
      }
    ]
  }
];

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
  }
];

export const SEED_PROCESS_LOGS: any[] = [
  {
    "id": "log-carnot-upgrade",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-thermo-carnot",
    "logType": "⚡",
    "title": "熱質守恆觀向熵增與能量守恆的框架升級",
    "oldContent": "卡諾 1824 原稿借用水輪機落水比喻，認為「熱質（Caloric）」在從高溫向低溫流動時總量守恆，僅是重力勢能落差對外作功。",
    "newContent": "克勞修斯與開爾文指出：高溫熱量吸入 $Q_H$ 中有一部分被實質轉化為功 $W$，其餘 $Q_C$ 排入低溫，熱質並不守恆；守恆的是總能量，而單向增加的是熵。",
    "explanation": "跨時間維度的重大理論框架升級（⚡），新舊理解並排陳列，警示不可將熱質落水模型與現代能量耗散混為一談。"
  },
  {
    "id": "log-schrodinger-orbit",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-schrodinger-eq",
    "logType": "⚡",
    "title": "波爾舊量子軌道模型 vs 薛丁格幾何機率幅雲",
    "oldContent": "波爾軌道假設：電子沿著半徑確定的圓周軌道繞原子核運轉，基態具有非零角動量 $L = 1\\hbar$。",
    "newContent": "波動力學：電子無經典軌跡，基態波函數為球對稱 $s$ 態，軌道角動量量子數嚴格為零（$L = 0$），位置以空間機率幅分佈。",
    "explanation": "直覺模型與精確公設體系的實質性衝突，揭示經典可想像的軌跡在量子尺度徹底失效。"
  },
  {
    "id": "log-lechatelier-incremental",
    "workspaceId": "default-scinotes-workspace",
    "cardId": "card-le-chatelier",
    "logType": "⟲",
    "title": "補充恆容與恆壓通入惰性氣體之本質差異",
    "oldContent": "原筆記僅籠統記錄「加壓平衡向氣體分子數減少方向移動」。",
    "newContent": "明確細分：只有引起『反應組分分壓改變』的加壓才影響平衡；恆容充惰氣雖然總壓增大，但反應物分壓不變，$Q_p$ 不變，平衡絲毫不動！",
    "explanation": "針對常見易混淆盲區進行的增量認知修正（⟲）。"
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
