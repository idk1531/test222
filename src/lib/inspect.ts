// 純前端 AI 檢查引擎（原 /api/ai/inspect 邏輯，完全不依賴伺服器）
import type { CardData } from "@/components/KnowledgeCardNode";

// ========== 0. v4 符號速查：全面文字標籤（不用再對照圖例） ==========
// 內部儲存沿用舊枚舉值（⊢證…）以相容既有本機資料；所有「顯示」一律走這裡的文字標籤。

/** 認識論地位 → 文字標籤（框架填在括號內） */
export function epistemicLabel(mark: string, framework?: string): string {
  const fw = (framework || "").trim();
  switch (mark) {
    case "⊢證": return "[地位:證明]";
    case "⊢歸": return "[地位:歸納]";
    case "⊢近": return fw ? `[地位:近似於${fw}]` : "[地位:近似於框架]";
    case "⊢約": return "[地位:約定]";
    case "⊢公設": return fw ? `[地位:公設(${fw})]` : "[地位:公設]";
    default: return mark?.startsWith("[地位") ? mark : `[地位:${mark || "?"}]`;
  }
}

/** 關係邊類型 → 文字標籤（含維度 d） */
export function relationLabelText(
  relationType: string,
  opts?: { dimension?: string; distance?: number | string }
): string {
  const d = (opts?.dimension || "").trim() || (opts?.distance ?? "");
  const withD = (base: string) => (d === "" || d === undefined ? base : `${base.slice(0, -1)}:${d}]`);
  switch (relationType) {
    case "prerequisite": return "[前提]";
    case "analogy_verified": return withD("[結構類比:d]");
    case "analogy_unverified": return withD("[表面相似:d]");
    case "contrast": return withD("[對照:d]");
    case "positive_example": return "[正例]";
    case "counter_example": return "[反例]";
    case "special_case": return "[特例]";
    case "generalization": return "[推廣]";
    case "motif_instance": return "[歸屬母題]";
    default: return `[${relationType || "?"}]`;
  }
}

/** 過程日誌類型 → 文字標籤（舊符號 ⟲⚡⇹⋯ 自動轉文字標籤） */
export function processLogLabel(logType: string): string {
  switch (logType) {
    case "⟲": case "[增量]": case "增量": return "[增量]";
    case "⚡": case "[框架衝突]": case "框架衝突": return "[框架衝突]";
    case "⇹": case "[同session矛盾]": case "同session矛盾": return "[同session矛盾]";
    case "⋯": case "[未編譯]": case "未編譯": return "[未編譯]";
    default: return logType?.startsWith("[") ? logType : `[${logType || "?"}]`;
  }
}

/** 舊符號 logType → 標準儲存值（統一為文字標籤） */
export function normalizeLogType(logType: string): string {
  switch (logType) {
    case "⟲": return "[增量]";
    case "⚡": return "[框架衝突]";
    case "⇹": return "[同session矛盾]";
    case "⋯": return "[未編譯]";
    default: return logType;
  }
}

/** 狀態標記（全部文字標籤） */
export const STATUS_DERIVED = "[已推出]";
export const STATUS_UNRESOLVED = "[未決]";
export const STATUS_UNCOMPILED = "[未編譯]";
export const STATUS_COMPILED = "[已編譯]";
export const STATUS_WARNING = "[警示]";
export const ORIGIN_MARK = "[歷史起源]";
export const ORIGIN_MARK_KEY = "[歷史起源:關鍵]";

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

// ========== 2. 全卡審查 ==========
export interface AuditIssue {
  severity: "critical" | "warning" | "suggestion";
  category: string;
  title: string;
  description: string;
  targetSlot: string;
}

export function fullCardAudit(card: CardData | null | undefined, relations: any[] = []) {
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
  if (subGoals.length === 1) {
    issues.push({
      severity: "suggestion",
      category: "WHY 結構審查",
      title: "子目標只有 1 個：不需要這個開場",
      description: "子目標聲明只在「≥2 個需分別證明的子結論」時才寫；只有 1 個時請刪掉，不能硬湊。",
      targetSlot: "WHY",
    });
  } else if (subGoals.length === 0) {
    const multiCue = /(①.*②|1[.)、．].{0,40}2[.)、．]|分别证明|分別證明|分三|分兩|三个推论|三個推論|一是.*二是)/.test(
      whyReasoning
    );
    if ((multiCue && whyReasoning.length > 60) || whyReasoning.length > 400) {
      issues.push({
        severity: "warning",
        category: "WHY 結構審查",
        title: "疑似含 ≥2 個子結論卻缺少子目標聲明",
        description:
          "若 WHY 含 ≥2 個需分別證明的子結論，需先寫「子目標聲明」：要證 X 需要證 1 和 2，為什麼兩個都必要、湊起來為什麼就夠。若其實只有 1 個子結論，請忽略本條。",
        targetSlot: "WHY",
      });
    }
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
          title: `聲明「${text.substring(0, 20)}...」標記為 [地位:證明] 可能不當`,
          description: "目前材料依賴的是實驗觀測與統計歸納，所支持的應是 [地位:歸納]，而不是純邏輯演繹的 [地位:證明]。注意：有用≠為真。",
          targetSlot: "CLAIMS",
        });
      }
      if (text.includes("近似") || text.includes("忽略") || text.includes("一階截斷") || text.includes("低速") || text.includes("稀薄")) {
        issues.push({
          severity: "critical",
          category: "認識論越級",
          title: "近似條件被當作絕對證明 [地位:證明]",
          description: "禁止將 [地位:近似於框架] 默默當成 [地位:證明]！近似只在特定邊界尺度成立，不可作為普適真理。",
          targetSlot: "CLAIMS",
        });
      }
    }
    if (mark === "⊢約") {
      if (/證明|證得|得證|實驗表明|觀測證實|推導出/.test(text)) {
        issues.push({
          severity: "warning",
          category: "認識論約束",
          title: "[地位:約定] 被寫成了需要證明的事實",
          description: "[地位:約定] 是人為約定，無所謂對錯；這條聲明的措辭卻像在主張一個待證的真假命題。請改寫為約定口吻，或改標正確地位。",
          targetSlot: "CLAIMS",
        });
      }
    }
    if (mark === "⊢公設") {
      if (!claim.frameworkNote || !claim.frameworkNote.trim()) {
        issues.push({
          severity: "warning",
          category: "認識論約束",
          title: "[地位:公設] 沒有綁定框架",
          description: "「公設」描述的是「在什麼框架裡作為起點」，不是脫離框架的絕對標籤。請填框架（格式如 [地位:公設(非相對論量子力學)]）；換框架時須重新說明地位，不能預設繼承。",
          targetSlot: "CLAIMS",
        });
      }
      if (/已經被證明|已被證明|得證|證得|證明了/.test(text)) {
        issues.push({
          severity: "warning",
          category: "認識論約束",
          title: "[地位:公設] 被寫成「已經被證明的結論」",
          description: "公設是在框架內不可再向下追問的起點，不能寫成已經被證明的結論。請改寫措辭。",
          targetSlot: "CLAIMS",
        });
      }
    }
    if (mark === "⊢近" && (!claim.frameworkNote || !claim.frameworkNote.trim())) {
      issues.push({
        severity: "warning",
        category: "認識論約束",
        title: "[地位:近似] 沒有綁定框架",
        description: "近似只在指定理論框架下成立，請填框架（格式如 [地位:近似於質量作用定律框架]），且不可脫離該框架後靜默當作普遍結論使用。",
        targetSlot: "CLAIMS",
      });
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
      title: `存在 ${uncompiledSteps.length} 個 [未編譯] 步驟`,
      description: "若這類題每次仍需先臨場重推 WHY 才能往下走，標 [未編譯]；直到能不經重新推導直接執行，才去掉這個標記。",
      targetSlot: "HOW",
    });
  }
  // HOW 空殼檢查：把 WHY 蓋住，只看 HOW——若只是抄 WHY 結論＋「解方程」三字，就是沒寫夠格
  {
    const howText = steps.map((s: any) => `${s.title || ""} ${s.action || ""}`).join("\n");
    const hasOpChoice =
      /查表|留數|二階判定|判別|分支|若.+則|如果.+就|選擇|技巧|先.+再|注意|陷阱|邊界|特例/.test(howText);
    const looksShell =
      howText.trim().length > 0 &&
      /解方程|求解|計算|算出/.test(howText) &&
      !hasOpChoice;
    // 與 WHY 的文字重疊度：任一步驟動作（去空白後取前 40 字）若逐字出現在 WHY 全文，即疑似重抄
    const norm = (x: string) => x.replace(/\s+/g, "");
    const whyNorm = norm(whyReasoning);
    const copied = steps.some((s: any) => {
      const a = norm(s.action || "");
      return a.length >= 40 && whyNorm.includes(a.slice(0, 40));
    });
    if (looksShell || copied) {
      issues.push({
        severity: "warning",
        category: "HOW 空殼檢查",
        title: "HOW 疑似空殼：只是重抄 WHY 的式子",
        description:
          "常見錯誤：把 WHY 已經推出的式子重抄一遍、外加「解方程」三個字。合格的 HOW 必須包含 WHY 完全沒處理到的內容：操作上的技巧選擇（如積分算不出解析解時該查表還是用留數定理），或 WHY 沒覆蓋的後續步驟（如拉格朗日的二階判定）。檢驗方法：把 WHY 蓋住只看 HOW。",
        targetSlot: "HOW",
      });
    }
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

  for (const [idx, p] of [p1, p2].entries()) {
    if (!p?.failureMode?.trim()) continue;
    const linked = triggers.some(
      (t: any) =>
        (t.check || "").includes("失效") ||
        (p.name && ((t.cue || "").includes(p.name) || (t.check || "").includes(p.name))) ||
        (t.keywords || []).some((k: string) => p.name && k.includes(p.name))
    );
    if (!linked) {
      issues.push({
        severity: "warning",
        category: "視角警告斷鏈",
        title: `視角 ${idx + 1}「${p.name || "未命名"}」的失效模式在 WHEN·警示找不到對應檢查項`,
        description: `WHY 討論了「這個視角在什麼情況下失效」，但 WHEN 沒有對應的「看到___→檢查___」，等於這個警告寫了但實戰中沒人會記得查。請現在去 WHEN 補上，不要留到複習時才發現斷鏈。`,
        targetSlot: "WHEN",
      });
    }
  }

  if (!originConflict || originConflict.length < 20) {
    issues.push({
      severity: "suggestion",
      category: "ORIGIN 矛盾審查",
      title: "ORIGIN 應指出逼出概念的歷史矛盾 [歷史起源]",
      description: "ORIGIN 不是教科書背景介紹，而應直面：『當初是哪個無法解決的問題／思想矛盾逼出了這個概念？』（歷史上、綁定人事時地的事件；邏輯上可重複撞見的困境放構造思路。）",
      targetSlot: "ORIGIN",
    });
  }

  // ===== v4：WHAT 視角下限 3（自由命名，不要求正交；只計非空視角） =====
  const perspectives = (card?.whatData?.perspectives || []).filter((p: any) => (p?.content || "").trim());
  if (perspectives.length < 3) {
    issues.push({
      severity: "warning",
      category: "WHAT 視角審查",
      title: `WHAT 只有 ${perspectives.length} 個視角（v4 下限 3）`,
      description:
        "v4 起下限由 2 提高到 3，多多益善、不設上限；視角標籤不限 G/L/I/C/O/A/P，直接寫借用哪個學科／框架的工具箱（例：經濟學視角、信息論視角、操作視角）。這裡不要求正交性檢驗——那條只保留給 [結構類比] 邊與 SOLO 評分。",
      targetSlot: "WHAT",
    });
  }
  const unnamed = perspectives.filter((p: any) => !(p?.code || "").trim());
  if (unnamed.length > 0) {
    issues.push({
      severity: "suggestion",
      category: "WHAT 視角審查",
      title: `${unnamed.length} 個視角沒有命名`,
      description: "每個視角要用自己的話說明借用了哪個學科／框架的工具箱，讀者才知道該切換哪套直覺。",
      targetSlot: "WHAT",
    });
  }

  // ===== v4：理解問題信心校準（Polya 理解問題階段；與 WHY 的 IOED 獨立） =====
  const construction = (card?.constructionThinking || "").trim();
  const cal = card?.constructionCalibration;
  if (construction) {
    if (!cal || !cal.confidenceBefore || !cal.confidenceAfter) {
      issues.push({
        severity: "suggestion",
        category: "理解問題校準",
        title: "構造思路尚未跑「理解問題信心校準」",
        description:
          "動筆前只看名稱／原始問題打一次分（1-5：我有多確定抓到這題在問什麼），寫完①契機②路徑後再打一次。這輪與 WHY 的 IOED 是平行但獨立的兩次校準，不能合併——分開做才抓得出「卡在理解問題」還是「卡在推理機制」。",
        targetSlot: "CONSTRUCTION",
      });
    } else if (cal.confidenceAfter < cal.confidenceBefore) {
      issues.push({
        severity: (cal.blindSpotNote || "").trim() ? "suggestion" : "warning",
        category: "理解問題校準",
        title: `理解問題信心 ${cal.confidenceBefore}★ → ${cal.confidenceAfter}★：先不進 WHY`,
        description: (cal.blindSpotNote || "").trim()
          ? `已記錄理解問題階段盲區：「${cal.blindSpotNote}」。回頭把①②補完整後再進 WHY。`
          : "分數下降不是失敗，是抓到「連題目在問什麼都沒抓穩」的盲區。請先記入過程日誌、標「理解問題階段盲區」，回頭補①②——帶著沒釐清的問題理解硬寫 WHY，推理再嚴謹也是在回答錯的問題。",
        targetSlot: "CONSTRUCTION",
      });
    }
    // 路徑不是被動敘述：真的問過自己的關鍵問題應以追問點格式標出
    const constructionProbes = (card?.thoughtPoints || []).filter((t: any) => t.placement === "construction");
    if (construction.length > 120 && constructionProbes.length === 0) {
      issues.push({
        severity: "suggestion",
        category: "追問點審查",
        title: "構造思路的路徑裡沒有標出任何追問點",
        description:
          "Polya「擬定計劃」的核心工具本來就是一串主動自問（你以前見過類似的題嗎？能不能先解一個更簡單的相關問題？）。把摸索當下真的問過自己的問題用【追問·思維模式名】標出來——與 WHY 的追問點共用同一套標籤庫，次數一起計入 ≥3 次門檻。",
        targetSlot: "CONSTRUCTION",
      });
    }
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

  // v4：省略某格必須聲明理由——「不說明的省略等於沒檢查過，不算數」
  const omitted = (card as any)?.omittedSlots || [];
  for (const o of omitted) {
    if (!o.reason || o.reason.trim().length < 6) {
      issues.push({
        severity: "warning",
        category: "省略未交代",
        title: `宣告省略 ${o.slot}，但沒有理由`,
        description: `省略本身是一個需要交代的判斷，不是預設狀態。請說明：把 ${o.slot} 寫出來後，內容與哪一格逐字或逐意重複、為何沒有額外資訊量。`,
        targetSlot: o.slot,
      });
    }
  }

  // ===== v4：WHAT 五方向延伸 · 洞見檢查 =====
  // 「拿掉這句話，讀者會不會真的損失理解？」——純事實陳述（"A可以用在B上"）不夠格，
  // 必須點出這個連接為什麼重要（更大的理論脈絡／真實應用後果／一個具體的取捨或張力）。
  const ext = (card as any)?.whatData?.extensions;
  if (ext) {
    const dirLabels: Record<string, string> = {
      deeper: "推深", shallower: "推淺", generalize: "推廣", specialize: "推窄", translate: "翻譯",
    };
    // 洞見訊號：因果／後果／重要性／取捨／張力／「這正是…源頭／催生」等
    const insightMarkers = [
      "因為", "因此", "所以", "這正是", "正是", "催生", "源頭", "發源", "權衡", "取捨", "張力",
      "代價", "貴", "慢", "快", "代價是", "因此才有", "結果", "後果", "→", "推得", "引起",
      "支撐起", "撐起", "故", "由此", "於是", "相當於", "翻譯成", "翻成", "禁止", "不可能", "必須", "只有", "只剩", "換句話說", "也就是", "低通", "衰減", "靠", "依賴", "關鍵", "真正的", "實質", "重要性", "意義", "背後", "本質",
      "然而", "但", "卻", "反而", "代價", "compromise", "trade-off",
      "\u2192", "→", "\\to", "\\propto", "\\sim", "\\le", "\\ge", "\\rightarrow",
      "退化為", "退化", "奠基在", "另開", "從這條",
    ];
    const bareDirections: string[] = [];
    for (const [key, label] of Object.entries(dirLabels)) {
      const text = (ext as any)[key];
      if (!text || !String(text).trim()) continue;
      const t = String(text);
      // 太短 → 幾乎只能是事實陳述
      const bare = !insightMarkers.some((m) => t.includes(m));
      if (bare) bareDirections.push(label);
    }
    if (bareDirections.length > 0) {
      issues.push({
        severity: "suggestion",
        category: "WHAT 洞見檢查",
        title: `${bareDirections.join("、")} 可能只是事實陳述，缺「洞見」`,
        description:
          "v4 洞見檢查：每個方向延伸寫完自問「拿掉這句話，讀者會不會真的損失理解？」純事實（A 可以用在 B 上）不夠格，要點出這個連接為什麼重要。讀完要讓讀者「原來如此」而非「喔，知道了」——挖不到就不寫，別留一句事實充數。",
        targetSlot: "WHAT",
      });
    }
  }

  // ===== v4：獨立主幹【背景】三段式檢查 =====  // ===== v4：獨立主幹【背景】三段式檢查 =====
  const background = (card as any)?.backgroundData;
  const bgSituation = (background?.situation || "").trim();
  const bgPrecise = (background?.preciseObject || "").trim();
  const bgQuestion = (background?.preciseQuestion || "").trim();
  if ((bgSituation || bgPrecise || bgQuestion) && (!bgSituation || !bgPrecise || !bgQuestion)) {
    issues.push({
      severity: "warning",
      category: "背景三段式",
      title: "【背景】三段式不完整",
      description: `三段缺了${!bgSituation ? "情境、" : ""}${!bgPrecise ? "精確對象、" : ""}${!bgQuestion ? "精確對應的問題" : ""}。三段合起來要讓讀者知道五件事：為什麼需要、為什麼出現、出現原因、如何被想出來、在什麼情境下面臨什麼問題才被逼出來。`,
      targetSlot: "BACKGROUND",
    });
  }
  // 泛問句偵測：開頭是「任意／所有／任何」等全稱量詞 + 「能不能／是否」，
  // 且句中沒有「這段…」「這個…」「x(t)」「f(t)」這類指回具體對象的錨——
  // 注意「訊號」本身是泛類名，不能當作「已對應回情境」的證據。
  if (bgQuestion && bgQuestion.length > 12 && /任意|所有|任何|能不能|是否/.test(bgQuestion)
      && !/(這段|這段錄音|這個|這個對象|x\(t\)|f\(t\)|此刻|上面這段)/.test(bgQuestion)) {
    issues.push({
      severity: "suggestion",
      category: "背景三段式",
      title: "第三段問題疑似脫離情境",
      description: "「精確對應的問題」必須對應回第一段具體對象，不能寫成『任意／所有訊號能不能…』這種泛問句。例：改成『對「這段錄音 x(t)」，有沒有簡單的組成單位可以拆它？』",
      targetSlot: "BACKGROUND",
    });
  }
  if (!background || !bgSituation || !bgPrecise || !bgQuestion) {
    issues.push({
      severity: "suggestion",
      category: "背景三段式",
      title: "缺少獨立主幹【背景】",
      description: "v4 把【背景】從構造思路拆成獨立主幹：先答「為什麼需要、在哪個情境下被逼出」，再讓構造思路答「怎麼想到候選工具」。沒有背景，構造思路的動機就缺了一個精確表述的問題當起點。",
      targetSlot: "BACKGROUND",
    });
  }

  // ===== v4：計畫缺失檢查（構造思路要有收尾） =====
  const planSteps = (card as any)?.plan?.steps?.length || 0;
  if (construction.length > 200 && planSteps === 0) {
    issues.push({
      severity: "warning",
      category: "構造思路計畫",
      title: "構造思路沒有收尾的「計畫」",
      description:
        "候選登場＋路徑摸索出來的零散線索，要收束成一句讀者能在讀 WHY 之前先知道「接下來會看到什麼」的路線圖——只講打算證什麼、用什麼方法、範圍劃在哪，且要說明為什麼是這個順序、後一步如何依賴前一步（打亂順序還成立＝只是清單不是計畫）。",
      targetSlot: "CONSTRUCTION",
    });
  }

  // ===== v4：背景子規則（情境領域／先給形式／情境語言／PS 五件事） =====
  {
    const bg: any = (card as any)?.backgroundData || {};
    const situation: string = bg.situation || "";
    const preciseObject: string = bg.preciseObject || "";
    const hasBg = [situation, preciseObject, bg.preciseQuestion || ""].some((x: string) => x.trim());
    if (hasBg) {
      const domain: string = card?.domain || "";
      const crossDomain =
        /訊號|信号|傅立葉|傅里葉|頻率|濾波/.test(domain + card?.title) &&
        /電路|電容|電阻|RC电路|RC電路|基爾霍夫/.test(situation);
      if (crossDomain) {
        issues.push({
          severity: "warning",
          category: "背景三段式",
          title: "情境疑似選錯領域",
          description:
            "情境必須選跟這張卡同一個領域的對象，不能為了「具體」牽扯出另一塊背景知識。例：給「傅立葉變換」（訊號處理）挑 RC 電路當情境，會被迫交代電容電壓的微分方程（電路學）；改用「錄音訊號的放大延遲操作」才不需要額外背景知識。",
          targetSlot: "BACKGROUND",
        });
      }
      const hasFormula = /[=∫Σ∑\\]|\\frac|\\int|\\sum|\^|\$/ .test(preciseObject);
      if (preciseObject.trim() && !hasFormula && preciseObject.length > 60) {
        issues.push({
          severity: "suggestion",
          category: "背景三段式",
          title: "第二段可考慮「先給形式、再給動機」",
          description:
            "若該方向涉及可精確寫出的數學形式／定義，把式子先列出來讓讀者一眼看到全貌，再解釋念頭。注意這與「WHY 不能被 WHAT 劇透」不矛盾：劇透管的是「最終答案本身」不能提前；先給形式管的是「半路要用的工具／背景定義」。",
          targetSlot: "BACKGROUND",
        });
      }
      const situationNouns = ["人聲", "背景音樂", "錄音", "x(t)", "f(t)", "訊號", "信号"];
      const usedInSituation = situationNouns.filter((n) => situation.includes(n));
      if (usedInSituation.length > 0 && preciseObject.trim().length > 40) {
        const stillThere = usedInSituation.some((n) => preciseObject.includes(n));
        if (!stillThere) {
          issues.push({
            severity: "warning",
            category: "背景三段式",
            title: "第二段疑似半路丟掉情境語言",
            description: `一般化定義式之後仍要貼著第一段的具體對象講（${usedInSituation.join("、")}）。反面教材：推廣成一般式後通篇只剩抽象 x(t)、y(t)，不再提「人聲」「背景音樂」，情境語言半路消失了。`,
            targetSlot: "BACKGROUND",
          });
        }
      }
      const allBg = `${situation}\n${preciseObject}\n${bg.preciseQuestion || ""}`;
      const fiveChecks: Array<[string, boolean]> = [
        ["為什麼需要", /為什麼需要|需要.{0,8}(這個|該)|逼出|動機/.test(allBg)],
        ["為什麼出現", /為什麼出現|出現/.test(allBg)],
        ["出現的原因", /原因|因為|由於/.test(allBg)],
        ["如何被想出來", /想出來|想到|摸索|聯想|推敲|契機/.test(allBg)],
        ["什麼情境＋什麼問題", /情境/.test(allBg) && /問題|矛盾|問/.test(allBg)],
      ];
      const missingFive = fiveChecks.filter(([, ok]) => !ok).map(([k]) => k);
      if (missingFive.length > 0 && allBg.trim().length > 60) {
        issues.push({
          severity: "suggestion",
          category: "背景三段式",
          title: `背景 PS 五件事疑似缺：${missingFive.join("、")}`,
          description:
            "三段合起來要讓讀者知道五件事：為什麼需要這個知識點、為什麼會出現、出現的原因、如何被想出來、在什麼情境下面臨什麼問題才被逼出來。覆蓋不到就是還沒寫完整。",
          targetSlot: "BACKGROUND",
        });
      }
    }
  }

  // ===== v4：候選登場（動機必須扣住具體形式；斷言要挪去 WHY） =====
  {
    const cand: any = (card as any)?.candidate || {};
    const motivation: string = cand.motivation || "";
    const requirement: string = cand.requirement || "";
    const form: string = cand.candidateForm || "";
    if (motivation.trim() || form.trim() || requirement.trim()) {
      const genericOnly =
        motivation.trim().length > 0 &&
        /形式簡單|別的領域常用|電路裡常用|常用|簡單/.test(motivation) &&
        !/(要求|通過.{0,6}(不變|運算)|具備.{0,10}性質|摸索|追溯|為什麼偏偏|指數型|不變)/.test(motivation);
      if (genericOnly) {
        issues.push({
          severity: "warning",
          category: "候選登場",
          title: "候選動機只是泛泛優點，沒有扣住具體形式",
          description:
            "只列「形式簡單、別的領域常用」不夠。判斷：把候選人換成任何別的東西，這段動機還成立嗎？成立→要補「從要求一步步摸索到這個具體形式」的過程（例：要求是通過運算後形式不變→什麼函數具備這種性質→指數型函數）。",
          targetSlot: "CONSTRUCTION",
        });
      }
      const assertion = `${form} ${motivation}`;
      if (/形式不變|恆成立|必然|必定成立|對於任意.{0,8}(成立|滿足)/.test(assertion) && !/驗證留給WHY|見WHY|WHY驗證/.test(assertion)) {
        issues.push({
          severity: "warning",
          category: "候選登場",
          title: "候選段出現了需要證明的斷言",
          description:
            "候選登場是決策敘事，不做驗證。凡是在斷言「某性質成立」且需要理由支撐的句子（如「通過系統後形式不變」），整段挪去 WHY；這裡只留「為什麼會想到測試它」。",
          targetSlot: "CONSTRUCTION",
        });
      }
      // 擴展方案搪塞偵測
      const ranges: string = (card as any)?.plan?.ranges || "";
      if (/足夠自由度/.test(ranges + motivation) && !/超出本卡範圍|另開/.test(ranges)) {
        issues.push({
          severity: "warning",
          category: "擴展方案",
          title: "擴展方案疑似用空話搪塞",
          description:
            "「這樣才有足夠自由度」聽起來合理、實際沒有支撐（⑤具體化測試該抓的錯）。若擴展牽涉更深的獨立問題（如「組合真能還原任意目標嗎、係數唯一嗎」），老實標「超出本卡範圍，需要另一張卡處理」，並對應 WHY 的 [地位:公設] 誠實標註。",
          targetSlot: "CONSTRUCTION",
        });
      }
    }
  }

  // ===== v4：計畫順序依賴（打亂還成立＝只是清單不是計畫） =====
  {
    const steps: any[] = (card as any)?.plan?.steps || [];
    if (steps.length > 0) {
      const noRationale = steps.filter((s) => !(s.rationale || "").trim());
      if (noRationale.length > 0) {
        issues.push({
          severity: "warning",
          category: "構造思路計畫",
          title: `${noRationale.length} 個計畫步驟沒有交代「為什麼是這個順序」`,
          description:
            "只列「要做哪幾件事」不夠：後一步依賴前一步結論時要點出依賴。判斷：把步驟順序打亂意思還成立嗎？成立→只是清單。例：「先證特徵函數性質（候選人能不能用的先決條件）→再推週期關係（先框定角頻率範圍）→最後求係數（只剩一個未知數）」。",
          targetSlot: "CONSTRUCTION",
        });
      }
    }
  }

  // ===== v4：路徑追問點邊界（完整技術推導挪去 WHY） =====
  {
    const cps = (card?.thoughtPoints || []).filter((t: any) => t.placement === "construction");
    for (const tp of cps) {
      const ans: string = tp.answer || "";
      const looksDerivation =
        ans.length > 140 &&
        (/移項|解方程|代入|兩邊|積分|求導|化簡|整理得|解得|⇒|⟹|∴|∵|∫|∑/.test(ans));
      if (looksDerivation) {
        issues.push({
          severity: "warning",
          category: "路徑邊界",
          title: `路徑追問點【${tp.modeName || "追問"}】的答案疑似完整技術推導`,
          description:
            "路徑只記錄「問過什麼問題、指向什麼方向」。若 (答案) 是任何人事後重算都會得到同樣結果的多步演算／證明，它是可獨立驗證的技術推導：答案整段挪去 WHY，路徑只留問題本身，加一句「完整推導見 WHY」過渡。",
          targetSlot: "CONSTRUCTION",
        });
      }
    }
  }

  // ===== v4：場／分布類「形狀」三選一 =====
  {
    const fieldShape = (card?.whyData as any)?.fieldShape;
    const mentionsField =
      /場|分布|分佈|每點|形狀/.test(whyReasoning) || /場|分布|分佈/.test(card?.title || "");
    if (mentionsField && (!fieldShape || fieldShape === "not-applicable")) {
      issues.push({
        severity: "suggestion",
        category: "場／分布形狀",
        title: "出現場／分布語彙但未選「形狀」三選一",
        description:
          "遇到「形狀」一詞停下來自問：現在答的是①分布範圍的形狀 ②某點取值方向 ③總共幾個獨立對象——三選一寫清楚，不要無聲切換。",
        targetSlot: "WHY",
      });
    }
  }

  // ===== v4：假設鎖定 vs 適用範圍（不要搞混） =====
  {
    const scopeish = (card?.assumptions || []).filter((a: any) => {
      if (a.kind === "scope") return true;
      return /適用範圍|通常|一般而言|絕對可積|L\^2|狄利克雷|收斂條件|成立範圍/.test(`${a.name || ""} ${a.description || ""}`);
    });
    for (const a of scopeish.slice(0, 3)) {
      issues.push({
        severity: "suggestion",
        category: "假設鎖定",
        title: `假設「${(a.name || "").slice(0, 18)}」疑似適用範圍前提`,
        description:
          "假設鎖定清單針對的是「這個具體情境／思想實驗設定了什麼條件」（一次性設定）；「這個技巧通常在什麼範圍成立」屬於適用範圍，該寫在 WHEN 或 WHY 的前提說明裡，不要塞進假設鎖定清單。",
        targetSlot: "ASSUMPTIONS",
      });
    }
  }

  // ===== v4：八點自我檢查（背景＋構造思路＋ WHY 正文共用同一套規則） =====
  const fourPointReports = runFourPointCheckOnCard(card, relations);
  for (const rep of fourPointReports) {
    for (const chk of rep.checks) {
      if (chk.status === "pass") continue;
      issues.push({
        severity: chk.status === "fail" ? "critical" : "warning",
        category: `八點自我檢查 · ${chk.index}${chk.label}`,
        title: `${rep.fieldLabel}：${chk.summary}`,
        description: chk.findings[0]
          ? `「${chk.findings[0].quote}」— ${chk.findings[0].issue}\n\n${chk.findings[0].fix}${
              chk.findings.length > 1 ? `\n（另有 ${chk.findings.length - 1} 處同類問題）` : ""
            }`
          : chk.summary,
        targetSlot: rep.field === "constructionThinking" ? "CONSTRUCTION" : "WHY",
      });
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

// ============================================================
// v4 四點自我檢查引擎（人名／零基础／路径／精確）
// 構造思路與 WHY 正文共用同一套規則，不是兩套。
// ============================================================

export type CheckId = "names" | "zeroBase" | "path" | "precision" | "concrete" | "toolChoice" | "proofChain" | "newRole";

export interface CheckFinding {
  /** 被點名的原文片段 */
  quote: string;
  /** 問題描述 */
  issue: string;
  /** 建議動作 */
  fix: string;
}

export interface CheckResult {
  id: CheckId;
  index: "①" | "②" | "③" | "④" | "⑤" | "⑥" | "⑦" | "⑧";
  label: string;
  /** 手冊原文要求（給 UI 顯示，避免使用者不知道這格在幹嘛） */
  manualRule: string;
  status: "pass" | "warn" | "fail";
  findings: CheckFinding[];
  summary: string;
}

export interface FourPointReport {
  /** 被檢查的欄位（v4：背景＋構造思路＋WHY 正文共用同一套八點規則） */
  field: "background" | "constructionThinking" | "whyFullReasoning";
  fieldLabel: string;
  checks: CheckResult[];
  failCount: number;
  warnCount: number;
  passCount: number;
  /** 八點全過 */
  clean: boolean;
  /** v4 獨立於七點的「符號綁定檢查」：每次引入新符號，核對是否與前面重用、重用時是否同指一物 */
  symbolBinding: {
    status: "pass" | "warn" | "fail";
    findings: CheckFinding[];
    summary: string;
  };
}

// ---------- 詞庫 ----------

/** 科學家人名（含音譯與原文）。①人名檢查用 */
const PERSON_NAMES = [
  "卡諾", "克勞修斯", "開爾文", "傅立葉", "傅里葉", "拉格朗日", "黎曼", "柯西",
  "牛頓", "愛因斯坦", "玻爾茲曼", "玻爾", "薛丁格", "薛定諤", "德布羅意", "德布罗意",
  "德拜", "波恩", "哈密頓", "雅可比", "高斯", "歐拉", "狄拉克", "范特霍夫",
  "勒夏特列", "勒沙特列", "亥姆霍茲", "諾特", "普朗克", "馬克士威", "吉布斯",
  "朗道", "費曼", "玻色", "費米", "海森堡", "泡利",
  "Carnot", "Clausius", "Kelvin", "Fourier", "Lagrange", "Riemann", "Cauchy",
  "Newton", "Einstein", "Boltzmann", "Bohr", "Schrodinger", "Schrodinger",
  "de Broglie", "Debye", "Born", "Hamilton", "Jacobi", "Gauss", "Euler",
  "Dirac", "van 't Hoff", "Le Chatelier", "Helmholtz", "Noether", "Planck",
  "Maxwell", "Gibbs", "Feynman", "Bose", "Fermi", "Heisenberg", "Pauli",
];

/** 歷史觸發的配套訊號（與人名同時出現時，判斷更可靠） */
const HISTORICAL_MARKERS = [
  "世紀", "年代", "年提", "年間", "西元", "西元前", "歷史", "當時", "原本",
  "最初", "18", "19", "20", "工业革命", "工業革命",
];

/** ②跳步用語：不許「顯然」「容易看出」 */
const JUMP_PHRASES = [
  "显然", "顯然", "容易看出", "不難看出", "易知", "顯而易見", "显然可见",
  "顯而易見", "同理可得", "不難驗證", "容易驗證", "顯見", "明顯地", "很明顯",
  "很明顯", "當然是", "不必細說", "從略", "此處從略", "不再推導", "略去不談",
];

/** ②需要當場解釋的專有名詞（出現即要有解釋線索） */
const JARGON = [
  "吉布斯自由能", "自適自由能", "自由能", "哈密頓算符", "哈密頓量", "哈密頓-雅可比",
  "希爾伯特空間", "本徵值", "本徵函數", "么正性", "厄米", "波函數",
  "正交基底", "正交基", "內積", "熵", "系綜", "配分函數", "留數定理",
  "狄利克雷條件", "Plancherel", "普朗克常數", "相空間", "重數", "簡諧",
  "反應商", "平衡常數", "活度", "化學勢", "活化能", "準靜態", "可逆循環",
  "熱庫", "卡諾循環", "克勞修斯表述", "開爾文表述", "狀態方程",
  "線性時不變", "卷積", "頻域", "時域", "自伴", "對易關係", "波包", "包絡",
  "解析延拓", "收斂半徑", "矩陣元", "測不準", "狄拉克", "短波極限", "退相干",
];

/**
 * ①「敘事用法」訊號：人名 + 這些詞 = 真的在講歷史觸發（該搬去 ORIGIN）
 */
const NARRATIVE_MARKERS = [
  // 把人物當成敘事主語的動詞（名字＋這些詞 = 在講歷史，不是在講邏輯觸發）
  "提出", "發現", "認為", "反對", "研究", "時代", "當時", "建立", "推導",
  "證明", "爭論", "年代", "世紀", "首先", "首次", "最初", "原本", "後來",
  "反駁", "批評", "陷入", "遭遇", "試圖", "問：", "問:", "遭", "被迫",
  "多年", "死結", "瓶頸", "面臨", "亟待", "急迫",
  "處理", "遇到", "每次", "想要", "尋求", "主張", "指出", "定義了", "假設了",
  "解釋", "描述", "受限", "引入", "採用", "改寫", "無視", "忽略", "主張",
  "反對", "拒絕", "接納", "修正", "推廣", "改進", "針對", "基於", "著手",
  "着手", "動機", "初衷", "直覺是", "想法是", "做法是",
];

/**
 * ①「命名術語」後綴：人名 + 這些詞 = 只是術語本身（如「克勞修斯表述」），
 * 不算混入歷史敘事，避免把正常用法全部誤報。
 */
const NAMED_OBJECT_SUFFIXES = [
  "表述", "定理", "機", "循環", "空間", "函數", "函式", "方程", "級數", "變換",
  "常數", "判據", "關係", "不等式", "法則", "原理", "分布", "分佈", "矩陣",
  "算子", "條件", "猜測", "引理", "係數", "座標", "波", "態", "群", "映射",
  "法", "式", "數", "函數", "點", "界", "能", "比", "效", "流", "流率",
];

/** ③「問題端」訊號 */
const PROBLEM_MARKERS = [
  "問題", "卡在", "困境", "矛盾", "想要", "為什麼", "怎麼", "如何", "無法",
  "失效", "不知道", "缺乏", "沒有", "痛點", "瓶頸", "問：", "問:", "更精確的問法",
];

/** ③「答案端」訊號 */
const ANSWER_MARKERS = [
  "因此", "所以", "得到", "推出", "才", "才是", "變成", "就是", "結論", "成立",
  "才對", "於是", "由此",
];

/** ③中間摸索過程訊號 */
const PATH_MARKERS = [
  "先", "再", "接著", "然後", "然後", "第一步", "第二步", "把", "看成", "轉化為",
  "轉變成", "改寫", "代入", "展開", "拆", "湊", "比對", "檢驗", "構造", "假設",
  "考慮", "注意到", "發現", "換個角度", "反過來", "倒推", "從…出發", "於是",
  "由此", "推", "算", "先寫", "先問",
];

/** ④A/B 對比對（兩者同時出現即視為做了二分對照） */
const DICHOTOMY_PAIRS: Array<[string, string, string]> = [
  ["離散", "連續", "離散/連續"],
  ["週期", "非週期", "週期/非週期"],
  ["可逆", "不可逆", "可逆/不可逆"],
  ["正頻", "負頻", "正/負頻率"],
  ["順時針", "逆時針", "旋轉方向"],
  ["微觀", "宏觀", "微觀/宏觀"],
  ["有限", "無限", "有限/無限"],
  ["時域", "頻域", "時域/頻域"],
  ["極大", "極小", "極大/極小"],
  ["收斂", "發散", "收斂/發散"],
  ["定義", "定理", "定義/定理"],
  ["近似", "證明", "近似/證明"],
];

/** ④「精確說明」訊號：必須講清楚「是什麼東西在A」 */
const PRECISION_MARKERS = [
  "指的是", "是指", "精確地說", "精確來講", "嚴格地說", "確切地說", "准確地說",
  "這裡說的", "這裡說的是", "說的是", "指的是…本身", "本身", "而不是", "不是指",
  "而非", "具體來說是", "也就是", "即：", "即:", "定義為", "意思是", "含義是", "才是", "差別所在", "區別在於", "差別在於", "關鍵在於", "必須說清楚", "說清楚",
];

/** ④「類比」訊號：只能當輔助，不能取代精確說明 */
const ANALOGY_MARKERS = [
  "就像", "好比", "比喻", "如同", "類似於", "类似于", "像是", "宛如", "彷彿",
  "好像", "猶如", "打個比方", "舉個例子來說就像", "相當於",
];

function uniquePreserveOrder<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** 抽取包含指定詞的句子（以中英標點切句） */
function sentencesContaining(text: string, word: string): string[] {
  const parts = text
    .replace(/\n+/g, "。")
    .split(/(?<=[。；;！？!?])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((s) => s.includes(word));
}

function clip(s: string, n = 46): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// ---------- ① 人名檢查 ----------
function checkNames(text: string): CheckResult {
  const base: CheckResult = {
    id: "names",
    index: "①",
    label: "人名檢查",
    manualRule:
      "文字裡有沒有出現任何歷史人物的名字？出現了，代表在講歷史觸發，該搬去 ORIGIN，不屬於構造思路／WHY正文。",
    status: "pass",
    findings: [],
    summary: "",
  };

  if (!text?.trim()) {
    base.status = "pass";
    base.summary = "欄位尚為空，未觸發此檢查。";
    return base;
  }

  const hits = uniquePreserveOrder(PERSON_NAMES.filter((n) => text.includes(n)));

  if (hits.length === 0) {
    base.summary = "未出現任何歷史人物名字 → 這段講的是邏輯觸發，擺放位置正確。";
    return base;
  }

  // 區分「敘事用法」與「命名術語用法」：
  // 「傅立葉研究熱傳導時」= 敘事（違規）；「克勞修斯表述」「希爾伯特空間」= 術語（正常）
  const narrativeHits: Array<{ name: string; sentence: string }> = [];
  const termOnlyHits: string[] = [];

  for (const name of hits) {
    const sents = sentencesContaining(text, name);
    const isNarrative = sents.some((s) => {
      const i = s.indexOf(name);
      // 名字前後一小段範圍內的訊號才算數（避免同句其他片段的詞誤觸發）
      const window = s.slice(Math.max(0, i - 16), i + name.length + 16);
      const after = s.slice(i + name.length, i + name.length + 4);
      // 名字後面直接接命名後綴（「克勞修斯表述」「希爾伯特空間」）→ 視為術語
      const isTerm = NAMED_OBJECT_SUFFIXES.some((suf) => after.startsWith(suf));
      const hasNarrative =
        NARRATIVE_MARKERS.some((m) => window.includes(m)) ||
        HISTORICAL_MARKERS.some((m) => window.includes(m));
      return hasNarrative && !isTerm;
    });
    if (isNarrative) narrativeHits.push({ name, sentence: sents[0] || `⋯${name}⋯` });
    else termOnlyHits.push(name);
  }

  if (narrativeHits.length === 0) {
    base.status = "pass";
    base.summary =
      termOnlyHits.length === 0
        ? "未出現任何歷史人物名字 → 這段講的是邏輯觸發，擺放位置正確。"
        : `出現的 ${termOnlyHits.length} 個名字（${termOnlyHits.slice(0, 3).join("、")}）只作為術語名稱使用，未構成歷史敘事，位置正確。`;
    return base;
  }

  base.status = "fail";
  base.findings = narrativeHits.slice(0, 5).map(({ name, sentence }) => ({
    quote: clip(sentence),
    issue: `以敘事方式使用人物名字「${name}」（搭配提出／研究／時代等歷史語彙）`,
    fix: "判準：「換個人、不靠這段歷史，會不會也撞到同一個點？」不會 → 這句該整段搬去 ORIGIN；若只是想指涉該概念，改成不依賴人名的說法（例：把「卡諾問：」改成「真正的問題是：」）。",
  }));
  base.summary = `有 ${narrativeHits.length} 處把「歷史觸發」寫進了「邏輯觸發」該待的位置${
    termOnlyHits.length ? `（另有 ${termOnlyHits.length} 個名字屬正常術語用法，未計入）` : ""
  }。`;
  return base;
}

// ---------- ② 零基础檢查 ----------
function checkZeroBase(text: string): CheckResult {
  const base: CheckResult = {
    id: "zeroBase",
    index: "②",
    label: "零基础檢查",
    manualRule:
      "假設讀者完全沒學過這個領域：有沒有專有名詞被直接丟出來卻沒當場解釋？有沒有「顯然」「容易看出」這類跳步用語？",
    status: "pass",
    findings: [],
    summary: "",
  };

  if (!text?.trim()) {
    base.summary = "欄位尚為空，未觸發此檢查。";
    return base;
  }

  // (a) 跳步用語
  const jumps = uniquePreserveOrder(JUMP_PHRASES.filter((j) => text.includes(j)));
  for (const j of jumps) {
    const sents = sentencesContaining(text, j);
    base.findings.push({
      quote: sents[0] ? clip(sents[0]) : `⋯${j}⋯`,
      issue: `跳步用語「${j}」——把該寫的過程省掉，讀者跟不過來`,
      fix: "把手省的推寫出來；寫不出來就是真的盲区，老實標 ▲ 或 ⋯，不能用「顯然」矇過去。",
    });
  }

  // (b) 專有名詞無解釋
  // Explanation cue: definition-ish connective or a parenthetical in the same sentence
  const defCues = [
    "就是", "是指", "定義", "指的是", "意思是", "即", "也即", "所謂", "指的是",
    "稱為", "記作", "表示", "指的是", "（", "(", "【",
  ];
  const bareTerms: string[] = [];
  for (const term of JARGON) {
    if (!text.includes(term)) continue;
    const sents = sentencesContaining(text, term);
    const hasExplain = sents.some((s) => {
      const i = s.indexOf(term);
      const around = s.slice(Math.max(0, i - 24), Math.min(s.length, i + term.length + 40));
      return defCues.some((c) => around.includes(c));
    });
    if (!hasExplain) bareTerms.push(term);
  }

  for (const term of bareTerms.slice(0, 6)) {
    const sents = sentencesContaining(text, term);
    base.findings.push({
      quote: sents[0] ? clip(sents[0]) : `⋯${term}⋯`,
      issue: `專有名詞「${term}」直接丟出，句中看不到任何当场解釋線索`,
      fix: `在該詞第一次出現處補一句就地解釋（「${term}就是⋯⋯」），或改用更基礎的說法。`,
    });
  }

  if (base.findings.length === 0) {
    base.summary = "未發現跳步用語，且出現的專有名詞都帶有当场解釋線索。";
    return base;
  }
  const jumpN = jumps.length;
  const jargonN = Math.min(bareTerms.length, 6);
  base.status = jumpN > 0 ? "fail" : "warn";
  base.summary =
    `發現 ${base.findings.length} 處未接住讀者的寫法` +
    (jumpN ? `（跳步用語 ${jumpN} 處）` : "") +
    (jargonN ? `（無解釋術語 ${jargonN} 個）` : "");
  return base;
}

// ---------- ③ 路径檢查 ----------
function checkPath(text: string, field: FourPointReport["field"] = "constructionThinking"): CheckResult {
  const base: CheckResult = {
    id: "path",
    index: "③",
    label: "路径檢查",
    manualRule:
      "「路径」是不是只寫了「問題是什麼」和「答案是什麼」兩端，中間怎麼從問題摸到答案的具體過程完全空白——是，代表只有結論沒有路径。",
    status: "pass",
    findings: [],
    summary: "",
  };

  if (!text?.trim()) {
    base.summary = "欄位尚為空，未觸發此檢查。";
    return base;
  }

  const hasProblem = PROBLEM_MARKERS.some((m) => text.includes(m));
  const hasAnswer = ANSWER_MARKERS.some((m) => text.includes(m));
  const pathHits = uniquePreserveOrder(PATH_MARKERS.filter((m) => text.includes(m)));
  const len = text.replace(/\s+/g, "").length;

  if (!hasProblem) {
    // WHY正文的「問題端」由構造思路負責交代，這裡不重複糾紛；
    // 構造思路自己必須有起點，否則只是空想。
    if (field === "whyFullReasoning") {
      base.status = "pass";
      base.summary =
        pathHits.length > 0
          ? `WHY正文帶有 ${pathHits.length} 個推導動作訊號（問題端交由構造思路交代，不重複要求）。`
          : "未見問題端，但這是慣例——若構造思路也缺，兩處都得補。";
      return base;
    }
    base.status = "warn";
    base.findings.push({
      quote: clip(text),
      issue: "看不到「起點困境」——讀者不知道這段是要解決什麼問題",
      fix: "補一句『卡在哪裡／想問的是什麼』，讓路径有明確起點。",
    });
    base.summary = "缺少问题端：路徑沒有起點，讀者不知為何要往下推。";
    return base;
  }

  if (hasProblem && hasAnswer && pathHits.length === 0) {
    base.status = "fail";
    base.findings.push({
      quote: clip(text),
      issue: `有問題端與答案端，但全文 ${len} 字中看不到任何中間摸索動作（先／再／把⋯看成／轉化為／代入／檢驗⋯）`,
      fix: "把「從問題摸到答案」的步驟寫出來：先做了哪個替換、為什麼選它、哪一步卡住、怎麼繞過去。這是構造思路與WHY正文的核心價值所在。",
    });
    base.summary = "只有結論、没有路径：從問題直接跳到答案，中間過程空白。";
    return base;
  }

  if (len < 90 && hasProblem && hasAnswer) {
    base.status = "warn";
    base.findings.push({
      quote: clip(text),
      issue: `內容過短（${len} 字），即使有關鍵詞，也很难容納完整的摸索過程`,
      fix: "檢查是否只記了「問題＋答案」兩句；把中間的聯想／推敲展開。",
    });
    base.summary = "內容偏短，路徑可能只寫了兩端。";
    return base;
  }

  base.summary = `問題端與答案端俱備，且偵測到 ${pathHits.length} 個中間摸索訊號。`;
  return base;
}

// ---------- ④ 精確檢查 ----------
function checkPrecision(text: string): CheckResult {
  const base: CheckResult = {
    id: "precision",
    index: "④",
    label: "精確檢查",
    manualRule:
      "出現「A情形 vs B情形」對比時，必須先精確講清楚「到底是什麼東西在A、什麼東西在B」；類比只能當精確說明後的輔助，不能取代精確說明本身。",
    status: "pass",
    findings: [],
    summary: "",
  };

  if (!text?.trim()) {
    base.summary = "欄位尚為空，未觸發此檢查。";
    return base;
  }

  for (const [a, b, tag] of DICHOTOMY_PAIRS) {
    if (!(text.includes(a) && text.includes(b))) continue;

    const sents = uniquePreserveOrder(
      sentencesContaining(text, a).concat(sentencesContaining(text, b))
    );
    const analogyUsed = ANALOGY_MARKERS.some((p) => text.includes(p));
    const precisionInText = PRECISION_MARKERS.some((p) => text.includes(p));

    // 視窗判定：只要對比詞前後一小段範圍內出現精確說明訊號，即視為已講清主體
    // （精確說明常寫在相鄰子句，硬要求同一句會誤報）
    const windows: string[] = [];
    for (const w of [a, b]) {
      let idx = text.indexOf(w);
      while (idx !== -1) {
        windows.push(text.slice(Math.max(0, idx - 60), idx + w.length + 60));
        idx = text.indexOf(w, idx + w.length);
      }
    }
    const subjectClarified = windows.some((win) =>
      PRECISION_MARKERS.some((p) => win.includes(p))
    );

    if (subjectClarified) continue;

    if (analogyUsed && !precisionInText) {
      base.status = "fail";
      base.findings.push({
        quote: clip(sents[0] || text),
        issue: `「${tag}」的對比只用類比帶過，且全文找不到精確說明的訊號（指的是／不是指／而非⋯）`,
        fix: `先用一句精確的話講清楚：到底是【什麼東西】在${a}、【什麼東西】在${b}（例如：是「可用來疊加的那組頻率本身」離散/連續，而不是時間變數 t）；類比留到這句之後當輔助。`,
      });
    } else {
      base.status = base.status === "fail" ? "fail" : "warn";
      base.findings.push({
        quote: clip(sents[0] || text),
        issue: `出現「${tag}」對比，但該句未點明「是什麼東西」處於兩端`,
        fix: `在對比出現處補上主語：什麼在${a}、什麼在${b}，避免讀者在兩個對象之間無聲切換。`,
      });
    }
  }

  if (base.findings.length === 0) {
    base.summary =
      DICHOTOMY_PAIRS.some(([a, b]) => text.includes(a) && text.includes(b))
        ? "有 A/B 對比，但都已點明主體，未被類比取代。"
        : "未出現 A/B 二分對比，此點不適用。";
    return base;
  }
  base.summary = `有 ${base.findings.length} 處 A/B 對比可能用類比或模糊說法取代了精確說明。`;
  return base;
}


// ---------- ⑤ 具體化測試 ----------
// 抓「單一個描述詞」精不精確、找對主語沒有（跟④抓「A/B 兩情形有沒有分清」不同層次）
function checkConcrete(text: string): CheckResult {
  const base: CheckResult = {
    id: "concrete",
    index: "⑤",
    label: "具體化測試",
    manualRule:
      "每個描述性詞（尤其「重疊／靠近／一致／對應」這類聽起來直覺、其實在描述某個具體計算或關係的詞）三問：主語是誰（數字／函數／函數圖像／計算過程）？能不能換成具體算式或判斷步驟？拿掉會不會散掉？",
    status: "pass",
    findings: [],
    summary: "",
  };
  if (!text?.trim()) { base.summary = "欄位尚為空，未觸發此檢查。"; return base; }

  const VAGUE = ["重疊", "靠近", "貼近", "一致", "對應", "乾脆", "乾淨", "清晰",
    "直覺上", "看起來", "很像", "差不多", "密切相關", "耦合", "呼應", "對得上"];
  const shots: string[] = [];
  for (const w of VAGUE) {
    if (text.includes(w)) {
      const sents = sentencesContaining(text, w);
      // 有精確 / 具體訊號才放行（算式、主語、步驟）
      const clarified = sents.some((sn) => /∫|Σ|\int|\sum|＝|==|\approx|定義為|指的是|具體/.test(sn));
      if (!clarified) shots.push(clip(sents[0] || text));
    }
  }
  if (shots.length === 0) {
    base.summary = "未發現模糊描述詞，或出現的描述詞都帶有具體算式／主語。";
    return base;
  }
  base.status = shots.some((_x, i) => i === 0 && VAGUE.some((w) => text.includes(w))) ? "warn" : "warn";
  for (const q of shots.slice(0, 5)) {
    base.findings.push({
      quote: q,
      issue: "模糊描述詞缺少主語或具體算式",
      fix: "三問：主語是數字／函數／函數圖像／計算過程？能不能換成具體算式（例：把「兩頻率不重疊」換成「∫e^(iω₁t)e^(−iω₂t)dt 算出來是 0」）？拿掉這個詞句子會不會散掉？",
    });
  }
  base.summary = `有 ${shots.length} 處描述詞疑似模糊（缺主語／缺算式）。`;
  return base;
}

// ---------- ⑥ 工具選擇檢查 ----------
function checkToolChoice(text: string): CheckResult {
  const base: CheckResult = {
    id: "toolChoice", index: "⑥", label: "工具選擇檢查",
    manualRule:
      "引入任何具體操作／工具／技巧（對兩邊積分、取共軛、構造某函數、把 f 分解成某種和）時，必須交代為什麼這個操作能達到想要的效果、效果怎麼被驗證／發現；從①契機第一個念頭就要跑，不能只在後面計算步驟才查。",
    status: "pass", findings: [], summary: "",
  };
  if (!text?.trim()) { base.summary = "欄位尚為空，未觸發此檢查。"; return base; }

  const TOOLS = ["積分", "取共軛", "共軛", "展開", "分解成", "傅立葉分解", "疊加", "變換",
    "對兩邊積分", "乘上共軛", "內積", "投影", "譜分解", "分離變數", "對易", "取特徵值"];
  const JUSTIFY = ["因為", "為了", "才能", "這樣才能", "目的", "要的是", "換言之", "如此一來",
    "驗證", "證實", "恰好", "因此選", "選擇它", "因為它"];
  const shots: Array<{ q: string; t: string }> = [];
  for (const t of TOOLS) {
    if (!text.includes(t)) continue;
    const sents = sentencesContaining(text, t);
    const justified = sents.some((sn) => {
      const i = sn.indexOf(t);
      const ahead = sn.slice(i + t.length, i + t.length + 30);
      const behind = sn.slice(Math.max(0, i - 30), i);
      return JUSTIFY.some((j) => ahead.includes(j) || behind.includes(j));
    });
    if (!justified) shots.push({ q: clip(sents[0] || text), t });
  }
  if (shots.length === 0) { base.summary = "引入的工具都帶有效果／理由說明。"; return base; }
  base.status = "warn";
  for (const s of shots.slice(0, 5)) {
    base.findings.push({
      quote: s.q,
      issue: `工具「${s.t}」直接亮相就用，沒有交代為什麼它能達到想要的效果`,
      fix: `先講想要的效果（例：「需要把加總裡某一項單獨挑出來、其他清成 0」），再交代「${s.t}」這個操作被驗證過恰好達成該效果（不同項積分為 0、同項不為 0）。工具要有來由，不能理所當然。`,
    });
  }
  base.summary = `有 ${shots.length} 個操作／工具缺少「為什麼用它」的說明。`;
  return base;
}

// ---------- ⑦ 證明鏈完整性檢查（v4 最重要：只問可機械執行的歸類） ----------
// 只在作者貼了 [地位:證明]（⊢證）時才適用；挨個核對證明引用的前提必須歸進三類之一。
function checkProofChain(card: any, text: string): CheckResult {
  const base: CheckResult = {
    id: "proofChain", index: "⑦", label: "證明鏈完整性檢查",
    manualRule:
      "貼 [地位:證明] 前，強制往回追溯證明的每一步，逐步核對它只能屬於三類之一：①本卡前面已確立的結論 ②一條明確指到別卡的 [前提] 關係邊 ③已誠實標成 [地位:公設] 或 [地位:歸納] 的假設。任何一步三類都不是，[地位:證明] 就不能貼。",
    status: "pass", findings: [], summary: "",
  };

  const claims = card?.claims || [];
  const proved = claims.filter((c: any) => c.epistemicMark === "⊢證");
  const prerequisites = card?._relationPrerequisites || card?.prerequisites || [];
  const assumptionNames = (card?.assumptions || []).map((a: any) => (a.name || "").toLowerCase());

  if (proved.length === 0) {
    base.summary = "此卡沒有貼 [地位:證明] 的聲明，此點不適用。";
    return base;
  }
  if (!text?.trim()) { base.summary = "有 [地位:證明] 但 WHY 正文為空，無法追溯；請先補推理。"; base.status = "warn"; return base; }

  // 偵測可疑的「默認起點」語式：直接引用一個定理/性質，卻不屬於已知三者之一
  const SUSPECT = ["由", "根據", "依", "因為", "既然", "由…可知", "由定理", "由性質", "眾所周知", "已知", "由定義", "由上式"];
  const KNOWN = [...assumptionNames, "公設", "前提", "歸納", "定義於", "見卡"];
  const sents = text.replace(/\n/g, "。").split(/(?<=[。；;！？!?])/).map((x) => x.trim()).filter(Boolean);

  const unresolved: string[] = [];
  for (const sn of sents) {
    // 只檢查「引用了某前提」的句子（有「由...得/推出/所以」或直接下結論）
    const isDerSd = /由|根據|依|因為|既然/.test(sn) && /得|推出|所以|故|因此|→|⟹|⇒/.test(sn);
    if (!isDerSd) continue;
    // 該句中引用的「依據」包含哪些名詞；判斷是否交代了身份
    const hasAnchor = PRECISION_MARKERS.concat(["公設", "歸納", "前卡", "見卡", "前提", "定義", "上式", "本卡前面", "已證"]).some((k) => sn.includes(k));
    if (!hasAnchor) unresolved.push(clip(sn));
  }

  if (unresolved.length === 0) {
    // 有少量待核對但都有明顯指涉：仍提醒作者人工複核（解釋性深度錯覺：自己看不清自己盲區）
    base.status = "pass";
    base.summary = "初步掃描未見「默認起點」，但請人工逐步往回核對：每一步是否都能歸進三類之一（本卡結論／[前提]邊／公設或歸納假設）。";
    if (prerequisites.length === 0 && assumptionNames.length === 0 && proved.length > 0) {
      base.status = "warn";
      base.summary = "此卡有 [地位:證明]，但既沒有假設鎖定、也沒有 [前提] 關係邊——請確認證明每一步的依據是否都已標明身份。";
    }
    return base;
  }

  base.status = "fail";
  for (const q of unresolved.slice(0, 5)) {
    base.findings.push({
      quote: q,
      issue: "此步引用的前提沒有交代身份（不是本卡前面已確立、不是 [前提] 邊、也沒標公設／歸納）",
      fix: "三選一：補證明（把這一步補成前面已確立的結論）、加一條指向別卡的 [前提] 關係邊、或老實改標 [地位:公設] 並註明「存在性／證明超出本卡範圍，需另開卡」——否則這條不能掛 [地位:證明]。",
    });
  }
  base.summary = `${unresolved.length} 步引用的依據三類都不屬，[地位:證明] 的證明鏈有破洞。`;
  return base;
}

// ---------- ⑧ 新角色登場檢查（v4 新增：新符號／新對象／角色第一次出現時的三交代） ----------
// 上位原則：②零基礎（專有名詞）、⑥工具選擇（操作）、符號綁定（重複符號）三者之上，
// 補上「全新、非專有名詞、非工具、非重複符號的角色／對象」第一次出現也要被交代清楚。
function checkNewRole(text: string, card: any, field: FourPointReport["field"]): CheckResult {
  const base: CheckResult = {
    id: "newRole", index: "⑧", label: "新角色登場檢查",
    manualRule:
      "任何新符號／新對象／新角色第一次出現都要三交代：①它是什麼（能精確寫成定義式優先，先給形式再給動機）②它跟已出現的東西什麼關係（在扮演前面哪個東西的角色？還是全新無關？明講，別讓讀者猜）③為什麼現在引入（回應某需求，或背景鋪陳所必需）。",
    status: "pass", findings: [], summary: "",
  };
  if (!text?.trim()) { base.summary = "欄位尚為空，未觸發此檢查。"; return base; }

  // 偵測「f(t)」這類獨立符號第一次登場的語境：前面沒有「定義/記/設/令」等鋪陳時即疑似
  const symbolPattern = /([a-zA-Zαβγδλθωψ])(\s*\([a-z]+\)|\s*[₀-₉])/g;
  const match = text.match(symbolPattern);
  const suspects: string[] = [];
  if (match) {
    // 找每個首次出現位置，檢查其前一小段有無鋪陳（定義/記/設/令/代表/扮演/對應/即背景）
    for (const sym of Array.from(new Set(match))) {
      const i = text.indexOf(sym);
      const behind = text.slice(Math.max(0, i - 40), i);
      const introduced = /定義|記作|設|令|代表|扮演|對應|指的是|即|寫作|表示為/.test(behind);
      if (!introduced) suspects.push(sym);
    }
  }

  // 若此卡有 candidate，但背景三段的 preciseObject 尚未確立，且構造思路／WHY 用了獨立符號
  const background = card?.backgroundData || {};
  const hasPreciseObject = !!(background.preciseObject && background.preciseObject.trim());

  if (suspects.length === 0 && hasPreciseObject) {
    base.summary = "未發現未鋪陳就登場的新角色。";
    return base;
  }

  for (const sym of suspects.slice(0, 5)) {
    base.findings.push({
      quote: `符號 ${sym} 第一次出現`,
      issue: "新角色登場時缺少「它是什麼／跟已出現的東西什麼關係／為什麼現在引入」的交代",
      fix: `三選一交代：①它能精確寫成定義式就寫「${sym} 就是…」；②明講它是否在扮演背景裡某個東西的角色（例：f(t) 扮演的就是「複雜輸入 x(t)」）；③說明現在引入是回應前面哪個需求。別讓讀者自己猜它是全新還是既有。`,
    });
  }
  if (!hasPreciseObject && (card?.constructionThinking || text)) {
    base.findings.push({
      quote: "【背景】未提供精確對象",
      issue: "構造思路／WHY 引入了符號，但【背景】第三段缺「精確對象＋情境語言」做對應",
      fix: "在【背景】第二段補上精確數學對象，並維持情境語言（一般化定義式後仍貼著第一段的具體對象講）。",
    });
  }
  base.status = base.findings.length ? "warn" : "pass";
  base.summary = base.findings.length ? `有 ${base.findings.length} 處新角色登場交代不全。` : "未發現未鋪陳就登場的新角色。";
  return base;
}


// ---------- 符號綁定檢查（獨立於七點） ----------
function checkSymbolBinding(text: string): FourPointReport["symbolBinding"] {
  const notApplicable = { status: "pass" as const, findings: [] as CheckFinding[], summary: "未偵測到重複使用同一符號的情形。" };
  if (!text?.trim()) return { status: "pass", findings: [], summary: "欄位尚為空，未觸發此檢查。" };

  // 粗糙抓字母符號：單一字元（希臘/拉丁），帶下標或上標風格
  const symbols = text.match(/[A-Za-zαβγδεζηθλμνξπρστφχψωΩΔΘΛΛΠΣΦΨ](?:_?\d+|[_'^]?[a-z]?|\\?[a-z])?/g) || [];
  const lower = text.toLowerCase();
  const dupFindings: CheckFinding[] = [];
  // 檢查數學常見易混淆重複：同一個符號出現於不同語境
  const counts: Record<string, number> = {};
  for (const sym of symbols) { const k = sym.replace(/\+/g, ""); if (/^[A-Za-z]$/.test(k) || k.length <= 2) counts[k] = (counts[k] || 0) + 1; }
  const heavyDup = Object.entries(counts).filter(([, n]) => n >= 6);
  if (heavyDup.length === 0) return notApplicable;

  const flagged: string[] = [];
  for (const [sym] of heavyDup) {
    const idxs: number[] = [];
    let i = lower.indexOf(sym.toLowerCase());
    while (i !== -1 && idxs.length < 4) { idxs.push(i); i = lower.indexOf(sym.toLowerCase(), i + 1); }
    const contexts: string[] = [];
    for (const ix of idxs) contexts.push(clip(text.slice(Math.max(0, ix - 12), ix + sym.length + 12)));
    // 情境差異大 → 可能同名異指
    const uniq = [...new Set(contexts)].length;
    if (uniq >= 2 && idxs.length >= 3) flagged.push(sym);
  }
  if (flagged.length === 0) return notApplicable;

  for (const sym of flagged.slice(0, 4)) {
    dupFindings.push({
      quote: `符號 ${sym} 於文中多處出現`,
      issue: "同一符號在不同語境反覆出現，可能是同名異指（same symbol, different referent）",
      fix: `核對每一處 ${sym} 是否指同一個東西；只要「不是同一個東西、卻用同一個符號」，當場加下標（${sym}₁、${sym}'、${sym}_f 等）或改名區分，不能先放著。`,
    });
  }
  return { status: "warn", findings: dupFindings, summary: `${flagged.length} 個符號可能在不同語境被重複使用，請逐一核對是否同指一物。` };
}


// ---------- 對外主函式 ----------

export function runEightPointCheck(
  text: string | undefined,
  field: FourPointReport["field"],
  card?: any
): FourPointReport {
  const t = text || "";
  const checks = [
    checkNames(t),
    checkZeroBase(t),
    checkPath(t, field),
    checkPrecision(t),
    checkConcrete(t),
    checkToolChoice(t),
    checkProofChain(card, t),
    checkNewRole(t, card, field),
  ];
  return {
    field,
    fieldLabel:
      field === "constructionThinking" ? "构造思路" : field === "background" ? "背景" : "WHY正文",
    checks,
    failCount: checks.filter((c) => c.status === "fail").length,
    warnCount: checks.filter((c) => c.status === "warn").length,
    passCount: checks.filter((c) => c.status === "pass").length,
    clean: checks.every((c) => c.status === "pass"),
    symbolBinding: checkSymbolBinding(t),
  };
}

/** 向後相容別名：既有呼叫端仍可用 runFourPointCheck（現在回傳七點） */
export function runFourPointCheck(
  text: string | undefined,
  field: FourPointReport["field"]
): FourPointReport {
  return runEightPointCheck(text, field, undefined);
}

/** 同時檢查背景＋構造思路＋ WHY 正文（手冊：同一套規則，三處都要跑）；relations 用於⑦證明鏈的 [前提] 歸類 */
export function runFourPointCheckOnCard(card: any, relations: any[] = []): FourPointReport[] {
  const bg = card?.backgroundData || {};
  const bgText = [bg.situation, bg.preciseObject, bg.preciseQuestion].filter(Boolean).join("\n");
  const enriched = {
    ...card,
    _relationPrerequisites: (relations || [])
      .filter((r: any) => r.relationType === "prerequisite" && (r.fromCardId === card?.id || r.toCardId === card?.id))
      .map((r: any) => r.label || r.id),
  };
  return [
    ...(bgText.trim() ? [runEightPointCheck(bgText, "background", enriched)] : []),
    runEightPointCheck(card?.constructionThinking, "constructionThinking", enriched),
    runEightPointCheck(card?.whyData?.fullReasoning, "whyFullReasoning", enriched),
  ];
}
