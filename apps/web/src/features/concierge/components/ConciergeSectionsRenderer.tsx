"use client";

import { useEffect, useMemo } from "react";
import DetailSection from "@/components/shrine/DetailSection";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";
import ConciergeFilterPanel from "@/features/concierge/components/ConciergeFilterPanel";
import ModeBadge from "@/features/concierge/components/ModeBadge";
import ShrineCard from "@/components/shrine/ShrineCard";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
  RegisteredShrineItem,
  PlaceShrineItem,
  RendererAction,
} from "@/features/concierge/sections/types";

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
  sending?: boolean;
  threadId?: number | null;
};

function parseExtraTokens(extra: string | undefined | null): string[] {
  return (extra || "")
    .split(/[、,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}


export default function ConciergeSectionsRenderer({ payload, onAction, sending = false, threadId = null }: Props) {
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
  const appliedLabel = appliedTokens.length ? `${appliedTokens.join(" / ")} で絞り込みました` : null;

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
                    <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      追加済み: {selectedPresets.join(" / ")}
                    </div>
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

          case "recommendations":
            return (
              <DetailSection key={`recs-${i}`} title={(sec as any).title ?? ""}>
                <div className="mb-2 flex items-center justify-end">
                  <ModeBadge mode={payload?.meta?.mode} />
                </div>

                {appliedLabel && (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
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
                  {(sec as any).items.map((item: RegisteredShrineItem | PlaceShrineItem, idx: number) => {
                    if (item.kind === "registered") {
                      return (
                        <ShrineCard
                          key={`rec-${i}-${idx}`}
                          shrineId={item.shrineId}
                          title={item.title}
                          address={item.address}
                          description={item.description}
                          imageUrl={item.imageUrl}
                          breakdown={item.breakdown ?? null}
                          detailHref={buildShrineHref(item.shrineId, { ctx: "concierge", tid: threadId })}
                        />
                      );
                    }

                    return (
                      <PlaceShrineCard
                        key={`rec-${i}-${idx}`}
                        placeId={item.placeId}
                        title={item.title}
                        address={item.address}
                        description={item.description}
                        imageUrl={item.imageUrl}
                        detailHref={item.detailHref}
                        detailLabel={item.detailLabel}
                      />
                    );
                  })}
                </div>
              </DetailSection>
            );

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
    </div>
  );
}
