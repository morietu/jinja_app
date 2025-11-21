"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";

type Props = {
  thread: ConciergeThread | null;
  messages: ConciergeMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onSend: (text: string) => void | Promise<void>;
};

export default function ChatPanel({ thread: _thread, messages, loading = false, sending = false, error, onRetry, onSend }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // メッセージ追加時のスクロール制御
  useEffect(() => {
    const el = listRef.current;
    if (!el || !autoScroll) return;

    el.scrollTop = el.scrollHeight;
  }, [messages, autoScroll]);

  // 「ほぼ最下部かどうか」で autoScroll を制御
  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const threshold = 80; // px
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(atBottom);
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending || loading) return;
    await onSend(trimmed);
    setInput("");
    setAutoScroll(true);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
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
                  className={`rounded-2xl px-3 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-900 rounded-bl-sm"
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

      {/* ▼ エラーがあるときだけ表示するバナー */}
        {error && (
          <div className="mt-2 flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
            <span className="mr-3 line-clamp-2">
              {error}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-full border border-red-400 bg-white px-3 py-1 text-xs font-medium text-red-700"
              >
                もう一度試す
              </button>
            )}
          </div>
        )}


      {/* 入力エリア */}
      <div className="border-t px-3 py-2">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
        >
          <textarea
            className="min-h-[80px] max-h-40 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
            placeholder="例）今年の仕事運と相性の良い神社を教えてください"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending || loading}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-400">Enterで送信／Shift+Enterで改行</p>
            <button
              type="submit"
              disabled={sending || loading || !input.trim()}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow disabled:opacity-60"
            >
              {sending || loading ? "送信中…" : "送信"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
