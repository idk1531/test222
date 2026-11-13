"use client";

import React from "react";
import type { CardData } from "./KnowledgeCardNode";
import type { CardPaperField, CardPaperRecord, InquiryGroup, InquiryStep } from "@/lib/cardPapers";
import { CARD_PAPER_FIELD_LABELS, formatPaperNumber } from "@/lib/cardPapers";
import { relationLabelText } from "@/lib/inspect";
import { Plus, Trash2 } from "lucide-react";
import { SoloAssessmentPanel } from "./SoloAssessmentPanel";
import { EditableText, useCardEdit } from "./CardPaperEditor";
import {
  CardPaperTheme,
  V6Page5What,
  V6Page6Apply,
  V6Page7ProcessLogs,
  V6PageHeaderBox,
  V6PageFooter,
} from "./CardPaperSections";

const UI_FONT = "'Varela Round', sans-serif";
const BLOOM_LEVELS = ["記憶", "理解", "應用", "分析", "評鑑", "創造"];

export function cardPaperTitle(paper: CardPaperRecord, inquiries: InquiryGroup[] = []): string {
  const fieldLabel = CARD_PAPER_FIELD_LABELS[paper.field];
  if (!paper.inquiryId) return fieldLabel;
  const index = inquiries.findIndex((inquiry) => inquiry.id === paper.inquiryId);
  const inquiry = index >= 0 ? inquiries[index] : undefined;
  const title = inquiry?.title?.trim() || `探究 ${index >= 0 ? index + 1 : ""}`.trim();
  return `${title} · ${fieldLabel}`;
}

function patchInquiry(
  card: CardData,
  inquiryId: string,
  update: (inquiry: InquiryGroup) => InquiryGroup,
): Partial<CardData> {
  return {
    inquiries: (card.inquiries || []).map((inquiry) => inquiry.id === inquiryId ? update(inquiry) : inquiry),
  };
}

function updatePaperNote(card: CardData, paperId: string, note: string): Partial<CardData> {
  return {
    papers: (card.papers || []).map((paper) => paper.id === paperId ? { ...paper, note } : paper),
  };
}

function PaperNoteField({ paper, card, theme }: {
  paper: CardPaperRecord;
  card: CardData;
  theme: CardPaperTheme;
}) {
  const ed = useCardEdit();
  if (!ed?.editable && !paper.note) return null;
  return (
    <div
      className="flex items-start gap-2 rounded-sm border px-2.5 py-2 text-[11px]"
      style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor }}
    >
      <span className="font-bold flex-shrink-0" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>紙面備註</span>
      <EditableText
        multiline
        rows={1}
        value={paper.note || ""}
        onChange={(value) => ed?.patch(updatePaperNote(card, paper.id, value))}
        placeholder="（可留空；可在卡頭目錄編輯）"
        className="block min-w-0 flex-1 whitespace-pre-wrap"
        style={{ color: theme.textColor }}
      />
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
  theme,
  font,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  theme: CardPaperTheme;
  font: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>{label}</div>
      <EditableText
        multiline
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="block w-full min-h-16 rounded-sm border px-3 py-2 whitespace-pre-wrap text-sm leading-relaxed"
        font={font}
        style={{ color: theme.textColor, borderColor: theme.borderColor, backgroundColor: theme.boxBg }}
      />
    </div>
  );
}

function CardHeadPaper({
  card,
  paper,
  pageNumber,
  theme,
  font,
  papers,
  onNavigatePaper,
  onAddInquiry,
}: {
  card: CardData;
  paper: CardPaperRecord;
  pageNumber: string;
  theme: CardPaperTheme;
  font: string;
  papers: CardPaperRecord[];
  onNavigatePaper: (paperId: string) => void;
  onAddInquiry: () => void;
}) {
  const ed = useCardEdit();
  const inquiries = card.inquiries || [];

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox
        title="卡頭"
        subtitle="卡片集合構成知識系統；本卡由欄位紙實例組成"
        pageNumber={pageNumber}
        theme={theme}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-sm border" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>卡片名稱</div>
          <EditableText
            value={card.title || ""}
            onChange={(value) => ed?.patch({ title: value })}
            placeholder="（輸入卡片名稱）"
            className="block text-xl font-bold"
            font={font}
            style={{ color: theme.headingColor }}
          />
        </div>
        <div>
          <div className="text-[10px] font-bold mb-1" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>領域</div>
          <EditableText
            value={card.domain || ""}
            onChange={(value) => ed?.patch({ domain: value })}
            placeholder="未指定領域"
            className="block text-base font-semibold"
            font={font}
            style={{ color: theme.textColor }}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-2 border-t pt-2" style={{ borderColor: theme.borderColor }}>
          <span className="text-[10px] font-bold" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>顆粒度</span>
          <EditableText
            value={card.granularity || ""}
            onChange={(value) => ed?.patch({ granularity: value })}
            placeholder="設定顆粒度"
            className="text-xs font-semibold"
            style={{ color: theme.textColor }}
          />
        </div>
      </div>

      <div className="rounded-sm border p-3 space-y-1 text-[11px] leading-relaxed" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.textColor }}>
        <p>「紙」是欄位的一份實例，不指實體紙張；紙號只表示本卡目錄中的排列，不代表欄位重要性或探究的主從。</p>
        <p className="font-semibold" style={{ color: theme.accentColor }}>
          暫行提示：探究組的重複介面與附錄 D.5 第二組其他未決事項仍待確認；可操作的重複功能不等於已定案規則。
        </p>
      </div>

      <div className="rounded-sm border overflow-hidden" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ borderColor: theme.borderColor }}>
          <div>
            <h3 className="text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>本卡紙目錄</h3>
            <p className="text-[10px] mt-0.5" style={{ color: theme.mutedTextColor }}>紙號 · 欄位 · 備註</p>
          </div>
          <button
            type="button"
            disabled={!ed?.editable}
            onClick={onAddInquiry}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-45 print:hidden"
            style={{ borderColor: theme.accentColor, color: theme.accentColor }}
            title="新增一組同層探究；重複規則仍待附錄 D.5 確認"
          >
            <Plus className="h-3 w-3" /> 新增探究組（暫行）
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b" style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}>
                <th className="px-3 py-1.5 font-semibold">紙號</th>
                <th className="px-3 py-1.5 font-semibold">欄位</th>
                <th className="px-3 py-1.5 font-semibold">備註</th>
              </tr>
            </thead>
            <tbody>
              {papers.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0 align-top" style={{ borderColor: theme.borderColor }}>
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onNavigatePaper(item.id)}
                      className="font-mono font-bold hover:underline"
                      style={{ color: theme.accentColor }}
                      title={`前往 ${cardPaperTitle(item, inquiries)}`}
                    >
                      {formatPaperNumber(item.number)}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 font-semibold" style={{ color: theme.textColor }}>{cardPaperTitle(item, inquiries)}</td>
                  <td className="px-3 py-1 w-[42%]">
                    <EditableText
                      multiline
                      rows={1}
                      value={item.note || ""}
                      onChange={(value) => ed?.patch(updatePaperNote(card, item.id, value))}
                      placeholder="（可留空）"
                      className="block w-full min-h-5 whitespace-pre-wrap"
                      font={font}
                      style={{ color: theme.mutedTextColor }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <V6PageFooter note="卡頭與紙目錄；紙號依欄位紙排列自動編排" theme={theme} />
      <span className="sr-only">{paper.id}</span>
    </div>
  );
}

function InquiryFieldPaper({
  card,
  paper,
  pageNumber,
  theme,
  font,
  inquiry,
  inquiryIndex,
  onRemoveInquiry,
}: {
  card: CardData;
  paper: CardPaperRecord;
  pageNumber: string;
  theme: CardPaperTheme;
  font: string;
  inquiry: InquiryGroup;
  inquiryIndex: number;
  onRemoveInquiry: (inquiryId: string) => void;
}) {
  const ed = useCardEdit();
  const field = paper.field;
  const inquiries = card.inquiries || [];
  const groupTitle = inquiry.title?.trim() || `探究 ${inquiryIndex + 1}`;
  const update = (fn: (current: InquiryGroup) => InquiryGroup) => {
    if (ed?.editable) ed.patch(patchInquiry(card, inquiry.id, fn));
  };
  const pageTitle = cardPaperTitle(paper, inquiries);
  const subtitleByField: Partial<Record<CardPaperField, string>> = {
    "inquiry-situation": "探究組從情境起始；各探究同層並列。",
    "inquiry-reasoning": "思路與推演依序交替；各段以承接文字連在同一條推理路徑上。",
    "inquiry-organization": "選填整理紙。",
    "inquiry-recovery": "回收紙。",
    "inquiry-output": "輸出紙。",
  };

  const renderContentField = (fieldKey: "organization" | "recovery" | "output", label: string, placeholder: string) => (
    <FieldText
      label={label}
      value={inquiry[fieldKey] || ""}
      onChange={(value) => update((current) => ({ ...current, [fieldKey]: value }))}
      placeholder={placeholder}
      theme={theme}
      font={font}
      rows={7}
    />
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox title={pageTitle} subtitle={subtitleByField[field]} pageNumber={pageNumber} theme={theme} />

      {field.startsWith("inquiry-") && (
        <div className="rounded-sm border px-3 py-2 text-[10px] leading-relaxed" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.mutedTextColor }}>
          暫行註記：探究紙組重複與附錄 D.5 第二組其他未決事項待確認；此頁只呈現可增減的暫行探究結構。
        </div>
      )}

      <div className="flex-1 rounded-sm border p-3 sm:p-4 space-y-4" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
        {field === "inquiry-situation" && (
          <>
            <FieldText
              label="情境"
              value={inquiry.situation || ""}
              onChange={(value) => update((current) => ({ ...current, situation: value }))}
              placeholder="記錄這一組探究從何種情境起始。"
              theme={theme}
              font={font}
              rows={7}
            />
            <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: theme.borderColor }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold flex-shrink-0" style={{ color: theme.mutedTextColor, fontFamily: UI_FONT }}>探究標題</span>
                <EditableText
                  value={inquiry.title || ""}
                  onChange={(value) => update((current) => ({ ...current, title: value }))}
                  placeholder={`探究 ${inquiryIndex + 1}`}
                  className="text-xs font-semibold"
                  font={font}
                  style={{ color: theme.headingColor }}
                />
              </div>
              <button
                type="button"
                disabled={!ed?.editable || inquiries.length <= 1}
                onClick={() => onRemoveInquiry(inquiry.id)}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] text-rose-700 border-rose-300 disabled:opacity-35 print:hidden"
                title={inquiries.length <= 1 ? "至少保留一組探究" : "刪除此探究組及其紙目錄項目"}
              >
                <Trash2 className="h-3 w-3" /> 刪除探究組
              </button>
            </div>
          </>
        )}

        {field === "inquiry-reasoning" && (
          <div className="space-y-3">
            {inquiry.steps.map((step, index) => (
              <InquiryStepEditor
                key={step.id}
                step={step}
                index={index}
                theme={theme}
                font={font}
                editable={!!ed?.editable}
                onChange={(nextStep) => update((current) => ({
                  ...current,
                  steps: current.steps.map((item) => item.id === step.id ? nextStep : item),
                }))}
                onRemove={() => update((current) => ({
                  ...current,
                  steps: current.steps
                    .filter((item) => item.id !== step.id)
                    .map((item, position) => ({
                      ...item,
                      kind: position % 2 === 0 ? "thinking" : "derivation",
                      ...(position === 0 ? { connectionToPrevious: undefined } : {}),
                    })),
                }))}
                canRemove={inquiry.steps.length > 1}
              />
            ))}
            <button
              type="button"
              disabled={!ed?.editable}
              onClick={() => {
                const index = inquiry.steps.length;
                const nextStep: InquiryStep = {
                  id: `${inquiry.id}-step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  kind: index % 2 === 0 ? "thinking" : "derivation",
                  content: "",
                  ...(index > 0 ? { connectionToPrevious: "" } : {}),
                };
                update((current) => ({ ...current, steps: [...current.steps, nextStep] }));
              }}
              className="inline-flex items-center gap-1 rounded border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40 print:hidden"
              style={{ borderColor: theme.accentColor, color: theme.accentColor }}
            >
              <Plus className="h-3.5 w-3.5" /> 追加下一段「{inquiry.steps.length % 2 === 0 ? "思路" : "推演"}」
            </button>
          </div>
        )}

        {field === "inquiry-organization" && renderContentField("organization", "整理（選填）", "可留空；若要整理，請在此欄位紙記錄。")}
        {field === "inquiry-recovery" && renderContentField("recovery", "回收", "記錄本探究組的回收內容。")}
        {field === "inquiry-output" && renderContentField("output", "輸出", "記錄本探究組的輸出內容。")}
      </div>

      <V6PageFooter note={`${groupTitle} · ${CARD_PAPER_FIELD_LABELS[field]}`} theme={theme} />
    </div>
  );
}

function InquiryStepEditor({
  step,
  index,
  theme,
  font,
  editable,
  onChange,
  onRemove,
  canRemove,
}: {
  step: InquiryStep;
  index: number;
  theme: CardPaperTheme;
  font: string;
  editable: boolean;
  onChange: (step: InquiryStep) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const label = step.kind === "thinking" ? "思路" : "推演";
  return (
    <div className="relative rounded-sm border p-3 space-y-2" style={{ borderColor: theme.borderColor, backgroundColor: theme.paperBg }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold" style={{ color: theme.accentColor, fontFamily: UI_FONT }}>
          {index + 1}. {label}
        </span>
        <button
          type="button"
          disabled={!editable || !canRemove}
          onClick={onRemove}
          className="rounded p-1 text-slate-400 hover:text-rose-600 disabled:opacity-25 print:hidden"
          title={canRemove ? "刪除此段；後續思路／推演會重新交替" : "至少保留一段思路"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {index > 0 && (
        <FieldText
          label="承接上一段的連結"
          value={step.connectionToPrevious || ""}
          onChange={(value) => onChange({ ...step, connectionToPrevious: value })}
          placeholder="說明這一段如何從上一段思路／推演接續。"
          theme={theme}
          font={font}
          rows={2}
        />
      )}
      <FieldText
        label={label}
        value={step.content || ""}
        onChange={(value) => onChange({ ...step, content: value })}
        placeholder={label === "思路" ? "記錄這一步的思路。" : "記錄這一步的推演。"}
        theme={theme}
        font={font}
        rows={5}
      />
    </div>
  );
}

function RelationPaper({
  card,
  pageNumber,
  theme,
  relations,
  cardTitles,
}: {
  card: CardData;
  pageNumber: string;
  theme: CardPaperTheme;
  relations: Array<any>;
  cardTitles: Record<string, string>;
}) {
  const edges = relations.filter((relation) => relation.fromCardId === card.id || relation.toCardId === card.id);
  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox title="關係邊" subtitle="沿用既有關係邊資料與附錄 A–C 規則" pageNumber={pageNumber} theme={theme} />
      <div className="rounded-sm border p-3 sm:p-4 space-y-3" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg, color: theme.textColor }}>
        <p className="text-[11px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
          關係邊作為獨立欄位紙呈現；以下只列出連到本卡的既有邊，不改動 WHAT、APPLY、附錄 A–C 的判準。
        </p>
        {edges.length ? (
          <div className="space-y-2">
            {edges.map((relation, index) => {
              const outgoing = relation.fromCardId === card.id;
              const fromTitle = cardTitles[relation.fromCardId] || relation.fromTitle || relation.fromCardId || "（未知卡）";
              const toTitle = cardTitles[relation.toCardId] || relation.toTitle || relation.toCardId || "（未知卡）";
              const label = relation.label || relationLabelText(relation.relationType);
              return (
                <div key={relation.id || index} className="rounded-sm border px-3 py-2 text-xs" style={{ borderColor: theme.borderColor, backgroundColor: theme.paperBg }}>
                  <span className="font-semibold">{fromTitle}</span>
                  <span className="mx-2 font-bold" style={{ color: theme.accentColor }}>—[{label}]→</span>
                  <span className="font-semibold">{toTitle}</span>
                  {relation.description && <p className="mt-1 text-[10px]" style={{ color: theme.mutedTextColor }}>{relation.description}</p>}
                  <span className="sr-only">{outgoing ? "本卡為起點" : "本卡為終點"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-sm border border-dashed p-4 text-center text-xs italic" style={{ borderColor: theme.borderColor, color: theme.mutedTextColor }}>
            目前沒有連到本卡的關係邊。
          </p>
        )}
      </div>
      <V6PageFooter note="關係邊紙 · 關係紀錄仍由工作區關係資料管理" theme={theme} />
    </div>
  );
}

function DiagnosticPaper({ card, pageNumber, theme }: { card: CardData; pageNumber: string; theme: CardPaperTheme }) {
  const ed = useCardEdit();
  const activeBloom = card.bloomLevel || "理解";
  return (
    <div className="flex flex-col h-full space-y-4">
      <V6PageHeaderBox title="診斷標籤" subtitle="Bloom 與 SOLO 保持為兩個不同維度；依既有規則評估" pageNumber={pageNumber} theme={theme} />
      <div className="rounded-sm border p-3 sm:p-4 space-y-3" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
        <div className="text-xs font-bold" style={{ color: theme.headingColor, fontFamily: UI_FONT }}>Bloom · 認知深度</div>
        <div className="flex flex-wrap gap-1.5">
          {BLOOM_LEVELS.map((level) => {
            const selected = activeBloom === level;
            return (
              <button
                key={level}
                type="button"
                disabled={!ed?.editable}
                onClick={() => ed?.patch({ bloomLevel: level })}
                className="rounded border px-2 py-1 text-[11px] font-semibold disabled:cursor-default"
                style={{
                  borderColor: selected ? theme.accentColor : theme.borderColor,
                  color: selected ? theme.accentColor : theme.mutedTextColor,
                  backgroundColor: selected ? `${theme.accentColor}22` : "transparent",
                }}
              >
                {level}
              </button>
            );
          })}
        </div>
        <p className="text-[10px]" style={{ color: theme.mutedTextColor }}>目前 Bloom：<b style={{ color: theme.headingColor }}>{activeBloom}</b></p>
      </div>
      <div className="rounded-sm border p-3 sm:p-4 space-y-2" style={{ borderColor: theme.borderColor, backgroundColor: theme.boxBg }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: theme.textColor }}>
          <span className="font-bold" style={{ color: theme.headingColor }}>SOLO 整合度</span>
          <span className="rounded border px-2 py-0.5 text-[10px] font-bold" style={{ borderColor: theme.borderColor, color: theme.accentColor }}>
            {card.soloData?.declaredLevel || card.soloLevel || "未設定"}
          </span>
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: theme.mutedTextColor }}>
          Bloom 觀察單一概念的認知深度；SOLO 觀察知識網整合度，兩者不可合併。
        </p>
        {ed?.editable && (
          <div className="border-t pt-3" style={{ borderColor: theme.borderColor }}>
            <SoloAssessmentPanel
              cardId={card.id}
              soloData={card.soloData}
              soloLevel={card.soloLevel || "多點結構"}
              bloomLevel={activeBloom}
              editable
              onChange={(nextLevel, nextData) => ed.patch({ soloData: nextData, soloLevel: nextLevel || nextData.declaredLevel })}
            />
          </div>
        )}
      </div>
      <V6PageFooter note="診斷標籤紙 · 沿用 Bloom／SOLO 既有規則" theme={theme} />
    </div>
  );
}

export interface CardPaperV9PageProps {
  card: CardData;
  paper: CardPaperRecord;
  pageNumber: string;
  papers: CardPaperRecord[];
  theme: CardPaperTheme;
  font: string;
  relations: Array<any>;
  cardTitles: Record<string, string>;
  processLogs: Array<any>;
  onNavigatePaper: (paperId: string) => void;
  onAddInquiry: () => void;
  onRemoveInquiry: (inquiryId: string) => void;
}

export function CardPaperV9Page({
  card,
  paper,
  pageNumber,
  papers,
  theme,
  font,
  relations,
  cardTitles,
  processLogs,
  onNavigatePaper,
  onAddInquiry,
  onRemoveInquiry,
}: CardPaperV9PageProps) {
  let content: React.ReactNode;
  const inquiries = card.inquiries || [];

  if (paper.field === "card-head") {
    content = (
      <CardHeadPaper
        card={card}
        paper={paper}
        pageNumber={pageNumber}
        theme={theme}
        font={font}
        papers={papers}
        onNavigatePaper={onNavigatePaper}
        onAddInquiry={onAddInquiry}
      />
    );
  } else if (paper.field.startsWith("inquiry-")) {
    const inquiryIndex = inquiries.findIndex((inquiry) => inquiry.id === paper.inquiryId);
    const inquiry = inquiryIndex >= 0 ? inquiries[inquiryIndex] : undefined;
    content = inquiry ? (
      <InquiryFieldPaper
        card={card}
        paper={paper}
        pageNumber={pageNumber}
        theme={theme}
        font={font}
        inquiry={inquiry}
        inquiryIndex={inquiryIndex}
        onRemoveInquiry={onRemoveInquiry}
      />
    ) : (
      <V6PageHeaderBox title="探究紙不存在" pageNumber={pageNumber} theme={theme} />
    );
  } else if (paper.field === "what") {
    content = <V6Page5What card={card} font={font} theme={theme} pageNumber={pageNumber} />;
  } else if (paper.field === "apply") {
    content = <V6Page6Apply card={card} font={font} theme={theme} pageNumber={pageNumber} />;
  } else if (paper.field === "relations") {
    content = <RelationPaper card={card} pageNumber={pageNumber} theme={theme} relations={relations} cardTitles={cardTitles} />;
  } else if (paper.field === "process-log") {
    content = <V6Page7ProcessLogs card={card} font={font} processLogs={processLogs} theme={theme} pageNumber={pageNumber} />;
  } else {
    content = <DiagnosticPaper card={card} pageNumber={pageNumber} theme={theme} />;
  }

  return (
    <div className="space-y-3">
      {paper.field !== "card-head" && <PaperNoteField paper={paper} card={card} theme={theme} />}
      {content}
    </div>
  );
}
