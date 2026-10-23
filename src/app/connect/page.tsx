"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Link2, LoaderCircle, ShieldAlert, Unplug } from "lucide-react";
import { copyTextWithFallback } from "@/lib/clipboard";
import {
  CONNECTION_TIMEOUT_MS,
  ICE_GATHERING_TIMEOUT_MS,
  ConnectionCancelledError,
  type CandidateTypeCounts,
  type SelectedCandidatePairState,
  DEFAULT_STUN_SERVER,
  connectionPhaseLabel,
  dataChannelStateLabel,
  iceConnectionStateLabel,
  iceGatheringStateLabel,
  peerConnectionStateLabel,
  signalingStateLabel,
  type ConnectionPhase,
} from "@/lib/connection";
import { useCollaboration } from "@/components/CollaborationProvider";

function isBusy(phase: ConnectionPhase): boolean {
  return phase === "creating-offer" || phase === "creating-answer" || phase === "applying-answer";
}

function canStartNewPairing(phase: ConnectionPhase): boolean {
  return phase === "idle";
}

function formatFailure(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isCancellation(error: unknown): boolean {
  return error instanceof ConnectionCancelledError;
}

function formatCandidateTypes(counts: CandidateTypeCounts | null): string {
  if (!counts) return "尚無統計";
  return `host ${counts.host} · srflx ${counts.srflx} · relay ${counts.relay} · prflx ${counts.prflx} · other ${counts.other}`;
}

function selectedCandidatePairLabel(state: SelectedCandidatePairState): string {
  switch (state) {
    case "checking": return "檢查中";
    case "succeeded": return "已選定且成功";
    case "failed": return "失敗";
    case "not-reported": return "瀏覽器尚未回報";
  }
}

function StateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}

export default function ConnectionPage() {
  const {
    manager,
    snapshot,
    displayName,
    setDisplayName,
    guestRole,
    setGuestRole,
    localRole,
    remoteParticipant,
    contentSyncStatus,
    signalingDrafts,
    setSignalingDraft,
    clearSignalingDrafts,
    preparePairing,
    disconnect,
  } = useCollaboration();
  const { offerOutput, offerInput, answerOutput, answerInput } = signalingDrafts;
  const setOfferOutput = (value: string) => setSignalingDraft("offerOutput", value);
  const setOfferInput = (value: string) => setSignalingDraft("offerInput", value);
  const setAnswerOutput = (value: string) => setSignalingDraft("answerOutput", value);
  const setAnswerInput = (value: string) => setSignalingDraft("answerInput", value);
  const [stunServer, setStunServer] = useState(DEFAULT_STUN_SERVER);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"offer" | "answer" | null>(null);

  const busy = isBusy(snapshot.phase);
  const canStart = canStartNewPairing(snapshot.phase);
  const isInitiator = snapshot.role === "initiator";
  const isJoiner = snapshot.role === "joiner";
  const phaseText = connectionPhaseLabel(snapshot.phase);
  const statusColor = useMemo(() => {
    if (snapshot.phase === "open") return "border-emerald-300 bg-emerald-50 text-emerald-900";
    if (snapshot.phase === "failed") return "border-rose-300 bg-rose-50 text-rose-900";
    if (snapshot.phase === "disconnected") return "border-amber-300 bg-amber-50 text-amber-950";
    if (snapshot.phase === "idle") return "border-slate-200 bg-slate-50 text-slate-800";
    return "border-sky-300 bg-sky-50 text-sky-950";
  }, [snapshot.phase]);

  const createInvite = async () => {
    setErrorMessage("");
    setNotice("");
    clearSignalingDrafts();
    preparePairing();
    try {
      const offer = await manager.createOffer(stunServer);
      setOfferOutput(offer);
      setNotice("Offer 已建立。請私下傳給加入端，等待對方產生 Answer。");
    } catch (error) {
      if (isCancellation(error)) return;
      setErrorMessage(formatFailure(error, "無法建立 Offer。請檢查瀏覽器支援與網路後重試。"));
    }
  };

  const createReply = async () => {
    setErrorMessage("");
    setNotice("");
    setAnswerOutput("");
    preparePairing();
    try {
      const answer = await manager.createAnswer(offerInput, stunServer);
      setAnswerOutput(answer);
      setNotice("Answer 已建立。請私下傳回發起端；等發起端套用 Answer 後，DataChannel 才可能開啟。");
    } catch (error) {
      if (isCancellation(error)) return;
      setErrorMessage(formatFailure(error, "無法建立 Answer。請確認 Offer 完整且貼在正確欄位。"));
    }
  };

  const confirmAnswerSent = () => {
    setErrorMessage("");
    setNotice("");
    try {
      manager.confirmAnswerSent();
      setNotice("已確認 Answer 傳回 A；B 端現在開始等待連線。");
    } catch (error) {
      setErrorMessage(formatFailure(error, "請先產生 Answer，再確認已傳回發起端。"));
    }
  };

  const completePairing = async () => {
    setErrorMessage("");
    setNotice("");
    try {
      await manager.completeWithAnswer(answerInput);
      setNotice("Answer 已套用，正在等待實際連線與 DataChannel 開啟。");
    } catch (error) {
      if (isCancellation(error)) return;
      setErrorMessage(formatFailure(error, "無法套用 Answer。請確認交換順序與邀請是否相符。"));
    }
  };

  const copySignal = async (kind: "offer" | "answer") => {
    const content = kind === "offer" ? offerOutput : answerOutput;
    if (!content) return;
    const label = kind === "offer" ? "Offer" : "Answer";
    const field = document.getElementById(`${kind}-output`) as HTMLTextAreaElement | null;
    setErrorMessage("");
    setNotice("");
    try {
      const result = await copyTextWithFallback(content, field);
      if (result === "manual") {
        setCopied(null);
        setNotice(`剪貼簿權限受瀏覽器或頁面政策限制；${label} 仍保留在下方文字區，並已嘗試選取。若未反白，請點入欄位按 Ctrl+A／⌘A 全選後複製，再私下傳給對方。`);
        return;
      }
      setCopied(kind);
      setNotice(`${label} 已複製。請只傳給預期配對的對方。`);
      window.setTimeout(() => setCopied((current) => current === kind ? null : current), 1800);
    } catch {
      // A copy failure must never clear the signal or block the pairing flow.
      try {
        field?.focus();
        field?.select();
      } catch {
        // The visible read-only field is still available for manual selection.
      }
      setCopied(null);
      setNotice(`無法自動複製；${label} 仍保留在下方文字區。請手動選取並複製，再私下傳給對方。`);
    }
  };

  const interruptConnection = () => {
    disconnect();
    clearSignalingDrafts();
    setErrorMessage("");
    setNotice("已中斷並清除本次連線資訊；現在可以重新配對。");
    setCopied(null);
  };

  const pairingInProgress = snapshot.phase !== "idle";
  const statusNote = snapshot.detail || (snapshot.phase === "idle"
    ? "尚未建立 PeerConnection。完成人工 Offer／Answer 交換後，才會開始檢查點對點連線。"
    : "");
  const iceGatheringTimeoutSeconds = Math.round(ICE_GATHERING_TIMEOUT_MS / 1000);
  const connectionTimeoutSeconds = Math.round(CONNECTION_TIMEOUT_MS / 1000);
  const waitingForIceGathering = snapshot.phase === "creating-offer" || snapshot.phase === "creating-answer";
  const waitingForConnection = snapshot.phase === "waiting-peer" || snapshot.phase === "applying-answer" || snapshot.phase === "connecting";
  const canConfirmAnswerSent = isJoiner && Boolean(answerOutput)
    && (snapshot.phase === "waiting-peer" || snapshot.phase === "connecting")
    && !snapshot.connectionTimeoutActive;

  return (
    <main className="min-h-dvh bg-slate-100 px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-950">
              <ArrowLeft className="h-4 w-4" />回到 SciNotes
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <Link2 className="h-6 w-6 text-blue-700" />點對點連線
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              使用瀏覽器原生 WebRTC 建立 PeerConnection 與 DataChannel；Offer／Answer 由你手動複製貼上，不經本網站伺服器。
            </p>
          </div>
          <button
            type="button"
            onClick={interruptConnection}
            disabled={!pairingInProgress && !busy}
            className="touch-target inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Unplug className="h-4 w-4" />中斷連線
          </button>
        </header>

        <section className={`mb-4 rounded-xl border p-4 shadow-sm ${statusColor}`} role="status" aria-live="polite" aria-atomic="true">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {snapshot.phase === "open" ? <Check className="h-5 w-5" /> : busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
              <strong>{phaseText}</strong>
              {snapshot.role && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium">{snapshot.role === "initiator" ? "發起端 A" : "加入端 B"}</span>}
            </div>
            <span className="text-xs">未開啟 DataChannel 前不會顯示成功</span>
          </div>
          <p className="mt-2 text-sm">{statusNote}</p>
          {snapshot.phase === "open" && (
            <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
              對方：<strong>{remoteParticipant?.name ?? "等待名稱資料"}</strong>
              {remoteParticipant && <> · 權限：{remoteParticipant.role === "reader" ? "唯讀" : remoteParticipant.role === "pending" ? "等待指定" : "可編輯"}</>}
              {localRole && <> · 你的權限：{localRole === "owner" ? "房主" : localRole === "reader" ? "唯讀" : localRole === "pending" ? "等待指定" : "可編輯"}</>}
            </p>
          )}
          {snapshot.phase === "open" && (
            <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${contentSyncStatus === "error" ? "bg-rose-100 text-rose-900" : "bg-white/70"}`}>
              書本／筆記卡同步：<strong>{contentSyncStatus === "synced" ? "已完成" : contentSyncStatus === "error" ? "失敗；資料仍保存在本機" : "同步中"}</strong>
              {contentSyncStatus === "synced" && " · 新增、編輯、移動、排序與刪除會直接透過 P2P 同步。"}
            </p>
          )}
          {waitingForIceGathering && (
            <p className="mt-1 text-xs text-slate-600">完整訊號需等候 ICE 候選收集完成；超過 {iceGatheringTimeoutSeconds} 秒會逾時，可檢查網路或 STUN 設定後重試。</p>
          )}
          {waitingForConnection && (
            <p className="mt-1 text-xs text-slate-600">
              {snapshot.connectionTimeoutActive
                ? `連線等待計時已啟動，最長 ${connectionTimeoutSeconds} 秒；逾時時請先比對診斷狀態。`
                : isJoiner
                  ? `B 端先把 Answer 傳回 A，再按下方確認按鈕；這時才開始 ${connectionTimeoutSeconds} 秒等待計時。`
                  : `A 端成功套用 Answer 後才開始 ${connectionTimeoutSeconds} 秒等待計時。`}
            </p>
          )}
        </section>

        <section className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.75fr)] sm:items-end">
          <div>
            <label htmlFor="display-name" className="mb-1 block text-sm font-semibold">你的書房顯示名稱</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={24}
              autoComplete="nickname"
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="例如：小安"
            />
            <p className="mt-1 text-xs text-slate-500">名稱由使用者自行填寫，不是已驗證身分。</p>
          </div>
          <div>
            <label htmlFor="guest-role" className="mb-1 block text-sm font-semibold">房主邀請權限</label>
            <select
              id="guest-role"
              value={guestRole}
              onChange={(event) => setGuestRole(event.target.value === "reader" ? "reader" : "editor")}
              disabled={pairingInProgress}
              className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 disabled:bg-slate-100"
            >
              <option value="editor">可編輯者</option>
              <option value="reader">唯讀者</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">由發起端 A 決定加入端 B 的角色。</p>
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 sm:col-span-2">
            邀請是私下交換的 Offer／Answer bearer 憑證：持有並完成配對者可加入，轉傳後任何持有者都可能使用；目前沒有帳號、伺服器端撤銷或到期驗證。連線後，房主的書本／筆記卡會傳給加入者；可編輯者的本機書本／筆記卡也會按 ID 合併並傳給房主。只與可信任對象配對，勿放入不想分享的筆記。唯讀限制是客戶端約束，不能防止修改客戶端、複製內容或截圖。
          </p>
        </section>

        <section className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.6fr)] sm:items-end">
          <div>
            <label htmlFor="stun-server" className="mb-1 block text-sm font-semibold">STUN 伺服器（可修改）</label>
            <input
              id="stun-server"
              value={stunServer}
              onChange={(event) => setStunServer(event.target.value)}
              disabled={pairingInProgress}
              autoComplete="off"
              spellCheck={false}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              placeholder="stun:stun.cloudflare.com:3478"
            />
            <p className="mt-1 text-xs text-slate-500">此設定只用於下一次新配對；留白時不使用 STUN。可填 stun: 或 stuns:，不支援 TURN。</p>
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">
            <ShieldAlert className="mr-1 inline h-4 w-4 align-[-3px]" />安全提醒：Offer／Answer 含 ICE 候選位址等網路資訊，請只透過私下可信管道傳給對方，不要公開分享。瀏覽器也會直接向所選 STUN 服務送出查詢，該服務可能看到你的公網 IP；本頁不儲存或上傳 SDP／ICE。
          </p>
        </section>

        {errorMessage && <p className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{errorMessage}</p>}
        {notice && !errorMessage && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{notice}</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${isJoiner ? "border-slate-200 opacity-75" : "border-slate-200"}`} aria-labelledby="initiator-heading">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Role A · Initiator</p>
                <h2 id="initiator-heading" className="mt-1 text-lg font-bold">發起端 A</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">先建立 Offer，傳給 B；收到 Answer 後貼回此處完成協商。</p>
              </div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">A → Offer → B</span>
            </div>

            <button
              type="button"
              onClick={createInvite}
              disabled={!canStart || busy}
              className="touch-target mb-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Link2 className="h-4 w-4" />建立連線邀請
            </button>
            <label htmlFor="offer-output" className="mb-1 block text-xs font-semibold text-slate-700">建立後的 Offer（完整 JSON／SDP）</label>
            <textarea
              id="offer-output"
              value={offerOutput}
              readOnly
              rows={7}
              spellCheck={false}
              placeholder="按「建立連線邀請」後，完整 Offer 會顯示在這裡。"
              className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs leading-relaxed outline-none focus:border-blue-600"
            />
            <button
              type="button"
              onClick={() => void copySignal("offer")}
              disabled={!offerOutput}
              className="touch-target mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copied === "offer" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied === "offer" ? "Offer 已複製" : "複製 Offer"}
            </button>

            <div className="my-5 border-t border-slate-200" />
            <label htmlFor="answer-input" className="mb-1 block text-sm font-semibold">貼上 B 傳回的 Answer</label>
            <textarea
              id="answer-input"
              value={answerInput}
              onChange={(event) => setAnswerInput(event.target.value)}
              disabled={!isInitiator || snapshot.phase !== "waiting-answer"}
              rows={6}
              spellCheck={false}
              autoComplete="off"
              placeholder="先建立 Offer，再將 B 傳回的完整 Answer 貼在這裡。"
              className="w-full resize-y rounded-lg border border-slate-300 p-2 font-mono text-xs leading-relaxed outline-none focus:border-blue-600 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => void completePairing()}
              disabled={!isInitiator || snapshot.phase !== "waiting-answer" || !answerInput.trim() || busy}
              className="touch-target mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              完成連線
            </button>
          </section>

          <section className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${isInitiator ? "border-slate-200 opacity-75" : "border-slate-200"}`} aria-labelledby="joiner-heading">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Role B · Joiner</p>
                <h2 id="joiner-heading" className="mt-1 text-lg font-bold">加入端 B</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">貼上 A 的 Offer 產生 Answer，再傳回 A；等候 DataChannel 開啟。</p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">A → Offer → B</span>
            </div>

            <label htmlFor="offer-input" className="mb-1 block text-sm font-semibold">貼上 A 提供的 Offer</label>
            <textarea
              id="offer-input"
              value={offerInput}
              onChange={(event) => setOfferInput(event.target.value)}
              disabled={!canStart || busy}
              rows={7}
              spellCheck={false}
              autoComplete="off"
              placeholder="將 A 提供的完整 Offer JSON 貼在這裡。"
              className="w-full resize-y rounded-lg border border-slate-300 p-2 font-mono text-xs leading-relaxed outline-none focus:border-emerald-600 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={createReply}
              disabled={!canStart || busy || !offerInput.trim()}
              className="touch-target mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Link2 className="h-4 w-4" />產生連線回覆
            </button>

            <label htmlFor="answer-output" className="mb-1 mt-4 block text-xs font-semibold text-slate-700">產生後的 Answer（完整 JSON／SDP）</label>
            <textarea
              id="answer-output"
              value={answerOutput}
              readOnly
              rows={7}
              spellCheck={false}
              placeholder="按「產生連線回覆」後，完整 Answer 會顯示在這裡。"
              className="w-full resize-y rounded-lg border border-slate-300 bg-slate-50 p-2 font-mono text-xs leading-relaxed outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={() => void copySignal("answer")}
              disabled={!answerOutput}
              className="touch-target mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copied === "answer" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
              {copied === "answer" ? "Answer 已複製" : "複製 Answer"}
            </button>
            {isJoiner && answerOutput && (snapshot.phase === "waiting-peer" || snapshot.phase === "connecting") && (
              <button
                type="button"
                onClick={confirmAnswerSent}
                disabled={!canConfirmAnswerSent}
                className="touch-target mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {snapshot.connectionTimeoutActive ? "已開始等待 A 端" : "我已傳回 Answer，開始等待"}
              </button>
            )}
          </section>
        </div>

        <section className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] sm:p-5" aria-labelledby="details-heading">
          <div>
            <h2 id="details-heading" className="mb-1 text-sm font-bold">連線狀態與診斷</h2>
            <p className="mb-2 text-[11px] text-slate-500">中斷或失敗時保留清理前最後狀態；只顯示候選類型數量，不顯示候選位址。</p>
            <StateMetric label="PeerConnection" value={peerConnectionStateLabel(snapshot.peerConnectionState)} />
            <StateMetric label="ICE 連線" value={iceConnectionStateLabel(snapshot.iceConnectionState)} />
            <StateMetric label="ICE 候選收集" value={iceGatheringStateLabel(snapshot.iceGatheringState)} />
            <StateMetric label="Signaling" value={signalingStateLabel(snapshot.signalingState)} />
            <StateMetric label="本機描述" value={snapshot.localDescriptionSet ? "已設定" : "尚未設定"} />
            <StateMetric label="遠端描述" value={snapshot.remoteDescriptionSet ? "已套用" : "尚未套用"} />
            <StateMetric label="遠端候選資訊" value={!snapshot.remoteDescriptionSet
              ? "尚未收到遠端描述"
              : snapshot.hasRemoteCandidateInformation
                ? "訊號含候選資訊（不代表可達）"
                : "遠端描述未含候選資訊"} />
            <StateMetric label="本機候選類型（getStats）" value={formatCandidateTypes(snapshot.localCandidateTypes)} />
            <StateMetric label="遠端候選類型（getStats）" value={formatCandidateTypes(snapshot.remoteCandidateTypes)} />
            <StateMetric label="選定候選配對" value={selectedCandidatePairLabel(snapshot.selectedCandidatePairState)} />
            <StateMetric label="DataChannel" value={dataChannelStateLabel(snapshot.dataChannelState)} />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <h3 className="mb-1 font-bold text-slate-800">重要限制</h3>
            <p>DataChannel 會交換自行填寫的顯示名稱、房主指定的角色、角色位置／動作，以及書本分類／位置／排序和筆記卡內容／畫布位置。初次連線會按記錄 ID 合併兩端資料；同一張卡同時編輯時採整筆記錄的確定性版本順序決定勝者，另一端同時寫入的欄位可能被覆蓋；尚未實作欄位／文字 CRDT、游標或輸入狀態。離線修改只留在本機，重新連線合併時另一端的舊副本可能讓離線刪除復現；請以手動匯出／匯入處理離線變更。WebRTC 使用 STUN 嘗試 NAT 穿透，但本方案沒有 TURN 中繼；公司防火牆、對稱 NAT 或受限行動網路可能阻擋直連，這時連線可能失敗。</p>
            <p className="mt-2">需要 HTTPS（GitHub Pages 預設提供）或 localhost。人工訊號交換沒有伺服器代替保管邀請；兩端需同時在線，並在逾時前完成 Offer／Answer 交換。</p>
            <p className="mt-2">排查順序：先讓兩台裝置在同一 Wi-Fi 測試，再改用不同網路（例如一端行動網路）。候選類型統計與 gathering complete 都不代表路徑可達；只有 DataChannel readyState 為 open 才算成功。</p>
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] text-slate-500">不建立自訂後端、不使用資料庫、不將 SDP 寫入 localStorage；跨頁切換會保留連線，直到你手動中斷或關閉分頁。</p>
      </div>
    </main>
  );
}
