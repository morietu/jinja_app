// apps/web/src/app/concierge/ConciergeClientFull.tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat, useConciergeThreads } from "@/features/concierge/hooks";
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
import ConciergeEntryCard from "@/features/concierge/components/ConciergeEntryCard";
import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";
import { buildConciergeRequestPayload } from "@/features/concierge/buildConciergeRequestPayload";

import type { RendererAction, ConciergeSectionsPayload } from "@/features/concierge/sections/types";
import { getGoriyakuTags } from "@/lib/api/tags";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBilling } from "@/features/billing/hooks/useBilling";
import { isAuthRequiredForAction } from "@/lib/auth/actionGuards";
import { initialConciergeSessionState, type ConciergeSessionState } from "@/features/concierge/types";
import { resolveDisplayLabel, resolveDisplayName } from "@/lib/profile/resolveDisplayName";
import { normalizeBirthday as normalizeProfileBirthday } from "@/lib/profile/derivedProfile";
import type { UserOrigin } from "../../../../../packages/shared/userOrigin";

import { conciergeLog } from "@/lib/log/concierge";
import { EVT_CLOSE_CONCIERGE } from "@/lib/events";
const conciergeCardClass =
  "rounded-3xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-6";

import { isValidISODate, normalizeBirthdateInput } from "@/lib/date/normalizeBirthdateInput";
import { track } from "@/lib/analytics/track";
import { trackWebDirection } from "@/lib/analytics/directionEvents";
import { buildPreviousConsultationSummary } from "@/lib/concierge/buildPreviousConsultationSummary";
import { compareState } from "@/lib/concierge/compareState";
import PremiumStateDeltaCard from "@/features/concierge/components/PremiumStateDeltaCard";

import { resolveAccessLevel } from "@/lib/premium/accessLevel";
import { getVisibilityForCard } from "@/lib/premium/cardVisibility";
import { trackCardEvent } from "@/lib/analytics/cardEvents";

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

function isBirthdateOnlyText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return normalizeBirthdateInput(trimmed) !== null;
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

  const recommendationsV2 =
    (Array.isArray(dataLike?.recommendations_v2) ? dataLike.recommendations_v2 : null) ??
    (Array.isArray(root?.recommendations_v2) ? root.recommendations_v2 : null) ??
    null;

  const recommendations =
    recommendationsV2 ??
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
      recommendations_v2: recommendationsV2,
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

function ConciergeDebugPanel({ unified }: { unified: UnifiedConciergeResponse | null }) {
  if (process.env.NEXT_PUBLIC_ENABLE_CONCIERGE_DEBUG_PANEL !== "1") return null;

  const data = (unified?.data ?? {}) as any;
  const debug = data?._debug && typeof data._debug === "object" ? data._debug : null;
  const signals = data?._signals && typeof data._signals === "object" ? data._signals : null;
  const mode = signals?.mode && typeof signals.mode === "object" ? signals.mode : null;

  if (!debug && !mode) return null;

  const candidatePool = debug?.candidate_pool_observation ?? null;
  const visitStyle = debug?.visit_style_observation ?? null;
  const rankingBreakdown = debug?.ranking_breakdown_observation ?? null;
  const trim = debug?.trim_observation ?? null;

  return (
    <details className="mt-4 rounded-2xl border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-slate-700">
      <summary className="cursor-pointer select-none font-semibold text-slate-700">Debug: concierge response</summary>

      <div className="mt-3 grid gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="font-semibold text-slate-800">Flow / Mode</p>
          <dl className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <dt className="text-slate-400">mode</dt>
              <dd className="font-mono text-slate-700">{String(mode?.mode ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-slate-400">flow</dt>
              <dd className="font-mono text-slate-700">{String(mode?.flow ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-slate-400">llm_used</dt>
              <dd className="font-mono text-slate-700">{String(signals?.llm?.used ?? "-")}</dd>
            </div>
            <div>
              <dt className="text-slate-400">fallback</dt>
              <dd className="font-mono text-slate-700">{String(signals?.result_state?.fallback_mode ?? "-")}</dd>
            </div>
          </dl>
        </section>

        {candidatePool ? (
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-800">Candidate Pool Observation</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-slate-400">valid</dt>
                <dd className="font-mono text-slate-700">{String(candidatePool.valid_candidate_count ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">with_place_id</dt>
                <dd className="font-mono text-slate-700">{String(candidatePool.with_place_id ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">distance_none</dt>
                <dd className="font-mono text-slate-700">{String(candidatePool.distance_none ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">missing_latlng</dt>
                <dd className="font-mono text-slate-700">{String(candidatePool.missing_latlng ?? "-")}</dd>
              </div>
            </dl>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(
                {
                  filter_context: candidatePool.filter_context ?? {},
                  score_top10: candidatePool.score_top10 ?? [],
                },
                null,
                2,
              )}
            </pre>
          </section>
        ) : null}

        {rankingBreakdown ? (
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-800">Ranking Breakdown Observation</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-slate-400">ranked_count</dt>
                <dd className="font-mono text-slate-700">{String(rankingBreakdown.ranked_count ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">top1_score</dt>
                <dd className="font-mono text-slate-700">
                  {String(rankingBreakdown.top10?.[0]?.score_total_ranked ?? "-")}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">top1_name</dt>
                <dd className="font-mono text-slate-700">{String(rankingBreakdown.top10?.[0]?.name ?? "-")}</dd>
              </div>
            </dl>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(rankingBreakdown.top10 ?? [], null, 2)}
            </pre>
          </section>
        ) : null}

        {visitStyle ? (
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-800">Visit Style Observation</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-slate-400">pool_size</dt>
                <dd className="font-mono text-slate-700">{String(visitStyle.pool_size ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">hit_count</dt>
                <dd className="font-mono text-slate-700">{String(visitStyle.hit_count ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">matched_tags</dt>
                <dd className="font-mono text-slate-700">
                  {Object.keys(visitStyle.matched_tag_counts ?? {}).join(", ") || "-"}
                </dd>
              </div>
            </dl>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(visitStyle.rows ?? [], null, 2)}
            </pre>
          </section>
        ) : null}

        {trim ? (
          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="font-semibold text-slate-800">Trim Observation</p>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div>
                <dt className="text-slate-400">before</dt>
                <dd className="font-mono text-slate-700">{String(trim.before_count ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">after</dt>
                <dd className="font-mono text-slate-700">{String(trim.after_count ?? "-")}</dd>
              </div>
              <div>
                <dt className="text-slate-400">dropped</dt>
                <dd className="font-mono text-slate-700">{String(trim.dropped_count ?? "-")}</dd>
              </div>
            </dl>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-slate-900 p-2 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(trim.dropped ?? [], null, 2)}
            </pre>
          </section>
        ) : null}
      </div>
    </details>
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
  const filterApplyPendingRef = useRef(false);

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
  const billing = useBilling();
  const isPremiumActive = billing.status?.plan === "premium" && billing.status?.is_active === true;

  const accessLevel = resolveAccessLevel(billing.status, isLoggedIn);
  const previousComparisonVisibility = getVisibilityForCard("previous_comparison", accessLevel);
  const historyShiftVisibility = getVisibilityForCard("history_shift", accessLevel);
  const deepReflectionVisibility = getVisibilityForCard("deep_reflection", accessLevel);

  const canSaveConciergeThread = !isAuthRequiredForAction("save_concierge_thread") || isLoggedIn;
  const { threads } = useConciergeThreads();

  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState(0);
  const [plannedVisitDate, setPlannedVisitDate] = useState("");
  const [userOrigin, setUserOrigin] = useState<UserOrigin | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const activeThreadIdRef = useRef(0);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [extraCondition, setExtraCondition] = useState("");
  // Level 2 Visit Preference (Structured, canonical tags). Session-scoped
  // like extraCondition -- not persisted as Personal Profile data. See
  // docs/product/concierge-input-architecture.md Addendum: Level 2 Visit
  // Preference Signal Redesign.
  const [visitPreferences, setVisitPreferences] = useState<string[]>([]);

  const [goriyakuTags, setGoriyakuTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [sessionState, setSessionState] = useState<ConciergeSessionState>(initialConciergeSessionState);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [needText, setNeedText] = useState("");
  const [entryValidationError, setEntryValidationError] = useState<string | null>(null);
  const autoSubmitThemeRef = useRef<string | null>(null);
  const autoSubmitConsumedThemeRef = useRef<string | null>(null);

  useEffect(() => {
    const theme = (sp.get("theme") ?? "").trim();
    if (!theme) return;
    if (autoSubmitConsumedThemeRef.current === theme) return;

    autoSubmitThemeRef.current = theme;
    setNeedText((current) => (current.trim() ? current : theme));
  }, [sp]);

  useEffect(() => {
    const openFilter = (sp.get("openFilter") ?? "").trim();
    if (openFilter !== "1") return;

    setIsFilterOpen(true);
  }, [sp]);

  const displayName = useMemo(
    () =>
      resolveDisplayName({
        sessionNickname: sessionState.sessionNickname,
        profileNickname: user?.profile?.nickname ?? null,
      }),
    [sessionState.sessionNickname, user?.profile?.nickname],
  );

  const displayLabel = useMemo(
    () =>
      resolveDisplayLabel({
        sessionNickname: sessionState.sessionNickname,
        profileNickname: user?.profile?.nickname ?? null,
      }),
    [sessionState.sessionNickname, user?.profile?.nickname],
  );

  const [liveUnified, setLiveUnified] = useState<UnifiedConciergeResponse | null>(null);
  const [liveRecs, setLiveRecs] = useState<ConciergeRecommendation[]>([]);

  const [threadDetail, setThreadDetail] = useState<ConciergeThreadDetail | null>(null);
  const [previousThreadDetail, setPreviousThreadDetail] = useState<ConciergeThreadDetail | null>(null);

  const currentConsultationSummary = useMemo(() => buildPreviousConsultationSummary(threadDetail), [threadDetail]);

  const previousConsultationSummary = useMemo(
    () => buildPreviousConsultationSummary(previousThreadDetail),
    [previousThreadDetail],
  );

  const stateDelta = useMemo(
    () => compareState(previousConsultationSummary, currentConsultationSummary),
    [currentConsultationSummary, previousConsultationSummary],
  );

  const shouldTrackHistoryShiftView = Boolean(stateDelta?.transitionNarrative?.summary);
  const shouldTrackDeepReflectionView = Boolean(
    stateDelta?.combinationChange?.summary ||
    (stateDelta?.changedNeedTags?.length ?? 0) > 0 ||
    (stateDelta?.continuedNeedTags?.length ?? 0) > 0,
  );

  useEffect(() => {
    if (!isLoggedIn) return;
    if (!stateDelta) return;

    const sessionId = activeThreadId ? String(activeThreadId) : undefined;

    if (previousComparisonVisibility !== "hidden") {
      trackCardEvent({
        event: "card_view",
        cardId: "previous_comparison",
        source: "concierge_result",
        accessLevel,
        visibility: previousComparisonVisibility,
        sessionId,
      });
    }

    if (historyShiftVisibility !== "hidden" && shouldTrackHistoryShiftView) {
      trackCardEvent({
        event: "card_view",
        cardId: "history_shift",
        source: "concierge_result",
        accessLevel,
        visibility: historyShiftVisibility,
        sessionId,
      });
    }

    if (deepReflectionVisibility !== "hidden" && shouldTrackDeepReflectionView) {
      trackCardEvent({
        event: "card_view",
        cardId: "deep_reflection",
        source: "concierge_result",
        accessLevel,
        visibility: deepReflectionVisibility,
        sessionId,
      });
    }
  }, [
    accessLevel,
    activeThreadId,
    deepReflectionVisibility,
    historyShiftVisibility,
    isLoggedIn,
    previousComparisonVisibility,
    shouldTrackDeepReflectionView,
    shouldTrackHistoryShiftView,
    stateDelta,
  ]);

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

  const previousThreadId = useMemo(() => {
    if (!isLoggedIn) return null;
    const currentId = tidNum ?? activeThreadId;
    if (!currentId || !Array.isArray(threads) || threads.length === 0) return null;

    const currentIndex = threads.findIndex((t) => Number(t.id) === Number(currentId));

    if (currentIndex < 0) {
      const fallbackPreviousThread = threads.find((t) => t != null && Number(t.id) !== Number(currentId)) ?? null;

      return typeof fallbackPreviousThread?.id === "number" ? fallbackPreviousThread.id : null;
    }

    const previousThread = threads[currentIndex + 1] ?? null;
    return typeof previousThread?.id === "number" ? previousThread.id : null;
  }, [activeThreadId, isLoggedIn, threads, tidNum]);

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

  useEffect(() => {
    if (!hydrated) return;
    if (!previousThreadId) {
      setPreviousThreadDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await getConciergeThread(String(previousThreadId));
        if (cancelled) return;
        setPreviousThreadDetail(data);
      } catch {
        if (cancelled) return;
        setPreviousThreadDetail(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, previousThreadId]);

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

    const primaryRecommendationsV2 = Array.isArray(primaryData?.recommendations_v2)
      ? primaryData.recommendations_v2
      : [];
    const primaryRecommendations = Array.isArray(primaryData?.recommendations) ? primaryData.recommendations : [];
    const primaryRecommendationCandidates =
      primaryRecommendationsV2.length > 0 ? primaryRecommendationsV2 : primaryRecommendations;

    const fallbackRecommendationsV2 = Array.isArray(fallbackData?.recommendations_v2)
      ? fallbackData.recommendations_v2
      : [];
    const fallbackRecommendations = Array.isArray(fallbackData?.recommendations) ? fallbackData.recommendations : [];
    const fallbackRecommendationCandidates =
      fallbackRecommendationsV2.length > 0 ? fallbackRecommendationsV2 : fallbackRecommendations;

    const recommendations =
      primaryRecommendationCandidates.length > 0 ? primaryRecommendationCandidates : fallbackRecommendationCandidates;

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
        recommendations,
        recommendations_v2: primaryRecommendationsV2.length > 0 ? primaryRecommendationsV2 : fallbackRecommendationsV2,
      },
    } as UnifiedConciergeResponse;
  }, [liveUnified, backendUnified, lastUnified]);

  const displayRecommendations = useMemo(() => {
    if (liveRecs.length > 0) return liveRecs;
    const recsV2 = displayUnified?.data?.recommendations_v2;
    const recs = displayUnified?.data?.recommendations;
    if (Array.isArray(recsV2) && recsV2.length > 0) return recsV2 as ConciergeRecommendation[];
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
    () => (sessionState.temporaryBirthdate ? birthdateToElement4(sessionState.temporaryBirthdate) : null),
    [sessionState.temporaryBirthdate],
  );

  const suggestedTags = useMemo(() => {
    if (!element4) return [];
    if (!Array.isArray(goriyakuTags) || goriyakuTags.length === 0) return [];
    const names = ELEMENT_TO_GORIYAKU[element4] ?? [];
    const setNames = new Set(names);
    return goriyakuTags.filter((t) => setNames.has(t.name));
  }, [element4, goriyakuTags]);

  const rawStopReason: StopReason =
    process.env.NODE_ENV !== "production" && forced ? forced : (displayUnified?.stop_reason ?? null);
  const stopReason: StopReason = isPremiumActive && rawStopReason === "paywall" ? null : rawStopReason;
  const canSend = stopReason === null || isPremiumActive || (process.env.NODE_ENV !== "production" && !!forced);
  const isUiPaywall =
    !isPremiumActive &&
    (stopReason === "paywall" ||
      displayUnified?.limitReached === true ||
      ((displayUnified?.plan === "anonymous" || displayUnified?.plan === "free") &&
        typeof displayUnified?.remaining === "number" &&
        displayUnified.remaining <= 0));

  const baseFilters: ConciergeChatFilters = useMemo(() => {
    const savedBirthday = normalizeProfileBirthday(user?.profile?.birthday);
    const bd = normalizeBirthdateInput(sessionState.temporaryBirthdate ?? "") ?? savedBirthday;
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
  }, [sessionState.temporaryBirthdate, selectedTagIds, extraCondition, user?.profile?.birthday]);

  const buildConciergePayload = useCallback(
    (
      input?: Partial<Omit<ConciergeChatRequestV1, "thread_id">> & {
        query?: string;
        crowd?: ConciergeChatFilters["crowd"];
        duration_max_min?: number;
        free_text?: string;
      },
    ): Omit<ConciergeChatRequestV1, "thread_id"> =>
      buildConciergeRequestPayload({
        needText,
        temporaryBirthdate: sessionState.temporaryBirthdate,
        savedProfile: user?.profile,
        baseFilters,
        visitPreferences,
        plannedVisitDate,
        userOrigin,
        input,
      }),
    [
      sessionState.temporaryBirthdate,
      needText,
      baseFilters,
      user?.profile,
      plannedVisitDate,
      userOrigin,
      visitPreferences,
    ],
  );

  const useCurrentLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("このブラウザでは現在地を取得できません。");
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserOrigin({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          source: "device",
          displayName: "現在地",
          accuracy: "precise",
        });
        trackWebDirection("direction_origin_result", { origin_type: "device", result: "success" });
      },
      (error) => {
        setLocationError("現在地を取得できませんでした。位置情報の許可を確認してください。");
        trackWebDirection("direction_origin_result", {
          origin_type: "device",
          result: error.code === 1 ? "denied" : "failed",
        });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  const hasFilter =
    (baseFilters.goriyaku_tag_ids?.length ?? 0) > 0 ||
    !!baseFilters.birthdate ||
    !!baseFilters.extra_condition ||
    visitPreferences.length > 0 ||
    !!plannedVisitDate ||
    !!userOrigin;

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
      visitPreferences,
      plannedVisitDate,
      userOrigin,
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
      visitPreferences,
      plannedVisitDate,
      userOrigin,
    ],
  );

  const payload = useMemo(
    () => buildPayloadFromUnified(displayUnified, filterState) ?? buildDummySections(filterState),
    [displayUnified, filterState],
  );

  const modeAnalyticsPayload = useMemo(() => {
    const modeRaw = (displayUnified?.data as any)?._signals?.mode;
    const mode = modeRaw?.mode === "need" || modeRaw?.mode === "compat" ? modeRaw.mode : undefined;
    const flow = modeRaw?.flow === "A" || modeRaw?.flow === "B" ? modeRaw.flow : undefined;
    const topRecommendation = displayRecommendations[0] as Record<string, unknown> | undefined;
    const data = (displayUnified?.data as any) ?? {};
    const signals = data?._signals ?? {};
    const resultState = signals?.result_state ?? signals?.resultState ?? {};
    const historyTheme =
      typeof topRecommendation?.history_theme === "string"
        ? topRecommendation.history_theme
        : typeof topRecommendation?.historyTheme === "string"
          ? topRecommendation.historyTheme
          : undefined;
    const consultationAxis =
      typeof topRecommendation?.consultation_axis === "string"
        ? topRecommendation.consultation_axis
        : typeof topRecommendation?.consultationAxis === "string"
          ? topRecommendation.consultationAxis
          : typeof data?.consultation_axis === "string"
            ? data.consultation_axis
            : typeof data?.consultationAxis === "string"
              ? data.consultationAxis
              : typeof data?._need?.consultation_axis === "string"
                ? data._need.consultation_axis
                : typeof data?._need?.consultationAxis === "string"
                  ? data._need.consultationAxis
                  : typeof signals?.consultation_axis === "string"
                    ? signals.consultation_axis
                    : typeof signals?.consultationAxis === "string"
                      ? signals.consultationAxis
                      : typeof resultState?.consultation_axis === "string"
                        ? resultState.consultation_axis
                        : typeof resultState?.consultationAxis === "string"
                          ? resultState.consultationAxis
                          : undefined;

    return {
      mode,
      flow,
      hasBirthdate: Boolean(normalizedBirthdate),
      recommendationCount: displayRecommendations.length,
      historyTheme,
      ...(consultationAxis ? { consultationAxis } : {}),
    };
  }, [displayUnified, displayRecommendations, normalizedBirthdate]);

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

      const completedRecommendations = Array.isArray((u.data as any)?.recommendations_v2)
        ? (u.data as any).recommendations_v2
        : Array.isArray(u.data?.recommendations)
          ? u.data.recommendations
          : [];

      const completedModeRaw = (u.data as any)?._signals?.mode;
      const completedTopRecommendation = completedRecommendations[0] as Record<string, unknown> | undefined;
      const completedData = (u.data as any) ?? {};
      const completedSignals = completedData?._signals ?? {};
      const completedResultState = completedSignals?.result_state ?? completedSignals?.resultState ?? {};
      const completedHistoryTheme =
        typeof completedTopRecommendation?.history_theme === "string"
          ? completedTopRecommendation.history_theme
          : typeof completedTopRecommendation?.historyTheme === "string"
            ? completedTopRecommendation.historyTheme
            : undefined;
      const completedConsultationAxis =
        typeof completedTopRecommendation?.consultation_axis === "string"
          ? completedTopRecommendation.consultation_axis
          : typeof completedTopRecommendation?.consultationAxis === "string"
            ? completedTopRecommendation.consultationAxis
            : typeof completedData?.consultation_axis === "string"
              ? completedData.consultation_axis
              : typeof completedData?.consultationAxis === "string"
                ? completedData.consultationAxis
                : typeof completedData?._need?.consultation_axis === "string"
                  ? completedData._need.consultation_axis
                  : typeof completedData?._need?.consultationAxis === "string"
                    ? completedData._need.consultationAxis
                    : typeof completedSignals?.consultation_axis === "string"
                      ? completedSignals.consultation_axis
                      : typeof completedSignals?.consultationAxis === "string"
                        ? completedSignals.consultationAxis
                        : typeof completedResultState?.consultation_axis === "string"
                          ? completedResultState.consultation_axis
                          : typeof completedResultState?.consultationAxis === "string"
                            ? completedResultState.consultationAxis
                            : undefined;

      track("consultation_completed", {
        threadId: nextTid || currentTid ? String(nextTid || currentTid) : undefined,
        mode: completedModeRaw?.mode,
        flow: completedModeRaw?.flow,
        hasBirthdate: Boolean(normalizedBirthdate || baseFilters.birthdate),
        recommendationCount: completedRecommendations.length,
        historyTheme: completedHistoryTheme,
        ...(completedConsultationAxis ? { consultationAxis: completedConsultationAxis } : {}),
        source: fromEntry ? "entry" : "thread",
      });
      if (filterApplyPendingRef.current) {
        const recommendationCount = Array.isArray(u.data?.recommendations) ? u.data.recommendations.length : 0;

        track("filter_result", {
          source: "concierge_result",
          threadId: nextTid || currentTid ? String(nextTid || currentTid) : undefined,
          mode: "compat",
          recommendation_count: recommendationCount,
          is_zero_result: recommendationCount === 0,
          hasFilter,
        });

        filterApplyPendingRef.current = false;
      }

      setLiveUnified(u);
      const unifiedRecommendationsV2 = Array.isArray(u.data?.recommendations_v2) ? u.data.recommendations_v2 : [];
      const unifiedRecommendations = Array.isArray(u.data?.recommendations) ? u.data.recommendations : [];
      setLiveRecs((unifiedRecommendationsV2.length > 0 ? unifiedRecommendationsV2 : unifiedRecommendations) as any);

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
  const isBusy = sending || isFiltering || (isEntryRoute && entrySubmitting);
  const hasExecutableQuery = buildConciergePayload().query.trim().length > 0;
  const canApply = hasExecutableQuery && !isBusy;

  /* ----------------------------------------
   * 安全な送信関数（共通化）
   * -------------------------------------- */
  const safeSend = useCallback(
    async (textOrPayload: any, logMeta?: Record<string, any>, options?: { ignoreStopReason?: boolean }) => {
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

      const rawInputQuery = typeof textOrPayload === "string" ? textOrPayload : textOrPayload?.query;
      const normalizedInputBirthdate =
        typeof rawInputQuery === "string" ? normalizeBirthdateInput(rawInputQuery) : null;

      if (typeof rawInputQuery === "string" && isBirthdateOnlyText(rawInputQuery)) {
        setSessionState((prev) => ({
          ...prev,
          temporaryBirthdate: normalizedInputBirthdate,
        }));
        setNeedText("");
        setEntryValidationError("生年月日は補助条件として受け取りました。今の状態も一言添えてください。");
        snap("safeSend:blocked_birthdate_only_query", { birthdate: normalizedInputBirthdate });
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

      if (!normalizedPayload.query.trim()) {
        setEntryValidationError("今の状態を一言だけ入力してください。");
        snap("safeSend:blocked_empty_query", { hasBirthdate: !!normalizedPayload.birthdate });
        if (isEntrySend) {
          setEntrySubmitting(false);
        }
        return;
      }

      setEntryValidationError(null);

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

  useEffect(() => {
    const theme = autoSubmitThemeRef.current;
    if (!theme) return;
    if (!hydrated) return;
    if (!isEntryRoute) return;
    if (!canSend) return;
    if (sending) return;
    if (entrySubmitting) return;

    autoSubmitThemeRef.current = null;
    autoSubmitConsumedThemeRef.current = theme;
    setNeedText(theme);
    setEntryValidationError(null);
    void safeSend(theme, { kind: "home_theme_submit", textLen: theme.length });
  }, [canSend, entrySubmitting, hydrated, isEntryRoute, safeSend, sending]);

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

  const shouldShowEntryError = !isBusy && !isFiltering && !entryValidationError && !!error && !hasCandidates;

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
      label: "仕事について考えたい",
      text: "仕事や働き方について、今の流れを整理したいです",
    },
    {
      label: "人との関係を整えたい",
      text: "人との関係やご縁について、落ち着いて見つめ直したいです",
    },
    {
      label: "お金の流れを整えたい",
      text: "お金や生活の流れについて、不安を整理して次の動きを考えたいです",
    },
    {
      label: "一歩踏み出したい",
      text: "迷いを整理して、次の一歩を踏み出すきっかけがほしいです",
    },
    {
      label: "少し休みたい",
      text: "最近少し疲れていて、気持ちを落ち着ける時間がほしいです",
    },
    {
      label: "体調を整えたい",
      text: "心身の調子を整えて、無理なく過ごせるようにしたいです",
    },
    {
      label: "学びを深めたい",
      text: "学びや積み重ねに向き合い、集中し直すきっかけがほしいです",
    },
    {
      label: "これからを考えたい",
      text: "これからの方向性について、静かに考え直す時間がほしいです",
    },
  ] as const;

  const onPickExample = (example: { label: string; text: string }) => {
    // チップは固定診断ではなく入力補助なので、既存の自由入力欄を置き換えてから編集可能にする。
    setNeedText(example.text);
    setEntryValidationError(null);
    track("consultation_theme_click", {
      label: example.label,
      text: example.text,
      source: "concierge_entry",
    });
    snap("action:pick_example", { label: example.label, text: example.text });
  };

  const buildFilterPayload = useCallback((): Omit<ConciergeChatRequestV1, "thread_id"> | null => {
    const payload = buildConciergePayload();

    if (!payload.query.trim()) return null;

    return payload;
  }, [buildConciergePayload]);

  /* ----------------------------------------
   * UIアクション
   * -------------------------------------- */
  const onRendererAction = (a: RendererAction) => {
    snap("action:renderer", { type: a.type });

    switch (a.type) {
      case "open_map": {
        if (typeof a.shrineId === "number") {
          track("shrine_decision", {
            shrineId: a.shrineId,
            action: "route",
            rank: typeof a.rank === "number" ? a.rank : null,
            tid: activeThreadIdRef.current || null,
            ...(modeAnalyticsPayload.consultationAxis
              ? { consultationAxis: modeAnalyticsPayload.consultationAxis }
              : {}),
          });
        }

        const routeHref = typeof a.routeHref === "string" && a.routeHref.length > 0 ? a.routeHref : null;
        if (routeHref) {
          window.location.assign(routeHref);
          return;
        }

        navPush("/map", { reason: "open_map_fallback", shrineId: a.shrineId ?? null, rank: a.rank ?? null });
        return;
      }

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
        trackCardEvent({
          event: "card_cta_click",
          cardId: "filter_panel",
          source: "concierge_result",
          accessLevel,
          visibility: "visible",
          ctaType: "back_to_entry",
          ...modeAnalyticsPayload,
          threadId: activeThreadIdRef.current ? String(activeThreadIdRef.current) : undefined,
        });
        conciergeLog("back_to_entry", {
          tid: activeThreadIdRef.current,
          meta: { fromTid: activeThreadIdRef.current },
        });
        setLiveUnified(null);
        setLiveRecs([]);
        setIsFiltering(false);
        setEntrySubmitting(false);
        setNeedText("");
        setEntryValidationError(null);
        setActiveTid(0);
        clearAnonymousSnapshot();
        setSessionState((prev) => ({
          ...prev,
          sessionNickname: null,
          temporaryBirthdate: null,
        }));
        navReplace("/concierge", { reason: "back_to_entry" });
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
        filterApplyPendingRef.current = true;
        trackCardEvent({
          event: "card_cta_click",
          cardId: "filter_panel",
          source: "concierge_result",
          accessLevel,
          visibility: "visible",
          ctaType: "filter_apply",
          ...modeAnalyticsPayload,
          threadId: activeThreadIdRef.current ? String(activeThreadIdRef.current) : undefined,
        });
        conciergeLog("filter_apply", {
          tid: activeThreadIdRef.current,
          meta: { baseFilters, payload: compatPayload },
        });
        if (!isEntryRoute) {
          setIsFilterOpen(false);
        }
        setIsFiltering(true);
        void safeSend(compatPayload, { kind: "filter_apply" }, { ignoreStopReason: true }).finally(() => {
          setIsFiltering(false);
        });
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

      case "filter_set_visit_preferences":
        setVisitPreferences(Array.isArray(a.visitPreferences) ? a.visitPreferences : []);
        return;

      case "filter_set_visit_date":
        setPlannedVisitDate(a.plannedVisitDate);
        if (a.plannedVisitDate) {
          trackWebDirection("direction_visit_date_set");
        }
        return;

      case "filter_set_origin":
        setUserOrigin(a.userOrigin);
        if (a.userOrigin) {
          trackWebDirection("direction_origin_result", {
            origin_type: a.userOrigin.source,
            result: "selected",
          });
        }
        return;

      case "filter_use_current_location":
        useCurrentLocation();
        return;

      case "filter_clear":
        snap("action:filter_clear", {});
        conciergeLog("filter_clear", { tid: activeThreadIdRef.current });
        setExtraCondition("");
        setVisitPreferences([]);
        setSelectedTagIds([]);
        setPlannedVisitDate("");
        setUserOrigin(null);
        setLocationError(null);
        setEntryValidationError(null);
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
        if (!trimmed) {
          setEntryValidationError("今の状態を一言だけ入力してください。");
          return;
        }
        snap("action:onSend", { textLen: trimmed.length });
        void safeSend(trimmed, { kind: "chat" });
      }}
      onNewThread={() => {
        snap("action:onNewThread", {});
        setLiveUnified(null);
        setLiveRecs([]);
        setIsFiltering(false);
        setEntrySubmitting(false);
        setNeedText("");
        setEntryValidationError(null);
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
        <div className="px-4 pt-6">
          <div className={`relative ${conciergeCardClass}`}>
            {isBusy ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-[var(--kt-color-overlay-default)] backdrop-blur-sm">
                <div className="rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-1.5 text-sm text-[var(--kt-color-text-secondary)]">
                  選定中です…
                </div>
              </div>
            ) : null}

            <ConciergeEntryCard
              displayName={displayName}
              displayLabel={displayLabel}
              sessionState={sessionState}
              setSessionNickname={(value) =>
                setSessionState((prev) => ({
                  ...prev,
                  sessionNickname: value,
                }))
              }
              canSaveConciergeThread={canSaveConciergeThread}
              isUiPaywall={isUiPaywall}
              redirectToAuth={redirectToAuth}
              needText={needText}
              setNeedText={setNeedText}
              feelExamples={feelExamples}
              onPickExample={onPickExample}
              isBusy={isBusy}
              canSend={canSend}
              onSubmit={() => {
                trackWebDirection("direction_condition_submitted", {
                  has_visit_date: !!plannedVisitDate,
                  has_origin: !!userOrigin,
                });
                void safeSend(needText.trim(), { kind: "need_submit", textLen: needText.trim().length });
              }}
              onClear={() => {
                setNeedText("");
                setEntryValidationError(null);
              }}
            />

            {/* Personalize: Level 2 Visit Preference + Level 3-A Personal
                Profile + Level 3-B Explicit Constraint + Level 3-C
                Recommendation Context, collapsed by default (Task 5-8,
                docs/audit/concierge-l1-freetext-final-readiness.md
                Decision: L2/L3 collapsed by default = Yes). Grouped under
                one disclosure (Task 10's 3-state model), but each
                responsibility keeps its own labeled subsection so they are
                not shown as one undifferentiated "条件" pile (Task 11). */}
            <div className="mt-5 rounded-3xl border border-stone-200/45 bg-stone-50/60 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.2em] text-stone-500">
                    もう少し自分に合わせる（任意）
                  </p>
                  <p className="mt-0.5 text-[11px] text-stone-500">
                    参拝の希望・誕生日・ご利益・参拝の詳細は、相談テーマを補う条件として扱います。
                  </p>
                </div>
                {!isFilterOpen ? (
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-stone-200/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
                    onClick={() => setIsFilterOpen(true)}
                    disabled={isBusy}
                  >
                    条件を開く
                  </button>
                ) : null}
              </div>

              {!isFilterOpen && hasFilter ? (
                <div className="mt-4 rounded-2xl border border-stone-200/50 bg-white/80 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium text-stone-500">相談に添えた条件</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {baseFilters.birthdate ? (
                          <span className="rounded-full border border-stone-200/70 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                            誕生日を補助条件に追加
                          </span>
                        ) : null}

                        {selectedTagNames.length ? (
                          <span className="rounded-full border border-stone-200/70 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                            ご利益: {selectedTagNames[0]}
                            {selectedTagNames.length > 1 ? ` 他${selectedTagNames.length - 1}` : ""}
                          </span>
                        ) : null}

                        {baseFilters.extra_condition ? (
                          <span className="rounded-full border border-stone-200/70 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                            参拝スタイルあり
                          </span>
                        ) : null}

                        {plannedVisitDate ? (
                          <span className="rounded-full border border-stone-200/70 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                            参拝予定日あり
                          </span>
                        ) : null}

                        {userOrigin ? (
                          <span className="rounded-full border border-stone-200/70 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                            出発地点あり
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                      onClick={() => onRendererAction({ type: "filter_clear" })}
                      disabled={isBusy}
                    >
                      条件をクリア
                    </button>
                  </div>
                </div>
              ) : null}

              {isFilterOpen ? (
                <div className="mt-3">
                  <ConciergeSectionsRenderer
                    payload={payload}
                    analyticsContext={modeAnalyticsPayload}
                    onAction={onRendererAction}
                    sending={sending || isFiltering}
                    canApply={canApply}
                    locationError={locationError}
                    threadId={thread?.id ?? activeThreadId}
                    isEntryRoute={isEntryRoute}
                    isPremiumActive={isPremiumActive}
                  />
                </div>
              ) : null}
            </div>

            {!isBusy && isUiPaywall ? (
              <div className="mt-5 rounded-3xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-5 py-4 text-sm text-[var(--kt-color-text-secondary)]">
                <p className="font-medium text-[var(--kt-color-text-primary)]">無料回数を使い切りました。</p>
                <p className="mt-1 text-xs leading-6 text-[var(--kt-color-text-muted)]">
                  {isLoggedIn
                    ? "続けるには有料プランへの切り替えが必要です。"
                    : "続けるにはログイン、または有料プランへの切り替えが必要です。"}
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {!isLoggedIn ? (
                    <button
                      type="button"
                      className="w-full rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm font-medium text-[var(--kt-color-text-secondary)] sm:w-auto"
                      onClick={() => redirectToAuth("login")}
                    >
                      ログイン
                    </button>
                  ) : null}
                  <Link
                    href="/billing/upgrade"
                    className="w-full rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-background-subtle)] px-4 py-2 text-center text-sm font-medium text-[var(--kt-color-action-primary)] sm:w-auto"
                  >
                    有料プランを見る
                  </Link>
                </div>
              </div>
            ) : null}

            {!isBusy && entryValidationError ? (
              <div className="mt-3 rounded-3xl border border-[var(--kt-color-status-warning)] bg-[var(--kt-color-background-subtle)] px-5 py-4 text-sm text-[var(--kt-color-status-warning)]">
                <p className="font-medium">{entryValidationError}</p>
              </div>
            ) : null}

            {shouldShowEntryError ? (
              <div className={`mt-3 ${conciergeCardClass}`}>
                <p className="text-sm font-semibold text-[var(--kt-color-status-error)]">うまく取得できませんでした</p>
                <div className="mt-2 grid gap-2">
                  <Link
                    href="/map"
                    className="w-full rounded-xl bg-[var(--kt-color-action-primary)] px-4 py-2 text-center text-sm font-semibold text-[var(--kt-color-action-primary-text)]"
                  >
                    近い神社を地図で見る
                  </Link>
                  <button
                    type="button"
                    className="w-full rounded-xl border bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm font-semibold text-[var(--kt-color-text-secondary)] hover:bg-[var(--kt-color-background-subtle)]"
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
        <div className="p-4 space-y-5">
          {isFiltering ? (
            <div className="rounded-3xl border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-background-subtle)] px-5 py-4 text-sm text-[var(--kt-color-action-primary)]">
              <p className="font-semibold">条件に合わせて再提案しています</p>
              <p className="mt-1 text-xs leading-6 text-[var(--kt-color-text-muted)]">
                候補を絞り直しているため、少しだけお待ちください。
              </p>
            </div>
          ) : null}
          <ConciergeSectionsRenderer
            payload={payload}
            analyticsContext={modeAnalyticsPayload}
            onAction={onRendererAction}
            sending={sending || isFiltering}
            canApply={canApply}
            locationError={locationError}
            threadId={thread?.id ?? activeThreadId}
            isEntryRoute={isEntryRoute}
            isPremiumActive={isPremiumActive}
          />

          {isLoggedIn && stateDelta && previousComparisonVisibility !== "hidden" ? (
            <PremiumStateDeltaCard stateDelta={stateDelta} isPremium={isPremiumActive} />
          ) : null}

          <ConciergeDebugPanel unified={displayUnified} />

          {!isBusy && isUiPaywall ? (
            <div className="rounded-3xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-5 py-4 text-sm text-[var(--kt-color-text-secondary)]">
              <p className="font-medium text-[var(--kt-color-text-primary)]">無料回数を使い切りました。</p>
              <p className="mt-1 text-xs leading-6 text-[var(--kt-color-text-muted)]">
                {isLoggedIn
                  ? "続けるには有料プランへの切り替えが必要です。"
                  : "続けるにはログイン、または有料プランへの切り替えが必要です。"}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {!isLoggedIn ? (
                  <button
                    type="button"
                    className="w-full rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm font-medium text-[var(--kt-color-text-secondary)] sm:w-auto"
                    onClick={() => redirectToAuth("login")}
                  >
                    ログイン
                  </button>
                ) : null}
                <Link
                  href="/billing/upgrade"
                  className="w-full rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-background-subtle)] px-4 py-2 text-center text-sm font-medium text-[var(--kt-color-action-primary)] sm:w-auto"
                >
                  有料プランを見る
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </ConciergeLayout>
  );
}
