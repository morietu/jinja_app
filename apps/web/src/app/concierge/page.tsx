"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";

type ChatEvent =
  | { kind: "user"; text: string; at: string; thread_id: number }
  | { kind: "assistant"; text: string; at: string; thread_id: number };

export default function ConciergePage() {
  const [thread, setThread] = useState<ConciergeThread | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  // ✅ messages state をやめて events にする
  const [events, setEvents] = useState<ChatEvent[]>([]);

  const [recommendations, setRecommendations] = useState<ConciergeRecommendation[]>([]);
  const [paywallNote, setPaywallNote] = useState<string | null>(null);
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  // thread_id を同期参照（assistant message 用）
  const threadIdRef = useRef<number>(0);

  // Unified の最後の値
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse | null>(null);

  // ✅ UIに渡す messages は events から派生生成
  const messages: ConciergeMessage[] = useMemo(() => {
    return events.map((e, idx) => ({
      id: idx + 1, // UI用の連番でOK
      thread_id: e.thread_id,
      role: e.kind,
      content: e.text,
      created_at: e.at,
    }));
  }, [events]);

  const { send, sending, error } = useConciergeChat(threadId, {
    onUnified: (u) => {
      setLastUnified(u);

      // assistant reply を events に積む（messages直積みを廃止）
      const reply = typeof u.reply === "string" ? u.reply : null;
      if (!reply) return;

      const now = new Date().toISOString();
      setEvents((prev) => [
        ...prev,
        {
          kind: "assistant",
          text: reply,
          at: now,
          thread_id: threadIdRef.current,
        },
      ]);
    },

    // 既存はまだ残す（段階的に削除する）
    onUpdated: ({ thread, recommendations }) => {
      setThread(thread);
      setThreadId(String(thread.id));
      threadIdRef.current = thread.id;
      if (Array.isArray(recommendations)) setRecommendations(recommendations);
    },

    onPaywall: ({ remaining_free, note }) => {
      setRemainingFree(typeof remaining_free === "number" ? remaining_free : null);
      setPaywallNote(note ?? null);
    },
  });

  const sp = useSearchParams();
  const force = sp.get("force"); // "design" | "paywall" | null

  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  // stopReason は Unified を単一の真実（dev force があるときだけ上書き）
  const stopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (lastUnified?.stop_reason ?? null);

  const canSend = stopReason === null;

  // 表示用（force=paywall のときだけ 0 扱い）
  const remainingFreeView = process.env.NODE_ENV !== "production" && forced === "paywall" ? 0 : remainingFree;

  const noteFromUnified = lastUnified?.note ?? null;

  const paywallNoteView =
    process.env.NODE_ENV !== "production" && forced === "paywall"
      ? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"
      : (noteFromUnified ?? paywallNote);

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
    setEvents((prev) => [
      ...prev,
      {
        kind: "user",
        text: trimmed,
        at: now,
        // thread がまだ無い最初の一発でも threadIdRef を使える（0の可能性はあるがUI用途ならOK）
        thread_id: thread?.id ?? threadIdRef.current ?? 0,
      },
    ]);

    await send(trimmed);
  };

  const handleRetry = () => {
    const lastUser = [...events].reverse().find((e) => e.kind === "user");
    if (!lastUser) return;
    void handleSend(lastUser.text);
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
        paywallNote={paywallNoteView}
        remainingFree={remainingFreeView}
        stopReason={stopReason}
        canSend={canSend}
      />
    </div>
  );
}
