"use client";

import { useState } from "react";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { ConciergeQuickActions } from "@/components/concierge/ConciergeQuickActions";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";

export default function ConciergePage() {
  const [thread] = useState<ConciergeThread | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);

  const { send, sending, error } = useConciergeChat(null, {
    onReply: (reply) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          thread_id: 1, // TODO: 本実装時に適切なIDに差し替え
          role: "assistant",
          content: reply,
          created_at: new Date().toISOString(),
        },
      ]);
    },
  });

  const makeMessage = (role: "user" | "assistant", content: string): ConciergeMessage => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    thread_id: thread?.id ?? 1,
    role,
    content,
    created_at: new Date().toISOString(),
  });

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages(prev => [...prev, makeMessage("user", trimmed)]);
    // ここでは try/catch しなくてOK（send は throw しない）
    await send(trimmed);
  };

  const handleRetry = () => {
    // 必要なら「最後のメッセージ再送」のロジックを追加
    // 今はひとまずエラーを消すだけなら、hook 側に clearError を足す or 再送時に上書きされるのを利用
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col p-4">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span>AI神社コンシェルジュ</span>
        </h1>
        <p className="text-xs text-gray-500">
          いまの気持ちを送ると、合いそうな神社と回り方を提案します。
        </p>
      </header>

      <div className="mt-4 flex-1">
        <ConciergeLayout
          thread={thread}
          messages={messages}
          sending={sending}
          error={error}
          onSend={handleSend}
          onRetry={handleRetry}
        />
      </div>

      <section className="mt-4">
        <ConciergeQuickActions variant="full" />
      </section>
    </main>
  );
}
