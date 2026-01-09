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
}: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 80;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(atBottom);
  };

  const handleSend = async (text: string) => {
    if (!canSend) return;
    const trimmed = text.trim();
    if (!trimmed || sending || loading) return;

    onSend(trimmed);
    setAutoScroll(true);
  };

  const authError = isAuthError(error);

  const goLogin = () => {
    const next = `${location.pathname}${location.search}`;
    location.href = `/login?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col rounded-2xl border bg-white shadow-sm">
      {/* メッセージ一覧 */}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3" onScroll={handleScroll}>
        {messages.length === 0 && !loading && !sending && (
          <div className="mt-6 rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600">
            いまの状況や相談したいことを、自由に送ってください。
            <br />
            例：
            <br />
            ・「今年の恋愛運を上げたい」
            <br />
            ・「転職活動の区切りでお参りしたい」 など
          </div>
        )}

        {messages.map((m) => {
          const dt = new Date(m.created_at);
          const timeLabel = `${dt.getHours().toString().padStart(2, "0")}:${dt
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;

          return (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-emerald-600 text-white"
                      : "rounded-bl-sm bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.content}
                </div>
                <p className={`mt-0.5 text-[10px] text-gray-400 ${m.role === "user" ? "text-right" : "text-left"}`}>
                  {timeLabel}
                </p>
              </div>
            </div>
          );
        })}

        {(loading || sending) && (
          <div className="mt-2 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3 py-2 text-xs text-gray-600">考え中…</div>
          </div>
        )}
      </div>

      {/* エラーバナー（401はログイン導線） */}
      {error && (
        <div className="flex items-center justify-between border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
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

      {/* 入力エリア（ChatInput 1個だけ） */}
      <div className="border-t px-3 py-2">
        <ChatInput disabled={sending || loading || !canSend} onSend={handleSend} error={error} />

        {!canSend && (
          <p className="mt-2 text-xs text-slate-600">
            無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
          </p>
        )}
      </div>
    </div>
  );
}
