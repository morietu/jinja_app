"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import DetailSection from "@/components/shrine/DetailSection";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";
import ShrineSaveButton from "@/components/shrine/ShrineSaveButton";
import ConciergeFilterPanel from "@/features/concierge/components/ConciergeFilterPanel";
import ModeBadge from "@/features/concierge/components/ModeBadge";
import { buildRecommendationReasonViewModel } from "@/lib/concierge/buildRecommendationReasonViewModel";
import { adaptReasonFactsForViewModel } from "@/lib/concierge/adaptReasonFactsForViewModel";
import { buildHeroReasonV4Sections } from "@/features/concierge/buildHeroReasonV4Sections";
import { buildHeroConclusionLines } from "@/features/concierge/buildHeroConclusion";
import { buildRuntimeMatchLines } from "@/features/concierge/buildRuntimeMatchLine";
import ConciergeTopRecommendationHero from "@/features/concierge/components/ConciergeTopRecommendationHero";
import ShrineCardCompact from "@/components/shrines/ShrineCardCompact";

import { buildLoginHref } from "@/lib/nav/login";
import { resolveAccessLevel } from "@/lib/premium/accessLevel";
import { getVisibilityForCard, type CardVisibilityState } from "@/lib/premium/cardVisibility";
import ConciergeConsultationSummary from "@/features/concierge/components/ConciergeConsultationSummary";
import DirectionReferenceCard from "@/features/concierge/components/DirectionReferenceCard";

import { trackCardEvent, type CardAnalyticsPayload } from "@/lib/analytics/cardEvents";
import { trackSearchEvent } from "@/lib/analytics/searchEvents";
import { trackWebDirection } from "@/lib/analytics/directionEvents";
import { withDirectionRouteContext } from "@/lib/analytics/directionRouteContext";
import { buildRecommendationReasonDisplay } from "../../../../../../packages/shared/recommendationReasonDisplay";
import {
  buildRecommendationImpressionDedupKey,
  buildRecommendationResultSetId,
  recommendationAnalyticsProperties,
} from "../../../../../../packages/shared/recommendationAnalyticsProvenance";

import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
  RegisteredShrineItem,
  PlaceShrineItem,
  RendererAction,
} from "@/features/concierge/sections/types";

import { buildConciergeCardRoutes } from "@/lib/concierge/conciergeCardRoutes";

type MetaMode = NonNullable<ConciergeSectionsPayload["meta"]>["mode"];
type AnalyticsContext = Pick<
  CardAnalyticsPayload,
  "mode" | "flow" | "hasBirthdate" | "recommendationCount" | "historyTheme" | "consultationAxis"
>;

// Design Token v1: 実値が完全一致する箇所のみ --kt-* 参照へ置換 (docs/design/design-token.md)
const conciergeSoftCardClass =
  "rounded-[var(--kt-radius-card)] border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] shadow-[var(--kt-shadow-medium)] p-4";
// Notice専用Token（--kt-color-notice-*）へ移行済み。
// 値としてはPremium Tokenと一致していたが、本カードの意味は
// 「Notice(警告・注意喚起)」でありPremiumではないため、
// 意味の異なるTokenを流用せず専用Tokenへ分離した。
const conciergeNoticeCardClass =
  "rounded-[var(--kt-radius-card)] border border-[var(--kt-color-notice-border)] bg-[var(--kt-color-notice-bg)] shadow-[var(--kt-shadow-medium)] p-4";

// PR-G1 (docs/design/premium-meaning-ui-direction.md §3.2 / §7, Direction C):
// the recommendation reading flow is carried by typography + spacing, not by
// stacked bordered cards (audit #2656 A-C1/A-C4/A-C5). Narrative section
// headings use `<DetailSection variant="plain">` (renders an <h2> at
// `text-base font-semibold text-[--kt-color-text-primary]`); section bodies use
// this one combo. `text-[15px]` is not a new value -- it already matches
// ShrineDetailHeroHeader's body size in the codebase.
const narrativeBodyClass = "text-[15px] leading-7 text-[var(--kt-color-text-primary)]";

/**
 * Conciergeではfavorite操作を提供しない。
 *
 * 理由:
 * - 本画面は discovery / comparison の導線に特化
 * - 保存操作は shrine詳細に集約する
 * - UI責務の肥大化と状態管理の複雑化を防ぐ
 */

function normalizeConciergeMode(mode: MetaMode | null | undefined): "need" | "compat" {
  if (!mode) return "need";

  if (typeof mode === "string") {
    return mode === "compat" ? "compat" : "need";
  }

  if (typeof mode === "object") {
    if ("kind" in mode && mode.kind === "compat") return "compat";
    if ("mode" in mode && mode.mode === "compat") return "compat";
  }

  return "need";
}

function pickAnalyticsString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function consultationAxisAnalytics(
  axis: unknown,
): Pick<CardAnalyticsPayload, "consultationAxis"> | Record<string, never> {
  const consultationAxis = pickAnalyticsString(axis);
  return consultationAxis ? { consultationAxis } : {};
}

function AstroCard(props: { sunSign?: string; element?: string; reason?: string }) {
  const { sunSign, element, reason } = props;
  return (
    <DetailSection title="占星術による選定">
      <div className={conciergeNoticeCardClass}>
        <div className="text-sm font-semibold text-[var(--kt-color-text-primary)]">
          {sunSign || "不明"} / {element || "不明"}
        </div>
        <div className="mt-2 text-sm leading-7 text-[var(--kt-color-text-secondary)]">{reason || "（理由なし）"}</div>
      </div>
    </DetailSection>
  );
}

/**
 * PR-G2 (docs/design/premium-meaning-ui-direction.md §7 / §10): the single
 * Free -> Premium seam in the Concierge Result. One restrained boundary into
 * the deeper meaning layers, carrying CTA-A (Meaning Depth) exactly once.
 *
 * - Guest / Free see this instead of standalone shrine_meaning / action_meaning
 *   sections. The seam itself carries the *allowed teaser* for each card whose
 *   visibility is "teaser" -- so a "teaser" in cardVisibility.ts always
 *   corresponds to real teaser content the user can see, matching the
 *   shrine_meaning / action_meaning card_teaser_view impression events (which
 *   still fire from the effect below, unchanged). The full bodies are never
 *   rendered for "teaser" and are never masked -- they exist only under
 *   "visible".
 * - Premium never renders the seam (premium_preview = "hidden") and reads the
 *   full sections directly -- no upsell surface for someone who already has
 *   depth.
 *
 * Restrained by design: a soft `--kt-color-premium-surface` tint, no border,
 * no shadow, no PREMIUM badge / lock icon; the CTA is a text link, never a
 * filled button, so the Hero's "神社の詳細を見る" stays the only strong CTA.
 * CTA-B (continuity, PremiumStateDeltaCard) and CTA-C (quota, isUiPaywall) each
 * keep a visually distinct treatment.
 *
 * Route, analytics event + payload, and the approved CTA labels are unchanged
 * from the previous ConciergePremiumEntryCard; the per-card teaser sentences
 * are the same approved strings the standalone teaser sections used before G2.
 */
function PremiumSeam(props: {
  shrineId?: number | null;
  tid?: string | null;
  isGuestUser?: boolean;
  accessLevel: "anonymous" | "free" | "premium";
  analyticsContext?: AnalyticsContext;
  shrineMeaningVisibility: CardVisibilityState;
  actionMeaningVisibility: CardVisibilityState;
}) {
  const href = props.isGuestUser ? buildLoginHref("/billing/upgrade") : "/billing/upgrade";
  const ctaLabel = props.isGuestUser ? "ログインして意味を深掘りする" : "この神社を選ぶ意味を深掘りする";
  return (
    <section
      className="rounded-[var(--kt-radius-panel)] bg-[var(--kt-color-premium-surface)] px-4 py-4"
      data-testid="recommendation-premium-preview"
    >
      <div className="space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--kt-color-premium-accent)]">
          ここから、より深い意味へ
        </p>
        {props.shrineMeaningVisibility === "teaser" ? (
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            この神社が選ばれた深い理由は、Premiumで読めます。
          </p>
        ) : null}
        {props.actionMeaningVisibility === "teaser" ? (
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            参拝で意識することの意味づけは、Premiumで読めます。
          </p>
        ) : null}
        {/* Text link, not a filled button: Hero's "神社の詳細を見る" must stay the
            only strong CTA (recommendation-result-information-architecture.md §6/§11). */}
        <a
          href={href}
          className="inline-flex items-center text-sm font-semibold text-[var(--kt-color-premium-accent)] underline underline-offset-2 hover:opacity-80"
          onClick={() => {
            trackCardEvent({
              event: "premium_preview_click",
              cardId: "premium_preview",
              source: "concierge_result",
              accessLevel: props.accessLevel,
              visibility: "teaser",
              ctaType: "continue_with_premium",
              ...props.analyticsContext,
              ...consultationAxisAnalytics(props.analyticsContext?.consultationAxis),
              shrineId: props.shrineId ?? undefined,
              threadId: props.tid ?? undefined,
            });
          }}
        >
          {ctaLabel}
        </a>
      </div>
    </section>
  );
}

type Props = {
  payload: ConciergeSectionsPayload;
  onAction?: (action: RendererAction) => void;
  sending?: boolean;
  threadId?: number | null;
  isEntryRoute?: boolean;
  isPremiumActive?: boolean;
  analyticsContext?: AnalyticsContext;
};

// extraCondition (Legacy/Transitional free-text) を表示用トークンへ分解する。
// 用途は下の appliedLabel（結果の近くに出る「条件: X / Y」チップ）のみで、
// 入力UIは持たない。参拝Preferenceの入力は ConciergeFilterPanel が正本。
function parseExtraTokens(extra: string | undefined | null): string[] {
  return (extra || "")
    .split(/[、,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildHistoryThemeDisplay(theme: string | null | undefined): { title: string; body: string } | null {
  const normalized = typeof theme === "string" ? theme.trim() : "";
  if (!normalized) return null;

  const map: Record<string, { title: string; body: string }> = {
    再出発: {
      title: "歴史的には、区切りと再出発を象徴する神社です",
      body: "過去を否定するためではなく、次へ進む前に一度流れを区切る場所として受け取りやすい候補です。",
    },
    静寂: {
      title: "歴史的には、静かに整える時間を象徴する神社です",
      body: "刺激を増やすより、外の情報から少し距離を置いて、自分の状態を見直す場所として受け取りやすい候補です。",
    },
    勝負: {
      title: "歴史的には、決断や覚悟を象徴する神社です",
      body: "結果を保証する場所ではなく、迷いを抱えながらも次に動かす方向を確認する場所として受け取りやすい候補です。",
    },
    縁: {
      title: "歴史的には、人や機会との結びつきを象徴する神社です",
      body: "関係をただ増やすのではなく、今あるつながりやこれから選びたい縁を見直す場所として受け取りやすい候補です。",
    },
    学び: {
      title: "歴史的には、積み重ねと集中を象徴する神社です",
      body: "結果だけを急ぐより、今続ける対象を絞り、努力の向け方を整える場所として受け取りやすい候補です。",
    },
    守り: {
      title: "歴史的には、暮らしの土台を守ることを象徴する神社です",
      body: "不安を消し切るためではなく、今守りたいものや生活の土台を確認する場所として受け取りやすい候補です。",
    },
    復興: {
      title: "歴史的には、回復と立て直しを象徴する神社です",
      body: "一気に元へ戻すのではなく、疲れや停滞を抱えたまま少しずつ整え直す場所として受け取りやすい候補です。",
    },
    浄化: {
      title: "歴史的には、抱えたものを手放すことを象徴する神社です",
      body: "問題を消すためではなく、抱え込みすぎた感情や情報をいったん外へ置く場所として受け取りやすい候補です。",
    },
    導き: {
      title: "歴史的には、進む方向を見直すことを象徴する神社です",
      body: "答えを与える場所ではなく、迷いの中で次に向かう方向を静かに確認する場所として受け取りやすい候補です。",
    },
    巡り: {
      title: "歴史的には、流れや循環を象徴する神社です",
      body: "停滞を責めるのではなく、止まっている流れを小さく巡らせ直す場所として受け取りやすい候補です。",
    },
  };

  return map[normalized] ?? null;
}

function scrollToConciergeInput() {
  if (typeof window === "undefined") return;

  const scroll = () => {
    const target = document.getElementById("concierge-input");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement) {
        target.focus({ preventScroll: true });
      }
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  window.requestAnimationFrame(scroll);
  window.setTimeout(scroll, 120);
}

export default function ConciergeSectionsRenderer({
  payload,
  onAction,
  sending = false,
  threadId = null,
  isEntryRoute = false,
  isPremiumActive: isPremiumActiveProp,
  analyticsContext,
}: Props) {
  const trackedImpressionKeysRef = useRef<Set<string>>(new Set());
  const trackedCardEventKeysRef = useRef<Set<string>>(new Set());
  const [showOtherRecommendations, setShowOtherRecommendations] = useState(false);
  const otherRecommendationsId = useId();

  const { isLoggedIn, loading: authLoading } = useAuth();
  const isGuestUser = !authLoading && !isLoggedIn;

  function resolveFirstResultClick(resultSetId: string) {
    if (typeof window === "undefined") return false;

    const key = `firstClick:${resultSetId}`;

    try {
      if (window.localStorage.getItem(key)) return false;

      window.localStorage.setItem(key, "1");
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const onOpen = () => onAction?.({ type: "add_condition" });
    window.addEventListener("concierge:open-filter", onOpen);
    return () => window.removeEventListener("concierge:open-filter", onOpen);
  }, [onAction]);

  const filterState: ConciergeFilterState | null = useMemo(() => {
    const sec = payload.sections.find((s) => s.type === "filter") as any;
    return (sec?.state ?? null) as ConciergeFilterState | null;
  }, [payload]);

  const appliedTokens = parseExtraTokens(filterState?.extraCondition);
  const appliedLabel = appliedTokens.length ? `条件: ${appliedTokens.join(" / ")}` : null;
  const normalizedModeForTracking = normalizeConciergeMode(payload?.meta?.mode);
  const tid = threadId != null ? String(threadId) : null;
  const isPremiumActive =
    typeof isPremiumActiveProp === "boolean"
      ? isPremiumActiveProp
      : Boolean((payload?.meta as any)?.billing?.is_active || (payload?.meta as any)?.isPremiumActive);

  const accessLevel = resolveAccessLevel(
    {
      plan: isPremiumActive ? "premium" : "free",
      is_active: isPremiumActive,
    },
    !authLoading && isLoggedIn,
  );

  const premiumPreviewVisibility = getVisibilityForCard("premium_preview", accessLevel);
  const savePromptVisibility = getVisibilityForCard("save_prompt", accessLevel);
  const consultationSummaryVisibility = getVisibilityForCard("consultation_summary", accessLevel);
  const shrineMeaningVisibility = getVisibilityForCard("shrine_meaning", accessLevel);
  const actionMeaningVisibility = getVisibilityForCard("action_meaning", accessLevel);

  const conciergeCardRoutes = useMemo(
    () =>
      buildConciergeCardRoutes([
        { cardId: "premium_preview", visibility: premiumPreviewVisibility },
        { cardId: "save_prompt", visibility: savePromptVisibility },
        { cardId: "consultation_summary", visibility: consultationSummaryVisibility },
        { cardId: "shrine_meaning", visibility: shrineMeaningVisibility },
        { cardId: "action_meaning", visibility: actionMeaningVisibility },
      ]),
    [
      actionMeaningVisibility,
      consultationSummaryVisibility,
      premiumPreviewVisibility,
      savePromptVisibility,
      shrineMeaningVisibility,
    ],
  );

  const resultImpressions = useMemo(() => {
    if (!payload || !Array.isArray(payload.sections)) return [];

    return payload.sections.flatMap((sec: ConciergeSection) => {
      if (sec.type !== "recommendations") return [];

      const items = ((sec as any).items ?? []).filter(
        (item: RegisteredShrineItem | PlaceShrineItem): item is RegisteredShrineItem => item.kind === "registered",
      );

      return items.map((item: RegisteredShrineItem, index: number) => ({
        shrineId: item.shrineId,
        name: item.title,
        position: index === 0 ? "hero" : "compact",
        rank: index + 1,
        mode: normalizedModeForTracking,
        historyTheme:
          typeof (item as any).history_theme === "string"
            ? (item as any).history_theme
            : typeof (item as any).historyTheme === "string"
              ? (item as any).historyTheme
              : null,
        consultationAxis: pickAnalyticsString(
          (item as any).consultation_axis,
          (item as any).consultationAxis,
          payload.meta?.consultationAxis,
        ),
        analyticsProvenance: item.analyticsProvenance,
        recommendationInstanceId: item.recommendationInstanceId ?? null,
      }));
    });
  }, [payload, normalizedModeForTracking]);

  const resultSetId = useMemo(() => {
    return buildRecommendationResultSetId(tid, resultImpressions);
  }, [resultImpressions, tid]);

  useEffect(() => {
    resultImpressions.forEach((item) => {
      const impressionKey = buildRecommendationImpressionDedupKey({
        recommendationInstanceId: item.recommendationInstanceId,
        resultSetId,
        shrineId: item.shrineId,
        position: item.position,
        rank: item.rank,
      });
      if (trackedImpressionKeysRef.current.has(impressionKey)) return;

      trackedImpressionKeysRef.current.add(impressionKey);
      trackSearchEvent("concierge_result_impression", {
        source: "concierge_result",
        threadId: tid ?? undefined,
        resultSetId,
        shrineId: item.shrineId,
        position: item.position === "hero" ? "hero_primary" : "compact",
        recommendationRank: item.rank,
        mode: item.mode,
        historyTheme: item.historyTheme ?? analyticsContext?.historyTheme,
        recommendationInstanceId: item.recommendationInstanceId,
        ...consultationAxisAnalytics(item.consultationAxis ?? analyticsContext?.consultationAxis),
        ...(item.analyticsProvenance ? recommendationAnalyticsProperties(item.analyticsProvenance) : {}),
      });
    });
  }, [analyticsContext?.consultationAxis, analyticsContext?.historyTheme, resultImpressions, resultSetId, tid]);

  useEffect(() => {
    const heroItem = resultImpressions.find((item) => item.position === "hero");
    if (!heroItem) return;

    const routeByCardId = new Map(conciergeCardRoutes.map((route) => [route.cardId, route]));

    const consultationSummaryRoute = routeByCardId.get("consultation_summary");
    if (consultationSummaryRoute) {
      const consultationSummaryEventKey = `${resultSetId}:${consultationSummaryRoute.viewEvent}:consultation_summary`;

      if (!trackedCardEventKeysRef.current.has(consultationSummaryEventKey)) {
        trackedCardEventKeysRef.current.add(consultationSummaryEventKey);
        trackCardEvent({
          event: consultationSummaryRoute.viewEvent,
          cardId: "consultation_summary",
          source: "concierge_result",
          accessLevel,
          visibility: consultationSummaryRoute.visibility,
          shrineId: heroItem.shrineId,
          recommendationRank: heroItem.rank,
          mode: heroItem.mode,
          historyTheme: heroItem.historyTheme ?? analyticsContext?.historyTheme,
          ...consultationAxisAnalytics(heroItem.consultationAxis ?? analyticsContext?.consultationAxis),
          threadId: tid ?? undefined,
          resultSetId,
          recommendationInstanceId: heroItem.recommendationInstanceId ?? null,
        });
      }
    }

    const shrineMeaningRoute = routeByCardId.get("shrine_meaning");
    if (shrineMeaningRoute) {
      const shrineMeaningEventKey = `${resultSetId}:${shrineMeaningRoute.viewEvent}:shrine_meaning:${heroItem.shrineId}`;

      if (!trackedCardEventKeysRef.current.has(shrineMeaningEventKey)) {
        trackedCardEventKeysRef.current.add(shrineMeaningEventKey);
        trackCardEvent({
          event: shrineMeaningRoute.viewEvent,
          cardId: "shrine_meaning",
          source: "concierge_result",
          accessLevel,
          visibility: shrineMeaningRoute.visibility,
          shrineId: heroItem.shrineId,
          recommendationRank: heroItem.rank,
          mode: heroItem.mode,
          historyTheme: heroItem.historyTheme ?? analyticsContext?.historyTheme,
          ...consultationAxisAnalytics(heroItem.consultationAxis ?? analyticsContext?.consultationAxis),
          threadId: tid ?? undefined,
          resultSetId,
          recommendationInstanceId: heroItem.recommendationInstanceId ?? null,
        });
      }
    }

    const actionMeaningRoute = routeByCardId.get("action_meaning");
    if (actionMeaningRoute) {
      const actionMeaningEventKey = `${resultSetId}:${actionMeaningRoute.viewEvent}:action_meaning:${heroItem.shrineId}`;

      if (!trackedCardEventKeysRef.current.has(actionMeaningEventKey)) {
        trackedCardEventKeysRef.current.add(actionMeaningEventKey);
        trackCardEvent({
          event: actionMeaningRoute.viewEvent,
          cardId: "action_meaning",
          source: "concierge_result",
          accessLevel,
          visibility: actionMeaningRoute.visibility,
          shrineId: heroItem.shrineId,
          recommendationRank: heroItem.rank,
          mode: heroItem.mode,
          historyTheme: heroItem.historyTheme ?? analyticsContext?.historyTheme,
          ...consultationAxisAnalytics(heroItem.consultationAxis ?? analyticsContext?.consultationAxis),
          threadId: tid ?? undefined,
          resultSetId,
          recommendationInstanceId: heroItem.recommendationInstanceId ?? null,
        });
      }
    }

    if (!isEntryRoute) {
      const savePromptEventKey = `${resultSetId}:save_prompt_view:${accessLevel}`;
      if (!trackedCardEventKeysRef.current.has(savePromptEventKey)) {
        trackedCardEventKeysRef.current.add(savePromptEventKey);
        trackCardEvent({
          event: "save_prompt_view",
          cardId: "save_prompt",
          source: "concierge_result",
          accessLevel,
          visibility: savePromptVisibility,
          ctaType: isGuestUser ? "login_to_save" : "save",
          ...analyticsContext,
          ...consultationAxisAnalytics(analyticsContext?.consultationAxis),
          threadId: tid ?? undefined,
          resultSetId,
        });
      }
    }

    const heroEventKey = `${resultSetId}:card_view:shrine_hero:${heroItem.shrineId}`;
    if (!trackedCardEventKeysRef.current.has(heroEventKey)) {
      trackedCardEventKeysRef.current.add(heroEventKey);
      trackCardEvent({
        event: "card_view",
        cardId: "shrine_hero",
        source: "concierge_result",
        accessLevel,
        visibility: "visible",
        shrineId: heroItem.shrineId,
        recommendationRank: heroItem.rank,
        mode: heroItem.mode,
        historyTheme: heroItem.historyTheme ?? analyticsContext?.historyTheme,
        ...consultationAxisAnalytics(heroItem.consultationAxis ?? analyticsContext?.consultationAxis),
        threadId: tid ?? undefined,
        resultSetId,
      });
    }

    if (showOtherRecommendations) {
      const compactItems = resultImpressions.filter((item) => item.position === "compact");

      if (compactItems.length > 0) {
        const otherShrinesEventKey = `${resultSetId}:card_view:other_shrines`;
        if (!trackedCardEventKeysRef.current.has(otherShrinesEventKey)) {
          trackedCardEventKeysRef.current.add(otherShrinesEventKey);
          trackCardEvent({
            event: "card_view",
            cardId: "other_shrines",
            source: "concierge_result",
            accessLevel,
            visibility: "visible",
            historyTheme: analyticsContext?.historyTheme,
            ...consultationAxisAnalytics(analyticsContext?.consultationAxis),
            threadId: tid ?? undefined,
            resultSetId,
          });
        }

        compactItems.forEach((item) => {
          const compactEventKey = `${resultSetId}:card_view:shrine_compact:${item.shrineId}`;
          if (trackedCardEventKeysRef.current.has(compactEventKey)) return;

          trackedCardEventKeysRef.current.add(compactEventKey);
          trackCardEvent({
            event: "card_view",
            cardId: "shrine_compact",
            source: "concierge_result",
            accessLevel,
            visibility: "visible",
            shrineId: item.shrineId,
            recommendationRank: item.rank,
            mode: item.mode,
            historyTheme: item.historyTheme ?? analyticsContext?.historyTheme,
            ...consultationAxisAnalytics(item.consultationAxis ?? analyticsContext?.consultationAxis),
            threadId: tid ?? undefined,
            resultSetId,
          });
        });
      }
    }

    if (isPremiumActive) return;

    const premiumPreviewEventKey = `${resultSetId}:card_teaser_view:premium_preview:${heroItem.shrineId}`;
    if (trackedCardEventKeysRef.current.has(premiumPreviewEventKey)) return;

    trackedCardEventKeysRef.current.add(premiumPreviewEventKey);
    trackCardEvent({
      event: "card_teaser_view",
      cardId: "premium_preview",
      source: "concierge_result",
      accessLevel,
      visibility: "teaser",
      shrineId: heroItem.shrineId,
      recommendationRank: heroItem.rank,
      mode: heroItem.mode,
      historyTheme: heroItem.historyTheme ?? analyticsContext?.historyTheme,
      ...consultationAxisAnalytics(heroItem.consultationAxis ?? analyticsContext?.consultationAxis),
      threadId: tid ?? undefined,
      resultSetId,
    });
  }, [
    accessLevel,
    analyticsContext,
    conciergeCardRoutes,
    isGuestUser,
    isPremiumActive,
    isEntryRoute,
    resultImpressions,
    resultSetId,
    savePromptVisibility,
    showOtherRecommendations,
    tid,
  ]);

  if (!payload || !Array.isArray(payload.sections) || payload.sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4 pb-0 lg:max-w-2xl">
      {payload.sections.map((sec: ConciergeSection, i: number) => {
        switch (sec.type) {
          case "guide":
            return null;

          case "filter": {
            const state: ConciergeFilterState = (sec as any).state;
            const title = (sec as any).title ?? "条件を追加して絞る";

            const canApplyCompatFilter =
              !!state.birthdate?.trim() || (state.selectedTagIds?.length ?? 0) > 0 || !!state.extraCondition?.trim();

            // 参拝Preferenceの入力UIは ConciergeFilterPanel が正本。
            // ここには独立したQuick Preset（短縮ラベル「静か」「駅近」「ひとり」
            // 「階段少なめ」）を持たない。同じ役割のUIが2系統あると、
            // 同じ意図に対して異なるSignalが飛ぶため一本化した。
            //   静か  -> FilterPanelの「静かな時間を過ごしたい」(quiet)
            //   駅近  -> 「近場がいい」/「アクセスしやすい場所がいい」(nearby)
            // 「ひとり」「階段少なめ」はShrine側にcapabilityが無く
            // (Task 13 Shrine Data Capability Check: Hold) canonical tagを持たない
            // ため、Presetとしては提供しない。自由入力としては引き続き受け付ける
            // （ConciergeClientFull.tsx / hooks.ts のfree-text互換処理は不変更）。
            //
            // Collapsed state is an entry point only (docs/product/
            // recommendation-result-information-architecture.md §3 Finding 1 follow-up,
            // §15 PR1): a single way to open the full editor. The current condition (if
            // any) is already surfaced by the existing appliedLabel chip near the results
            // below (with its own "クリア" control) -- not repeated here.
            if (!state.isOpen) {
              return (
                <div key={`filter-${i}-closed`}>
                  <DetailSection title="補助条件を添える">
                    <button
                      type="button"
                      className="w-full rounded-[var(--kt-radius-panel)] border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: "add_condition" })}
                    >
                      もう少し詳しく添える
                    </button>
                  </DetailSection>
                </div>
              );
            }

            // ConciergeFilterPanel already renders its own title + close
            // control as a self-contained bordered section (see
            // ConciergeFilterPanel.tsx). Wrapping it in DetailSection here
            // duplicated the same title text twice and added a second
            // nested border/padding layer -- Concierge Entry Responsive /
            // Density Polish Task 6 removed that redundancy; no signal or
            // behavior change.
            return (
              <div key={`filter-${i}-open`}>
                <ConciergeFilterPanel
                  isOpen
                  title={title}
                  onClose={() => onAction?.({ type: "filter_close" })}
                  onApply={() => {
                    onAction?.({ type: "filter_apply" });
                  }}
                  canApply={canApplyCompatFilter}
                  birthdate={state.birthdate}
                  onBirthdateChange={(v: string) => onAction?.({ type: "filter_set_birthdate", birthdate: v })}
                  element4={state.element4}
                  goriyakuTags={state.goriyakuTags}
                  suggestedTags={state.suggestedTags}
                  selectedTagIds={state.selectedTagIds}
                  onToggleTag={(tagId: number) => onAction?.({ type: "filter_toggle_tag", tagId })}
                  tagsLoading={state.tagsLoading}
                  tagsError={state.tagsError}
                  extraCondition={state.extraCondition}
                  onExtraConditionChange={(v: string) => onAction?.({ type: "filter_set_extra", extraCondition: v })}
                  visitPreferences={state.visitPreferences}
                  onVisitPreferencesChange={(tags: string[]) =>
                    onAction?.({ type: "filter_set_visit_preferences", visitPreferences: tags })
                  }
                />

                {/* 独立したQuick Preset群はここに置かない。
                    ConciergeFilterPanel が QUICK_PRESET_GROUPS を正本として
                    持っており、同じ役割のUIを二重に出さないため。 */}

                {!isEntryRoute ? (
                  <button
                    type="button"
                    className="mt-2 w-full rounded-[var(--kt-radius-panel)] border px-4 py-3 text-sm font-semibold"
                    onClick={() => {
                      onAction?.({ type: "back_to_entry" });
                      scrollToConciergeInput();
                    }}
                    disabled={sending}
                  >
                    入口に戻る
                  </button>
                ) : null}
              </div>
            );
          }

          case "recommendations": {
            const items = (sec as any).items ?? [];

            const rs = payload?.meta?.resultState ?? null;
            const isFallback = rs?.fallback_mode === "nearby_unfiltered";
            const hasDummy = items.some((x: any) => x?.isDummy === true);

            const bannerText =
              (typeof rs?.fallback_reason_ja === "string" && rs.fallback_reason_ja) ||
              (typeof rs?.ui_disclaimer_ja === "string" && rs.ui_disclaimer_ja) ||
              (hasDummy ? "条件に合う神社が少ないため、まずは向かいやすい神社から表示しています。" : null);

            const normalizedMode = normalizeConciergeMode(payload?.meta?.mode);

            const registeredItems = items.filter(
              (x: RegisteredShrineItem | PlaceShrineItem): x is RegisteredShrineItem => x.kind === "registered",
            );

            const placeItems = items.filter(
              (x: RegisteredShrineItem | PlaceShrineItem): x is PlaceShrineItem => x.kind === "place",
            );

            const heroItem = registeredItems[0] ?? null;
            const otherRegisteredItems = registeredItems.slice(1);

            return (
              <DetailSection key={`recs-${i}`} title={(sec as any).title ?? ""}>
                <div className="mb-2 flex items-center justify-end">
                  <ModeBadge mode={payload?.meta?.mode} />
                </div>

                {typeof payload?.meta?.remaining === "number" && payload.meta.remaining > 0 && (
                  <div className="mb-2 text-xs leading-6 text-[var(--kt-color-text-muted)]">
                    あと {payload.meta.remaining}回までは無料で試せます
                  </div>
                )}

                {bannerText && (
                  <div
                    className={`mb-3 ${conciergeNoticeCardClass} text-sm leading-6 text-[var(--kt-color-notice-text)]`}
                  >
                    {bannerText}
                  </div>
                )}

                {(isFallback || hasDummy) && (
                  // PR-G4: 1 column at mobile widths so the JP labels never wrap to
                  // uneven 2-line buttons at 375px; 2 columns from `sm` up. Same
                  // pattern as ConciergeTopRecommendationHero / ShrineReflectionPrompt.
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      className="rounded-[var(--kt-radius-panel)] border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: "open_map" })}
                    >
                      近くの神社を静かに見る
                    </button>
                    <button
                      type="button"
                      /* Fallback escape-hatch CTA Visual Weight Polish (docs/audit/
                         recommendation-result-ia-v2-final.md Should item, docs/product/
                         recommendation-result-information-architecture.md §11): this used to be
                         a solid bg-neutral-900 fill, which read as visually on par with Hero's
                         Primary CTA (docs/product/recommendation-result-information-architecture.md
                         §6/§11/§15 PR3 contract: "神社の詳細を見る" must stay the only strong CTA).
                         Downgraded from filled to the same plain-border/no-fill style already used
                         by its sibling button above and by "もう少し詳しく添える"/"入口に戻る"
                         elsewhere in this file -- an existing pattern, not a new one. */
                      className="rounded-[var(--kt-radius-panel)] border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: "filter_clear" })}
                    >
                      条件を広げて見直す
                    </button>
                  </div>
                )}

                {appliedLabel && (
                  <div
                    className={`mb-2 ${conciergeSoftCardClass} flex items-center justify-between text-xs leading-6 text-slate-600`}
                  >
                    <span>{appliedLabel}</span>
                    <button
                      type="button"
                      className="rounded-[var(--kt-radius-control)] px-2 py-1 font-semibold text-[var(--kt-color-text-secondary)] hover:bg-slate-100"
                      onClick={() => onAction?.({ type: "filter_clear" })}
                    >
                      クリア
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {heroItem
                    ? (() => {
                        const inputNeedTags = payload?.meta?.needTags ?? [];
                        const matchedNeedTags = heroItem.breakdown?.matched_need_tags ?? [];
                        const effectiveNeedTags = inputNeedTags.length > 0 ? inputNeedTags : matchedNeedTags;

                        const reasonVm = buildRecommendationReasonViewModel({
                          rec: {
                            id: heroItem.shrineId,
                            display_name: heroItem.title,
                            name: heroItem.title,
                            breakdown: heroItem.breakdown ?? null,
                            breakdown_detail: (heroItem as any).breakdown_detail ?? null,
                            reason: heroItem.description ?? null,
                            fallback_mode: payload?.meta?.resultState?.fallback_mode ?? null,
                            distance_m: (heroItem as any).distance_m ?? null,
                            popular_score: (heroItem as any).popular_score ?? null,
                            astro_elements: (heroItem as any).astro_elements ?? null,
                            astro_priority: (heroItem as any).astro_priority ?? null,
                            explanation: (heroItem as any).explanation ?? null,
                          },
                          reasonFacts: heroItem.reasonFacts ?? null,
                          index: 0,
                          mode: normalizedMode,
                          birthdate: filterState?.birthdate ?? null,
                          needTags: effectiveNeedTags,
                        });
                        const reasonDisplay = buildRecommendationReasonDisplay({
                          matchReason: reasonVm.list.primaryPhrase,
                          reason: heroItem.description,
                          directionReference: heroItem.directionReference,
                        });
                        // Reason V4構造化契約(fact/interpretation/action)を優先し、
                        // needTagsベースの独自テンプレート(reasonDisplay)は新fieldが無い場合のfallbackとしてのみ使う
                        const heroReasonV4 = buildHeroReasonV4Sections({
                          detail: (heroItem as any).reasonV4Detail ?? null,
                          recommendationReasonV4: (heroItem as any).recommendationReasonV4 ?? null,
                          reason: heroItem.description ?? null,
                        });
                        // Hero Reason Consolidation (docs/product/
                        // recommendation-result-information-architecture.md §6, §13,
                        // §15 PR2): compose the single Conclusion block from the same
                        // already-Authority-decided strings the old 4 separate cards
                        // used (primaryReason / factReason / interpretationReason /
                        // legacy fallback) -- no new resolver, no re-prioritization.
                        const conclusionLines = buildHeroConclusionLines({
                          hasStructured: heroReasonV4.hasStructured,
                          interpretationText: heroReasonV4.interpretationText,
                          factText: heroReasonV4.factText,
                          primaryReason: reasonVm.list.primaryPhrase,
                          fallbackText: heroReasonV4.fallbackText,
                        });
                        const trustMetadata = (heroItem as any).trustMetadata ?? null;
                        const trustLabels = [
                          trustMetadata?.rank_class ?? trustMetadata?.rankClass,
                          ...(trustMetadata?.cultural_status ?? trustMetadata?.culturalStatus ?? []),
                          trustMetadata?.lineage,
                        ].filter(Boolean);

                        const historyTheme =
                          typeof (heroItem as any).history_theme === "string"
                            ? (heroItem as any).history_theme
                            : typeof (heroItem as any).historyTheme === "string"
                              ? (heroItem as any).historyTheme
                              : null;
                        const historyContext =
                          typeof (heroItem as any).history_context === "string"
                            ? (heroItem as any).history_context
                            : typeof (heroItem as any).historyContext === "string"
                              ? (heroItem as any).historyContext
                              : null;
                        // historyContext(Backendから届く生テキスト)はFactに近い扱いを維持する。
                        // 一方、buildHistoryThemeDisplay()のfallbackは完全にFrontend側で合成した
                        // 解釈(Derived Meaning)であり、Fact/Meaning境界を明示するため見出しを
                        // 分ける(Concierge Evidence Explanation PR)。
                        const historyThemeDisplay = historyContext
                          ? {
                              title: "この神社が持つ文脈",
                              body: historyContext,
                              isInterpretation: false,
                            }
                          : (() => {
                              const fallback = buildHistoryThemeDisplay(historyTheme);
                              return fallback ? { ...fallback, isInterpretation: true } : null;
                            })();

                        // "今回の相談との接点"(Runtime Match): 既にBackend/既存Adapterが選定済みの
                        // 信号(matched_need_tags、reason_facts is_primary goriyaku_tag)だけを使う。
                        // 新たな一致判定は行わない(Concierge Evidence Explanation PR、
                        // docs/product/recommendation-signal-authority.md §10)。
                        const adaptedReasonFacts = adaptReasonFactsForViewModel(heroItem.reasonFacts ?? null);
                        const runtimeMatchGoriyakuLabel =
                          adaptedReasonFacts?.primary_fact_type === "goriyaku_tag"
                            ? (adaptedReasonFacts.shrine_benefit ?? null)
                            : heroReasonV4.factSource === "goriyaku"
                              ? heroReasonV4.factText
                              : null;
                        const runtimeMatchLines = buildRuntimeMatchLines({
                          needTags: effectiveNeedTags,
                          goriyakuLabel: runtimeMatchGoriyakuLabel,
                        });

                        return (
                          /* PR-G1 (docs/design/premium-meaning-ui-direction.md §7, Direction C):
                             the recommendation now reads as one vertical narrative --
                             Recommended shrine -> the consultation it answers -> why this
                             shrine / how it connects -> meaning -> action -> (evidence).
                             The reason/meaning layers are borderless <h2> sections separated
                             by whitespace (space-y-6 = --kt-space-section-y), not repeated
                             bordered cards (audit #2656 A-C1/A-C2/A-C4/A-C5). No Premium
                             behaviour, visibility, analytics, or generation change here --
                             the teaser text and the ConciergePremiumEntryCard box are
                             untouched (PR-G2 owns the single Free->Premium seam). */
                          <div key={`rec-${i}-hero-${heroItem.shrineId}`} className="space-y-6">
                            <div className="space-y-3">
                              <ConciergeTopRecommendationHero
                                name={heroItem.title}
                                href={withDirectionRouteContext(
                                  heroItem.detailHref,
                                  heroItem.directionReference,
                                  "hero",
                                )}
                                address={null}
                                topReasonLabel={reasonVm.hero.topReasonLabel ?? null}
                                eyebrowLabel={reasonVm.hero.eyebrowLabel ?? null}
                                conclusionLines={conclusionLines}
                                explanationOnlyFactText={heroReasonV4.explanationOnlyFactText}
                                actionReason={heroReasonV4.actionText}
                                actionSuggestionV4Preview={(heroItem as any).actionSuggestionV4Preview ?? null}
                                analyticsSource="concierge_result"
                                threadId={tid ?? null}
                                resultSetId={resultSetId}
                                shrineId={heroItem.shrineId}
                                recommendationRank={1}
                                historyTheme={historyTheme ?? analyticsContext?.historyTheme ?? null}
                                routeLabel="神社の詳細を見る"
                                onDetailClick={() => {
                                  if (heroItem.directionReference?.matched)
                                    trackWebDirection("direction_match_detail_opened", {
                                      matched: true,
                                      recommendation_rank: 1,
                                    });
                                  trackSearchEvent("shrine_detail_transition", {
                                    source: "concierge_result",
                                    threadId: tid ?? undefined,
                                    resultSetId,
                                    position: "hero_primary",
                                    recommendationRank: 1,
                                    shrineId: heroItem.shrineId,
                                    mode: analyticsContext?.mode ?? normalizedMode,
                                    flow: analyticsContext?.flow,
                                    hasBirthdate: analyticsContext?.hasBirthdate,
                                    recommendationCount: analyticsContext?.recommendationCount,
                                    historyTheme: historyTheme ?? analyticsContext?.historyTheme,
                                    ...consultationAxisAnalytics(
                                      heroItem.consultationAxis ?? analyticsContext?.consultationAxis,
                                    ),
                                    firstClick: resolveFirstResultClick(resultSetId),
                                    recommendationInstanceId: heroItem.recommendationInstanceId ?? null,
                                    ...(heroItem.analyticsProvenance
                                      ? recommendationAnalyticsProperties(heroItem.analyticsProvenance)
                                      : {}),
                                  });
                                }}
                              />
                              <DirectionReferenceCard
                                reference={reasonDisplay.directionReference}
                                recommendationKey={heroItem.shrineId}
                                rank={1}
                              />
                            </div>

                            {/* Layer 1 bridge: the consultation this recommendation answers.
                                Moved up from below the meaning layers (audit #2656 A-C2); kept
                                just under the Hero so the shrine + its Primary CTA still lead
                                the first viewport on mobile. */}
                            {consultationSummaryVisibility !== "hidden" && reasonVm.detail.consultationSummary ? (
                              <ConciergeConsultationSummary
                                summary={reasonVm.detail.consultationSummary}
                                modeLabel={normalizedMode === "compat" ? "相性ベース" : "悩みベース"}
                              />
                            ) : null}

                            {runtimeMatchLines.length > 0 ? (
                              <div data-testid="recommendation-runtime-match">
                                <DetailSection variant="plain" title="今回の相談との接点">
                                  <div className="space-y-2">
                                    {runtimeMatchLines.map((line) => (
                                      <p key={line} className={narrativeBodyClass}>
                                        {line}
                                      </p>
                                    ))}
                                  </div>
                                </DetailSection>
                              </div>
                            ) : null}

                            {historyThemeDisplay ? (
                              <div data-testid="recommendation-history-theme">
                                <DetailSection
                                  variant="plain"
                                  title={
                                    historyThemeDisplay.isInterpretation
                                      ? "この神社をどう捉えるか（KAMI MUSUBIの解釈）"
                                      : "この神社が持つ文脈"
                                  }
                                >
                                  <p className={narrativeBodyClass}>{historyThemeDisplay.body}</p>
                                </DetailSection>
                              </div>
                            ) : null}

                            {/* Free -> Premium seam (PR-G2): one restrained boundary, placed
                                where the FREE reason layers end and the deeper meaning begins.
                                Guest / Free see the seam here instead of the gated
                                shrine_meaning / action_meaning bodies; Premium skips it. The
                                shrine_meaning / action_meaning card_view / card_teaser_view
                                analytics still fire from the effect above (cardVisibility
                                routes), independent of this JSX. */}
                            {premiumPreviewVisibility !== "hidden" ? (
                              <PremiumSeam
                                shrineId={heroItem.shrineId}
                                tid={tid}
                                isGuestUser={isGuestUser}
                                accessLevel={accessLevel}
                                analyticsContext={analyticsContext}
                                shrineMeaningVisibility={shrineMeaningVisibility}
                                actionMeaningVisibility={actionMeaningVisibility}
                              />
                            ) : null}

                            {/* Full deep-meaning bodies: Premium only ("visible"). "teaser"
                                (Guest / Free) renders nothing here -- the content is not in
                                the DOM at all (no masked / withheld-mid-sentence content),
                                the seam above represents it. */}
                            {shrineMeaningVisibility === "visible" ? (
                              <DetailSection variant="plain" title="相談から見た意味（KAMI MUSUBIの解釈）">
                                <p className={narrativeBodyClass}>{reasonVm.detail.shrineMeaning}</p>
                              </DetailSection>
                            ) : null}

                            {actionMeaningVisibility === "visible" ? (
                              <DetailSection variant="plain" title="今の自分への問い">
                                <p className={narrativeBodyClass}>
                                  {reasonVm.detail.actionMeaning ?? reasonVm.detail.shrineMeaning}
                                </p>
                              </DetailSection>
                            ) : null}

                            <ShrineSaveButton
                              shrineId={heroItem.shrineId}
                              ctx="concierge"
                              tid={tid}
                              nextPath={heroItem.detailHref}
                              variant="subtle"
                              recommendationInstanceId={heroItem.recommendationInstanceId ?? null}
                              analyticsProvenance={heroItem.analyticsProvenance}
                            />

                            {/* Layer 8 (evidence): shrine-side facts, de-emphasised into a
                                recessed surface. Previously a conciergeSoftCardClass box
                                directly under the Hero, grouped with historyTheme
                                (recommendation-result-information-architecture.md §13); that
                                grouping is superseded by the Direction-C hierarchy
                                (docs/design/premium-meaning-ui-direction.md §7/§9) -- trust
                                metadata is evidence, not part of the reason narrative, so it
                                moves below it. Still never feeds Conclusion / Primary Reason. */}
                            {trustMetadata ? (
                              <section
                                data-testid="recommendation-trust"
                                className="rounded-[var(--kt-radius-card)] bg-[var(--kt-color-background-subtle)] p-4"
                              >
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1">
                                    {trustLabels.slice(0, 4).map((label: string) => (
                                      <span
                                        key={label}
                                        className="rounded-[var(--kt-radius-pill)] bg-[var(--kt-color-surface-default)] px-2 py-0.5 text-[11px] font-semibold text-[var(--kt-color-text-muted)]"
                                      >
                                        {label}
                                      </span>
                                    ))}
                                  </div>
                                  {trustMetadata.origin_summary || trustMetadata.originSummary ? (
                                    <p className="text-xs leading-6 text-[var(--kt-color-text-muted)]">
                                      {trustMetadata.origin_summary ?? trustMetadata.originSummary}
                                    </p>
                                  ) : null}
                                </div>
                              </section>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}

                  {otherRegisteredItems.length > 0 ? (
                    <div className="pt-8">
                      <button
                        type="button"
                        className="w-full rounded-[var(--kt-radius-card)] border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 py-3 text-xs font-semibold text-[var(--kt-color-text-muted)] transition hover:bg-[var(--kt-color-background-subtle)] hover:text-[var(--kt-color-text-secondary)]"
                        aria-expanded={showOtherRecommendations}
                        aria-controls={otherRecommendationsId}
                        onClick={() => setShowOtherRecommendations((prev) => !prev)}
                      >
                        {showOtherRecommendations ? "ほかの神社を閉じる" : "迷った時だけ、ほかの神社を見る"}
                      </button>

                      {showOtherRecommendations ? (
                        <div id={otherRecommendationsId}>
                          <div className="mb-2 mt-3 text-xs font-semibold tracking-[0.16em] text-[var(--kt-color-text-muted)]">
                            ほかの神社
                          </div>
                          <p className="mb-3 text-xs leading-5 text-[var(--kt-color-text-muted)]">
                            迷った時の参考です。
                          </p>

                          <div className="space-y-3">
                            {otherRegisteredItems.map((item: RegisteredShrineItem, compactIdx: number) => {
                              const compactReasonVm = buildRecommendationReasonViewModel({
                                rec: {
                                  id: item.shrineId,
                                  display_name: item.title,
                                  name: item.title,
                                  breakdown: item.breakdown ?? null,
                                  breakdown_detail: (item as any).breakdown_detail ?? null,
                                  reason: item.description ?? null,
                                  fallback_mode: payload?.meta?.resultState?.fallback_mode ?? null,
                                  distance_m: (item as any).distance_m ?? null,
                                  popular_score: (item as any).popular_score ?? null,
                                  astro_elements: (item as any).astro_elements ?? null,
                                  astro_priority: (item as any).astro_priority ?? null,
                                  explanation: (item as any).explanation ?? null,
                                },
                                reasonFacts: item.reasonFacts ?? null,
                                index: compactIdx + 1,
                                mode: normalizedMode,
                                birthdate: filterState?.birthdate ?? null,
                                needTags: item.breakdown?.matched_need_tags ?? [],
                              });
                              const compactReasonDisplay = buildRecommendationReasonDisplay({
                                matchReason: compactReasonVm.list.primaryPhrase,
                                reason: item.description,
                                directionReference: item.directionReference,
                              });
                              // Compact Recommendation Reason / Explanation Consistency
                              // (docs/product/recommendation-result-information-architecture.md
                              // §15): reuse the exact same Hero adapter to classify the same
                              // Reason V4 fact -- no new Explanation-only decision, no Compact-local
                              // priority logic. Only explanationOnlyFactText is consumed here;
                              // Compact's "why" text stays driven by the existing reason_facts-based
                              // primaryPhrase (below), never by this adapter's factText/interpretationText
                              // (that composition is Hero's Conclusion, not ported to Compact).
                              const compactReasonV4 = buildHeroReasonV4Sections({
                                detail: (item as any).reasonV4Detail ?? null,
                                recommendationReasonV4: (item as any).recommendationReasonV4 ?? null,
                                reason: item.description ?? null,
                              });
                              // Single reason source, not two: matchReason (reason_facts-derived,
                              // already Authority-decided) wins when present; the legacy free-text
                              // reason field is only shown as a fallback when matchReason is
                              // unavailable (Finding: Compact previously showed both under separate
                              // headings, reading as a repeated explanation of the same "why").
                              const compactReason = compactReasonDisplay.matchReason ?? compactReasonDisplay.reason;

                              return (
                                <div key={`rec-${i}-compact-${item.shrineId}`} className="space-y-2">
                                  <ShrineCardCompact
                                    name={item.title}
                                    href={withDirectionRouteContext(item.detailHref, item.directionReference, "other")}
                                    imageUrl={item.imageUrl}
                                    address={item.address ?? null}
                                    reason={compactReason}
                                    explanationOnlyFactText={compactReasonV4.explanationOnlyFactText}
                                    tags={[]}
                                    distanceM={(item as any).distance_m ?? null}
                                    onDetailClick={() => {
                                      if (item.directionReference?.matched)
                                        trackWebDirection("direction_match_detail_opened", {
                                          matched: true,
                                          recommendation_rank: compactIdx + 2,
                                        });
                                      trackSearchEvent("shrine_detail_transition", {
                                        source: "concierge_result",
                                        threadId: tid ?? undefined,
                                        resultSetId,
                                        position: "compact",
                                        recommendationRank: compactIdx + 2,
                                        shrineId: item.shrineId,
                                        mode: analyticsContext?.mode ?? normalizedMode,
                                        flow: analyticsContext?.flow,
                                        hasBirthdate: analyticsContext?.hasBirthdate,
                                        recommendationCount: analyticsContext?.recommendationCount,
                                        historyTheme:
                                          typeof (item as any).history_theme === "string"
                                            ? (item as any).history_theme
                                            : typeof (item as any).historyTheme === "string"
                                              ? (item as any).historyTheme
                                              : analyticsContext?.historyTheme,
                                        ...consultationAxisAnalytics(
                                          (item as any).consultationAxis ?? analyticsContext?.consultationAxis,
                                        ),
                                        firstClick: resolveFirstResultClick(resultSetId),
                                        recommendationInstanceId: item.recommendationInstanceId ?? null,
                                        ...(item.analyticsProvenance
                                          ? recommendationAnalyticsProperties(item.analyticsProvenance)
                                          : {}),
                                      });
                                    }}
                                  />
                                  <DirectionReferenceCard
                                    reference={compactReasonDisplay.directionReference}
                                    recommendationKey={item.shrineId}
                                    rank={compactIdx + 2}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {placeItems.length > 0 ? (
                    <div className="space-y-3 pt-4">
                      {placeItems.map((item: PlaceShrineItem, placeIdx: number) => (
                        <div key={`rec-${i}-${placeIdx}-place-${item.placeId}`} className="space-y-2">
                          <PlaceShrineCard
                            placeId={item.placeId}
                            title={item.title}
                            address={item.address}
                            description={item.description}
                            imageUrl={item.imageUrl}
                            detailHref={item.detailHref}
                            detailLabel={item.detailLabel}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!isEntryRoute && savePromptVisibility !== "hidden" ? (
                    <div className="pt-4">
                      <button
                        type="button"
                        className="w-full rounded-[var(--kt-radius-panel)] border px-4 py-3 text-sm font-semibold text-[var(--kt-color-text-secondary)] hover:bg-[var(--kt-color-background-subtle)]"
                        onClick={() => {
                          trackCardEvent({
                            event: "save_prompt_click",
                            cardId: "save_prompt",
                            source: "concierge_result",
                            accessLevel,
                            visibility: savePromptVisibility,
                            ctaType: isGuestUser ? "login_to_save" : "save",
                            ...analyticsContext,
                            ...consultationAxisAnalytics(analyticsContext?.consultationAxis),
                            threadId: tid ?? undefined,
                            resultSetId,
                          });

                          onAction?.({ type: "save_concierge_thread" });
                        }}
                        disabled={sending}
                      >
                        {isGuestUser ? "ログインしてあとで見返す" : "あとで見返すために保存"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </DetailSection>
            );
          }

          case "astro":
            return (
              <AstroCard
                key={`astro-${i}`}
                sunSign={(sec as any).sunSign}
                element={(sec as any).element}
                reason={(sec as any).reason}
              />
            );

          default:
            return null;
        }
      })}
      {/* 下部固定バーを前提にした余白は持たせない。結果セクションはここで閉じる。 */}
    </div>
  );
}
