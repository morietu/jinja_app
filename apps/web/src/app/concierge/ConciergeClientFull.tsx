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

import { conciergeLog } from "@/lib/log/concierge";
import { EVT_CLOSE_CONCIERGE } from "@/lib/events";
const conciergeCardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm p-6";

/* ========================================
 * 型定義とデータ設定
 * ====================================== */
type Element4 = "火" | "地" | "風" | "水";
type Tag = { id: number; name: string };

type AssistantStateEvent = { type: "assistant_state"; unified: UnifiedConciergeResponse; at: string };
type LocalEvent = ChatEvent | AssistantStateEvent;

type EventsByThread = Record<number, LocalEvent[]>;
type EntryMode = "feel" | "filter";

const STORAGE_KEY = "concierge:eventsByThread";
const LS_ENTRY_MODE = "concierge:entryMode";

type AnonymousConciergeSnapshot = {
  version: 1;
  savedAt: string;
  entryMode: EntryMode;
  unified: UnifiedConciergeResponse;
  filters: {
    selectedTagIds: number[];
    extraCondition: string;
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

/* ========================================
 * 便利な関数群
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

function resolveAccessState(u: UnifiedConciergeResponse | null | undefined) {
  return {
    reply: typeof u?.reply === "string" ? u.reply : null,
    plan: u?.plan ?? null,
    remaining: typeof u?.remaining === "number" ? u.remaining : null,
    limit: typeof u?.limit === "number" ? u.limit : null,
    limitReached: u?.limitReached === true,
  };
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

type ViewerTier = "anonymous" | "free" | "premium";


type ConciergeCtaKind = "none" | "auth" | "premium";
type ConciergeInfoBannerState =
  | "anonymous_default"
  | "anonymous_limited"
  | "free_default"
  | "free_limited"
  | "premium_hidden";

type ConciergeInfoBannerConfig = {
  state: ConciergeInfoBannerState;
  visible: boolean;
  showLimitNote: boolean;
  ctaKind: ConciergeCtaKind;
};

function resolveConciergeInfoBanner(args: {
  viewerTier: ViewerTier;
  isLimitReached: boolean;
}): ConciergeInfoBannerConfig {
  const { viewerTier, isLimitReached } = args;

  if (viewerTier === "premium") {
    return {
      state: "premium_hidden",
      visible: false,
      showLimitNote: false,
      ctaKind: "none",
    };
  }

  if (viewerTier === "anonymous") {
    return {
      state: isLimitReached ? "anonymous_limited" : "anonymous_default",
      visible: true,
      showLimitNote: isLimitReached,
      ctaKind: "auth",
    };
  }

  return {
    state: isLimitReached ? "free_limited" : "free_default",
    visible: true,
    showLimitNote: isLimitReached,
    ctaKind: "premium",
  };
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

  const [me, setMe] = useState<any | null>(null);
  const [billingPlan, setBillingPlan] = useState<ViewerTier | null>(null);
  const [billingStatusChecked, setBillingStatusChecked] = useState(false);

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

  const [entrySubmitting, setEntrySubmitting] = useState(false);

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

  const rawMode = useMemo(() => (sp.get("mode") ?? "").trim(), [sp]);

  /* ----------------------------------------
   * entryMode（LS）
   * -------------------------------------- */
  const [entryMode, setEntryMode] = useState<EntryMode>(() => {
    if (typeof window === "undefined") return "filter";
    const v = localStorage.getItem(LS_ENTRY_MODE);
    return v === "feel" ? "feel" : "filter";
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_ENTRY_MODE, entryMode);
    } catch {
      // ignore
    }
  }, [entryMode]);

  // ?mode=feel/filter を直叩き
  useEffect(() => {
    snap("url:mode_effect", { rawMode, isEntryRoute });
    if (!isEntryRoute) return;
    if (!rawMode) return;
    setEntryMode(rawMode === "feel" ? "feel" : "filter");
    snap("nav:replace", { to: "/concierge", reason: "mode_cleanup" });
    router.replace("/concierge");
  }, [rawMode, isEntryRoute, router]);

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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/users/me/", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) setMe(null);
          return;
        }

        const data = await res.json();
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/billings/status/", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (!cancelled) {
            setBillingPlan(me ? "free" : "anonymous");
            setBillingStatusChecked(true);
          }
          return;
        }

        const data = await res.json();

        const nextPlan: ViewerTier =
          data?.plan === "premium"
            ? "premium"
            : me
              ? "free"
              : "anonymous";

        if (!cancelled) {
          setBillingPlan(nextPlan);
          setBillingStatusChecked(true);
        }
      } catch {
        if (!cancelled) {
          setBillingPlan(me ? "free" : "anonymous");
          setBillingStatusChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [me]);

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

    setEntryMode(snapshot.entryMode ?? "filter");
    setSelectedTagIds(Array.isArray(snapshot.filters.selectedTagIds) ? snapshot.filters.selectedTagIds : []);
    setExtraCondition(snapshot.filters.extraCondition ?? "");
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
      } catch (e) {
        if (cancelled) return;
        console.warn("getConciergeThread failed", e);
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
    return liveUnified ?? backendUnified ?? lastUnified;
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

  const baseFilters: ConciergeChatFilters = useMemo(() => {
    const bd = normalizeISODate(birthdate) ?? undefined;
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
  }, [birthdate, selectedTagIds, extraCondition]);

  const hasFilter =
    (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 || !!baseFilters.birthdate || !!baseFilters.extra_condition;

  const selectedTagNames = useMemo(() => {
    if (!goriyakuTags.length || !selectedTagIds.length) return [];
    const set = new Set(selectedTagIds);
    return goriyakuTags.filter((t) => set.has(t.id)).map((t) => t.name);
  }, [goriyakuTags, selectedTagIds]);

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

  const payload = useMemo(
    () => buildPayloadFromUnified(displayUnified, filterState) ?? buildDummySections(filterState),
    [displayUnified, filterState],
  );

  const accessState = useMemo(() => resolveAccessState(displayUnified), [displayUnified]);
  const metaReply = accessState.reply;
  const isLimitReached = accessState.limitReached;

  const rawViewer = sp.get("viewer");

  const debugViewer: ViewerTier | null =
    rawViewer === "anonymous" || rawViewer === "free" || rawViewer === "premium" ? rawViewer : null;

  const effectiveViewerTier: ViewerTier =
    debugViewer ?? billingPlan ?? (billingStatusChecked ? (me ? "free" : "anonymous") : "anonymous");

  const debugLimitReached = sp.get("limit") === "1";
  const resolvedIsLimitReached = debugLimitReached || isLimitReached;

  const infoBanner = useMemo(
    () =>
      resolveConciergeInfoBanner({
        viewerTier: effectiveViewerTier,
        isLimitReached: resolvedIsLimitReached,
      }),
    [effectiveViewerTier, resolvedIsLimitReached],
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
          entryMode,
          unified: u,
          filters: {
            selectedTagIds,
            extraCondition,
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
    async (textOrPayload: any, logMeta?: Record<string, any>) => {
      snap("safeSend:start", { isEntryRoute, sending, entrySubmitting, canSend });

      if (!canSend) {
        snap("safeSend:blocked_canSend", {});
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

      try {
        if (logMeta) {
          conciergeLog("entry_send", {
            tid: activeThreadIdRef.current,
            meta: { ...logMeta, isEntryRoute, entryMode },
          });
        }

        await (send as any)(textOrPayload);
        snap("safeSend:awaited", {});
      } catch (e) {
        snap("safeSend:error", { e: String(e) });
        console.warn("[SEND] failed", e);
      } finally {
        snap("safeSend:finally", { isEntryRoute, sending, entrySubmitting });
        if (isEntrySend) {
          snap("safeSend:finally_setEntrySubmitting_false", {});
          setEntrySubmitting(false);
        }
      }
    },
    [canSend, sending, entrySubmitting, send, isEntryRoute, entryMode],
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
  const hideChatPanel = !hydrated || (isEntryRoute && !hasRestoredCandidates);

  const entryViewedRef = useRef(false);

  useEffect(() => {
    if (!shouldShowEntry) return;
    if (entryViewedRef.current) return;
    entryViewedRef.current = true;
    snap("entry_view", { entryMode });
    conciergeLog("entry_view", {
      tid: 0,
      meta: { entryMode },
    });
  }, [shouldShowEntry, entryMode]);

  useEffect(() => {
    if (!shouldShowEntry) return;
    if (entryMode === "filter") setIsFilterOpen(true);
  }, [entryMode, shouldShowEntry]);

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
    "最近ちょっと疲れていて、落ち着ける神社がいいです",
    "気持ちを切り替えて前向きになれる参拝がしたいです",
    "人が少なくて静かな場所でお参りしたいです",
  ];

  const onPickExample = (text: string) => {
    snap("action:pick_example", { text });
    void safeSend(text, { kind: "example", textLen: text.length });
  };

  const buildFilterPayload = useCallback((): Omit<ConciergeChatRequestV1, "thread_id"> | null => {
    const has =
      (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 || !!baseFilters.birthdate || !!baseFilters.extra_condition;

    if (!has) return null;
    return { version: 1, query: "条件を追加して絞り込みたいです。" };
  }, [baseFilters]);

  /* ----------------------------------------
   * UIアクション
   * -------------------------------------- */
  const onRendererAction = (a: RendererAction) => {
    snap("action:renderer", { type: a.type });

    switch (a.type) {
      case "open_map":
        navPush("/map", { reason: "open_map" });
        return;

      case "back_to_entry":
        snap("action:back_to_entry", { fromTid: activeThreadIdRef.current, entryMode });
        conciergeLog("back_to_entry", {
          tid: activeThreadIdRef.current,
          meta: { fromTid: activeThreadIdRef.current, entryMode },
        });
        setLiveUnified(null);
        setLiveRecs([]);
        setEntrySubmitting(false);
        setActiveTid(0);
        clearAnonymousSnapshot();
        snap("nav:push", { to: "/concierge", reason: "back_to_entry" });
        router.push("/concierge");
        return;

      case "filter_close":
        snap("action:filter_close", { isEntryRoute, entryMode });
        conciergeLog("filter_close", {
          tid: activeThreadIdRef.current,
          meta: { isEntryRoute, entryMode },
        });
        if (isEntryRoute) setIsFilterOpen(true);
        else setIsFilterOpen(false);
        return;

      case "add_condition":
        snap("action:add_condition", {});
        setIsFilterOpen(true);
        return;

      case "filter_apply": {
        const p = buildFilterPayload();
        if (!p) return;
        snap("action:filter_apply", { baseFilters });
        conciergeLog("filter_apply", {
          tid: activeThreadIdRef.current,
          meta: { baseFilters },
        });
        setIsFilterOpen(true);
        void safeSend(p, { kind: "filter_apply" });
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
        setExtraCondition((a.extraCondition ?? "").toString());
        return;

      case "filter_clear":
        snap("action:filter_clear", {});
        conciergeLog("filter_clear", { tid: activeThreadIdRef.current });
        setExtraCondition("");
        setSelectedTagIds([]);
        setBirthdate("");
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
          <div className={`relative ${conciergeCardClass}`}>
            {/* ロック中のオーバーレイ */}
            {isBusy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-sm">
                <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">選定中です…</div>
              </div>
            ) : null}

            {/* タブ */}
            <div className="flex gap-2">
              <button
                type="button"
                className={[
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold border",
                  entryMode === "feel" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700",
                ].join(" ")}
                onClick={() => {
                  snap("action:entryMode_feel", {});
                  setEntryMode("feel");
                  setIsFilterOpen(false);
                }}
                disabled={isBusy}
              >
                気分から探す
              </button>

              <button
                type="button"
                className={[
                  "flex-1 rounded-xl px-3 py-2 text-sm font-semibold border",
                  entryMode === "filter" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700",
                ].join(" ")}
                onClick={() => {
                  snap("action:entryMode_filter", {});
                  setEntryMode("filter");
                  setIsFilterOpen(true);
                }}
                disabled={isBusy}
              >
                条件で絞る
              </button>
            </div>

            {/* 入口でも条件チップ */}
            {hasFilter ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {baseFilters.birthdate ? (
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">
                    誕生日: {baseFilters.birthdate}
                  </span>
                ) : null}

                {selectedTagNames.length ? (
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">
                    ご利益: {selectedTagNames.slice(0, 2).join(" / ")}
                    {selectedTagNames.length > 2 ? ` 他${selectedTagNames.length - 2}` : ""}
                  </span>
                ) : null}

                {baseFilters.extra_condition ? (
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold">補足: あり</span>
                ) : null}

                <button
                  type="button"
                  className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  onClick={() => onRendererAction({ type: "filter_clear" })}
                  disabled={isBusy}
                >
                  クリア
                </button>
              </div>
            ) : null}

            {/* コンテンツ */}
            {entryMode === "feel" ? (
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-600">例（タップで送信）</p>
                <div className="mt-2 grid gap-2">
                  {feelExamples.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="text-left rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-60"
                      onClick={() => onPickExample(t)}
                      disabled={isBusy || !canSend}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  1回送るだけでOK。会話はしない設計です（必要なら質問は1つだけ返します）。
                </p>
              </div>
            ) : (
              <div className="mt-3">
                {SHOW_NEW_RENDERER ? (
                  <ConciergeSectionsRenderer
                    payload={payload}
                    onAction={onRendererAction}
                    sending={sending}
                    threadId={thread?.id ?? activeThreadId}
                    isEntryRoute={isEntryRoute}
                  />
                ) : (
                  <div className={`${conciergeCardClass} bg-slate-50 text-sm text-slate-700`}>
                    この画面は SHOW_NEW_RENDERER 前提です
                  </div>
                )}
              </div>
            )}

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
                      setEntryMode("filter");
                    }}
                  >
                    条件で絞って再挑戦
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* ===== 通常（tidあり） ===== */}
      {!shouldShowEntry ? (
        SHOW_NEW_RENDERER ? (
          <div className="p-4 space-y-3">
            {/* メタリプライ＋情報バナー */}
            {infoBanner.visible ? (
              <div className={conciergeCardClass}>
                {metaReply ? <p className="text-sm font-semibold text-slate-900">{metaReply}</p> : null}

                {infoBanner.showLimitNote ? (
                  <p className="mt-1 text-xs text-slate-500">
                    近くの神社は地図から探せます。条件を変えるか、別の探索を試してください。
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => onRendererAction({ type: "add_condition" })}
                    disabled={isBusy}
                  >
                    条件を追加
                  </button>

                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => onRendererAction({ type: "open_map" })}
                    disabled={isBusy}
                  >
                    地図で探す
                  </button>

                  {infoBanner.ctaKind === "auth" ? (
                    <Link
                      href="/auth/login"
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white"
                    >
                      ログインして続ける
                    </Link>
                  ) : null}

                  {infoBanner.ctaKind === "premium" ? (
                    <Link
                      href="/billing/upgrade"
                      className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white"
                    >
                      プレミアムを見る
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}

            <ConciergeSectionsRenderer
              payload={payload}
              onAction={onRendererAction}
              sending={sending}
              threadId={thread?.id ?? activeThreadId}
              isEntryRoute={isEntryRoute}
            />
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
