// apps/web/src/app/concierge/ConciergeClientFull.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConciergeSections from "@/features/concierge/components/ConciergeSections";
import { buildConciergeSections } from "@/features/concierge/sectionsBuilder";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread, ConciergeRecommendation } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";
import type { ConciergeChatRequestV1, ConciergeChatFilters } from "@/features/concierge/types/chatRequest";
import { buildDummySections } from "@/features/concierge/sections/dummy";

import ConciergeSectionsRenderer from "@/features/concierge/components/ConciergeSectionsRenderer";

import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";
import { SHOW_NEW_RENDERER } from "@/features/concierge/rendererMode";

import type { RendererAction } from "@/features/concierge/sections/types";
import { getGoriyakuTags } from "@/lib/api/tags";

/* ========================================
 * types / consts
 * ====================================== */
type Element4 = "火" | "地" | "風" | "水";
type Tag = { id: number; name: string };

// ✅ ChatEvent に assistant_state が無い環境でも崩れないよう、このファイル内だけ拡張
type AssistantStateEvent = { type: "assistant_state"; unified: UnifiedConciergeResponse; at: string };
type LocalEvent = ChatEvent | AssistantStateEvent;

type EventsByThread = Record<number, LocalEvent[]>;
const STORAGE_KEY = "concierge:eventsByThread";

const LS_BIRTHDATE_KEY = "concierge:birthdate";

const ELEMENT_TO_GORIYAKU: Record<Element4, string[]> = {
  火: ["仕事運・出世", "勝運・必勝祈願", "開運招福", "厄除け・方除け"],
  地: ["金運・商売繁盛", "健康長寿", "五穀豊穣", "家内安全"],
  風: ["学業成就", "合格祈願"],
  水: ["縁結び", "子宝・安産", "病気平癒"],
};

/* ========================================
 * utils
 * ====================================== */
function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const [y, m, dd] = s.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === dd;
}

function normalizeISODate(s: string): string | null {
  const t = (s || "").trim();
  if (!t) return null;

  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = m[1];
    const mm = m[2].padStart(2, "0");
    const dd = m[3].padStart(2, "0");
    const iso = `${y}-${mm}-${dd}`;
    return isValidISODate(iso) ? iso : null;
  }

  return isValidISODate(t) ? t : null;
}

function birthdateToElement4(birthdateISO: string): Element4 | null {
  if (!isValidISODate(birthdateISO)) return null;
  const [, mm, dd] = birthdateISO.split("-");
  const md = Number(mm) * 100 + Number(dd);

  if (md >= 321 && md <= 419) return "火";
  if (md >= 420 && md <= 520) return "地";
  if (md >= 521 && md <= 621) return "風";
  if (md >= 622 && md <= 722) return "水";
  if (md >= 723 && md <= 822) return "火";
  if (md >= 823 && md <= 922) return "地";
  if (md >= 923 && md <= 1023) return "風";
  if (md >= 1024 && md <= 1122) return "水";
  if (md >= 1123 && md <= 1221) return "火";
  if (md >= 1222 || md <= 119) return "地";
  if (md >= 120 && md <= 218) return "風";
  return "水";
}

function deriveMessages(events: LocalEvent[], threadId: number): ConciergeMessage[] {
  let mid = 0;
  const out: ConciergeMessage[] = [];

  for (const e of events) {
    if (e.type === "user_message" || e.type === "assistant_reply") {
      mid += 1;
      out.push({
        id: mid,
        thread_id: threadId,
        role: e.type === "user_message" ? "user" : "assistant",
        content: e.text,
        created_at: e.at,
      } as ConciergeMessage);
    }
  }

  return out;
}

/* ========================================
 * events store helpers
 * ====================================== */
function getThreadEvents(map: EventsByThread, tid: number): LocalEvent[] {
  return map[tid] ?? [];
}

function appendEvents(map: EventsByThread, tid: number, next: LocalEvent | LocalEvent[]): EventsByThread {
  const arr = Array.isArray(next) ? next : [next];
  return { ...map, [tid]: [...getThreadEvents(map, tid), ...arr] };
}

function promoteThread(map: EventsByThread, fromTid: number, toTid: number): EventsByThread {
  if (!toTid || fromTid === toTid) return map;
  const fromEvents = getThreadEvents(map, fromTid);
  if (!fromEvents.length) return map;

  const next = { ...map };
  next[toTid] = [...getThreadEvents(map, toTid), ...fromEvents];
  delete next[fromTid];
  return next;
}

/* ========================================
 * component
 * ====================================== */
export default function ConciergeClientFull() {
  const router = useRouter();
  const sp = useSearchParams();

  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState(0);
  const activeThreadIdRef = useRef(0);

  

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [extraCondition, setExtraCondition] = useState("");

  const [goriyakuTags, setGoriyakuTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [birthdate, setBirthdate] = useState("");
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  // ✅ 初回レスポンス保持（2回送信問題対策）
  const [liveUnified, setLiveUnified] = useState<UnifiedConciergeResponse | null>(null);
  const [liveRecs, setLiveRecs] = useState<ConciergeRecommendation[]>([]);

  const setActiveTid = (tid: number) => {
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };

  const tidFromQuery = useMemo(() => {
    const raw = sp.get("tid");
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [sp]);

  

  /* restore */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEventsByThread(JSON.parse(raw) as EventsByThread);
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (tidFromQuery === activeThreadIdRef.current) return; // ✅ 上書き防止
    setActiveTid(tidFromQuery);
  }, [tidFromQuery, hydrated]);

  /* save */
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByThread));
      } catch {
        // ignore
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [eventsByThread, hydrated]);

  /* 生年月日 restore */
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_BIRTHDATE_KEY);
      if (v && isValidISODate(v)) setBirthdate(v);
    } catch {
      // ignore
    }
  }, []);

  /* 生年月日 save */
  useEffect(() => {
    try {
      if (birthdate && isValidISODate(birthdate)) {
        localStorage.setItem(LS_BIRTHDATE_KEY, birthdate);
      } else {
        localStorage.removeItem(LS_BIRTHDATE_KEY);
      }
    } catch {
      // ignore
    }
  }, [birthdate]);

  useEffect(() => {
    if (!isFilterOpen) return;
    if (tagsLoading || goriyakuTags.length > 0) return;

    let alive = true;
    setTagsLoading(true);
    setTagsError(null);

    (async () => {
      try {
        console.log("[tags] fetching...");
        const res = await getGoriyakuTags();
        console.log("[tags] res", res);

        if (!alive) return;
        setGoriyakuTags(Array.isArray(res) ? res : []);
        setTagsError(null);
      } catch (e) {
        console.log("[tags] failed", e);
        if (!alive) return;
        setGoriyakuTags([]);
        setTagsError("ご利益タグの取得に失敗しました");
      } finally {
        if (alive) setTagsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isFilterOpen, tagsLoading, goriyakuTags.length]);

  

  /* dev force */
  const force = sp.get("force");
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  // ✅ 表示ソースは displayUnified に統一
  const displayUnified = useMemo(() => liveUnified ?? lastUnified, [lastUnified, liveUnified]);

  const displayRecommendations = useMemo(() => {
    if (liveRecs.length > 0) return liveRecs;
    const recs = displayUnified?.data?.recommendations;
    return Array.isArray(recs) ? (recs as ConciergeRecommendation[]) : [];
  }, [liveRecs, displayUnified]);

  const hasCandidates = displayRecommendations.length > 0;

  const thread: ConciergeThread | null = useMemo(() => {
    const t = displayUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [displayUnified]);

  const mode = useMemo(() => displayUnified?.data?._signals?.mode, [displayUnified]);

  const chatThreadId =
    typeof thread?.id === "number" ? String(thread.id) : activeThreadId !== 0 ? String(activeThreadId) : null;

  const element4 = useMemo(() => (birthdate ? birthdateToElement4(birthdate) : null), [birthdate]);

  const suggestedTags = useMemo(() => {
    if (!element4) return [];
    if (!Array.isArray(goriyakuTags) || goriyakuTags.length === 0) return [];
    const names = ELEMENT_TO_GORIYAKU[element4] ?? [];
    const setNames = new Set(names);
    return goriyakuTags.filter((t) => setNames.has(t.name));
  }, [element4, goriyakuTags]);

  const stopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (displayUnified?.stop_reason ?? null);
  const canSend = stopReason === null || (process.env.NODE_ENV !== "production" && !!forced);

  const needTags = useMemo(() => {
    const tags = displayUnified?.data?._need?.tags;
    return Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
  }, [displayUnified]);

  const sections = useMemo(
    () => buildConciergeSections(displayRecommendations as any, needTags),
    [displayRecommendations, needTags],
  );

  const baseFilters: ConciergeChatFilters = useMemo(() => {
    const bd = normalizeISODate(birthdate) ?? undefined;
    const extra = extraCondition.trim() || undefined;

    return {
      birthdate: bd,
      goriyaku_tag_ids: selectedTagIds.length ? selectedTagIds : undefined,
      extra_condition: extra,
    };
  }, [birthdate, selectedTagIds, extraCondition]);

  // ✅ filterState は payload より先
  const filterState = useMemo(
    () => ({
      isOpen: isFilterOpen,
      birthdate,
      element4,
      goriyakuTags,
      suggestedTags,
      selectedTagIds,
      tagsLoading,
      tagsError,
      extraCondition,
    }),
    [
      isFilterOpen,
      birthdate,
      element4,
      goriyakuTags,
      suggestedTags,
      selectedTagIds,
      tagsLoading,
      tagsError,
      extraCondition,
    ],
  );

  // ✅ payload は 1回だけ（displayUnified + filterState）
  const payload = useMemo(() => {
    return buildPayloadFromUnified(displayUnified, filterState) ?? buildDummySections(filterState);
  }, [displayUnified, filterState]);

  const messages = useMemo(
    () => deriveMessages(events, thread?.id ?? activeThreadId),
    [events, thread, activeThreadId],
  );



  const { send, sending, error } = useConciergeChat(chatThreadId, {
    filters: baseFilters,

    // ✅ 初回で cards 出すために保持
    onRecommendations: (recs) => {
      setLiveRecs(Array.isArray(recs) ? recs : []);
    },

    onUnified: (u) => {
      setLiveUnified(u);

      const now = new Date().toISOString();
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;
      const currentTid = activeThreadIdRef.current;

      if (currentTid === 0 && nextTid !== 0) {
        setActiveTid(nextTid);
        router.replace(`/concierge?tid=${nextTid}`);
      }

      setEventsByThread((prev) =>
        appendEvents(
          currentTid === 0 && nextTid !== 0 ? promoteThread(prev, 0, nextTid) : prev,
          nextTid || currentTid,
          [
            { type: "assistant_state", unified: u, at: now },
            ...(u.reply ? [{ type: "assistant_reply", text: u.reply, at: now } as const] : []),
          ],
        ),
      );
    },
  });

  const buildFilterPayload = useCallback((): Omit<ConciergeChatRequestV1, "thread_id"> | null => {
    const hasFilter =
      (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 || !!baseFilters.birthdate || !!baseFilters.extra_condition;

    if (!hasFilter) return null;

    return {
      version: 1,
      query: "条件を追加して絞り込みたいです。",
    };
  }, [baseFilters]);

  const onRendererAction = (a: RendererAction) => {
    switch (a.type) {
      case "open_map":
        router.push("/map");
        return;

      case "add_condition":
        setIsFilterOpen(true);
        return;

      case "filter_close":
        setIsFilterOpen(false);
        return;

      case "filter_apply": {
        const p = buildFilterPayload();
        if (!p) return;
        setIsFilterOpen(false);
        void (send as any)(p);
        return;
      }

      case "filter_set_birthdate":
        setBirthdate(a.birthdate);
        return;

      case "filter_toggle_tag":
        setSelectedTagIds((prev) => {
          const set = new Set(prev);
          if (set.has(a.tagId)) set.delete(a.tagId);
          else set.add(a.tagId);
          return Array.from(set);
        });
        return;

      case "filter_set_extra":
        setExtraCondition(a.extraCondition);
        return;

      case "filter_clear":
        setExtraCondition("");
        // ついでにやるなら
        // setSelectedTagIds([]);
        return;
    }
  };

  

  return (
    <ConciergeLayout
      messages={messages}
      sending={sending}
      error={error}
      onSend={(text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!canSend) return;
        void send(trimmed);
      }}
      onNewThread={() => {
        setLiveUnified(null);
        setLiveRecs([]);
        setActiveTid(0);
      }}
      canSend={canSend}
      embedMode={false}
      hasCandidates={hasCandidates}
    >
      {SHOW_NEW_RENDERER ? (
        <div className="p-4 space-y-3">
          <ConciergeSectionsRenderer payload={payload} onAction={onRendererAction} sending={sending} />
        </div>
      ) : (
        <ConciergeSections sections={sections} onNewThread={() => setActiveTid(0)} mode={mode} />
      )}
    </ConciergeLayout>
  );
}
