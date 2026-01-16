// apps/web/src/app/concierge/ConciergeClientFull.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";




const DEBUG = process.env.NODE_ENV !== "production" && false;



function deriveMessages(events: ChatEvent[], threadId: number): ConciergeMessage[] {
  let mid = 0;
  const out: ConciergeMessage[] = [];

  for (const e of events) {
    if (e.type === "user_message") {
      mid += 1;
      out.push({
        id: mid,
        thread_id: threadId,
        role: "user",
        content: e.text,
        created_at: e.at,
      } as ConciergeMessage);
      continue;
    }

    if (e.type === "assistant_reply") {
      mid += 1;
      out.push({
        id: mid,
        thread_id: threadId,
        role: "assistant",
        content: e.text,
        created_at: e.at,
      } as ConciergeMessage);
    }
  }

  return out;
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

export default function ConciergeClientFull() {
  const router = useRouter();
  const sp = useSearchParams();

  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState<number>(0);
  const activeThreadIdRef = useRef<number>(0);

  const [promotedTid, setPromotedTid] = useState<number | null>(null);

  const setActiveTid = (tid: number) => {
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };

  const tidFromQuery = useMemo(() => {
    const raw = sp.get("tid");
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [sp]);

  // restore
  useEffect(() => {
    if (DEBUG) console.time("restore");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEventsByThread(JSON.parse(raw) as EventsByThread);
    } catch {
      // ignore
    } finally {
      if (DEBUG) console.timeEnd("restore");
      setHydrated(true);
    }
  }, []);

  // URL tid -> activeThreadId
  useEffect(() => {
    if (!hydrated) return;
    if (tidFromQuery === 0 && activeThreadIdRef.current !== 0) return;
    setActiveTid(tidFromQuery);
  }, [tidFromQuery, hydrated]);

  // save
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      if (DEBUG) console.time("save");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByThread));
      } catch {
        // ignore
      } finally {
        if (DEBUG) console.timeEnd("save");
      }
    }, 250);

    return () => window.clearTimeout(id);
  }, [eventsByThread, hydrated]);

  // dev force
  const force = sp.get("force");
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  // recommendations（そのまま）
  const recommendations = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== "assistant_state") continue;
      const recs = e.unified?.data?.recommendations;
      if (Array.isArray(recs)) return recs;
    }
    return [];
  }, [events]);

  const debugRecN = useMemo(() => {
    if (process.env.NODE_ENV === "production") return 0;
    const n = Number(sp.get("recs") ?? "0");
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
  }, [sp]);

  // ✅ dev用のダミー（長文reason/画像あり/なし混在）
  const devDummyRecs = useMemo(() => {
    if (process.env.NODE_ENV === "production") return [];
    const long =
      "これは長文の理由です。表示崩れ（高さ・改行・ボタン位置）が起きないか確認するためのダミーテキストです。".repeat(
        6,
      );

    return [
      {
        id: null,
        name: "（ダミー）明治神宮",
        display_name: "（ダミー）明治神宮",
        display_address: "東京都渋谷区代々木神園町1-1",
        reason: long,
        photo_url: null,
        distance_m: 1234,
        duration_min: 18,
        place_id: "dummy-place-1",
      },
      {
        id: null,
        name: "（ダミー）伏見稲荷大社",
        display_name: "（ダミー）伏見稲荷大社",
        display_address: "京都府京都市伏見区深草薮之内町68",
        reason: "短い理由。",
        photo_url: null,
        distance_m: 4321,
        duration_min: 55,
        place_id: "dummy-place-2",
      },
      {
        id: null,
        name: "（ダミー）鶴岡八幡宮",
        display_name: "（ダミー）鶴岡八幡宮",
        display_address: "神奈川県鎌倉市雪ノ下2-1-31",
        reason: long,
        photo_url: null,
        distance_m: 9876,
        duration_min: 120,
        place_id: "dummy-place-3",
      },
    ];
  }, []);

  const recommendationsView = useMemo(() => {
    const base = recommendations.length > 0 ? recommendations : devDummyRecs;
    if (!debugRecN) return base;
    return base.slice(0, debugRecN);
  }, [recommendations, devDummyRecs, debugRecN]);

  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  const needTags = useMemo(() => {
    const tags = lastUnified?.data?._need?.tags;
    return Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
  }, [lastUnified]);

  const thread: ConciergeThread | null = useMemo(() => {
    const t = lastUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [lastUnified]);

  const threadIdNum = thread?.id ?? activeThreadId;
  const messages = useMemo(() => deriveMessages(events, threadIdNum), [events, threadIdNum]);

  const chatThreadId: string | null =
    typeof thread?.id === "number" && thread.id > 0
      ? String(thread.id)
      : activeThreadId !== 0
        ? String(activeThreadId)
        : null;

  const { send, sending, error } = useConciergeChat(chatThreadId, {
    onUnified: (u) => {
      const now = new Date().toISOString();
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;
      const currentTid = activeThreadIdRef.current;

      if (currentTid === 0 && nextTid !== 0) {
        setActiveTid(nextTid);
        setPromotedTid(nextTid);
      }

      setEventsByThread((prev) => {
        let cur = prev;
        if (currentTid === 0 && nextTid !== 0) cur = promoteThread(cur, 0, nextTid);

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

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!canSend) return;

    const now = new Date().toISOString();
    const tid = activeThreadId !== 0 ? activeThreadId : activeThreadIdRef.current;

    setEventsByThread((prev) => appendEvents(prev, tid, { type: "user_message", text: trimmed, at: now } as const));

    void send(trimmed);
  };

  useEffect(() => {
    if (!promotedTid) return;
    router.replace(`/concierge?tid=${promotedTid}`);
    setPromotedTid(null);
  }, [promotedTid, router]);

  return (
    <ConciergeLayout
      messages={messages}
      sending={sending}
      error={error}
      onSend={handleSend}
      onNewThread={() => setActiveTid(0)}
      recommendations={recommendationsView}
      needTags={needTags}
      paywallNote={lastUnified?.note ?? null}
      remainingFree={lastUnified?.remaining_free ?? null}
      stopReason={stopReason}
      canSend={canSend}
      embedMode={false}
    />
  );
}
