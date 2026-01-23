"use client";

import DetailSection from "@/components/shrine/DetailSection";
import ShrineCard from "@/components/shrine/ShrineCard";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";
import ConciergeFilterPanel from "@/features/concierge/components/ConciergeFilterPanel";
import { buildOneLiner } from "@/lib/concierge/pickAClause";
import ModeBadge from "@/features/concierge/components/ModeBadge";


import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
  RegisteredShrineItem,
  PlaceShrineItem,
  RendererAction,
  
} from "@/features/concierge/sections/types";

// ✅ まずはここで AstroCard を定義（import 迷子を防ぐ）
function AstroCard(props: { sunSign?: string; element?: string; reason?: string }) {
  const { sunSign, element, reason } = props;
  return (
    <DetailSection title="占星術による選定">
      <div className="rounded-xl border bg-amber-50 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">
          {sunSign || "不明"} / {element || "不明"}
        </div>
        <div className="mt-1 text-sm text-slate-700">{reason || "（理由なし）"}</div>
      </div>
    </DetailSection>
  );
}

type Props = {
  payload: ConciergeSectionsPayload;
  onAction?: (action: RendererAction) => void;
};

export default function ConciergeSectionsRenderer({ payload, onAction }: Props) {
  if (!payload || !Array.isArray(payload.sections) || payload.sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4">
      {payload.sections.map((sec: ConciergeSection, i: number) => {
        switch (sec.type) {
          case "guide":
            return null;

          case "filter": {
            const state: ConciergeFilterState = (sec as any).state;
            const title = (sec as any).title ?? "条件を追加して絞る";
            const closedLabel = (sec as any).closedLabel ?? "条件を追加して絞る";

            if (!state.isOpen) {
              return (
                <DetailSection key={`filter-${i}`} title="条件で絞る">
                  <button
                    type="button"
                    className="w-full rounded-xl border px-4 py-3 text-sm font-semibold"
                    onClick={() => onAction?.({ type: "add_condition" })}
                  >
                    {closedLabel}
                  </button>
                </DetailSection>
              );
            }

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

          case "recommendations":
            return (
              <DetailSection key={`recs-${i}`} title={(sec as any).title ?? ""}>
                <div className="mb-2 flex items-center justify-end">
                  <ModeBadge mode={payload?.meta?.mode} />
                </div>
                <div className="space-y-3">
                  {(sec as any).items.map((it: RegisteredShrineItem | PlaceShrineItem, idx: number) => {
                    const isPrimary = idx === 0;

                    if (it.kind === "registered") {
                      const oneLiner = it.breakdown ? buildOneLiner(it.breakdown) : null;
                      const description =
                        isPrimary && typeof oneLiner === "string" && oneLiner.trim() ? oneLiner.trim() : it.description;

                      return (
                        <div key={`reg-${it.shrineId}-${idx}`} className="space-y-2">
                          <ShrineCard
                            shrineId={it.shrineId}
                            title={it.title}
                            address={it.address}
                            description={description}
                            imageUrl={it.imageUrl}
                            initialFav={it.initialFav}
                            showFavorite
                            breakdown={it.breakdown ?? null}
                            detailHref={it.detailHref}
                          />
                        </div>
                      );
                    }

                    return (
                      <PlaceShrineCard
                        key={`place-${it.placeId}-${idx}`}
                        placeId={it.placeId}
                        title={it.title}
                        address={it.address}
                        description={it.description}
                        imageUrl={it.imageUrl}
                        detailHref={it.detailHref}
                        detailLabel={it.detailLabel}
                      />
                    );
                  })}
                </div>
              </DetailSection>
            );

          // ✅ ここが本題
          case "astro":
            return <AstroCard key={`astro-${i}`} sunSign={sec.sunSign} element={sec.element} reason={sec.reason} />;

          default:
            return null;
        }
      })}
    </div>
  );
}
