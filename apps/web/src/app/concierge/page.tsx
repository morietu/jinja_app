"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";

/**
 * deriveMessages は UI 表示専用の純関数。
 * - events 以外の外部状態を参照しない
 * - assistant_state は表示しない
 */
function deriveMessages(events: ChatEvent[], threadId: number): ConciergeMessage[] {
  let mid = 0;

  return events.flatMap((e) => {
    if (e.type === "user_message") {
      mid += 1;
      return [
        {
          id: mid,
          thread_id: threadId,
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
          thread_id: threadId,
          role: "assistant" as ConciergeMessage["role"],
          content: e.text,
          created_at: e.at,
        },
      ];
    }

    return [];
  });
}

type EventsByThread = Record<number, ChatEvent[]>;

const STORAGE_KEY = "concierge:eventsByThread";

function getThreadEvents(map: EventsByThread, tid: number): ChatEvent[] {
  return map[tid] ?? [];
}

function appendEvents(map: EventsByThread, tid: number, next: ChatEvent | ChatEvent[]): EventsByThread {
  const arr = Array.isArray(next) ? next : [next];
  const cur = getThreadEvents(map, tid);
  return { ...map, [tid]: [...cur, ...arr] };
}

// 0(暫定) → 実threadId に昇格（初回だけ）
function promoteThread(map: EventsByThread, fromTid: number, toTid: number): EventsByThread {
  if (!toTid) return map;
  if (fromTid === toTid) return map;

  const fromEvents = getThreadEvents(map, fromTid);
  const toEvents = getThreadEvents(map, toTid);

  // すでに昇格済みなら何もしない
  if (!fromEvents.length) return map;

  const next: EventsByThread = { ...map };
  next[toTid] = [...toEvents, ...fromEvents];
  delete next[fromTid];
  return next;
}

export default function ConciergePage() {

  // ✅ thread単位でイベント保持（localStorageから復元）
  const [eventsByThread, setEventsByThread] = useState<EventsByThread>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as EventsByThread) : {};
    } catch {
      return {};
    }
  });

  // ✅ localStorageへ保存（副作用はここだけ）
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByThread));
    } catch {
      // quota / private mode 等は無視
    }
  }, [eventsByThread]);

  // ✅ 今表示している thread（最初は 0=暫定）
  const [activeThreadId, setActiveThreadId] = useState<number>(0);
  const activeThreadIdRef = useRef<number>(0);

  const setActiveTid = (tid: number) => {
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };

  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  // ✅ lastUnified（状態の単一ソース）: activeThread の events から導出
  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  // ✅ thread は lastUnified から導出
  const thread: ConciergeThread | null = useMemo(() => {
    const t = lastUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [lastUnified]);

  // ✅ useConciergeChat 用 threadId
  const threadId: string | null = thread ? String(thread.id) : null;
  const threadIdNum = thread?.id ?? activeThreadId;

  const messages = useMemo(() => deriveMessages(events, threadIdNum), [events, threadIdNum]);

  const recommendations = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== "assistant_state") continue;
      const recs = e.unified?.data?.recommendations;
      if (Array.isArray(recs)) return recs; // 空でも上書き
    }
    return [];
  }, [events]);

  const sp = useSearchParams();
  const force = sp.get("force"); // "design" | "paywall" | null
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  const { send, sending, error } = useConciergeChat(threadId, {
    onUnified: (u) => {
      const now = new Date().toISOString();

      // ① thread が返ってきたら、0(暫定)→実threadId へ昇格
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;
      const currentTid = activeThreadIdRef.current;

      setEventsByThread((prev) => {
        let cur = prev;

        // active が 0 で、threadが確定したら昇格
        if (currentTid === 0 && nextTid !== 0) {
          cur = promoteThread(cur, 0, nextTid);
        }

        // ② 保存先 tid を確定（昇格後は nextTid に積む）
        const tidToWrite = nextTid !== 0 ? nextTid : currentTid;


        return appendEvents(cur, tidToWrite, [
          { type: "assistant_state", unified: u, at: now },
          ...(typeof u.reply === "string" && u.reply.trim()
            ? [{ type: "assistant_reply", text: u.reply, at: now } as const]
            : []),
        ]);
      });

      // ③ activeThreadId も確定IDに切り替える（0のままだと参照がズレる）
      if (currentTid === 0 && nextTid !== 0) setActiveTid(nextTid);
      
    },
  });

  const isDevForced = process.env.NODE_ENV !== "production" && !!forced;
  const stopReason: StopReason = isDevForced ? (forced as StopReason) : (lastUnified?.stop_reason ?? null);

  // ✅ dev force でも送信できる（表示だけ強制）
  const canSend = stopReason === null || isDevForced;

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
    const currentTid = activeThreadIdRef.current;

    setEventsByThread((prev) =>
      appendEvents(prev, currentTid, {
        type: "user_message",
        text: trimmed,
        at: now,
      } as const),
    );

  await send(trimmed);
};



  const handleRetry = () => {
    const lastUser = [...events].reverse().find((e) => e.type === "user_message");
    if (!lastUser) return;
    void handleSend(lastUser.text);
  };

  const handleNewThread = () => {
    setActiveTid(0);
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
        onNewThread={handleNewThread}
        recommendations={recommendations}
        paywallNote={paywallNoteView}
        remainingFree={remainingFreeView}
        stopReason={stopReason}
        canSend={canSend}
      />
    </div>
  );
}
