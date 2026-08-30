// 純前端 SOLO 診斷引擎（原 /api/ai/solo 邏輯，完全不依賴伺服器）
import { CardData } from "@/components/KnowledgeCardNode";

export const SOLO_ORDER = ["前結構", "單點結構", "多點結構", "關聯結構", "抽象拓展"];

export interface SoloAssessment {
  cardId: string;
  declaredLevel: string;
  suggestedLevel: string;
  verdict: "match" | "overclaim" | "underclaim";
  verdictMessage: string;
  rationale: string;
  blockers: string[];
  metrics: {
    countedRelations: number;
    unverifiedAnalogies: number;
    verifiedAnalogies: number;
    generalizations: number;
    motifsContaining: number;
    verifiedMotifs: number;
    perspectiveCount: number;
    hasTwoPerspectives: boolean;
    cardsWithOpenBlindSpots: number;
  };
  v4RuleApplied: boolean;
  v4Note: string;
}

/**
 * SOLO = 知識網整合度（與 Bloom 單點深度嚴格分離）
 * 依據真實關係邊計算；~ 未驗證類比不計分；
 * v4 新規則：邊指向目標有未決盲區（▲）時，該邊暫不計入。
 */
export function assessSolo(
  card: CardData,
  relations: any[],
  motherTopics: any[],
  blindSpotOpenCardIds: Set<string>
): SoloAssessment {
  const cardId = card.id;

  const rels = relations.filter(
    (r) => r.fromCardId === cardId || r.toCardId === cardId
  );

  // v4: 邊類型合法 + 指向目標無未決盲區才計入
  const countedRelations = rels.filter((r) => {
    if (r.relationType === "analogy_unverified") return false;
    const otherCardId = r.fromCardId === cardId ? r.toCardId : r.fromCardId;
    if (!otherCardId) return true;
    if (blindSpotOpenCardIds.has(otherCardId)) return false;
    return true;
  });

  const unverifiedAnalogies = rels.filter((r) => r.relationType === "analogy_unverified");
  const verifiedAnalogies = rels.filter((r) => r.relationType === "analogy_verified");
  const generalizations = rels.filter(
    (r) => r.relationType === "generalization" || r.relationType === "special_case"
  );

  const motifsContaining = (motherTopics || []).filter((m) =>
    (m.instanceCardIds || []).includes(cardId)
  );
  const verifiedMotifs = motifsContaining.filter((m) => m.isVerified);

  const perspectiveCount = card.whatData?.perspectives?.length ?? 0;
  const hasTwoPerspectives = Boolean(
    card.whyData?.perspective1?.content && card.whyData?.perspective2?.content
  );

  // SOLO 判定階梯
  let level = "前結構";
  const reasons: string[] = [];

  const hasAnyContent = Boolean(card.whatData?.summary) || Boolean(card.whyData?.fullReasoning);

  if (hasAnyContent) {
    level = "單點結構";
    reasons.push("WHAT/WHY 已有內容，可掌握單一面向。");
  }

  if (perspectiveCount >= 2 || hasTwoPerspectives) {
    level = "多點結構";
    reasons.push(
      `具備 ${Math.max(perspectiveCount, hasTwoPerspectives ? 2 : 0)} 個獨立面向（多視角或雙失效模式視角），但面向之間尚未必然收束。`
    );
  }

  if (countedRelations.length >= 2 || verifiedAnalogies.length >= 1) {
    level = "關聯結構";
    reasons.push(
      `具 ${countedRelations.length} 條計分關係邊${
        verifiedAnalogies.length > 0 ? `（含 ${verifiedAnalogies.length} 條已驗證結構類比 ≈）` : ""
      }，各面向已被關係串成一體。`
    );
  }

  if (verifiedMotifs.length >= 1 && (generalizations.length >= 1 || verifiedAnalogies.length >= 1)) {
    level = "抽象拓展";
    reasons.push(
      `屬於 ${verifiedMotifs.length} 個已成立母題，且具備推廣/特例或已驗證類比邊，可跨框架遷移並對新情境做預測。`
    );
  }

  const blockers: string[] = [];
  if (unverifiedAnalogies.length > 0) {
    blockers.push(
      `有 ${unverifiedAnalogies.length} 條未驗證類比 ~[d]，依規則不計入整合度。請先完成候選推理測試。`
    );
  }
  if (countedRelations.length === 0) {
    blockers.push("此卡目前為孤島節點：沒有任何計分關係邊，SOLO 無法超過多點結構。");
  }
  if (motifsContaining.length === 0) {
    blockers.push("尚未歸屬任何母題，難以達到抽象拓展。母題需 ≥3 實例 + 候選推理測試 + 新實例預測驗證。");
  } else if (verifiedMotifs.length === 0) {
    blockers.push("所屬母題尚未通過驗證（候選狀態），不計入抽象拓展門檻。");
  }
  if (!hasTwoPerspectives) {
    blockers.push("WHY 尚未具備兩個失效模式不同的視角，多點結構的證據偏弱。");
  }
  // v4：指出因目標未驗證被排除的邊
  const excludedByBlindSpot = rels.filter((r) => {
    if (r.relationType === "analogy_unverified") return false;
    const otherCardId = r.fromCardId === cardId ? r.toCardId : r.fromCardId;
    return otherCardId && blindSpotOpenCardIds.has(otherCardId);
  });
  if (excludedByBlindSpot.length > 0) {
    blockers.push(
      `有 ${excludedByBlindSpot.length} 條邊因指向目標仍有未決盲區（▲）而暫不計入——先處理目標卡的盲區，這些邊才會重新計分。`
    );
  }

  const declared = card.soloData?.declaredLevel || card.soloLevel;
  const declaredIdx = SOLO_ORDER.indexOf(declared);
  const suggestedIdx = SOLO_ORDER.indexOf(level);

  let verdict: SoloAssessment["verdict"] = "match";
  if (declaredIdx > suggestedIdx) verdict = "overclaim";
  if (declaredIdx < suggestedIdx) verdict = "underclaim";

  return {
    cardId,
    declaredLevel: declared,
    suggestedLevel: level,
    verdict,
    verdictMessage:
      verdict === "overclaim"
        ? `⚠ 你宣告的「${declared}」高於知識網證據支持的「${level}」。SOLO 測的是網絡整合度，不是你對這個概念有多熟。`
        : verdict === "underclaim"
        ? `↑ 知識網證據已支持升級到「${level}」，你目前宣告「${declared}」，可考慮接受升級。`
        : `✓ 宣告層級與知識網證據一致（${level}）。`,
    rationale: reasons.join(" "),
    blockers,
    metrics: {
      countedRelations: countedRelations.length,
      unverifiedAnalogies: unverifiedAnalogies.length,
      verifiedAnalogies: verifiedAnalogies.length,
      generalizations: generalizations.length,
      motifsContaining: motifsContaining.length,
      verifiedMotifs: verifiedMotifs.length,
      perspectiveCount,
      hasTwoPerspectives,
      cardsWithOpenBlindSpots: blindSpotOpenCardIds.size,
    },
    v4RuleApplied: true,
    v4Note:
      "邊指向目標有未決盲區（▲）時，該邊暫不計入 SOLO 判定——目標本身站不住，邊就不能算有效整合。",
  };
}

/** 收集目前所有有未決盲區的卡片 id */
export function openBlindSpotCardIds(blindSpots: any[]): Set<string> {
  return new Set(
    (blindSpots || [])
      .filter((b) => b.status === "open" && b.cardId)
      .map((b) => b.cardId as string)
  );
}
