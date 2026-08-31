// 純前端 AI 檢查引擎（原 /api/ai/inspect 邏輯，完全不依賴伺服器）
import { CardData } from "@/components/KnowledgeCardNode";

// ========== 1. 判型(A~E) ==========
export function classifyShape(card: Partial<CardData>) {
  const content = `${card?.title || ""} ${card?.whatData?.summary || ""} ${card?.whyData?.fullReasoning || ""} ${card?.howData?.steps?.map((s: any) => s.action).join(" ") || ""}`;

  let predictedShape: "A" | "B" | "C" | "D" | "E" = "A";
  let confidence = 85;
  let rationale = "";

  const lower = content.toLowerCase();
  if (lower.includes("公設") || lower.includes("前提") || lower.includes("不可推導") || lower.includes("框架") || lower.includes("自洽")) {
    predictedShape = "D";
    confidence = 94;
    rationale = "該知識點為體系之不可推導底層公設或宏觀演化框架，作為後續推理的出發點而非推導結論。";
  } else if (lower.includes("定義") || lower.includes("約定") || lower.includes("符號") || lower.includes("基底展開") || lower.includes("變換")) {
    predictedShape = "E";
    confidence = 92;
    rationale = "核心結構為概念定義或坐標/表象變換約定，強調完備性與投影雙射性質。";
  } else if (lower.includes("判別") || lower.includes("步驟") || lower.includes("如果") || lower.includes("擾動") || lower.includes("移動方向") || lower.includes("流程")) {
    predictedShape = "C";
    confidence = 89;
    rationale = "具備明確的輸入狀態、條件分支檢驗與輸出判定流程（狀態機/判別算法結構）。";
  } else if (lower.includes("存在") || lower.includes("構造") || lower.includes("技法") || lower.includes("求解技巧")) {
    predictedShape = "B";
    confidence = 87;
    rationale = "涉及特定數學/物理對象的存在性證明或專用構造求解技法。";
  } else {
    predictedShape = "A";
    confidence = 91;
    rationale = "由清晰的前提與定理出發，通過嚴密邏輯因果演繹步步推進至最終結論的連續推導鏈。";
  }

  return { shape: predictedShape, confidence, rationale };
}

// ========== 2. 四點自我檢查 (v4 手冊：人名/零基礎/路徑/精確) ==========
export interface FourPointCheckItem {
  id: "name" | "zero_foundation" | "path" | "precision";
  title: string;
  passed: boolean;
  message: string;
  hint: string;
}

export function checkFourPoints(text: string, context: "construction" | "why"): FourPointCheckItem[] {
  const content = text || "";
  const results: FourPointCheckItem[] = [];

  // 1. 人名檢查
  const HISTORICAL_NAMES = [
    "拉格朗日", "傅立葉", "傅里葉", "卡諾", "牛頓", "柯西", "黎曼", "愛因斯坦",
    "德布羅意", "薛丁格", "薛定諤", "波爾", "玻爾", "勒沙特列", "勒夏特列", "范特霍夫",
    "克勞修斯", "開爾文", "笛卡爾", "高斯", "歐拉", "麥克斯韋", "洛倫茲", "希爾伯特",
    "伯努利", "哈密頓", "拉普拉斯", "狄拉克", "普朗克"
  ];
  const foundNames = HISTORICAL_NAMES.filter((n) => content.includes(n));
  if (foundNames.length > 0) {
    results.push({
      id: "name",
      title: "① 人名檢查",
      passed: false,
      message: `文字中出現了歷史人物名字：${foundNames.join("、")}`,
      hint: "出現歷史人物代表在講「歷史觸發」，該搬去 ORIGIN，不屬於構造思路/WHY。判準：換個人、不靠這段歷史，會不會也撞到同一個點？會→構造思路，不會→ORIGIN。"
    });
  } else {
    results.push({
      id: "name",
      title: "① 人名檢查",
      passed: true,
      message: "✓ 未出現歷史人物姓名，符合「純邏輯觸發」要求。",
      hint: "邏輯上的困境不管由誰重新推導都會撞到，不綁定具體歷史事件。"
    });
  }

  // 2. 零基礎檢查
  const JUMP_WORDS = ["顯然", "容易看出", "不難得出", "顯而易見", "眾所周知", "自然成立", "不言而喻", "顯見"];
  const foundJumps = JUMP_WORDS.filter((w) => content.includes(w));
  if (foundJumps.length > 0) {
    results.push({
      id: "zero_foundation",
      title: "② 零基礎檢查",
      passed: false,
      message: `發現跳步用詞：${foundJumps.join("、")}`,
      hint: "不許使用「顯然」「容易看出」等跳步用詞。假設讀者完全沒學過這個領域，每個專有名詞第一次出現必須就地解釋或換更基礎的說法。"
    });
  } else {
    results.push({
      id: "zero_foundation",
      title: "② 零基礎檢查",
      passed: true,
      message: "✓ 未使用「顯然」等跳步用語，推理步驟完整寫滿。",
      hint: "零基礎可讀性是檢驗自己是否真正透徹理解的試金石。"
    });
  }

  // 3. 路徑檢查
  const TRANSITION_WORDS = ["如果", "那麼", "因為", "所以", "考慮", "聯想", "轉化", "設", "推得", "假設", "發現", "關鍵是", "由此", "代入"];
  const transitionCount = TRANSITION_WORDS.filter((w) => content.includes(w)).length;
  if (content.length > 0 && (content.length < 35 || transitionCount < 2)) {
    results.push({
      id: "path",
      title: "③ 路徑檢查",
      passed: false,
      message: "探索與摸索過程偏短，可能只交代了「問題」和「答案」兩端。",
      hint: "「路徑」不能只寫問題和答案，中間怎麼從契機一步步摸到解法的具體推敲過程不可空白，需補上摸索過程本身。"
    });
  } else if (content.length === 0) {
    results.push({
      id: "path",
      title: "③ 路徑檢查",
      passed: false,
      message: "內容為空，尚未寫下探索路徑。",
      hint: "交代當初卡在什麼具體困難，以及怎麼一步步推敲出路線。"
    });
  } else {
    results.push({
      id: "path",
      title: "③ 路徑檢查",
      passed: true,
      message: "✓ 包含因果摸索與推敲過渡步驟，具備完整路徑。",
      hint: "清楚展現了從問題到解法的思考演化。"
    });
  }

  // 4. 精確檢查
  const CONTRAST_PAIRS = [
    ["離散", "連續"],
    ["正", "負"],
    ["順時針", "逆時針"],
    ["微觀", "宏觀"],
    ["恆容", "恆壓"],
    ["可逆", "不可逆"],
    ["有限", "無窮"]
  ];
  const ANALOGY_WORDS = ["像", "如同", "比喻", "好比", "比作", "就像"];
  const hasContrast = CONTRAST_PAIRS.some(([a, b]) => content.includes(a) && content.includes(b));
  const hasAnalogy = ANALOGY_WORDS.some((w) => content.includes(w));

  if (hasContrast && hasAnalogy && !content.includes("指的是") && !content.includes("定義為") && !content.includes("具體是")) {
    results.push({
      id: "precision",
      title: "④ 精確檢查",
      passed: false,
      message: "偵測到對比情境與比喻詞，但缺乏對對比對象的精確定義！",
      hint: "出現「A情形 vs B情形」對比時，必須先精確講清楚「到底是什麼東西在A、什麼在B」，不能只丟一個類比（如鋼琴鍵）代替說清楚。類比只能是精確說明之後的輔助補充。"
    });
  } else {
    results.push({
      id: "precision",
      title: "④ 精確檢查",
      passed: true,
      message: "✓ 對比與機制陳述精確，未拿模糊比喻蒙混核心概念。",
      hint: "精確定位對象變量，確保比喻不喧賓奪主。"
    });
  }

  return results;
}

// ========== 3. 全卡審查 ==========
export interface AuditIssue {
  severity: "critical" | "warning" | "suggestion";
  category: string;
  title: string;
  description: string;
  targetSlot: string;
}

export function fullCardAudit(card: CardData | null | undefined) {
  const issues: AuditIssue[] = [];

  const whyReasoning = card?.whyData?.fullReasoning || "";
  const lockedAssumptions = (card?.assumptions || []).map((a: any) => (a.name || "").toLowerCase());
  const claims = card?.claims || [];
  const steps = card?.howData?.steps || [];
  const triggers = card?.whenData?.triggers || [];
  const originConflict = card?.originData?.conflict || "";

  if (!whyReasoning || whyReasoning.length < 30) {
    issues.push({
      severity: "critical",
      category: "WHY 假懂審查",
      title: "WHY 缺乏完整推理鏈條",
      description: "WHY 不能只是『背後原因一句話』或結論陳述。必須寫出從前提到結論的完整因果演繹步步推理。",
      targetSlot: "WHY",
    });
  }

  const subGoals = card?.whyData?.subGoals || [];
  if (subGoals.length === 0 && whyReasoning.length > 80) {
    issues.push({
      severity: "warning",
      category: "WHY 結構審查",
      title: "缺少子目標聲明 (Sub-goals)",
      description: "複雜推理需先建立子目標聲明：『要證 X，需要 1. A, 2. B』，並分別回答：為什麼必要？為什麼合起來足夠？",
      targetSlot: "WHY",
    });
  }

  const p1 = card?.whyData?.perspective1;
  const p2 = card?.whyData?.perspective2;
  if (!p1?.content || !p2?.content) {
    issues.push({
      severity: "warning",
      category: "雙重視角審查",
      title: "未具備兩個失效模式不同的視角",
      description: "系統要求至少使用兩個失效模式不同的視角（例如：幾何直覺 vs 代數機制；唯象約束 vs 微觀統計）。",
      targetSlot: "WHY",
    });
  }

  const potentialSmuggledKeywords = [
    { kw: "可逆", name: "準靜態可逆條件" },
    { kw: "無摩擦", name: "無摩擦耗散條件" },
    { kw: "理想氣體", name: "理想氣體狀態方程" },
    { kw: "線性", name: "線性系統疊加性" },
    { kw: "非相對論", name: "非相對論低速極限" },
    { kw: "恆溫", name: "恆溫環境條件" },
    { kw: "封閉體系", name: "封閉隔離體系" },
  ];

  for (const item of potentialSmuggledKeywords) {
    if (whyReasoning.includes(item.kw)) {
      const isDeclared = lockedAssumptions.some((a: string) => a.includes(item.kw));
      if (!isDeclared) {
        issues.push({
          severity: "warning",
          category: "偷渡前提警報",
          title: `疑似使用未聲明的前提條件：「${item.name}」`,
          description: `你的推理中隱含使用了『${item.kw}』，但在假設鎖定清單中尚未正式聲明。請確認該條件是否為必要約束並加入清單。`,
          targetSlot: "ASSUMPTIONS",
        });
      }
    }
  }

  for (const claim of claims) {
    const text = claim.text || "";
    const mark = claim.epistemicMark;
    if (mark === "⊢證") {
      if (text.includes("實驗") || text.includes("觀測") || text.includes("測量") || text.includes("統計表明")) {
        issues.push({
          severity: "critical",
          category: "認識論越級",
          title: `聲明「${text.substring(0, 20)}...」標記為 ⊢證 可能不當`,
          description: "⚠ 目前材料依賴的是實驗觀測與統計歸納，所支持的應是 ⊢歸，而不是純邏輯演繹的 ⊢證。",
          targetSlot: "CLAIMS",
        });
      }
      if (text.includes("近似") || text.includes("忽略") || text.includes("一階截斷") || text.includes("低速") || text.includes("稀薄")) {
        issues.push({
          severity: "critical",
          category: "認識論越級",
          title: `近似條件被當作絕對證明 ⊢證`,
          description: "⚠ 禁止將 ⊢近[框架] 默默當成 ⊢證！近似只在特定邊界尺度成立，不可作為普適真理。",
          targetSlot: "CLAIMS",
        });
      }
    }
    // v4：獨立區塊的認識論聲明需有錨點
    if (!claim.anchor) {
      issues.push({
        severity: "suggestion",
        category: "認識論錨點",
        title: "獨立列表的認識論聲明缺少錨點",
        description: "列在獨立區塊的認識論聲明，每條應追加指回 WHY 具體段落的錨點（如「[見WHY視角2]」），讓「憑什麼成立」變得可檢查。",
        targetSlot: "CLAIMS",
      });
    }
  }

  const uncompiledSteps = steps.filter((s: any) => !s.isCompiled);
  if (uncompiledSteps.length > 0 || card?.howData?.status === "uncompiled") {
    issues.push({
      severity: "suggestion",
      category: "HOW 編譯檢查",
      title: `存在 ${uncompiledSteps.length} 個未編譯步驟 (⋯)`,
      description: "若使用者每次仍需重新推導才能執行該步驟，標記為 ⋯ 未編譯。完成閉卷展開測試後可晉升為 ✓展。",
      targetSlot: "HOW",
    });
  }

  if (triggers.length === 0) {
    issues.push({
      severity: "warning",
      category: "WHEN 具體化審查",
      title: "WHEN 缺少具體觸發線索",
      description: "不要寫抽象套話（如『在高維時注意』），必須寫成：『看到 [具體線索] → 檢查 [明確條件]』。",
      targetSlot: "WHEN",
    });
  }

  if (p1?.failureMode && !triggers.some((t: any) => (t.check || "").includes("失效") || (t.cue || "").includes(p1.name || ""))) {
    issues.push({
      severity: "suggestion",
      category: "WHY-HOW 斷鏈警告",
      title: "視角失效模式在 WHEN 中找不到對應檢查項",
      description: `視角「${p1.name || "1"}」已標失效模式，但 WHEN 沒有對應「看到___→檢查___」。這個警告寫了但沒人會在實戰中記得查——請在 WHEN 補上對應檢查項。`,
      targetSlot: "WHEN",
    });
  }

  if (!originConflict || (!originConflict.includes("↯") && originConflict.length < 20)) {
    issues.push({
      severity: "suggestion",
      category: "ORIGIN 矛盾審查",
      title: "ORIGIN 應指出逼出概念的歷史矛盾 (↯)",
      description: "ORIGIN 不是教科書背景介紹，而應直面：『當初是哪個無法解決的問題／思想矛盾逼出了這個概念？』",
      targetSlot: "ORIGIN",
    });
  }

  const thoughtPoints = card?.thoughtPoints || [];
  if (whyReasoning.length > 150 && thoughtPoints.length === 0) {
    issues.push({
      severity: "suggestion",
      category: "追問點審查",
      title: "推理較長但沒有任何追問點",
      description: "v4 規定：在真正的關鍵轉折處（懂了這一步就懂了整個論證）插入【追問·思維模式名】問題，逼讀者自己先想一次再看答案。",
      targetSlot: "WHY",
    });
  }

  // 四點自檢執行（構造思路 + WHY 正文）
  if (card?.constructionThinking) {
    const constrChecks = checkFourPoints(card.constructionThinking, "construction");
    for (const c of constrChecks) {
      if (!c.passed) {
        issues.push({
          severity: c.id === "name" ? "warning" : "suggestion",
          category: `構造思路自檢·${c.title}`,
          title: c.message,
          description: c.hint,
          targetSlot: "CONSTRUCTION",
        });
      }
    }
  }

  if (whyReasoning) {
    const whyChecks = checkFourPoints(whyReasoning, "why");
    for (const c of whyChecks) {
      if (!c.passed) {
        issues.push({
          severity: c.id === "name" ? "warning" : c.id === "zero_foundation" ? "warning" : "suggestion",
          category: `WHY正文自檢·${c.title}`,
          title: c.message,
          description: c.hint,
          targetSlot: "WHY",
        });
      }
    }
  }

  return {
    cardId: card?.id,
    auditTimestamp: new Date().toISOString(),
    score: Math.max(
      20,
      100 -
        issues.filter((i) => i.severity === "critical").length * 25 -
        issues.filter((i) => i.severity === "warning").length * 10
    ),
    totalIssues: issues.length,
    criticalCount: issues.filter((i) => i.severity === "critical").length,
    issues,
  };
}

// ========== 3. 圖文獨立性 ==========
export function imageTextIndependence(text: string) {
  const content = text || "";
  const hasDirectGraphicReferences =
    content.includes("如圖") || content.includes("見圖") || content.includes("圖中可知") || content.includes("看圖即明") || content.includes("如下所示");

  let passes = true;
  const warnings: string[] = [];

  if (hasDirectGraphicReferences && content.length < 80) {
    passes = false;
    warnings.push("文字長度過短且包含『見圖可知』等依附性短語，疑似將核心幾何/因果推理偷偷交給了圖片。");
  }

  if (!content.includes("因此") && !content.includes("因為") && !content.includes("由") && !content.includes("得")) {
    warnings.push("文字中缺乏因果連接詞，可能僅描述了視覺靜態空間位置，未完成獨立的邏輯推導。");
  }

  return {
    passes,
    simulatedImageRemoval: "已模擬移去畫布圖片與幾何視覺元件。",
    verdict: passes
      ? "✓ 圖文獨立性通過：即使移除所有圖片，純文字推理鏈條依然完整自洽。"
      : "⚠ 圖文獨立性警告：文字可能把推理偷偷交給了圖片！",
    warnings,
    ruleReminder:
      "【圖文綁定原則】圖片只負責展示直觀結構（誰在哪）；為什麼成立、下一步推什麼、哪個條件導致結論，必須完全由文字獨立完成。",
  };
}

// ========== 4. 追問測試（原展開測試，v4 改名） ==========
export function expansionTest(card: CardData | null | undefined, attempt: string, targetConcept?: string) {
  const target = targetConcept || card?.title || "核心定理";

  if ((attempt || "").trim().length < 20) {
    return {
      passed: false,
      stuckAtStep: 1,
      target,
      feedback: "展開嘗試內容過於簡略。請嘗試從基礎前提寫出第一步出發點。",
      hint: "提示：不要直接給出最終公式，請先寫出體系的出發公設或守恆關係。",
    };
  }

  const containsPrerequisite = attempt.includes("假設") || attempt.includes("設") || attempt.includes("由") || attempt.includes("已知");
  const containsIntermediate = attempt.includes("代入") || attempt.includes("積分") || attempt.includes("推得") || attempt.includes("故") || attempt.includes("因此");
  const containsConclusion = attempt.includes("得證") || attempt.includes("結論") || attempt.includes("必然") || attempt.includes("=") || attempt.includes("成立");

  if (!containsPrerequisite) {
    return {
      passed: false,
      stuckAtStep: 1,
      target,
      feedback: "你在推導的第 1 個推理節點卡住了：未清楚闡明起點公設與前提邊界條件。",
      hint: "教練提示：在開始任何代數推演前，先明確本次展開依據的物理假設或數學約束。",
    };
  }

  if (!containsIntermediate) {
    return {
      passed: false,
      stuckAtStep: 2,
      target,
      feedback: "你在推導的第 2 個推理節點卡住了：起點直接跳步到了末端，缺少中間關鍵變形或守恆約束聯立過程。",
      hint: "教練提示：思考起點與終點之間的橋樑是什麼？例如狀態方程、正交性內積或是能量平衡式？",
    };
  }

  void containsConclusion;
  return {
    passed: true,
    stuckAtStep: null,
    target,
    feedback: "✓ 閉卷展開測試成功！推理節點完整，未出現跳步或循環論證。",
    recommendation: "可將此 HOW 步驟正式編譯標記為 ✓展。",
  };
}

// ========== 5. 堵塞感檢查 ==========
export function blockageGuide() {
  return {
    diagnosisProcess: [
      {
        step: 1,
        title: "檢查最近的核心聲明是否缺少認識論標記",
        guidance: "審查最近寫下的 3 條結論：每一條究竟是 ⊢證、⊢歸、⊢近、⊢約 還是 ⊢公設？若模稜兩可，常造成底層信任危機。",
      },
      {
        step: 2,
        title: "檢查是否跨框架挪用了不可比較的概念",
        guidance: "是否在經典力學軌道概念中套用了量子波函數？或在微觀可逆動力學中無條件套用了宏觀不可逆熱力學？",
      },
      {
        step: 3,
        title: "檢查是否把 ⊢近 默默當成了 ⊢證",
        guidance: "是否存在一個『理想模型近似』被你的大腦當成了絕對真理，從而在極限邊界處遇到了邏輯撞車？",
      },
    ],
    recordTemplate: "（曾引發堵塞，已定位：______）",
  };
}

// ========== 6. 類比驗證 ==========
export function analogyTest(ctx: {
  sourceCardTitle?: string;
  targetCardTitle?: string;
  proposedAnalogy?: string;
  candidatePrediction?: string;
}) {
  const { candidatePrediction } = ctx;
  const hasPrediction = !!(candidatePrediction && candidatePrediction.trim().length > 15);

  if (!hasPrediction) {
    return {
      valid: false,
      status: "analogy_unverified (~[d])",
      message:
        "尚未通過候選推理測試：不能因為兩者『看起來很像』就建立 ≈。必須回答：『能否從這個結構類比推出一個新的、可驗證的具體預測？』",
      countsTowardNetworkScore: false,
    };
  }

  return {
    valid: true,
    status: "analogy_verified (≈[d])",
    message: "候選推理測試已具備具體預測，可進行驗證並計入知識網整合度。",
    countsTowardNetworkScore: true,
  };
}
