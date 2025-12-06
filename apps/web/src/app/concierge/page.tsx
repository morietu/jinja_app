// apps/web/src/app/concierge/page.tsx
"use client";

import { useState } from "react";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";

export default function ConciergePage() {
  const [thread, setThread] = useState<ConciergeThread | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]);

  const { send, sending, error } = useConciergeChat(threadId, {
    // ★ バックエンドから thread が返ってきたらここで紐付け
    onUpdated: ({ thread }) => {
      setThread(thread);
      setThreadId(String(thread.id));
    },

    // echo 返信を疑似メッセージに変換
    onReply: (replyText) => {
      const now = new Date().toISOString();

      setMessages((prev) => {
        const lastId = prev.length ? prev[prev.length - 1].id : 0;

        const assistantMsg: ConciergeMessage = {
          id: lastId + 1,
          thread_id: thread?.id ?? 0,
          role: "assistant",
          content: replyText,
          created_at: now,
        };

        return [...prev, assistantMsg];
      });
    },

    // 推薦候補を右側パネルに渡す用
    onRecommendations: (recs) => {
      setRecommendations(recs);
    },
  });

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const now = new Date().toISOString();

    // まずユーザーメッセージをローカルに追加
    setMessages((prev) => {
      const lastId = prev.length ? prev[prev.length - 1].id : 0;

      const userMsg: ConciergeMessage = {
        id: lastId + 1,
        thread_id: thread?.id ?? 0,
        role: "user",
        content: text,
        created_at: now,
      };

      return [...prev, userMsg];
    });

    // API 送信
    await send(text);
  };

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    void handleSend(lastUser.content);
  };

  return (
    <div className="px-4 py-4">
      <h1 className="mb-2 text-base font-semibold text-gray-800">AI神社コンシェルジュ</h1>
      <p className="mb-3 text-xs text-gray-500">今年の運勢や叶えたい願いごとを、自由に送ってみてください。</p>

      <ConciergeLayout
        thread={thread}
        messages={messages}
        sending={sending}
        error={error}
        onSend={handleSend}
        onRetry={handleRetry}
        recommendations={recommendations}
      />
    </div>
  );
}
