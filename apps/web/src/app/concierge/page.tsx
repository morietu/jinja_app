"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";



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

function promoteThread(map: EventsByThread, fromTid: number, toTid: number): EventsByThread {
  if (!toTid) return map;
  if (fromTid === toTid) return map;

  const fromEvents = getThreadEvents(map, fromTid);
  const toEvents = getThreadEvents(map, toTid);

  if (!fromEvents.length) return map;

  const next: EventsByThread = { ...map };
  next[toTid] = [...toEvents, ...fromEvents];
  delete next[fromTid];
  return next;
}

export default function ConciergePage() {
  const router = useRouter();
  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState<number>(0);
  const activeThreadIdRef = useRef<number>(0);

  const [promotedTid, setPromotedTid] = useState<number | null>(null);

  const setActiveTid = (tid: number) => {
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };

  const sp = useSearchParams();

  const tidFromQuery = useMemo(() => {
    const raw = sp.get("tid");
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [sp]);

  // ① restore（client mount 後に 1回だけ）
  useEffect(() => {
    console.time("restore");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEventsByThread(JSON.parse(raw) as EventsByThread);
    } catch {
      // ignore
    } finally {
      console.timeEnd("restore");
      setHydrated(true);
    }
  }, []);

  // ② URL tid → activeThreadId（hydrated 後だけ） ← URL同期はここ “だけ”
  useEffect(() => {
    if (!hydrated) return;

    if (tidFromQuery === 0 && activeThreadIdRef.current !== 0) return;

    setActiveTid(tidFromQuery);
  }, [tidFromQuery, hydrated]);

  // ③ save（hydrated 後だけ）
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      console.time("save");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByThread));
      } catch {
        // noop: storage が使えない環境（
      }
      console.timeEnd("save");
    }, 250); // まずは250ms
    return () => window.clearTimeout(id);
  }, [eventsByThread, hydrated]);

  const force = sp.get("force"); // "design" | "paywall" | null
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  const thread: ConciergeThread | null = useMemo(() => {
    const t = lastUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [lastUnified]);

  const threadIdNum = thread?.id ?? activeThreadId;

  const messages = useMemo(() => deriveMessages(events, threadIdNum), [events, threadIdNum]);

  const recommendations = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== "assistant_state") continue;
      const recs = e.unified?.data?.recommendations;
      if (Array.isArray(recs)) return recs;
    }
    return [];
  }, [events]);

  // ✅ useConciergeChat は activeThreadId を正にする（URL依存を消す）
  const chatThreadId: string | null = activeThreadId !== 0 ? String(activeThreadId) : thread ? String(thread.id) : null;

  const { send, sending, error } = useConciergeChat(chatThreadId, {
    onUnified: (u) => {
      const now = new Date().toISOString();
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;
      const currentTid = activeThreadIdRef.current;

      console.debug("[onUnified raw]", u);
      console.debug("[onUnified thread]", u?.thread);

      // 昇格が起きたら state だけ更新（副作用は effect に逃がす）
      if (currentTid === 0 && nextTid !== 0) {
        setActiveTid(nextTid);
        setPromotedTid(nextTid);
      }

      setEventsByThread((prev) => {
        let cur = prev;

        if (currentTid === 0 && nextTid !== 0) {
          cur = promoteThread(cur, 0, nextTid);
        }

        const tidToWrite = nextTid !== 0 ? nextTid : currentTid;

        const nextEvents: ChatEvent[] = [
          { type: "assistant_state", unified: u, at: now },
          ...(typeof u.reply === "string" && u.reply.trim()
            ? [{ type: "assistant_reply", text: u.reply, at: now } as const]
            : []),
        ];

        return appendEvents(cur, tidToWrite, nextEvents);
      });
    },
  });
    


  const isDevForced = process.env.NODE_ENV !== "production" && !!forced;
  const stopReason: StopReason = isDevForced ? (forced as StopReason) : (lastUnified?.stop_reason ?? null);
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
      appendEvents(prev, currentTid, { type: "user_message", text: trimmed, at: now } as const),
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

  

  useEffect(() => {
    if (!promotedTid) return;
    router.replace(`/concierge?tid=${promotedTid}`);
    setPromotedTid(null);
  }, [promotedTid, router]);

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
