import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Module } from "node:module";
import ts from "typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, "../src/lib/cardPapers.ts");
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(sourcePath);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled, sourcePath);
const { createEmptyInquiry, ensureCardPaperModel, migrateCardToV9 } = loaded.exports;

test("v8 narrative migrates into a v9 inquiry without discarding the legacy fields", () => {
  const legacy = {
    id: "legacy-card",
    title: "舊卡",
    backgroundDescription: "背景脈絡",
    backgroundData: { situation: "情境", preciseObject: "對象", preciseQuestion: "問題" },
    constructionThinking: "構造思路",
    plan: { steps: [{ label: "先看邊界", rationale: "排除退化情況" }], ranges: "範圍註記" },
    candidate: { requirement: "需求", candidateForm: "候選", motivation: "動機" },
    whyData: { confidenceBefore: 2, closedBookDraft: "閉卷草稿", fullReasoning: "完整推導", confidenceAfter: 4 },
  };
  const migrated = migrateCardToV9(legacy);
  const inquiry = migrated.inquiries[0];

  assert.equal(migrated.paperModelVersion, 9);
  assert.match(inquiry.situation, /情境/);
  assert.match(inquiry.situation, /精確對象/);
  assert.match(inquiry.steps[0].content, /構造思路/);
  assert.match(inquiry.steps[0].content, /舊版計畫/);
  assert.match(inquiry.steps[0].content, /候選形式/);
  assert.match(inquiry.steps[1].content, /完整推導/);
  assert.equal(inquiry.steps[0].kind, "thinking");
  assert.equal(inquiry.steps[1].kind, "derivation");
  assert.ok(inquiry.steps[1].connectionToPrevious);
  assert.equal(migrated.backgroundDescription, legacy.backgroundDescription);
  assert.deepEqual(migrated.whyData, legacy.whyData);
});

test("paper index contains all v9 fields, is stable, and re-numbers after another inquiry is added", () => {
  const one = ensureCardPaperModel({ id: "card-one", title: "一張卡" });
  assert.equal(one.papers.length, 11);
  assert.equal(ensureCardPaperModel(one), one, "normalized model is referentially idempotent");
  assert.deepEqual(one.papers.map((paper) => paper.field), [
    "card-head",
    "inquiry-situation",
    "inquiry-reasoning",
    "inquiry-organization",
    "inquiry-recovery",
    "inquiry-output",
    "what",
    "apply",
    "relations",
    "process-log",
    "diagnostic",
  ]);
  assert.match(one.papers[1].contentRef, /\/situation$/);
  assert.equal(one.papers[6].contentRef, "whatData");
  assert.equal(one.papers[7].contentRef, "howData");

  const noteId = one.papers[1].id;
  const noted = ensureCardPaperModel({
    ...one,
    papers: one.papers.map((paper) => paper.id === noteId ? { ...paper, note: "從例子開始" } : paper),
  });
  assert.equal(noted.papers[1].id, noteId);
  assert.equal(noted.papers[1].note, "從例子開始");

  const two = ensureCardPaperModel({
    ...noted,
    inquiries: [...noted.inquiries, createEmptyInquiry(2, "inquiry-second")],
  });
  assert.equal(two.papers.length, 16);
  assert.equal(two.papers[1].note, "從例子開始");
  assert.equal(two.papers[11].field, "what");
  assert.deepEqual(two.papers.map((paper) => paper.number), Array.from({ length: 16 }, (_, index) => index + 1));
});

test("inquiry step normalization enforces alternating thinking and derivation", () => {
  const normalized = ensureCardPaperModel({
    id: "card-steps",
    inquiries: [{
      id: "inquiry-a",
      title: "探究 A",
      situation: "情境",
      steps: [
        { id: "a", kind: "derivation", content: "一" },
        { id: "b", kind: "thinking", content: "二" },
        { id: "c", kind: "thinking", content: "三" },
      ],
    }],
  });
  assert.deepEqual(normalized.inquiries[0].steps.map((step) => step.kind), ["thinking", "derivation", "thinking"]);
  assert.deepEqual(normalized.inquiries[0].steps.map((step) => step.content), ["一", "二", "三"]);
  assert.equal(normalized.inquiries[0].steps[0].connectionToPrevious, undefined);
  assert.equal(typeof normalized.inquiries[0].steps[1].connectionToPrevious, "string");
});
