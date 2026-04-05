"use client";

import { useEffect, useMemo } from "react";
import DetailSection from "@/components/shrine/DetailSection";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";
import ConciergeFilterPanel from "@/features/concierge/components/ConciergeFilterPanel";
import ModeBadge from "@/features/concierge/components/ModeBadge";
import { buildRecommendationReasonViewModel } from "@/lib/concierge/buildRecommendationReasonViewModel";
import ConciergeTopRecommendationHero from "@/features/concierge/components/ConciergeTopRecommendationHero";
import ConciergeConsultationSummary from "@/features/concierge/components/ConciergeConsultationSummary";
import ShrineCardCompact from "@/components/shrines/ShrineCardCompact";

import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
  RegisteredShrineItem,
  PlaceShrineItem,
  RendererAction,
} from "@/features/concierge/sections/types";

type MetaMode = NonNullable<ConciergeSectionsPayload["meta"]>["mode"];

const conciergeSoftCardClass = "rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-4";
const conciergeNoticeCardClass = "rounded-2xl border border-amber-200 bg-amber-50 shadow-sm p-4";

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

function AstroCard(props: { sunSign?: string; element?: string; reason?: string }) {
  const { sunSign, element, reason } = props;
  return (
    <DetailSection title="占星術による選定">
      <div className={conciergeNoticeCardClass}>
        <div className="text-sm font-semibold text-slate-900">
          {sunSign || "不明"} / {element || "不明"}
        </div>
        <div className="mt-2 text-sm leading-7 text-slate-700">{reason || "（理由なし）"}</div>
      </div>
    </DetailSection>
  );
}

type Props = {
  payload: ConciergeSectionsPayload;
  onAction?: (action: RendererAction) => void;
  sending?: boolean;
  threadId?: number | null;
  isEntryRoute?: boolean;
};

function parseExtraTokens(extra: string | undefined | null): string[] {
  return (extra || "")
    .split(/[、,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function ConciergeSectionsRenderer({
  payload,
  onAction,
  sending = false,
  threadId: _threadId = null,
  isEntryRoute = false,
}: Props) {
  // ✅ hooks は必ず同じ順序
  useEffect(() => {
    const onOpen = () => onAction?.({ type: "add_condition" });
    window.addEventListener("concierge:open-filter", onOpen);
    return () => window.removeEventListener("concierge:open-filter", onOpen);
  }, [onAction]);

  // ✅ filter state は map の外で1回だけ取る
  const filterState: ConciergeFilterState | null = useMemo(() => {
    const sec = payload.sections.find((s) => s.type === "filter") as any;
    return (sec?.state ?? null) as ConciergeFilterState | null;
  }, [payload]);

  const appliedTokens = parseExtraTokens(filterState?.extraCondition);
  const appliedLabel = appliedTokens.length ? `条件: ${appliedTokens.join(" / ")}` : null;

  if (!payload || !Array.isArray(payload.sections) || payload.sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4 pb-0">
      {payload.sections.map((sec: ConciergeSection, i: number) => {
        switch (sec.type) {
          case "guide":
            return null;

          case "filter": {
            const state: ConciergeFilterState = (sec as any).state;
            const title = (sec as any).title ?? "条件を追加して絞る";

            // 閉じ状態（プリセット選択 + 即絞り）
            if (!state.isOpen) {
              const presets = ["静か", "駅近", "ひとり", "階段少なめ"] as const;

              const parts = parseExtraTokens(state.extraCondition);
              const set = new Set(parts);

              const togglePreset = (p: string) => {
                const next = new Set(parts);
                if (next.has(p)) next.delete(p);
                else next.add(p);
                onAction?.({ type: "filter_set_extra", extraCondition: Array.from(next).join(" ") });
              };

              const selectedPresets = presets.filter((p) => set.has(p));
              const hasAny = selectedPresets.length > 0;

              return (
                <DetailSection key={`filter-${i}`} title="条件で絞る">
                  <p className="mb-2 text-xs text-slate-500">まずは条件を追加</p>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {presets.map((p) => {
                      const active = set.has(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          className={[
                            "rounded-full border px-3 py-1 text-xs font-semibold transition",
                            active
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-700 hover:bg-slate-50",
                          ].join(" ")}
                          onClick={() => togglePreset(p)}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPresets.length > 0 && (
                    <div className={`mb-3 ${conciergeSoftCardClass} text-xs leading-6 text-slate-600`}>
                      追加済み: {selectedPresets.join(" / ")}
                    </div>
                  )}

                  {!isEntryRoute && (
                    <button
                      type="button"
                      className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: "back_to_entry" })}
                      disabled={sending}
                    >
                      入口に戻る
                    </button>
                  )}

                  <button
                    type="button"
                    className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    disabled={!hasAny || sending}
                    onClick={() => onAction?.({ type: "filter_apply" })}
                  >
                    {sending ? "絞り込み中…" : "この条件で絞り込む"}
                  </button>

                  <button
                    type="button"
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold"
                    onClick={() => onAction?.({ type: "add_condition" })}
                  >
                    詳細条件を設定する
                  </button>
                </DetailSection>
              );
            }

            // 開いた状態（既存のフィルタパネル）
            return (
              <DetailSection key={`filter-${i}`} title={title}>
                <ConciergeFilterPanel
                  isOpen
                  title={title}
                  onClose={() => onAction?.({ type: "filter_close" })}
                  onApply={() => onAction?.({ type: "filter_apply" })}
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
                />
              </DetailSection>
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
              (hasDummy ? "条件に合う候補が少ないため、まずは選びやすい候補から表示しています。" : null);

            const topRegisteredItem = items.find(
              (x: RegisteredShrineItem | PlaceShrineItem) => x.kind === "registered",
            ) as RegisteredShrineItem | undefined;

            const normalizedMode = normalizeConciergeMode(payload?.meta?.mode);

            const topReasonVm =
              topRegisteredItem && topRegisteredItem.kind === "registered"
                ? buildRecommendationReasonViewModel({
                    rec: {
                      display_name: topRegisteredItem.title,
                      name: topRegisteredItem.title,
                      breakdown: topRegisteredItem.breakdown ?? null,
                      reason: topRegisteredItem.description ?? null,
                      fallback_mode: payload?.meta?.resultState?.fallback_mode ?? null,
                      distance_m: (topRegisteredItem as any).distance_m ?? null,
                      popular_score: (topRegisteredItem as any).popular_score ?? null,
                      astro_elements: (topRegisteredItem as any).astro_elements ?? null,
                      astro_priority: (topRegisteredItem as any).astro_priority ?? null,
                      explanation: (topRegisteredItem as any).explanation ?? null,
                      reason_facts: (topRegisteredItem as any).reasonFacts ?? null,
                    },
                    index: 0,
                    mode: normalizedMode,
                    birthdate: filterState?.birthdate ?? null,
                    needTags: topRegisteredItem.breakdown?.matched_need_tags ?? [],
                  })
                : null;

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

                {topReasonVm?.detail.consultationSummary || topReasonVm?.interpretation.consultationSummary ? (
                  <div className="mb-4">
                    <ConciergeConsultationSummary
                      summary={topReasonVm.detail.consultationSummary ?? topReasonVm.interpretation.consultationSummary}
                      modeLabel={normalizedMode === "compat" ? "相性をもとに見ています" : "相談内容をもとに見ています"}
                      appliedLabel={appliedLabel}
                    />
                  </div>
                ) : null}

                {typeof payload?.meta?.remaining === "number" && payload.meta.remaining > 0 && (
                  <div className="mb-2 text-xs leading-6 text-slate-500">
                    あと {payload.meta.remaining}回までは無料で試せます
                  </div>
                )}

                {bannerText && (
                  <div className={`mb-3 ${conciergeNoticeCardClass} text-sm leading-6 text-amber-900`}>
                    {bannerText}
                  </div>
                )}

                {(isFallback || hasDummy) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="rounded-xl border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: "open_map" })}
                    >
                      近くの候補を優先して探す
                    </button>
                    <button
                      type="button"
                      className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white"
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
                      className="rounded-md px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                      onClick={() => onAction?.({ type: "filter_clear" })}
                    >
                      クリア
                    </button>
                  </div>
                )}

                <div className="space-y-3">
                  {heroItem
                    ? (() => {
                        const reasonVm = buildRecommendationReasonViewModel({
                          rec: {
                            display_name: heroItem.title,
                            name: heroItem.title,
                            breakdown: heroItem.breakdown ?? null,
                            reason: heroItem.description ?? null,
                            fallback_mode: payload?.meta?.resultState?.fallback_mode ?? null,
                            distance_m: (heroItem as any).distance_m ?? null,
                            popular_score: (heroItem as any).popular_score ?? null,
                            astro_elements: (heroItem as any).astro_elements ?? null,
                            astro_priority: (heroItem as any).astro_priority ?? null,
                            explanation: (heroItem as any).explanation ?? null,
                            reason_facts: (heroItem as any).reasonFacts ?? null,
                          },
                          index: 0,
                          mode: normalizedMode,
                          birthdate: filterState?.birthdate ?? null,
                          needTags: heroItem.breakdown?.matched_need_tags ?? [],
                        });

                        return (
                          <div key={`rec-${i}-hero-${heroItem.shrineId}`} className="space-y-2">
                            <ConciergeTopRecommendationHero
                              name={heroItem.title}
                              href={heroItem.detailHref}
                              imageUrl={heroItem.imageUrl}
                              address={null}
                              topReasonLabel={reasonVm.hero.topReasonLabel ?? null}
                              catchCopy={reasonVm.hero.catchCopy}
                              whyTop={reasonVm.rank.whyTop ?? null}
                              primaryReason={reasonVm.list.primaryPhrase ?? reasonVm.why.primaryReason}
                              secondaryReason={reasonVm.list.secondaryPhrase ?? reasonVm.why.secondaryReason ?? null}
                              differenceFromOthers={reasonVm.rank.differenceFromOthers ?? null}
                              tags={(heroItem.breakdown?.matched_need_tags ?? []).slice(0, 3)}
                              onRouteClick={() => onAction?.({ type: "open_map" })}
                            />
                          </div>
                        );
                      })()
                    : null}

                  {otherRegisteredItems.length > 0 ? (
                    <div className="pt-8">
                      <div className="mb-2 text-sm font-semibold text-slate-900">他の候補</div>
                      <p className="mb-3 text-xs leading-6 text-slate-500">
                        比較候補として、今回の相談と相性のある神社も紹介します。
                      </p>

                      <div className="space-y-3">
                        {otherRegisteredItems.map((item: RegisteredShrineItem, compactIdx: number) => {
                          const reasonVm = buildRecommendationReasonViewModel({
                            rec: {
                              display_name: item.title,
                              name: item.title,
                              breakdown: item.breakdown ?? null,
                              reason: item.description ?? null,
                              fallback_mode: payload?.meta?.resultState?.fallback_mode ?? null,
                              distance_m: (item as any).distance_m ?? null,
                              popular_score: (item as any).popular_score ?? null,
                              astro_elements: (item as any).astro_elements ?? null,
                              astro_priority: (item as any).astro_priority ?? null,
                              explanation: (item as any).explanation ?? null,
                              reason_facts: (item as any).reasonFacts ?? null,
                            },
                            index: compactIdx + 1,
                            mode: normalizedMode,
                            birthdate: filterState?.birthdate ?? null,
                            needTags: item.breakdown?.matched_need_tags ?? [],
                          });

                          return (
                            <div key={`rec-${i}-compact-${item.shrineId}`} className="space-y-2">
                              <ShrineCardCompact
                                name={item.title}
                                href={item.detailHref}
                                imageUrl={item.imageUrl}
                                address={null}
                                summary={reasonVm.list.summary ?? reasonVm.why.summary}
                                primaryReason={reasonVm.list.primaryPhrase ?? reasonVm.why.primaryReason}
                                tags={(item.breakdown?.matched_need_tags ?? []).slice(0, 1)}
                                distanceM={(item as any).distance_m ?? null}
                              />
                            </div>
                          );
                        })}
                      </div>
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
