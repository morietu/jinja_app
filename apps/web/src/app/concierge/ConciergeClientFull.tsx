// apps/web/src/app/concierge/ConciergeClientFull.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";

import {
  getConciergeThread,
  type ConciergeMessage,
  type ConciergeThread,
  type ConciergeRecommendation,
  type ConciergeThreadDetail,
} from "@/lib/api/concierge";

import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";
import type { ConciergeChatRequestV1, ConciergeChatFilters } from "@/features/concierge/types/chatRequest";
import { buildDummySections } from "@/features/concierge/sections/dummy";

import ConciergeSectionsRenderer from "@/features/concierge/components/ConciergeSectionsRenderer";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";
import { SHOW_NEW_RENDERER } from "@/features/concierge/rendererMode";

import type {
  RendererAction,
  ConciergeSectionsPayload,
} from "@/features/concierge/sections/types";
import { getGoriyakuTags } from "@/lib/api/tags";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAuthRequiredForAction } from "@/lib/auth/actionGuards";
import {
  initialConciergeSessionState,
  type ConciergeSessionState,
} from "@/features/concierge/types";
import { resolveDisplayLabel, resolveDisplayName } from "@/lib/profile/resolveDisplayName";

import { conciergeLog } from "@/lib/log/concierge";
import { EVT_CLOSE_CONCIERGE } from "@/lib/events";
const conciergeCardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm p-6";

import { isValidISODate, normalizeBirthdateInput } from "@/lib/date/normalizeBirthdateInput";

/* ========================================
 * 型定義とデータ設定
 * ====================================== */
type Element4 = "火" | "地" | "風" | "水";
type Tag = { id: number; name: string };

type AssistantStateEvent = { type: "assistant_state"; unified: UnifiedConciergeResponse; at: string };
type LocalEvent = ChatEvent | AssistantStateEvent;

type EventsByThread = Record<number, LocalEvent[]>;


const STORAGE_KEY = "concierge:eventsByThread";


type AnonymousConciergeSnapshot = {
  version: 1;
  savedAt: string;
  unified: UnifiedConciergeResponse;
  filters: {
    selectedTagIds: number[];
    extraCondition: string;
  };
  session: {
    sessionNickname: string | null;
  };
};

const SS_ANON_SNAPSHOT_KEY = "concierge:anonymousSnapshot:v1";

const ELEMENT_TO_GORIYAKU: Record<Element4, string[]> = {
  火: ["仕事運・出世", "勝運・必勝祈願", "開運招福", "厄除け・方除け"],
  地: ["金運・商売繁盛", "健康長寿", "五穀豊穣", "家内安全"],
  風: ["学業成就", "合格祈願"],
  水: ["縁結び", "子宝・安産", "病気平癒"],
};

/* ========================================
 * snap（ナビ/状態遷移を１箇所に集約してログを強制出力）
 * ====================================== */
function snap(_label: string, _extra: Record<string, any> = {}) {}



/**
 * UI補助用の簡易変換。
 * 推薦根拠の正本ではない。
 * 正本は backend domain/astrology.py の判定を使う。
 */
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

function threadDetailToUnified(thread: ConciergeThreadDetail | null): UnifiedConciergeResponse | null {
  if (!thread) return null;

  const root = thread as any;
  const dataLike =
    (root?.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : null) ?? root;

  const recommendations =
    (Array.isArray(dataLike?.recommendations) ? dataLike.recommendations : null) ??
    (Array.isArray(root?.recommendations) ? root.recommendations : null) ??
    [];

  const signals =
    (dataLike?._signals && typeof dataLike._signals === "object" ? dataLike._signals : null) ??
    (root?._signals && typeof root._signals === "object" ? root._signals : null) ??
    null;

  const reply =
    typeof root?.reply === "string" ? root.reply : typeof dataLike?.reply === "string" ? dataLike.reply : null;

  const plan =
    root?.plan === "anonymous" || root?.plan === "free" || root?.plan === "premium"
      ? root.plan
      : dataLike?.plan === "anonymous" || dataLike?.plan === "free" || dataLike?.plan === "premium"
        ? dataLike.plan
        : null;

  const remaining =
    typeof root?.remaining === "number"
      ? root.remaining
      : typeof dataLike?.remaining === "number"
        ? dataLike.remaining
        : null;

  const limit =
    typeof root?.limit === "number" ? root.limit : typeof dataLike?.limit === "number" ? dataLike.limit : null;

  const limitReached = root?.limitReached === true || dataLike?.limitReached === true;

  return {
    ok: true,
    thread: typeof root?.id === "number" ? ({ id: root.id } as any) : undefined,
    data: {
      ...(dataLike ?? {}),
      recommendations,
      _signals: signals,
    },
    reply,
    plan,
    remaining,
    limit,
    limitReached,
    stop_reason: null,
  } as UnifiedConciergeResponse;
}

function isAnonymousLikeUnified(u: UnifiedConciergeResponse | null | undefined): boolean {
  if (!u) return false;
  const tid = (u as any)?.thread?.id ?? (u as any)?.thread_id ?? (u as any)?.data?.thread_id ?? null;
  return tid == null || tid === "" || Number(tid) === 0;
}

function saveAnonymousSnapshot(snapshot: AnonymousConciergeSnapshot) {
  try {
    sessionStorage.setItem(SS_ANON_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

function loadAnonymousSnapshot(): AnonymousConciergeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SS_ANON_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnonymousConciergeSnapshot;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearAnonymousSnapshot() {
  try {
    sessionStorage.removeItem(SS_ANON_SNAPSHOT_KEY);
  } catch {
    // ignore
  }
}

function isRecommendationsPayload(
  payload: ConciergeSectionsPayload | null | undefined,
): payload is ConciergeSectionsPayload {
  if (!payload || !Array.isArray(payload.sections)) return false;
  return payload.sections.some(
    (s) => s.type === "recommendations" && Array.isArray((s as any).items) && (s as any).items.length > 0,
  );
}




/* ========================================
 * メインコンポーネント
 * ====================================== */
export default function ConciergeClientFull() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    snap("component_render", {});
  }, []);

  const lastNavAtRef = useRef(0);
  const isClosingRef = useRef(false);

  const navReplace = useCallback(
    (to: string, meta?: any) => {
      lastNavAtRef.current = performance.now();
      snap("nav:replace", { to, ...meta });
      router.replace(to);
    },
    [router],
  );

  const navPush = useCallback(
    (to: string, meta?: any) => {
      lastNavAtRef.current = performance.now();
      snap("nav:push", { to, ...meta });
      router.push(to);
    },
    [router],
  );

  const redirectToAuth = useCallback(
    (kind: "login" | "register") => {
      const returnTo = "/concierge";
      navPush(`/auth/${kind}?returnTo=${encodeURIComponent(returnTo)}`, {
        reason: "auth_required",
        kind,
        returnTo,
      });
    },
    [navPush],
  );

  const { user, isLoggedIn } = useAuth();

  const canSaveConciergeThread =
    !isAuthRequiredForAction("save_concierge_thread") || isLoggedIn;

  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState(0);
  const activeThreadIdRef = useRef(0);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [extraCondition, setExtraCondition] = useState("");

  const [goriyakuTags, setGoriyakuTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [sessionState, setSessionState] = useState<ConciergeSessionState>(initialConciergeSessionState);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [needText, setNeedText] = useState("");

  const displayName = useMemo(
    () =>
      resolveDisplayName({
        sessionNickname: sessionState.sessionNickname,
        profileNickname: user?.nickname ?? null,
      }),
    [sessionState.sessionNickname, user?.nickname],
  );

  const displayLabel = useMemo(
    () =>
      resolveDisplayLabel({
        sessionNickname: sessionState.sessionNickname,
        profileNickname: user?.nickname ?? null,
      }),
    [sessionState.sessionNickname, user?.nickname],
  );

  const [liveUnified, setLiveUnified] = useState<UnifiedConciergeResponse | null>(null);
  const [liveRecs, setLiveRecs] = useState<ConciergeRecommendation[]>([]);

  const [threadDetail, setThreadDetail] = useState<ConciergeThreadDetail | null>(null);
  const [, setThreadLoading] = useState(false);

  const setActiveTid = (tid: number) => {
    snap("setActiveTid", { from: activeThreadIdRef.current, to: tid });
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };


  /* ----------------------------------------
   * URLパラメータ
   * -------------------------------------- */
  const rawTid = useMemo(() => (sp.get("tid") ?? "").trim(), [sp]);

  const tidNum = useMemo(() => {
    if (!rawTid) return null;
    const n = Number(rawTid);
    if (!Number.isFinite(n)) return null;
    if (!Number.isInteger(n)) return null;
    if (n <= 0) return null;
    return n;
  }, [rawTid]);

  const isEntryRoute = tidNum === null;
  const tidFromQuery = tidNum ?? 0;





  // 入口でtidパラメータがある場合は削除
  useEffect(() => {
    if (!isEntryRoute) return;
    if (!rawTid) return;
    snap("nav:replace", { to: "/concierge", reason: "tid_cleanup" });
    router.replace("/concierge");
  }, [isEntryRoute, rawTid, router]);

  /* ----------------------------------------
   * 閉じる
   * -------------------------------------- */
  useEffect(() => {
    const onClose = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      snap("event:jinja_close_received", { detail });

      if (!window.location.pathname.startsWith("/concierge")) return;

      const dt = performance.now() - lastNavAtRef.current;
      if (dt >= 0 && dt < 800) {
        snap("event:jinja_close_ignored", { dt: Number(dt.toFixed(1)) });
        return;
      }

      if (isClosingRef.current) return;
      isClosingRef.current = true;

      setLiveUnified(null);
      setLiveRecs([]);
      setIsFilterOpen(false);

      navReplace("/", { reason: "close" });

      window.setTimeout(() => {
        isClosingRef.current = false;
      }, 800);
    };

    window.addEventListener(EVT_CLOSE_CONCIERGE, onClose);
    return () => window.removeEventListener(EVT_CLOSE_CONCIERGE, onClose);
  }, [navReplace]);

  /* ----------------------------------------
   * LS: eventsByThread
   * -------------------------------------- */
  useEffect(() => {
    snap("ls:restore_events", {});
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
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsByThread));
      } catch {
        // ignore
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [eventsByThread, hydrated]);




  /* ----------------------------------------
   * スレッド切り替え（URLパラメータ反応）
   * -------------------------------------- */
  useEffect(() => {
    snap("url:tid_effect", { rawTid, tidNum, tidFromQuery, hydrated });
    if (!hydrated) return;
    if (tidFromQuery === activeThreadIdRef.current) return;
    setActiveTid(tidFromQuery);
  }, [tidFromQuery, hydrated, rawTid, tidNum]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isEntryRoute) return;

    const snapshot = loadAnonymousSnapshot();

    snap("entry:reset_state", { hasSnapshot: !!snapshot });
    setActiveTid(0);
    setThreadDetail(null);
    setThreadLoading(false);

    if (!snapshot) {
      setLiveUnified(null);
      setLiveRecs([]);
    }
  }, [hydrated, isEntryRoute]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isEntryRoute) return;
    if (liveUnified) return;

    const snapshot = loadAnonymousSnapshot();
    if (!snapshot) return;

    setSelectedTagIds(Array.isArray(snapshot.filters.selectedTagIds) ? snapshot.filters.selectedTagIds : []);
    setExtraCondition(snapshot.filters.extraCondition ?? "");
    setSessionState((prev) => ({
      ...prev,
      sessionNickname: snapshot.session?.sessionNickname ?? null,
    }));
    setLiveUnified(snapshot.unified);
    setLiveRecs(
      Array.isArray(snapshot.unified?.data?.recommendations)
        ? (snapshot.unified.data.recommendations as ConciergeRecommendation[])
        : [],
    );
  }, [hydrated, isEntryRoute, liveUnified]);

  useEffect(() => {
    if (!hydrated) return;

    if (!tidNum) {
      setThreadDetail(null);
      setThreadLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setThreadLoading(true);
        const data = await getConciergeThread(String(tidNum));
        if (cancelled) return;
        setThreadDetail(data);
      } catch {
        if (cancelled) return;
        setThreadDetail(null);
      } finally {
        if (!cancelled) setThreadLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, tidNum]);

  /* ----------------------------------------
   * タグ取得（フィルター開いたら）
   * -------------------------------------- */
  useEffect(() => {
    if (!isFilterOpen) return;
    if (goriyakuTags.length > 0) return;

    let cancelled = false;

    (async () => {
      setTagsLoading(true);
      setTagsError(null);

      try {
        const res = await getGoriyakuTags();
        if (cancelled) return;
        setGoriyakuTags(Array.isArray(res) ? res : []);
      } catch (e) {
        if (cancelled) return;
        setGoriyakuTags([]);
        setTagsError("ご利益タグの取得に失敗しました");
        console.warn("getGoriyakuTags failed", e);
      } finally {
        if (!cancelled) setTagsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isFilterOpen, goriyakuTags.length]);

  /* ----------------------------------------
   * 開発用 force
   * -------------------------------------- */
  const force = sp.get("force");
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  /* ----------------------------------------
   * 派生データ
   * -------------------------------------- */
  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  const backendUnified = useMemo(() => threadDetailToUnified(threadDetail), [threadDetail]);

  const displayUnified = useMemo(() => {
    const primary = liveUnified ?? backendUnified ?? lastUnified;
    if (!primary) return null;

    const fallbackData = lastUnified?.data ?? null;
    const primaryData = primary.data ?? null;

    const primaryRecommendations = Array.isArray(primaryData?.recommendations)
      ? primaryData.recommendations
      : [];

    const fallbackRecommendations = Array.isArray(fallbackData?.recommendations)
      ? fallbackData.recommendations
      : [];

    return {
      ...primary,
      stop_reason: primary.stop_reason ?? lastUnified?.stop_reason ?? null,
      plan: primary.plan ?? lastUnified?.plan ?? null,
      remaining: primary.remaining ?? lastUnified?.remaining ?? null,
      limit: primary.limit ?? lastUnified?.limit ?? null,
      limitReached: primary.limitReached ?? lastUnified?.limitReached ?? false,
      thread: primary.thread ?? lastUnified?.thread ?? null,
      data: {
        ...(fallbackData ?? {}),
        ...(primaryData ?? {}),
        recommendations:
          primaryRecommendations.length > 0 ? primaryRecommendations : fallbackRecommendations,
      },
    } as UnifiedConciergeResponse;
  }, [liveUnified, backendUnified, lastUnified]);

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

  const chatThreadId =
    activeThreadId !== 0 ? String(activeThreadId) : typeof thread?.id === "number" ? String(thread.id) : null;

  const element4 = useMemo(
    () =>
      sessionState.temporaryBirthdate
        ? birthdateToElement4(sessionState.temporaryBirthdate)
        : null,
    [sessionState.temporaryBirthdate],
  );

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
  const isUiPaywall =
    stopReason === "paywall" ||
    displayUnified?.limitReached === true ||
    ((displayUnified?.plan === "anonymous" || displayUnified?.plan === "free") &&
      typeof displayUnified?.remaining === "number" &&
      displayUnified.remaining <= 0);

  const baseFilters: ConciergeChatFilters = useMemo(() => {
    const bd = normalizeBirthdateInput(sessionState.temporaryBirthdate ?? "") ?? undefined;
    const extra = extraCondition.trim() || undefined;

    const crowd: ConciergeChatFilters["crowd"] = [];
    let duration_max_min: number | undefined;

    if (extra?.includes("ひとり") || extra?.includes("空いて")) crowd.push("quiet");
    if (extra?.includes("駅近")) duration_max_min = 30;

    return {
      birthdate: bd,
      goriyaku_tag_ids: selectedTagIds.length ? selectedTagIds : undefined,
      extra_condition: extra,
      crowd: crowd.length ? crowd : undefined,
      duration_max_min,
      free_text: extra,
    };
  }, [sessionState.temporaryBirthdate, selectedTagIds, extraCondition]);

  const buildConciergePayload = useCallback(
    (
      input?: Partial<Omit<ConciergeChatRequestV1, "thread_id">> & {
        query?: string;
        crowd?: ConciergeChatFilters["crowd"];
        duration_max_min?: number;
        free_text?: string;
      },
    ): Omit<ConciergeChatRequestV1, "thread_id"> => {
      const birthdate = normalizeBirthdateInput(sessionState.temporaryBirthdate ?? "") ?? undefined;
      const query = (input?.query ?? needText).trim();

     return {
       version: input?.version ?? 1,
       mode: input?.mode ?? "need",
       query,
       birthdate: input?.birthdate ?? birthdate,
       filters: {
         birthdate: input?.birthdate ?? birthdate,
         goriyaku_tag_ids: input?.goriyaku_tag_ids ?? baseFilters.goriyaku_tag_ids,
         extra_condition: input?.extra_condition ?? baseFilters.extra_condition,
         crowd: input?.crowd ?? baseFilters.crowd,
         duration_max_min: input?.duration_max_min ?? baseFilters.duration_max_min,
         free_text: input?.free_text ?? input?.extra_condition ?? baseFilters.free_text,
       },
       goriyaku_tag_ids: input?.goriyaku_tag_ids ?? baseFilters.goriyaku_tag_ids,
       extra_condition: input?.extra_condition ?? baseFilters.extra_condition,
     };
    },
    [sessionState.temporaryBirthdate, needText, baseFilters],
  );

  const hasFilter =
    (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 || !!baseFilters.birthdate || !!baseFilters.extra_condition;

  const selectedTagNames = useMemo(() => {
    if (!goriyakuTags.length || !selectedTagIds.length) return [];
    const set = new Set(selectedTagIds);
    return goriyakuTags.filter((t) => set.has(t.id)).map((t) => t.name);
  }, [goriyakuTags, selectedTagIds]);

  const normalizedBirthdate = normalizeBirthdateInput(sessionState.temporaryBirthdate ?? "") ?? "";

  const filterState = useMemo(
    () => ({
      isOpen: isFilterOpen,
      birthdate: normalizedBirthdate,
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
      normalizedBirthdate,
      element4,
      goriyakuTags,
      suggestedTags,
      selectedTagIds,
      tagsLoading,
      tagsError,
      extraCondition,
    ],
  );

  const payload = useMemo(
    () => buildPayloadFromUnified(displayUnified, filterState) ?? buildDummySections(filterState),
    [displayUnified, filterState],
  );




  const messages = useMemo(
    () => deriveMessages(events, thread?.id ?? activeThreadId),
    [events, thread, activeThreadId],
  );

  /* ----------------------------------------
   * チャット
   * -------------------------------------- */
  const { send, sending, error } = useConciergeChat(chatThreadId, {
    debugLabel: "ConciergeClientFull",
    filters: baseFilters,

    onUnified: (u) => {
      if (isClosingRef.current) return;

      const now = new Date().toISOString();
      const nextTid = Number((u as any)?.thread?.id ?? (u as any)?.thread_id ?? (u as any)?.data?.thread_id ?? 0) || 0;
      const currentTid = activeThreadIdRef.current;
      const fromEntry = currentTid === 0;

      snap("onUnified:in", {
        nextTid,
        currentTid,
        thread: u.thread,
        threadId: u.thread?.id,
        isEntryRoute,
        hasRecs: Array.isArray(u.data?.recommendations) ? u.data.recommendations.length : 0,
      });

      conciergeLog("unified_received", {
        tid: typeof u.thread?.id === "number" ? u.thread.id : currentTid,
        meta: {
          fromEntry,
          hasReply: !!u.reply,
          stopReason: u.stop_reason ?? null,
          hasRecs: Array.isArray(u.data?.recommendations) ? u.data.recommendations.length : 0,
        },
      });

      setLiveUnified(u);
      setLiveRecs(Array.isArray(u.data?.recommendations) ? (u.data.recommendations as any) : []);

      if (isAnonymousLikeUnified(u)) {
        saveAnonymousSnapshot({
          version: 1,
          savedAt: new Date().toISOString(),
          unified: u,
          filters: {
            selectedTagIds,
            extraCondition,
          },
          session: {
            sessionNickname: sessionState.sessionNickname,
          },
        });
      }

      if (currentTid === 0) {
        snap("onUnified:setEntrySubmitting_false", {});
        setEntrySubmitting(false);

        if (nextTid === 0) {
          conciergeLog("thread_missing", {
            tid: currentTid,
            meta: {
              nextTid,
              path: window.location.pathname + window.location.search,
            },
            level: "warn",
          });
        } else {
          snap("nav:replace", { to: `/concierge?tid=${nextTid}`, reason: "onUnified" });
          navReplace(`/concierge?tid=${nextTid}`, { reason: "onUnified" });
        }
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

  /* ----------------------------------------
   * ロック統一：isBusy
   * -------------------------------------- */
  const isBusy = sending || (isEntryRoute && entrySubmitting);

  /* ----------------------------------------
   * 安全な送信関数（共通化）
   * -------------------------------------- */
  const safeSend = useCallback(
    async (
      textOrPayload: any,
      logMeta?: Record<string, any>,
      options?: { ignoreStopReason?: boolean },
    ) => {
      snap("safeSend:start", { isEntryRoute, sending, entrySubmitting, canSend });
      const ignoreStopReason = options?.ignoreStopReason === true;
      const effectiveCanSend = ignoreStopReason ? true : canSend;

      if (!effectiveCanSend) {
        snap("safeSend:blocked_canSend", { ignoreStopReason });
        return;
      }
      if (sending) {
        snap("safeSend:blocked_sending", {});
        return;
      }
      if (isEntryRoute && entrySubmitting) {
        snap("safeSend:blocked_entrySubmitting", {});
        return;
      }

      const isEntrySend = isEntryRoute;

      if (isEntrySend) {
        snap("safeSend:setEntrySubmitting_true", {});
        setEntrySubmitting(true);
        setLiveUnified(null);
        setLiveRecs([]);
      }

      const normalizedPayload =
        typeof textOrPayload === "string"
          ? buildConciergePayload({
              query: textOrPayload,
            })
          : buildConciergePayload({
              ...(textOrPayload ?? {}),
              version: textOrPayload?.version ?? 1,
              query: typeof textOrPayload?.query === "string" ? textOrPayload.query : undefined,
            });

      try {
        if (logMeta) {
          conciergeLog("entry_send", {
            tid: activeThreadIdRef.current,
            meta: { ...logMeta, isEntryRoute },
          });
        }

        await (send as any)(normalizedPayload);
        snap("safeSend:awaited", {});
      } catch (e) {
        snap("safeSend:error", { e: String(e) });
      } finally {
        snap("safeSend:finally", { isEntryRoute, sending, entrySubmitting });
        if (isEntrySend) {
          snap("safeSend:finally_setEntrySubmitting_false", {});
          setEntrySubmitting(false);
        }
      }
    },
    [canSend, sending, entrySubmitting, send, isEntryRoute, buildConciergePayload],
  );

  /* ----------------------------------------
   * UI表示の判定
   * -------------------------------------- */
  const hasRestoredCandidates =
    hydrated &&
    isEntryRoute &&
    Array.isArray(displayRecommendations) &&
    displayRecommendations.length > 0 &&
    isRecommendationsPayload(payload);

  const shouldShowEntry = hydrated && isEntryRoute && !hasRestoredCandidates;
  const shouldShowThreadRenderer = hydrated && !shouldShowEntry;
  const hideChatPanel = !hydrated || (isEntryRoute && !hasRestoredCandidates);


  const entryViewedRef = useRef(false);

  useEffect(() => {
    if (!shouldShowEntry) return;
    if (entryViewedRef.current) return;
    entryViewedRef.current = true;
    snap("entry_view", {});
    conciergeLog("entry_view", {
      tid: 0,
      meta: {},
    });
  }, [shouldShowEntry]);

  

  useEffect(() => {
    if (!isEntryRoute && entrySubmitting) {
      snap("entry:left_route_clear_submitting", {});
      setEntrySubmitting(false);
    }
  }, [isEntryRoute, entrySubmitting]);

  useEffect(() => {
    if (!entrySubmitting) return;
    if (sending) return;
    if (!error) return;

    snap("error:clear_entrySubmitting", { error: String(error) });

    conciergeLog("error", {
      tid: activeThreadIdRef.current,
      meta: {
        message: String(error),
        entrySubmitting,
        sending,
        path: window.location.pathname + window.location.search,
      },
      level: "error",
    });

    setEntrySubmitting(false);
  }, [entrySubmitting, sending, error]);

  /* ----------------------------------------
   * 入口UI
   * -------------------------------------- */
  const feelExamples = [
    {
      label: "最近ちょっと疲れている",
      text: "最近ちょっと疲れていて、落ち着ける神社がいいです",
    },
    {
      label: "前向きになれる参拝がしたい",
      text: "気持ちを切り替えて前向きになれる参拝がしたいです",
    },
    {
      label: "静かな場所で参拝したい",
      text: "人が少なくて静かな場所でお参りしたいです",
    },
  ] as const;

  const onPickExample = (text: string) => {
    setNeedText(text);
    snap("action:pick_example", { text });
  };

  const buildFilterPayload = useCallback((): Omit<ConciergeChatRequestV1, "thread_id"> | null => {
    const hasFilterInput =
      !!normalizeBirthdateInput(sessionState.temporaryBirthdate ?? "") ||
      (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 ||
      !!baseFilters.extra_condition;

    const hasQuery = needText.trim().length > 0;

    if (!hasFilterInput && !hasQuery) return null;

    return buildConciergePayload();
  }, [
    sessionState.temporaryBirthdate,
    baseFilters.goriyaku_tag_ids,
    baseFilters.extra_condition,
    needText,
    buildConciergePayload,
  ]);

  /* ----------------------------------------
   * UIアクション
   * -------------------------------------- */
  const onRendererAction = (a: RendererAction) => {
    snap("action:renderer", { type: a.type });

    switch (a.type) {
      case "open_map":
        navPush("/map", { reason: "open_map" });
        return;

      case "save_concierge_thread":
        snap("action:save_concierge_thread", {
          tid: activeThreadIdRef.current,
          canSaveConciergeThread,
          isLoggedIn,
        });

        conciergeLog("save_concierge_thread_click", {
          tid: activeThreadIdRef.current,
          meta: {
            canSaveConciergeThread,
            isLoggedIn,
            path: window.location.pathname + window.location.search,
          },
        });

        if (!canSaveConciergeThread) {
          redirectToAuth("login");
          return;
        }

        // 現時点では server 保存API未接続。
        // 認証済みユーザーは、thread URL がある状態自体を保存済み導線とみなす。
        return;

      case "back_to_entry":
        snap("action:back_to_entry", { fromTid: activeThreadIdRef.current });
        conciergeLog("back_to_entry", {
          tid: activeThreadIdRef.current,
          meta: { fromTid: activeThreadIdRef.current },
        });
        setLiveUnified(null);
        setLiveRecs([]);
        setEntrySubmitting(false);
        setNeedText("");
        setActiveTid(0);
        clearAnonymousSnapshot();
        setSessionState((prev) => ({
          ...prev,
          sessionNickname: null,
          temporaryBirthdate: null,
        }));
        snap("nav:push", { to: "/concierge", reason: "back_to_entry" });
        router.push("/concierge");
        return;

      case "filter_close":
        snap("action:filter_close", { isEntryRoute });
        setIsFilterOpen(false);
        return;

      case "add_condition":
        snap("action:add_condition", {});
        setIsFilterOpen(true);
        return;

      case "filter_apply": {
        const p = buildFilterPayload();
        const compatPayload = p
          ? {
              ...p,
              mode: "compat" as const,
            }
          : null;
        if (!compatPayload) return;
        snap("action:filter_apply", { baseFilters, payload: compatPayload });
        conciergeLog("filter_apply", {
          tid: activeThreadIdRef.current,
          meta: { baseFilters, payload: compatPayload },
        });
        if (!isEntryRoute) {
          setIsFilterOpen(false);
        }
        void safeSend(compatPayload, { kind: "filter_apply" }, { ignoreStopReason: true });
        return;
      }

      case "filter_set_birthdate":
        setSessionState((prev) => ({
          ...prev,
          temporaryBirthdate: a.birthdate,
        }));
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
        setExtraCondition((a.extraCondition ?? "").toString());
        return;

      case "filter_clear":
        snap("action:filter_clear", {});
        conciergeLog("filter_clear", { tid: activeThreadIdRef.current });
        setExtraCondition("");
        setSelectedTagIds([]);
        setSessionState((prev) => ({
          ...prev,
          temporaryBirthdate: null,
          sessionNickname: null,
        }));
        clearAnonymousSnapshot();
        return;
    }
  };

  /* ========================================
   * JSX
   * ====================================== */
  return (
    <ConciergeLayout
      messages={messages}
      sending={sending}
      error={error}
      hideChatPanel={hideChatPanel}
      onSend={(text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        snap("action:onSend", { textLen: trimmed.length });
        void safeSend(trimmed, { kind: "chat" });
      }}
      onNewThread={() => {
        snap("action:onNewThread", {});
        setLiveUnified(null);
        setLiveRecs([]);
        setEntrySubmitting(false);
        setNeedText("");
        setActiveTid(0);
        clearAnonymousSnapshot();
        snap("nav:replace", { to: "/concierge", reason: "onNewThread" });
        router.replace("/concierge");
      }}
      canSend={canSend}
      embedMode={false}
      hasCandidates={hasCandidates}
    >
      {/* ===== 入口（tidなし） ===== */}
      {shouldShowEntry ? (
        <div className="px-4 pt-4">
          <div
            className={`relative ${conciergeCardClass}`}
          >
            {/* ロック中のオーバーレイ */}
            {isBusy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">選定中です…</div>
              </div>
            ) : null}

            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {displayName
                ? `${displayLabel}さん向けに、今の状態に合う神社を探します。`
                : "今の状態に合う神社を探します。"}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-semibold text-slate-600">呼び名（任意）</label>
              <input
                type="text"
                value={sessionState.sessionNickname ?? ""}
                onChange={(e) =>
                  setSessionState((prev) => ({
                    ...prev,
                    sessionNickname: e.target.value,
                  }))
                }
                placeholder="例: えつこ"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                maxLength={20}
              />
            </div>
            {!canSaveConciergeThread ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p>未ログインでも検索できます。保存にはログインが必要です。</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    onClick={() => redirectToAuth("login")}
                  >
                    ログイン
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => redirectToAuth("register")}
                  >
                    新規登録
                  </button>
                </div>
              </div>
            ) : null}
            {/* コンテンツ */}
            <div className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">今の気持ち・状況・願いごと</label>
                <textarea
                  value={needText}
                  onChange={(e) => setNeedText(e.target.value)}
                  placeholder="今の気分・願い・状況を、そのまま書いてください"
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600">入力例</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {feelExamples.map((example) => {
                    const isSelected = needText.trim() === example.text;
                    return (
                      <button
                        key={example.label}
                        type="button"
                        className={[
                          "rounded-full border px-3 py-2 text-sm font-semibold transition shadow-sm",
                          isSelected
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-slate-300 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100",
                          "disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none",
                        ].join(" ")}
                        onClick={() => onPickExample(example.text)}
                        disabled={isBusy || !canSend}
                        aria-pressed={isSelected}
                        title={example.text}
                      >
                        {example.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 active:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isBusy || !needText.trim() || !canSend}
                  onClick={() =>
                    void safeSend(needText.trim(), { kind: "need_submit", textLen: needText.trim().length })
                  }
                >
                  この内容で探す
                </button>

                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={isBusy}
                  onClick={() => setNeedText("")}
                >
                  クリア
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">希望を補足する</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">誕生日や希望条件を追加して、候補を絞れます。</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => setIsFilterOpen((prev) => !prev)}
                    disabled={isBusy}
                  >
                    {isFilterOpen ? "閉じる" : "条件を追加する"}
                  </button>
                </div>

                {!isFilterOpen && hasFilter ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600">追加済みの条件</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {baseFilters.birthdate ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              誕生日あり
                            </span>
                          ) : null}

                          {selectedTagNames.length ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              希望: {selectedTagNames[0]}
                              {selectedTagNames.length > 1 ? ` 他${selectedTagNames.length - 1}` : ""}
                            </span>
                          ) : null}

                          {baseFilters.extra_condition ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                              希望の補足あり
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                        onClick={() => onRendererAction({ type: "filter_clear" })}
                        disabled={isBusy}
                      >
                        クリア
                      </button>
                    </div>
                  </div>
                ) : null}

                {SHOW_NEW_RENDERER && isFilterOpen ? (
                  <div className="mt-3">
                    <ConciergeSectionsRenderer
                      payload={payload}
                      onAction={onRendererAction}
                      sending={sending}
                      threadId={thread?.id ?? activeThreadId}
                      isEntryRoute={isEntryRoute}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            {!isBusy && isUiPaywall ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800">無料回数を使い切りました。</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">続けるにはログイン、または有料プランへの切り替えが必要です。</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => redirectToAuth("login")}
                  >
                    ログイン
                  </button>
                  <Link
                    href="/billing/upgrade"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    有料プランを見る
                  </Link>
                </div>
              </div>
            ) : null}

            {/* エラー表示 */}
            {!isBusy && error ? (
              <div className={`mt-3 ${conciergeCardClass}`}>
                <p className="text-sm font-semibold text-rose-600">うまく取得できませんでした</p>
                <div className="mt-2 grid gap-2">
                  <Link
                    href="/map"
                    className="w-full rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    近い神社を地図で見る
                  </Link>
                  <button
                    type="button"
                    className="w-full rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      snap("action:error_retry_filter", {});
                      setIsFilterOpen(true);
                    }}
                  >
                    補助条件を見直して再挑戦
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ===== 通常（tidあり） ===== */}
      {hydrated && shouldShowThreadRenderer ? (
        SHOW_NEW_RENDERER ? (
          <div className="p-4 space-y-3">
            <ConciergeSectionsRenderer
              payload={payload}
              onAction={onRendererAction}
              sending={sending}
              threadId={thread?.id ?? activeThreadId}
              isEntryRoute={isEntryRoute}
            />

            {!isBusy && isUiPaywall ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-800">無料回数を使い切りました。</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">続けるにはログイン、または有料プランへの切り替えが必要です。</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => redirectToAuth("login")}
                  >
                    ログイン
                  </button>
                  <Link
                    href="/billing/upgrade"
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    有料プランを見る
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="p-4">
            <div className={`${conciergeCardClass} text-sm text-slate-600`}>
              SHOW_NEW_RENDERER が false です（この画面は新レンダラー前提）
            </div>
          </div>
        )
      ) : null}
    </ConciergeLayout>
  );
}
