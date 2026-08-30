"use client";

import React, { useState, useEffect, useRef } from "react";
import { InfiniteCanvas, CanvasObjectData, RelationData } from "@/components/InfiniteCanvas";
import { CardData } from "@/components/KnowledgeCardNode";
import { useWorkspaceState, actions, exportFile, importFile, resetToSeed, getState } from "@/lib/store";
import { CardDetailModal } from "@/components/CardDetailModal";
import { AIAuditDrawer } from "@/components/AIAuditDrawer";
import { ExpansionTestModal } from "@/components/ExpansionTestModal";
import { BlockageGuideModal } from "@/components/BlockageGuideModal";
import { AnalogyWorkbenchModal } from "@/components/AnalogyWorkbenchModal";
import { OmniSearchModal } from "@/components/OmniSearchModal";
import { ImageTextCheckModal } from "@/components/ImageTextCheckModal";
import { TemplateSelectorModal } from "@/components/TemplateSelectorModal";
import { NetworkGraphView } from "@/components/NetworkGraphView";
import { CardIndexView } from "@/components/CardIndexView";
import { ProcessLogsView } from "@/components/ProcessLogsView";
import { BlindSpotsView } from "@/components/BlindSpotsView";
import { MotherTopicsView } from "@/components/MotherTopicsView";
import { BackgroundCustomizer } from "@/components/BackgroundCustomizer";
import { FieldCustomizer, CustomField } from "@/components/FieldCustomizer";
import { FontSelector } from "@/components/FontSelector";
import {
  Sparkles,
  Search,
  Layers,
  Share2,
  BookOpen,
  History,
  AlertTriangle,
  HelpCircle,
  Plus,
  Save,
  CheckCircle2,
  Atom,
  Activity,
  Code2,
  Grid,
  Palette,
  Settings,
  Menu,
  X,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";

interface BackgroundConfig {
  type: "solid" | "gradient" | "pattern" | "custom";
  solidColor?: string;
  gradientStart?: string;
  gradientEnd?: string;
  gradientAngle?: number;
  patternType?: "dots" | "grid" | "lines" | "none";
  patternColor?: string;
  customCss?: string;
  imageUrl?: string;
  imageOpacity?: number;
  overlayColor?: string;
  overlayOpacity?: number;
}

export default function WorkbenchPage() {
  // Main view state
  const [activeView, setActiveView] = useState<
    "canvas" | "network" | "cards" | "logs" | "blindspots" | "motifs"
  >("canvas");

  // 資料改為純前端狀態倉庫（本機快取 + 檔案匯入/匯出，無資料庫、無 Node.js 後端）
  const workspaceState = useWorkspaceState();
  const workspace = workspaceState.workspace;
  const cards = workspaceState.cards as CardData[];
  const canvasObjects = workspaceState.canvasObjects as CanvasObjectData[];
  const relations = workspaceState.relations as RelationData[];
  const processLogs = workspaceState.processLogs;
  const blindSpots = workspaceState.blindSpots;
  const motherTopics = workspaceState.motherTopics as any[];
  const isLoading = false;

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 避免伺服器預渲染與瀏覽器本機快取的水合差異：
  // 等待客戶端掛載後才讀取本機快取狀態
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // UI Customization
  const [selectedFont, setSelectedFont] = useState("caveat");
  const [backgroundColor, setBackgroundColor] = useState<BackgroundConfig>({
    type: "gradient",
    gradientStart: "#e0f7ff",
    gradientEnd: "#b3e5fc",
    gradientAngle: 135,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // Active Modals & Drawers
  const [detailCard, setDetailCard] = useState<CardData | null>(null);
  const [previewCard, setPreviewCard] = useState<CardData | null>(null);
  const [auditCard, setAuditCard] = useState<CardData | null>(null);
  const [expansionCard, setExpansionCard] = useState<CardData | null>(null);
  const [showBlockageModal, setShowBlockageModal] = useState(false);
  const [editingRelation, setEditingRelation] = useState<RelationData | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [imageCheckCaption, setImageCheckCaption] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showBackgroundCustomizer, setShowBackgroundCustomizer] = useState(false);
  const [showFieldCustomizer, setShowFieldCustomizer] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // 匯出資料為 JSON 檔案
  const handleExport = () => {
    exportFile();
    setImportMessage("已匯出工作區 JSON 檔案");
    setTimeout(() => setImportMessage(null), 3000);
  };

  // 從 JSON 檔案匯入
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importFile(file);
    if (result.ok) {
      setImportMessage("匯入成功！工作區已替換為檔案內容");
    } else {
      setImportMessage(`匯入失敗：${result.error}`);
    }
    setTimeout(() => setImportMessage(null), 4000);
    e.target.value = "";
  };

  // 重置為種子資料
  const handleReset = () => {
    if (window.confirm("確定要重置為內建範例資料嗎？此操作會覆蓋目前本機快取。")) {
      resetToSeed();
      setImportMessage("已重置為初始範例資料");
      setTimeout(() => setImportMessage(null), 3000);
    }
  };

  // Keyboard shortcut Ctrl+K to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearchModal((s) => !s);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Canvas objects CRUD（純前端）
  const handleUpdateCanvasObjects = async (updated: Partial<CanvasObjectData>[]) => {
    actions.updateCanvasObjects(updated);
  };

  const handleDeleteCanvasObject = async (id: string) => {
    actions.deleteCanvasObject(id);
  };

  const handleSaveCard = async (updatedCard: Partial<CardData>) => {
    if (!updatedCard.id) return;
    actions.updateCard(updatedCard.id, updatedCard);
  };

  const handleDeleteCard = async (id: string) => {
    actions.deleteCard(id);
  };

  // Create new card from template or scratch（純前端）
  const handleCreateNewCard = async (templateKey: string = "standard_card") => {

    const titles: Record<
      string,
      {
        title: string;
        domain: string;
        shape: string;
        granularity: string;
        background: string;
        composite?: string[];
        compositeNote?: string;
      }
    > = {
      standard_card: {
        title: "新理科核心概念", domain: "物理 / 經典力學", shape: "A", granularity: "L2 定理/機制",
        background: "此知識點座落於哪個框架？前置背景是什麼？向下支撐什麼？",
      },
      proof_card: {
        title: "重要定理與連鎖推導鏈", domain: "數學 / 分析學", shape: "A", granularity: "L2 定理/機制",
        background: "此定理位於哪個公理系統之下？需要哪些前置定理？",
      },
      procedure_card: {
        title: "擾動響應判別程序", domain: "化學 / 動態平衡", shape: "C", granularity: "L3 技法/程序",
        background: "此程序適用於什麼狀態？輸入是什麼？輸出判定什麼？",
      },
      thought_experiment_card: {
        title: "極限假設思想實驗", domain: "物理 / 相對論", shape: "D", granularity: "L1 核心原理",
        background: "此思想實驗要挑戰哪個既有框架？假設邊界在哪？",
      },
      definition_card: {
        title: "概念基底代數定義", domain: "數學 / 拓撲代數", shape: "E", granularity: "L2 定理/機制",
        background: "此定義解決了什麼歧義？在哪個空間/結構上成立？",
      },
      composite_card: {
        title: "複合型知識點（外層程序＋內核推導）", domain: "理科綜合", shape: "COMPOSITE", granularity: "L2 定理/機制",
        background: "此知識點同時含有多種推理形狀，需標明哪一段屬於哪一型。",
        composite: ["C", "A"],
        compositeNote: "外層是 C 判別程序型（可執行流程），內核是 A 推導鏈型（流程為何正當）。只背外層流程而缺內核推導，遇到邊界案例必然誤判。",
      },
      math_formula_block: {
        title: "公式推導", domain: "公式", shape: "A", granularity: "L2 定理/機制", background: "",
      },
    };

    const config = titles[templateKey] || titles.standard_card;

    if (templateKey === "math_formula_block") {
      // Math block（純前端）
      actions.createCanvasObject({
        workspaceId: workspace.id,
        type: "math",
        x: 200 + Math.random() * 80,
        y: 150 + Math.random() * 80,
        width: 380,
        height: 140,
        semanticType: "WHY",
        content: {
          title: "新公式推導式",
          latex: "E = mc^2",
          epistemicMark: "⊢證",
        },
      });
      return;
    }

    const cardId = actions.createCard(
      {
        workspaceId: workspace.id,
        title: config.title,
        domain: config.domain,
        granularity: config.granularity,
        backgroundDescription: config.background,
        reasoningShape: config.shape,
        compositeShapes: config.composite || [],
        compositeNote: config.compositeNote || "",
        cardFont: selectedFont,
      },
      { x: 100 + Math.random() * 120, y: 100 + Math.random() * 120 }
    );
    const created = getState().cards.find((c) => c.id === cardId) as CardData | undefined;
    if (created) {
      setDetailCard(created); // 開啟編輯模式
    }
  };

  // Add 2D plot object（純前端）
  const handleAddPlotObject = async () => {
    actions.createCanvasObject({
      workspaceId: workspace.id,
      type: "plot",
      x: 250 + Math.random() * 60,
      y: 200 + Math.random() * 60,
      width: 420,
      height: 280,
      semanticType: "WHY_VISUAL",
      content: {
        title: "波包干涉與幾何振幅",
        formula: "Math.exp(-x*x/4) * Math.cos(4*x)",
        caption: "圖文獨立性檢查：文字必須自述波包包絡，不能把算符推導偷偷丟給圖示。",
      },
    });
  };

  // Save relation (create or update)（純前端）
  const handleSaveRelation = async (relData: Partial<RelationData>) => {
    actions.upsertRelation({ ...relData, workspaceId: workspace.id });
  };

  // Record process log（純前端）
  const handleAddProcessLog = async (logData: any) => {
    actions.addProcessLog({ ...logData, workspaceId: workspace.id });
  };

  // Blind spots（純前端）
  const handleAddBlindSpot = async (spotData: any) => {
    actions.addBlindSpot({ ...spotData, workspaceId: workspace.id });
  };

  const handleUpdateBlindSpot = async (id: string, updates: any) => {
    actions.updateBlindSpot(id, updates);
  };

  // Mother topics（純前端）
  const handleAddMotherTopic = async (topicData: any) => {
    actions.addMotherTopic({ ...topicData, workspaceId: workspace.id });
  };

  const handleVerifyMotherTopic = async (id: string, updates: any) => {
    actions.updateMotherTopic(id, updates);
  };

  // Expansion test passed -> compile HOW step
  const handleExpansionTestSuccess = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const updatedSteps = (card.howData?.steps || []).map((s) => ({ ...s, isCompiled: true }));
    handleSaveCard({
      id: cardId,
      howData: {
        ...card.howData!,
        status: "compiled",
        steps: updatedSteps,
        testNotes: "✓ 閉卷展開測試已成功通過，推理節點完備。",
      },
    });
    setExpansionCard(null);
  };

  // Blockage recorded
  const handleBlockageRecorded = (cardId: string, note: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    handleSaveCard({
      id: cardId,
      blockageNotes: (card.blockageNotes ? `${card.blockageNotes} ` : "") + note,
    });
  };

  if (!mounted || isLoading) {
    return (
      <div
        className="app-shell flex flex-col items-center justify-center text-white gap-4"
        style={{
          background:
            backgroundColor.type === "gradient"
              ? `linear-gradient(${backgroundColor.gradientAngle || 135}deg, ${
                  backgroundColor.gradientStart
                }, ${backgroundColor.gradientEnd})`
              : backgroundColor.solidColor,
        }}
      >
        <Atom className="w-12 h-12 text-blue-500 animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-bold">理科知識筆記工作台</h2>
          <p className="text-xs text-white/70 mt-1">
            正在啟動自由畫布、結構化理科卡片與認識論審查引擎...
          </p>
        </div>
      </div>
    );
  }

  const views = [
    { key: "canvas", label: "畫布", icon: Grid },
    { key: "network", label: "知識網", icon: Share2 },
    { key: "cards", label: "卡片", icon: BookOpen },
    { key: "logs", label: "日誌", icon: History },
    { key: "blindspots", label: "盲區", icon: AlertTriangle },
    { key: "motifs", label: "母題", icon: Layers },
  ] as const;

  return (
    <div className="app-shell flex flex-col overflow-hidden bg-slate-50 text-slate-900">
      {/* Header — responsive */}
      <header className="h-12 sm:h-11 bg-white border-b border-slate-200 px-3 sm:px-4 flex items-center justify-between z-40 flex-shrink-0 safe-top">
        {/* Left: Logo + Nav（桌機顯示完整 tab，手機只顯示 logo + 漢堡） */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setShowMobileMenu(true)}
            className="md:hidden touch-target flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            title="選單"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Atom className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-800 tracking-tight">SciNotes</span>
          </div>

          {/* 桌機 / 平板：橫向 tab（可橫向捲動避免溢出） */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg overflow-x-auto no-scrollbar max-w-[52vw] lg:max-w-none">
            {views.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveView(key)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                  activeView === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 手機：中央顯示當前視圖名稱 */}
        <span className="md:hidden text-sm font-semibold text-slate-700">
          {views.find((v) => v.key === activeView)?.label}
        </span>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={() => setShowSearchModal(true)}
            className="touch-target flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="搜尋 (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>
          {/* 這些次要設定手機收進漢堡選單 */}
          <button
            onClick={() => setShowBackgroundCustomizer(true)}
            className="hidden sm:flex touch-target items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="背景設定"
          >
            <Palette className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFieldCustomizer(true)}
            className="hidden sm:flex touch-target items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="欄位設定"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="hidden sm:block">
            <FontSelector currentFont={selectedFont} onSelect={setSelectedFont} />
          </div>

          <div className="hidden sm:block w-px h-5 bg-slate-200 mx-1" />

          {/* 資料管理：匯出 / 匯入 / 重置（純前端靜態檔案） */}
          <button
            onClick={handleExport}
            className="touch-target flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="匯出工作區為 JSON 檔案"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleImportClick}
            className="touch-target flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="從 JSON 檔案匯入工作區"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="hidden sm:flex touch-target items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="重置為初始範例資料"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors touch-target"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">新增</span>
          </button>

          {/* 隱藏檔案選擇器 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </header>

      {/* 匯入/匯出訊息條 */}
      {importMessage && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs shadow-lg">
          {importMessage}
        </div>
      )}

      {/* 手機側邊選單 (Drawer) */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setShowMobileMenu(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-white shadow-xl flex flex-col safe-top safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-12 px-4 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <Atom className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-800">SciNotes</span>
              </div>
              <button
                onClick={() => setShowMobileMenu(false)}
                className="touch-target flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1">視圖</div>
              {views.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveView(key);
                    setShowMobileMenu(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-0.5 ${
                    activeView === key
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}

              <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 mt-3">設定</div>
              <button
                onClick={() => { setShowBackgroundCustomizer(true); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 mb-0.5"
              >
                <Palette className="w-4 h-4" />
                <span>背景設定</span>
              </button>
              <button
                onClick={() => { setShowFieldCustomizer(true); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 mb-0.5"
              >
                <Settings className="w-4 h-4" />
                <span>欄位設定</span>
              </button>

              <div className="text-[10px] font-bold text-slate-400 uppercase px-2 py-1 mt-3">資料（檔案）</div>
              <button
                onClick={() => { handleExport(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 mb-0.5"
              >
                <Download className="w-4 h-4" />
                <span>匯出 JSON 檔案</span>
              </button>
              <button
                onClick={() => { handleImportClick(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 mb-0.5"
              >
                <Upload className="w-4 h-4" />
                <span>匯入 JSON 檔案</span>
              </button>
              <button
                onClick={() => { handleReset(); setShowMobileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 mb-0.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>重置為初始範例</span>
              </button>

              <div className="px-3 py-2">
                <div className="text-xs text-slate-500 mb-1.5">全域字體</div>
                <FontSelector currentFont={selectedFont} onSelect={setSelectedFont} />
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* 2. Main Viewport */}
      <main
        className="flex-1 relative overflow-hidden"
        style={{
          fontFamily: {
            caveat: "var(--font-caveat)",
            indie: "var(--font-indie)",
            fredoka: "var(--font-fredoka)",
            playwrite: "var(--font-playwrite)",
            brush: "var(--font-brush)",
            comfortaa: "var(--font-comfortaa)",
            satisfy: "var(--font-satisfy)",
            pacifico: "var(--font-pacifico)",
            sacramento: "var(--font-sacramento)",
            dancing: "var(--font-dancing)",
            quicksand: "var(--font-quicksand)",
            varela: "var(--font-varela)",
          }[selectedFont] || "var(--font-caveat)",
          background:
            backgroundColor.type === "gradient"
              ? `linear-gradient(${backgroundColor.gradientAngle || 135}deg, ${
                  backgroundColor.gradientStart
                }, ${backgroundColor.gradientEnd})`
              : backgroundColor.type === "pattern" && backgroundColor.patternType === "dots"
              ? `radial-gradient(${backgroundColor.patternColor || "#cbd5e1"} 1.5px, transparent 1.5px)`
              : backgroundColor.type === "pattern" && backgroundColor.patternType === "grid"
              ? `linear-gradient(${backgroundColor.patternColor || "#e5e7eb"} 1px, transparent 1px), linear-gradient(90deg, ${backgroundColor.patternColor || "#e5e7eb"} 1px, transparent 1px)`
              : backgroundColor.type === "pattern" && backgroundColor.patternType === "lines"
              ? `repeating-linear-gradient(45deg, ${backgroundColor.patternColor || "#f3f4f6"}, ${backgroundColor.patternColor || "#f3f4f6"} 10px, ${backgroundColor.solidColor || "#ffffff"} 10px, ${backgroundColor.solidColor || "#ffffff"} 20px)`
              : backgroundColor.type === "custom"
              ? backgroundColor.customCss || ""
              : backgroundColor.solidColor || "#f8fafc",
          backgroundSize:
            backgroundColor.type === "pattern"
              ? backgroundColor.patternType === "grid"
                ? "20px 20px"
                : "20px 20px"
              : undefined,
          backgroundImage:
            backgroundColor.type === "pattern" && backgroundColor.imageUrl
              ? `url(${backgroundColor.imageUrl})`
              : undefined,
          opacity:
            backgroundColor.type === "pattern" && backgroundColor.imageUrl
              ? backgroundColor.imageOpacity ?? 1
              : undefined,
        }}
      >
        {activeView === "canvas" && (
          <InfiniteCanvas
            objects={canvasObjects}
            cards={cards}
            relations={relations}
            onUpdateObjects={handleUpdateCanvasObjects}
            onDeleteObject={handleDeleteCanvasObject}
            onSelectCard={(c) => setDetailCard(c)}
            onOpenPreview={(c) => setPreviewCard(c)}
            onRunAudit={(c) => setAuditCard(c)}
            onExpansionTest={(c) => setExpansionCard(c)}
            onOpenEditRelation={(rel) => setEditingRelation(rel)}
            onImageTextIndependenceTest={(caption) => setImageCheckCaption(caption)}
            onOpenCardDetail={(c) => setDetailCard(c)}
            fontFamily={selectedFont}
            backgroundConfig={backgroundColor}
          />
        )}

        {activeView === "network" && (
          <NetworkGraphView
            cards={cards}
            relations={relations}
            processLogs={processLogs}
            blindSpots={blindSpots}
            motherTopics={motherTopics}
            onSelectCard={(id) => {
              const card = cards.find((c) => c.id === id);
              if (card) {
                setDetailCard(card);
                setActiveView("canvas");
              }
            }}
            onOpenAddRelation={() =>
              setEditingRelation({
                id: "",
                workspaceId: workspace?.id,
                fromCardId: cards[0]?.id || "",
                toCardId: cards[1]?.id || "",
                relationType: "prerequisite",
                status: "active",
              })
            }
            onEditRelation={(rel) => setEditingRelation(rel)}
          />
        )}

        {activeView === "cards" && (
          <CardIndexView
            cards={cards}
            onOpenCardDetail={(c) => setDetailCard(c)}
            onOpenPreview={(c) => setPreviewCard(c)}
            onRunAudit={(c) => setAuditCard(c)}
            onExpansionTest={(c) => setExpansionCard(c)}
            onDeleteCard={handleDeleteCard}
            onCreateCard={() => handleCreateNewCard("standard_card")}
            onJumpToCanvas={(cardId) => {
              setActiveView("canvas");
            }}
          />
        )}

        {activeView === "logs" && (
          <ProcessLogsView
            cards={cards}
            processLogs={processLogs}
            onAddLog={handleAddProcessLog}
          />
        )}

        {activeView === "blindspots" && (
          <BlindSpotsView
            cards={cards}
            blindSpots={blindSpots}
            onUpdateBlindSpot={handleUpdateBlindSpot}
            onAddBlindSpot={handleAddBlindSpot}
            onJumpToCard={(cardId) => {
              setActiveView("canvas");
            }}
          />
        )}

        {activeView === "motifs" && (
          <MotherTopicsView
            cards={cards}
            motherTopics={motherTopics}
            onAddMotherTopic={handleAddMotherTopic}
            onVerifyMotherTopic={handleVerifyMotherTopic}
          />
        )}
      </main>

      {/* 3. Global Modals & Drawers */}

      {/* Card Detail Modal — 編輯模式進入 */}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          initialMode="edit"
          onClose={() => setDetailCard(null)}
          onSave={handleSaveCard}
          onRunAudit={(c) => setAuditCard(c)}
          onExpansionTest={(c) => setExpansionCard(c)}
          fontFamily={selectedFont}
        />
      )}

      {/* Card Preview Modal — 預覽模式進入（同一元件，可即時切換） */}
      {previewCard && (
        <CardDetailModal
          card={previewCard}
          initialMode="preview"
          onClose={() => setPreviewCard(null)}
          onSave={handleSaveCard}
          onRunAudit={(c) => setAuditCard(c)}
          onExpansionTest={(c) => setExpansionCard(c)}
          fontFamily={selectedFont}
        />
      )}

      {/* AI Deep Audit Drawer */}
      {auditCard && (
        <AIAuditDrawer
          card={auditCard}
          onClose={() => setAuditCard(null)}
          onOpenExpansionTest={(c) => setExpansionCard(c)}
          onOpenBlockageGuide={() => setShowBlockageModal(true)}
        />
      )}

      {/* Expansion Test Modal */}
      {expansionCard && (
        <ExpansionTestModal
          card={expansionCard}
          onClose={() => setExpansionCard(null)}
          onSuccess={handleExpansionTestSuccess}
        />
      )}

      {/* Blockage Guide Modal */}
      {showBlockageModal && (
        <BlockageGuideModal
          cards={cards}
          onClose={() => setShowBlockageModal(false)}
          onRecordResolution={handleBlockageRecorded}
        />
      )}

      {/* Analogy & Relation Workbench Modal */}
      {editingRelation && (
        <AnalogyWorkbenchModal
          cards={cards}
          relation={editingRelation.id ? editingRelation : null}
          onClose={() => setEditingRelation(null)}
          onSaveRelation={handleSaveRelation}
        />
      )}

      {/* Omni-Search Modal */}
      {showSearchModal && (
        <OmniSearchModal
          cards={cards}
          onClose={() => setShowSearchModal(false)}
          onSelectCard={(cardId) => {
            const c = cards.find((card) => card.id === cardId);
            if (c) {
              setDetailCard(c);
              setActiveView("canvas");
            }
          }}
        />
      )}

      {/* Image Text Independence Modal */}
      {imageCheckCaption && (
        <ImageTextCheckModal
          captionText={imageCheckCaption}
          onClose={() => setImageCheckCaption(null)}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplateModal && (
        <TemplateSelectorModal
          onClose={() => setShowTemplateModal(false)}
          onSelectTemplate={(tplKey) => {
            handleCreateNewCard(tplKey);
          }}
        />
      )}

      {/* Background Customizer Modal */}
      {showBackgroundCustomizer && (
        <BackgroundCustomizer
          currentConfig={backgroundColor}
          onUpdate={(config) => {
            setBackgroundColor(config);
            actions.updateWorkspaceMeta({
              settings: { ...(workspace?.settings || {}), backgroundColor: config },
            });
          }}
          onClose={() => setShowBackgroundCustomizer(false)}
        />
      )}

      {/* Field Customizer Modal */}
      {showFieldCustomizer && (
        <FieldCustomizer
          fields={customFields}
          onUpdate={(fields) => {
            setCustomFields(fields);
            actions.updateWorkspaceMeta({
              settings: { ...(workspace?.settings || {}), customFields: fields },
            });
          }}
          onClose={() => setShowFieldCustomizer(false)}
        />
      )}
    </div>
  );
}
