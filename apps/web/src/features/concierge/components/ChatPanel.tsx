// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import ChatInput from "./ChatInput";

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSend: (text: string) => void | Promise<void>;
  canSend: boolean;
  embedMode?: boolean;
};

function isAuthError(err: string | null) {
  if (!err) return false;
  return err.includes("401") || err.toLowerCase().includes("unauthorized");
}

export default function ChatPanel({
  thread: _thread,
  messages,
  loading = false,
  sending = false,
  error = null,
  onRetry,
  onSend,
  canSend = true,
  embedMode = false,
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [flashStatus, setFlashStatus] = useState<string | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  // 非embed用（embedでは使わないがHook順のため残してOK）
  useEffect(() => {
    if (embedMode) return;
    const el = listRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll, embedMode]);

  const handleSend = async (text: string) => {
    if (!canSend) return;
    const trimmed = text.trim();
    if (!trimmed || sending || loading) return;

    if (embedMode) {
      setFlashStatus("更新中…");
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    }

    await onSend(trimmed);
    setAutoScroll(true);
  };

  useEffect(() => {
    if (!embedMode) return;
    if (!sending && !loading && flashStatus === "更新中…") {
      setFlashStatus("更新しました");
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => {
        setFlashStatus(null);
        flashTimerRef.current = null;
      }, 1200);
    }
  }, [embedMode, sending, loading, flashStatus]);

  const authError = isAuthError(error);
  const goLogin = () => {
    const next = `${location.pathname}${location.search}`;
    location.href = `/login?next=${encodeURIComponent(next)}`;
  };

  // ✅ embedMode: 入力パネルだけ
  if (embedMode) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm">
        {error && (
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="mr-3 line-clamp-2">
              {authError ? "ログイン期限が切れました。もう一度ログインしてください。" : error}
            </span>
            {authError ? (
              <button
                type="button"
                onClick={goLogin}
                className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
              >
                ログイン
              </button>
            ) : onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
              >
                もう一度試す
              </button>
            ) : null}
          </div>
        )}

        <div className="px-3 py-2">
          {flashStatus && (
            <div className="mb-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">{flashStatus}</div>
          )}

          <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} embedMode />

          {!canSend && (
            <p className="mt-2 text-xs text-slate-600">
              無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
            </p>
          )}
        </div>
      </div>
    );
  }

  // ---- ここから下は非embedの従来表示（会話UI） ----
  // （省略：いまの messages.map 描画を残す）
  return (
    <div className="flex h-[calc(100vh-180px)] flex-col rounded-2xl border bg-white shadow-sm">
      {/* 既存の会話UI */}
      {/* ... */}
    </div>
  );
}
