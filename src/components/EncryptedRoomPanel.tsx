"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import QRCode from "qrcode";
import { Check, Copy, LoaderCircle, QrCode, Radio, ShieldCheck, Unplug, X } from "lucide-react";
import { copyTextWithFallback } from "@/lib/clipboard";
import { getSecureRoomTransport, type RoomPeer, type RoomTransportProgress, type RoomTransportStatus } from "@/lib/secureRoomTransport";
import { normalizeRoomCode } from "@/lib/secureRoomTransport/crypto";

interface EncryptedRoomPanelProps {
  nickname: string;
  manualSessionActive?: boolean;
}

function statusLabel(status: RoomTransportStatus): string {
  switch (status.state) {
    case "deriving-key": return "正在準備加密房間";
    case "connecting": return "正在連接 WSS relay";
    case "connected": return "relay 連線成功";
    case "partial": return `relay 已連線（${status.connectedBrokerCount}/${status.brokerCount} 個 broker）`;
    case "offline": return status.roomReady ? "relay 已中斷" : "relay 目前離線";
    case "leaving": return "正在離開房間";
    case "failed": return "relay 連線失敗";
    default: return "尚未加入房間";
  }
}

function normalizeScannedCode(value: string): string {
  const raw = value.trim();
  try {
    const url = new URL(raw);
    if (url.hash.length > 1) return normalizeRoomCode(decodeURIComponent(url.hash.slice(1)));
    throw new Error("QR 連結沒有配對碼片段。");
  } catch (error) {
    if (error instanceof TypeError) return normalizeRoomCode(raw);
    throw error;
  }
}

function formatCode(code: string): string {
  return code.match(/.{1,4}/g)?.join(" ") ?? code;
}

function BrokerIndicator({ state }: { state: "connecting" | "connected" | "offline" }) {
  const label = state === "connected" ? "已連線" : state === "connecting" ? "連線中" : "離線";
  const color = state === "connected" ? "bg-emerald-500" : state === "connecting" ? "bg-amber-500" : "bg-slate-300";
  return <span className="inline-flex items-center gap-1.5 text-xs text-slate-600"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>;
}

export default function EncryptedRoomPanel({ nickname, manualSessionActive = false }: EncryptedRoomPanelProps) {
  const transport = useMemo(() => getSecureRoomTransport(), []);
  const [status, setStatus] = useState<RoomTransportStatus>(() => transport.getStatus());
  const [peers, setPeers] = useState<RoomPeer[]>(() => transport.getPeers());
  const [progress, setProgress] = useState<RoomTransportProgress | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [lifetimeHours, setLifetimeHours] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [createdLink, setCreatedLink] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const joinCodeRef = useRef(joinCode);
  const nicknameRef = useRef(nickname);
  const scannerVideoRef = useRef<HTMLVideoElement | null>(null);
  const linkInputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoJoinStartedRef = useRef(false);

  useEffect(() => { joinCodeRef.current = joinCode; }, [joinCode]);
  useEffect(() => { nicknameRef.current = nickname; }, [nickname]);

  useEffect(() => {
    const offStatus = transport.on("status", setStatus);
    const offPeers = transport.on("peers", setPeers);
    const offProgress = transport.on("progress", setProgress);
    const offMessage = transport.on("message", (event) => {
      const printable = typeof event.payload === "string"
        ? event.payload
        : JSON.stringify(event.payload);
      setReceivedMessages((previous) => [`${event.metadata.from.slice(0, 12)}: ${printable ?? "(non-JSON payload)"}`, ...previous].slice(0, 5));
    });
    const offError = transport.on("error", (event) => setErrorMessage(event.message));
    return () => {
      offStatus();
      offPeers();
      offProgress();
      offMessage();
      offError();
    };
  }, [transport]);

  const joinRoom = useCallback(async (rawCode: string, fromLink = false) => {
    if (manualSessionActive) {
      setErrorMessage("請先中斷手動 WebRTC 配對，再加入加密 relay 房間。");
      return;
    }
    setErrorMessage("");
    setNotice("");
    setIsBusy(true);
    try {
      const code = normalizeRoomCode(rawCode);
      setJoinCode(formatCode(code));
      await transport.join(code, nicknameRef.current);
      setCreatedCode("");
      setCreatedLink("");
      setQrDataUrl("");
      setNotice("已加入加密房間；訊息使用 AES-GCM 加密後，透過可用的 WSS 中繼傳送。");
      if (fromLink && typeof window !== "undefined") {
        window.history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "無法加入房間，請確認配對碼與網路。");
    } finally {
      setIsBusy(false);
    }
  }, [transport, manualSessionActive]);

  useEffect(() => {
    if (manualSessionActive || autoJoinStartedRef.current || typeof window === "undefined" || window.location.hash.length < 2) return;
    autoJoinStartedRef.current = true;
    let code: string;
    try {
      code = normalizeRoomCode(decodeURIComponent(window.location.hash.slice(1)));
    } catch {
      window.setTimeout(() => setErrorMessage("連結片段不是有效的 16 字元配對碼。"), 0);
      return;
    }
    window.setTimeout(() => { void joinRoom(code, true); }, 0);
  }, [joinRoom, manualSessionActive]);

  const createRoom = async () => {
    if (manualSessionActive) {
      setErrorMessage("請先中斷手動 WebRTC 配對，再建立加密 relay 房間。");
      return;
    }
    setErrorMessage("");
    setNotice("");
    setIsBusy(true);
    try {
      const hours = lifetimeHours.trim() ? Number(lifetimeHours) : undefined;
      if (hours !== undefined && (!Number.isFinite(hours) || hours <= 0)) {
        throw new Error("房間存活時間必須是大於 0 的數值，或留空表示不設定期限。");
      }
      const result = await transport.create(nicknameRef.current, {
        ...(hours === undefined ? {} : { expiresInMs: Math.round(hours * 60 * 60 * 1000) }),
      });
      if (typeof window !== "undefined") window.history.replaceState(null, "", result.link);
      setCreatedCode(result.code);
      setCreatedLink(result.link);
      setJoinCode("");
      const image = await QRCode.toDataURL(result.link, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(image);
      setNotice("房間已建立。配對碼只放在網址片段（#）與 QR 連結中，不放入 query 或 MQTT topic。");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "無法建立房間，請稍後重試。");
    } finally {
      setIsBusy(false);
    }
  };

  const copyLink = async () => {
    if (!createdLink) return;
    try {
      const result = await copyTextWithFallback(createdLink, linkInputRef.current);
      setNotice(result === "manual" ? "請從已選取的欄位手動複製房間連結。" : "房間連結已複製；請只分享給預期加入者。");
    } catch {
      setNotice("無法自動複製；連結仍顯示在欄位中，請手動複製。");
    }
  };

  const leaveRoom = async () => {
    setIsBusy(true);
    setErrorMessage("");
    try {
      await transport.leave();
      if (typeof window !== "undefined" && createdCode && window.location.hash.slice(1) === createdCode) {
        window.history.replaceState(null, "", `${window.location.origin}${window.location.pathname}`);
      }
      setCreatedCode("");
      setCreatedLink("");
      setQrDataUrl("");
      setJoinCode("");
      setReceivedMessages([]);
      setNotice("已離開加密房間並清除本頁記憶體中的金鑰。");
    } finally {
      setIsBusy(false);
    }
  };

  const sendTestMessage = async () => {
    if (!testMessage.trim()) return;
    setErrorMessage("");
    try {
      const receipt = await transport.send(testMessage, { route: "relay" });
      setNotice(`relay 已送出；broker PUBACK ${receipt.acknowledgedByBrokers.length}/${receipt.publishedTo.length}。這不是接收端應用層 ACK。`);
      setTestMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "訊息未送出。");
    }
  };

  const handleScan = (value: string) => {
    setScannerOpen(false);
    setScannerError("");
    try {
      const code = normalizeScannedCode(value);
      setJoinCode(formatCode(code));
      void joinRoom(code);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "掃描內容不是有效的配對碼或房間連結。");
    }
  };

  const connectedBrokers = status.brokers.filter((broker) => broker.state === "connected").length;
  const roomActive = status.roomReady;

  return (
    <section className="mb-5 rounded-2xl border border-indigo-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="encrypted-room-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">WSS · 多 broker 加密中繼</p>
          <h2 id="encrypted-room-heading" className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShieldCheck className="h-5 w-5 text-indigo-700" />加密房間
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
            配對碼導出房間金鑰；書樓協作訊息以 AES-GCM 加密後，透過可用的 WSS broker 傳送。這代表 relay 協作，不代表 WebRTC direct 已連線；手動 WebRTC 診斷會顯示在下方獨立面板。
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700" role="status" aria-live="polite">
          <Radio className="h-4 w-4 text-indigo-700" />{statusLabel(status)}
        </div>
      </div>

      {manualSessionActive && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          手動 WebRTC 診斷連線正在使用本分頁的協作通道。請先在下方中斷它，再建立或加入加密 relay 房間。
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold">建立房間</h3>
          <p className="mt-1 text-xs text-slate-500">建立 16 字元安全配對碼，可將網址片段或 QR 分享給加入者。</p>
          <label htmlFor="room-lifetime-hours" className="mt-3 block text-xs font-semibold text-slate-700">房間存活時間（小時）</label>
          <input
            id="room-lifetime-hours"
            type="number"
            min="0.01"
            step="0.01"
            value={lifetimeHours}
            onChange={(event) => setLifetimeHours(event.target.value)}
            disabled={isBusy || roomActive || manualSessionActive}
            placeholder="留空表示不設定期限"
            className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          />
          <button
            type="button"
            onClick={() => void createRoom()}
            disabled={isBusy || roomActive || manualSessionActive}
            className="touch-target mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            建立加密房間
          </button>
          {createdCode && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-xs font-semibold text-slate-600">配對碼</p>
                <p className="mt-1 select-all font-mono text-lg font-bold tracking-[0.16em] text-slate-950" aria-label="配對碼">{formatCode(createdCode)}</p>
                <label htmlFor="room-share-link" className="mt-2 block text-xs font-semibold text-slate-600">分享連結（配對碼只在 # 片段）</label>
                <div className="mt-1 flex gap-2">
                  <textarea
                    ref={linkInputRef}
                    id="room-share-link"
                    value={createdLink}
                    readOnly
                    rows={2}
                    spellCheck={false}
                    className="min-h-10 min-w-0 flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 font-mono text-[11px] text-slate-700"
                  />
                  <button type="button" onClick={() => void copyLink()} className="touch-target inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50">
                    <Copy className="h-4 w-4" />複製
                  </button>
                </div>
              </div>
              {qrDataUrl && <Image src={qrDataUrl} alt="加密房間加入 QR Code" width={144} height={144} unoptimized className="mx-auto h-36 w-36 rounded-lg border border-slate-200 p-1" />}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold">加入房間</h3>
          <p className="mt-1 text-xs text-slate-500">輸入 16 字元配對碼、開啟 # 連結，或掃描建立者的 QR Code。</p>
          <label htmlFor="room-join-code" className="mt-3 block text-xs font-semibold text-slate-700">配對碼</label>
          <input
            id="room-join-code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            disabled={isBusy || roomActive || manualSessionActive}
            autoComplete="off"
            spellCheck={false}
            maxLength={19}
            placeholder="例如：ABCD EFGH JKLM NPQR"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono text-sm tracking-wider outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void joinRoom(joinCodeRef.current)}
              disabled={isBusy || roomActive || manualSessionActive || !joinCode.trim()}
              className="touch-target inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}加入房間
            </button>
            <button
              type="button"
              onClick={() => { setScannerError(""); setScannerOpen(true); }}
              disabled={isBusy || roomActive || manualSessionActive}
              className="touch-target inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <QrCode className="h-4 w-4" />掃描 QR
            </button>
          </div>
        </div>
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true" aria-labelledby="qr-scanner-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 id="qr-scanner-title" className="font-bold">掃描加密房間 QR Code</h3>
              <button type="button" onClick={() => setScannerOpen(false)} className="touch-target inline-flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100" aria-label="關閉掃描器"><X className="h-5 w-5" /></button>
            </div>
            <p className="mt-1 text-xs text-slate-500">相機影像只在本機用來解碼；請允許此 HTTPS 網頁使用相機。</p>
            <video ref={scannerVideoRef} className="mt-3 aspect-video w-full rounded-xl bg-slate-950 object-cover" muted playsInline />
            {scannerError && <p className="mt-2 text-sm text-rose-700" role="alert">{scannerError}</p>}
            <QrScanner videoRef={scannerVideoRef} open={scannerOpen} onCode={handleScan} onError={setScannerError} />
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-800">中繼狀態 · {connectedBrokers}/{status.brokerCount} 已連線</h3>
            {roomActive && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" />AES-GCM 已啟用</span>}
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
            {status.brokers.map((broker) => (
              <div key={broker.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-2">
                <span className="text-xs font-semibold text-slate-700">{broker.label}</span><BrokerIndicator state={broker.state} />
              </div>
            ))}
            {!status.brokers.length && <p className="text-xs text-slate-500">尚未建立 MQTT 連線。</p>}
          </div>
          {progress && <p className="mt-2 text-[11px] text-slate-600" aria-live="polite">{progress.message} ({progress.completed}/{progress.total})</p>}
          {status.roomReady && status.expiresAt !== null && <p className="mt-1 text-[11px] text-slate-600">本機金鑰預計到期：{new Date(status.expiresAt).toLocaleString()}</p>}
          {roomActive && (
            <button type="button" onClick={() => void leaveRoom()} disabled={isBusy} className="touch-target mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50">
              {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}離開加密房間
            </button>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <h3 className="text-xs font-bold text-slate-800">房間裝置 · {peers.length}</h3>
          {roomActive && (
            <p
              className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${connectedBrokers > 0 ? "text-emerald-700" : "text-amber-700"}`}
              role="status"
              aria-live="polite"
            >
              {connectedBrokers > 0 ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Radio className="h-3.5 w-3.5 shrink-0" />}
              {connectedBrokers > 0
                ? peers.length > 0
                  ? `relay 連線成功，已透過 relay 發現 ${peers.length} 個其他裝置。`
                  : "relay 連線成功，等待其他裝置加入。"
                : "房間仍已加入，但所有 relay broker 目前離線。"}
            </p>
          )}
          {peers.length ? (
            <ul className="mt-2 space-y-1.5">
              {peers.map((peer) => (
                <li key={peer.deviceId} className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-2">
                  <span className="truncate text-xs font-semibold text-slate-800">{peer.nickname}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-500">{peer.deviceId.slice(0, 12)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-xs text-slate-500">{roomActive ? "目前沒有其他裝置在線。" : "加入同一房間的其他裝置會出現在這裡。"}</p>}
          {roomActive && (
            <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void sendTestMessage(); }}>
              <input
                value={testMessage}
                onChange={(event) => setTestMessage(event.target.value)}
                aria-label="測試傳輸文字"
                placeholder="傳送 relay 測試文字"
                className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none focus:border-indigo-600"
              />
              <button type="submit" disabled={!testMessage.trim() || !connectedBrokers} className="touch-target min-h-9 rounded-lg bg-indigo-700 px-3 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50">送出</button>
            </form>
          )}
          {receivedMessages.length > 0 && <ul className="mt-2 space-y-1">{receivedMessages.map((message, index) => <li key={`${index}-${message}`} className="break-all rounded bg-white px-2 py-1 text-[10px] text-slate-600">{message}</li>)}</ul>}
        </div>
      </div>

      {errorMessage && <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900" role="alert">{errorMessage}</p>}
      {notice && !errorMessage && <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">{notice}</p>}
      {status.encrypted && <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-500"><Check className="h-3.5 w-3.5 text-emerald-700" />房間內容使用 AES-GCM 加密；broker 仍可見連線來源、主題雜湊、時間與封包大小。</p>}
    </section>
  );
}

function QrScanner({
  videoRef,
  open,
  onCode,
  onError,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  open: boolean;
  onCode: (code: string) => void;
  onError: (message: string) => void;
}) {
  const callbacksRef = useRef({ onCode, onError });
  useEffect(() => { callbacksRef.current = { onCode, onError }; }, [onCode, onError]);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    const reader = new BrowserQRCodeReader();
    let cancelled = false;
    let controls: { stop: () => void } | null = null;
    void reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error, scannerControls) => {
      controls = scannerControls;
      if (cancelled) {
        scannerControls.stop();
        return;
      }
      if (result) {
        scannerControls.stop();
        cancelled = true;
        callbacksRef.current.onCode(result.getText());
      } else if (error && error.name !== "NotFoundException") {
        callbacksRef.current.onError("相機無法解碼 QR；請確認相機權限，或改為輸入配對碼／開啟房間連結。");
      }
    }).then((scannerControls) => {
      controls = scannerControls;
      if (cancelled) scannerControls.stop();
    }).catch(() => {
      callbacksRef.current.onError("無法開啟相機；請確認 HTTPS 網址與相機權限，或改為手動輸入配對碼。");
    });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [open, videoRef]);
  return null;
}
