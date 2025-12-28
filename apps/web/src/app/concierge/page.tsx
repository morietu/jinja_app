"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";

export default function ConciergePage() {
  const [thread, setThread] = useState<ConciergeThread | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]);
  const [paywallNote, setPaywallNote] = useState<string | null>(null);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  // ★ 追加：Unified の最後の値
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse | null>(null);

  const { send, sending, error } = useConciergeChat(threadId, {
    onUnified: setLastUnified,

    // 既存はまだ残す（段階的に削除する）
    onUpdated: ({ thread, recommendations }) => {
      setThread(thread);
      setThreadId(String(thread.id));
      if (Array.isArray(recommendations)) setRecommendations(recommendations);
    },
    onPaywall: ({ remaining_free, note }) => {
      setRemainingFree(typeof remaining_free === "number" ? remaining_free : null);
      setPaywallNote(note ?? null);
    },
    onReply: (replyText) => {
      const now = new Date().toISOString();
      setMessages((prev) => {
        const lastId = prev.length ? prev[prev.length - 1].id : 0;
        return [
          ...prev,
          {
            id: lastId + 1,
            thread_id: thread?.id ?? 0,
            role: "assistant",
            content: replyText,
            created_at: now,
          },
        ];
      });
    },
  });

  const sp = useSearchParams();
  const force = sp.get("force"); // "design" | "paywall" | null

  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  // stopReason は Unified を単一の真実として扱う（remainingFree/paywallNote は表示用）
  const stopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (lastUnified?.stop_reason ?? null);

  const canSend = stopReason === null;

  // ★ 表示用（force=paywall のときだけ 0 扱い）
  const remainingFreeView = process.env.NODE_ENV !== "production" && forced === "paywall" ? 0 : remainingFree;

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!canSend) {
      if (stopReason === "design") {
        setPaywallNote("ここまでで候補を出しました。次は候補から神社を見てみましょう。続きは新しい相談でどうぞ。");
      }
      return;
    }

    const now = new Date().toISOString();
    setMessages((prev) => {
      const lastId = prev.length ? prev[prev.length - 1].id : 0;
      return [...prev, { id: lastId + 1, thread_id: thread?.id ?? 0, role: "user", content: trimmed, created_at: now }];
    });

    await send(trimmed);
  };

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    void handleSend(lastUser.content);
  };

  const paywallNoteView =
    process.env.NODE_ENV !== "production" && forced === "paywall"
      ? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"
      : paywallNote;

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
        paywallNote={paywallNoteView}
        remainingFree={remainingFreeView}
        stopReason={stopReason}
        canSend={canSend}
      />
    </div>
  );
}
