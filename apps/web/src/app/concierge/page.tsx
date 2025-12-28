"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";

type ChatEvent =
  | {
      type: "user_message";
      text: string;
      at: string;
      thread_id: number; // UI用
    }
  | {
      type: "assistant_reply";
      text: string; // replyをここで確定
      at: string;
      thread_id: number; // UI用
    };

// ✅ 完全純関数（外部 state / Date.now 参照なし）
function deriveMessages(events: ChatEvent[]): ConciergeMessage[] {
  return events.map((e, idx) => ({
    id: idx + 1,
    thread_id: e.thread_id,
    role: e.type === "user_message" ? "user" : "assistant",
    content: e.text,
    created_at: e.at,
  }));
}

export default function ConciergePage() {
  const [thread, setThread] = useState<ConciergeThread | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  // ✅ messages stateを廃止して events に寄せる
  const [events, setEvents] = useState<ChatEvent[]>([]);

  // ✅ Unified が UI の単一ソース
  const [lastUnified, setLastUnified] = useState<UnifiedConciergeResponse | null>(null);

  // thread_id を同期参照（thread確定前でもUIが壊れないように）
  const threadIdRef = useRef<number>(0);

  const messages = useMemo(() => deriveMessages(events), [events]);

  const { send, sending, error } = useConciergeChat(threadId, {
    onUnified: (u) => {
      setLastUnified(u);

      // thread を Unified から採用（あるときだけ）
      if (u.thread) {
        setThread(u.thread);
        setThreadId(String(u.thread.id));
        threadIdRef.current = u.thread.id;
      }

      // assistant reply event
      const reply = typeof u.reply === "string" ? u.reply.trim() : "";
      if (!reply) return;

      const now = new Date().toISOString();
      const tid = threadIdRef.current || u.thread?.id || 0;

      setEvents((prev) => [
        ...prev,
        {
          type: "assistant_reply",
          text: reply,
          at: now,
          thread_id: tid,
        },
      ]);
    },
  });

  const sp = useSearchParams();
  const force = sp.get("force"); // "design" | "paywall" | null
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  // stopReason は Unified を単一の真実（dev force のみ上書き）
  const stopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (lastUnified?.stop_reason ?? null);

  const canSend = stopReason === null;

  // ✅ recommendations も Unified を単一の真実にする
  const recommendations = lastUnified?.data?.recommendations ?? [];

  // remaining_free / note も Unified を優先（dev force=paywall は表示だけ強制）
  const remainingFreeRaw = lastUnified?.remaining_free ?? null;
  const remainingFreeView = process.env.NODE_ENV !== "production" && forced === "paywall" ? 0 : remainingFreeRaw;

  const noteFromUnified = lastUnified?.note ?? null;
  const paywallNoteView =
    process.env.NODE_ENV !== "production" && forced === "paywall"
      ? "無料で利用できる回数を使い切りました。プレミアムで制限解除できます。"
      : noteFromUnified;

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!canSend) return;

    const now = new Date().toISOString();
    const tid = thread?.id ?? threadIdRef.current ?? 0;

    // user event
    setEvents((prev) => [
      ...prev,
      {
        type: "user_message",
        text: trimmed,
        at: now,
        thread_id: tid,
      },
    ]);

    await send(trimmed);
  };

  const handleRetry = () => {
    const lastUser = [...events].reverse().find((e) => e.type === "user_message");
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
