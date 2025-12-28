"use client";


import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";

type ChatEvent =
  | { type: "user_message"; text: string; at: string; thread_id: number }
  | { type: "assistant_reply"; text: string; at: string; thread_id: number }
  | { type: "assistant_state"; unified: UnifiedConciergeResponse; at: string; thread_id: number };

function patchThreadId(events: ChatEvent[], nextThreadId: number): ChatEvent[] {
  if (!nextThreadId) return events;
  return events.map((e) => (e.thread_id === 0 ? { ...e, thread_id: nextThreadId } : e));
}

  function deriveMessages(events: ChatEvent[]): ConciergeMessage[] {
  let mid = 0;

  return events.flatMap((e) => {
    if (e.type === "user_message") {
      mid += 1;
      return [
        {
          id: mid,
          thread_id: e.thread_id,
          role: "user" as ConciergeMessage["role"],
          content: e.text,
          created_at: e.at,
        },
      ];
    }

    if (e.type === "assistant_reply") {
      mid += 1;
      return [
        {
          id: mid,
          thread_id: e.thread_id,
          role: "assistant" as ConciergeMessage["role"],
          content: e.text,
          created_at: e.at,
        },
      ];
    }

    return [];
  });
}

export default function ConciergePage() {
  // ✅ thread / threadId state を削除（events から導出）
  const [events, setEvents] = useState<ChatEvent[]>([]);

  // thread_id を同期参照（thread確定前でもUIが壊れないように）
  const threadIdRef = useRef<number>(0);

  const messages = useMemo(() => deriveMessages(events), [events]);

  // ✅ lastUnified（状態の単一ソース）
  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  // ✅ thread は events（= lastUnified）から導出
  const thread: ConciergeThread | null = useMemo(() => {
    const t = lastUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [lastUnified]);

  // ✅ threadId は thread から導出（useConciergeChat の引数用）
  const threadId: string | null = thread ? String(thread.id) : null;

  const recommendations = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== "assistant_state") continue;
      const recs = e.unified?.data?.recommendations;
      if (Array.isArray(recs)) return recs; // 空でも上書き
    }
    return [];
  }, [events]);

  const { send, sending, error } = useConciergeChat(threadId, {
    
    
    onUnified: (u) => {
      const now = new Date().toISOString();

      // ① thread が来たら確定
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;

      // ★「初めて thread が確定した」瞬間だけ、過去イベントの 0 を補正
      const shouldPatch = threadIdRef.current === 0 && nextTid !== 0;
      if (nextTid) threadIdRef.current = nextTid;

      setEvents((prev) => {
        const patched = shouldPatch ? patchThreadId(prev, nextTid) : prev;

        return [
          ...patched,
          { type: "assistant_state", unified: u, at: now, thread_id: nextTid || 0 },
          ...(typeof u.reply === "string" && u.reply.trim()
            ? [{ type: "assistant_reply", text: u.reply, at: now, thread_id: nextTid || 0 } as const]
            : []),
        ];
      });
    },
  });
  const sp = useSearchParams();
  const force = sp.get("force"); // "design" | "paywall" | null
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

    // ✅ dev の force を切り替えたら、events をリセット（状態が残って入力不能になるのを防ぐ）
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    setEvents([]);
    threadIdRef.current = 0;
  }, [forced]);

  const stopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (lastUnified?.stop_reason ?? null);

  const canSend = stopReason === null;

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
