// 全卡審計驗證腳本（npx tsx scripts/audit.ts）
// 對 SEED_CARDS 全部卡片執行 fullCardAudit，印出每張卡的分數與問題清單。
import { SEED_CARDS, SEED_RELATIONS } from "../src/lib/seedData";
import { fullCardAudit } from "../src/lib/inspect";

const only = process.argv[2];
let allPass = true;

for (const card of SEED_CARDS) {
  if (only && card.id !== only) continue;
  const rels = SEED_RELATIONS.filter(
    (r: any) => r.fromCardId === card.id || r.toCardId === card.id
  );
  const res = fullCardAudit(card as any, rels);
  console.log("=".repeat(70));
  console.log(
    `${card.id}  |  Score: ${res.score} | Total Issues: ${res.totalIssues} | Critical: ${res.criticalCount}`
  );
  if (res.issues.length) {
    for (const it of res.issues) {
      console.log(`  - [${it.severity}] ${it.category} / ${it.targetSlot} :: ${it.title}`);
      console.log(`      ${String(it.description).split("\n")[0].slice(0, 300)}`);
    }
  }
  if (res.score !== 100 || res.totalIssues !== 0 || res.criticalCount !== 0) allPass = false;
}

console.log("=".repeat(70));
console.log(allPass ? "ALL CARDS PASS (100 / 0 issues / 0 critical)" : "SOME CARDS STILL HAVE ISSUES");
process.exit(allPass ? 0 : 1);
