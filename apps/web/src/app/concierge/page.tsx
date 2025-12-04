// apps/web/src/app/concierge/page.tsx
"use client";

import { useState } from "react";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type {
  ConciergeMessage,
  ConciergeThread,
  ConciergeRecommendation, // ★ 追加
} from "@/lib/api/concierge";

export default function ConciergePage() {
  const [thread, setThread] = useState<ConciergeThread | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]); // ★ 追加

  const { send, sending, error } = useConciergeChat(thread ? String(thread.id) : null, {
    // 将来 thread / messages / recommendations が backend から飛んでくる用
    onUpdated(payload) {
      setThread(payload.thread);
      setMessages(payload.messages);
      if (payload.recommendations) {
        setRecommendations(payload.recommendations);
      }
    },

    // 今の echo / fallback 用
    onReply(replyText) {
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

    // ★ ここが今回のメイン
    onRecommendations(recs) {
      setRecommendations(recs);
    },
  });

  const handleSend = async (text: string) => {
    const now = new Date().toISOString();

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
        recommendations={recommendations} // ★ ここを [] から変更
      />
    </div>
  );
}
