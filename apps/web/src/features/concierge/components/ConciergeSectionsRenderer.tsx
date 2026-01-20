"use client";

import DetailSection from "@/components/shrine/DetailSection";
import ShrineCard from "@/components/shrine/ShrineCard";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";
import ConciergeFilterPanel from "@/features/concierge/components/ConciergeFilterPanel";
import Link from "next/link";

import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
  RegisteredShrineItem,
  PlaceShrineItem,
  RendererAction,
  ActionType,
  ActionsSection,
} from "@/features/concierge/sections/types";

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
            return (
              <DetailSection key={`guide-${i}`} title="ガイド">
                <div className="text-sm text-slate-700">{sec.text}</div>
              </DetailSection>
            );

          case "filter": {
            const state: ConciergeFilterState = sec.state;
            const title = sec.title ?? "条件を追加して絞る";
            const closedLabel = sec.closedLabel ?? "条件を追加して絞る";

            // 閉じてる時：入口ボタンだけ
            if (!state.isOpen) {
              return (
                <DetailSection key={`filter-${i}`} title="絞り込み">
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

            // 開いてる時：Panel
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
              <DetailSection key={`recs-${i}`} title={sec.title ?? "おすすめ"}>
                <div className="space-y-3">
                  {sec.items.map((it: RegisteredShrineItem | PlaceShrineItem, idx: number) => {
                    if (it.kind === "registered") {
                      const detailHref = (it as any).detailHref as string | undefined;
                      const detailLabel = ((it as any).detailLabel as string | undefined) ?? "神社の詳細を見る";

                      return (
                        <div key={`reg-${it.shrineId}-${idx}`} className="space-y-2">
                          <ShrineCard
                            shrineId={it.shrineId}
                            title={it.title}
                            address={it.address}
                            description={it.description}
                            imageUrl={it.imageUrl}
                            goriyakuTags={it.goriyakuTags}
                            initialFav={it.initialFav}
                            showFavorite
                            breakdown={(it as any).breakdown ?? null}
                            // ✅ 黒いメインCTAも ctx/tid 付き
                            detailHref={detailHref}
                          />

                          {/* ✅ サブ導線：必ず出す */}
                          {detailHref ? (
                            <Link
                              href={detailHref}
                              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold"
                            >
                              {detailLabel}
                            </Link>
                          ) : (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              detailHref がありません（recommendations に id が入っていない可能性）
                            </div>
                          )}
                        </div>
                      );
                    }

                    // place
                    return (
                      <PlaceShrineCard
                        key={`place-${it.placeId}-${idx}`}
                        placeId={it.placeId}
                        title={it.title}
                        address={it.address}
                        description={it.description}
                        imageUrl={it.imageUrl}
                      />
                    );
                  })}
                </div>
              </DetailSection>
            );

          case "actions": {
            const asec = sec as ActionsSection;
            return (
              <DetailSection key={`actions-${i}`} title="次の操作">
                <div className="grid gap-2">
                  {asec.items.map((a: { action: ActionType; label: string }, idx: number) => (
                    <button
                      key={`${a.action}-${idx}`}
                      type="button"
                      className="rounded-xl border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.({ type: a.action })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </DetailSection>
            );
          }

          default:
            return null;
        }
      })}
    </div>
  );
}
