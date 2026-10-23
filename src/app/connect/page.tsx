"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ClipboardCopy, Link2, LoaderCircle, ShieldAlert, Unplug } from "lucide-react";
import { copyTextWithFallback } from "@/lib/clipboard";
import {
  CONNECTION_TIMEOUT_MS,
  ICE_GATHERING_TIMEOUT_MS,
  ConnectionCancelledError,
  DEFAULT_STUN_SERVER,
  WebRTCConnectionManager,
  connectionPhaseLabel,
  dataChannelStateLabel,
  iceConnectionStateLabel,
  iceGatheringStateLabel,
  peerConnectionStateLabel,
  type ConnectionPhase,
  type ConnectionSnapshot,
} from "@/lib/connection";

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

function StateMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}

export default function ConnectionPage() {
  const [manager] = useState(() => new WebRTCConnectionManager());
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot>(() => manager.getState());
  const [stunServer, setStunServer] = useState(DEFAULT_STUN_SERVER);
  const [offerOutput, setOfferOutput] = useState("");
  const [offerInput, setOfferInput] = useState("");
  const [answerOutput, setAnswerOutput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState<"offer" | "answer" | null>(null);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      manager.disconnect();
    };
  }, [manager]);

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
    setOfferOutput("");
    setAnswerInput("");
    setAnswerOutput("");
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
    try {
      const answer = await manager.createAnswer(offerInput, stunServer);
      setAnswerOutput(answer);
      setNotice("Answer 已建立。請私下傳回發起端；等發起端套用 Answer 後，DataChannel 才可能開啟。");
    } catch (error) {
      if (isCancellation(error)) return;
      setErrorMessage(formatFailure(error, "無法建立 Answer。請確認 Offer 完整且貼在正確欄位。"));
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
    manager.disconnect();
    setOfferOutput("");
    setOfferInput("");
    setAnswerOutput("");
    setAnswerInput("");
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
          {waitingForIceGathering && (
            <p className="mt-1 text-xs text-slate-600">完整訊號需等候 ICE 候選收集完成；超過 {iceGatheringTimeoutSeconds} 秒會逾時，可檢查網路或 STUN 設定後重試。</p>
          )}
          {waitingForConnection && (
            <p className="mt-1 text-xs text-slate-600">若 {connectionTimeoutSeconds} 秒內 DataChannel 沒有開啟，介面會提示逾時；可中斷後重新配對。</p>
          )}
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
          </section>
        </div>

        <section className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] sm:p-5" aria-labelledby="details-heading">
          <div>
            <h2 id="details-heading" className="mb-2 text-sm font-bold">即時連線狀態</h2>
            <StateMetric label="PeerConnection" value={peerConnectionStateLabel(snapshot.peerConnectionState)} />
            <StateMetric label="ICE 連線" value={iceConnectionStateLabel(snapshot.iceConnectionState)} />
            <StateMetric label="ICE 候選收集" value={iceGatheringStateLabel(snapshot.iceGatheringState)} />
            <StateMetric label="DataChannel" value={dataChannelStateLabel(snapshot.dataChannelState)} />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <h3 className="mb-1 font-bold text-slate-800">重要限制</h3>
            <p>本工具只建立並監測資料通道，不傳送筆記、畫面、音訊或其他應用資料。WebRTC 使用 STUN 嘗試 NAT 穿透，但本方案沒有 TURN 中繼；公司防火牆、對稱 NAT 或受限行動網路可能阻擋直連，這時連線可能失敗。</p>
            <p className="mt-2">需要 HTTPS（GitHub Pages 預設提供）或 localhost。人工訊號交換沒有伺服器代替保管邀請；兩端需同時在線，並在逾時前完成 Offer／Answer 交換。</p>
          </div>
        </section>

        <p className="mt-4 text-center text-[11px] text-slate-500">不建立自訂後端、不使用資料庫、不寫入 localStorage；中斷或離開頁面會清除本次 SDP 與連線。</p>
      </div>
    </main>
  );
}
