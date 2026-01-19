"use client";

import DetailSection from "@/components/shrine/DetailSection";
import ShrineCard from "@/components/shrine/ShrineCard";
import PlaceShrineCard from "@/components/shrine/PlaceShrineCard";


import type {
  ConciergeSectionsPayload,
  RegisteredShrineItem,
  PlaceShrineItem,
} from "@/features/concierge/sections/types";

type ActionType = "add_condition" | "open_map";

type Props = {
  payload: ConciergeSectionsPayload;
  onAction?: (action: ActionType) => void;
};

export default function ConciergeSectionsRenderer({ payload, onAction }: Props) {
  if (!payload || !Array.isArray(payload.sections) || payload.sections.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4">
      {payload.sections.map((sec, i) => {
        switch (sec.type) {
          case "guide":
            return (
              <DetailSection key={`guide-${i}`} title="ガイド">
                <div className="text-sm text-slate-700">{sec.text}</div>
              </DetailSection>
            );

          case "recommendations":
            return (
              <DetailSection key={`recs-${i}`} title={sec.title || "おすすめ"}>
                <div className="space-y-3">
                  {sec.items.map((it: RegisteredShrineItem | PlaceShrineItem, idx: number) => {
                    if (it.kind === "registered") {
                      return (
                        <ShrineCard
                          key={`reg-${it.shrineId}-${idx}`}
                          shrineId={it.shrineId}
                          title={it.title}
                          address={it.address}
                          description={it.description}
                          imageUrl={it.imageUrl}
                          goriyakuTags={it.goriyakuTags}
                          initialFav={it.initialFav}
                          showFavorite
                          breakdown={(it as any).breakdown ?? null}
                        />
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
                      />
                    );
                  })}
                </div>
              </DetailSection>
            );

          case "actions":
            return (
              <DetailSection key={`actions-${i}`} title="次の操作">
                <div className="grid gap-2">
                  {sec.items.map((a: { action: ActionType; label: string }, idx: number) => (
                    <button
                      key={`${a.action}-${idx}`}
                      type="button"
                      className="rounded-xl border px-4 py-3 text-sm font-semibold"
                      onClick={() => onAction?.(a.action)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </DetailSection>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
