// apps/web/src/features/concierge/components/ChatPanel.tsx
"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import type { ConciergeMessage } from "@/lib/api/concierge";
import ChatInput from "./ChatInput";

type Props = {
  messages: ConciergeMessage[];
  loading?: boolean;
  sending?: boolean;
  error?: string | null;
  onSend: (text: string) => void | Promise<void>;
  canSend: boolean;
  onNewThread?: () => void;
  embedMode?: boolean;
  lastQuery?: string;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

export default function ChatPanel({
  messages,
  loading = false,
  sending = false,
  error = null,
  onSend,
  canSend = true,
  embedMode = false,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const threshold = 80;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (distanceFromBottom < threshold) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, loading, sending]);

  const handleSend = async (text: string) => {
    await onSend(text);
  };

  const truncateAIMessage = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + "...";
  };

  const outerClass = embedMode
    ? "w-full min-w-0 min-h-[400px] flex flex-col"
    : "w-full min-w-0 flex-1 min-h-0 flex flex-col";

  const frameClass = "relative mx-auto flex w-full max-w-md min-w-0 flex-1 min-h-0 flex-col bg-white overflow-hidden";

  const inputWrapClass =
    "shrink-0 border-t border-neutral-200 bg-white px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)]";

  return (
    <div className={outerClass}>
      <div className={frameClass}>
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2">
          <div className="space-y-1.5">
            {messages.length === 0 && !loading && !sending && (
              <div className="mt-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                条件や希望があれば追加してください（例：静か／駅近／ひとりで／階段少なめ など）
              </div>
            )}

            {messages.map((m) => {
              const dt = new Date(m.created_at);
              const timeLabel = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
              const displayContent = m.role === "assistant" ? truncateAIMessage(m.content) : m.content;

              return (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%]">
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-2.5 py-1.5 text-sm leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-emerald-600 text-white"
                          : "rounded-bl-sm bg-gray-100 text-gray-900"
                      }`}
                    >
                      {displayContent}
                    </div>

                    {m.role === "assistant" && m.content.length > 60 && (
                      <p className="mt-0.5 text-[10px] text-gray-400 text-left">詳細はカードをご確認ください</p>
                    )}

                    <p className={`mt-0.5 text-[10px] text-gray-400 ${m.role === "user" ? "text-right" : "text-left"}`}>
                      {timeLabel}
                    </p>
                  </div>
                </div>
              );
            })}

            {(loading || sending) && (
              <div className="mt-1.5 flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-2.5 py-1.5 text-xs text-gray-600">考え中…</div>
              </div>
            )}
          </div>

          <div className="h-2" />
        </div>

        <div className={inputWrapClass}>
          <div className="rounded-xl border border-neutral-300 transition focus-within:border-neutral-500 focus-within:ring-1 focus-within:ring-neutral-300">
            <ChatInput
              disabled={sending || loading || !canSend}
              onSend={handleSend}
              error={error}
              embedMode={embedMode}
            />
          </div>

          {!canSend && (
            <p className="mt-2 text-xs text-slate-600">
              無料枠を使い切りました。続けて利用するにはプレミアムをご確認ください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
