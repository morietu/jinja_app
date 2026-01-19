"use client";

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
    // 既存ConciergeSectionsと同じ幅感に合わせる（max-w-md）
    <div className="mx-auto w-full max-w-md min-w-0 space-y-4">
      {payload.sections.map((sec, i) => {
        switch (sec.type) {
          case "guide":
            return (
              <section key={`guide-${i}`} className="rounded-xl border bg-white p-3">
                <div className="text-sm text-slate-700">{sec.text}</div>
              </section>
            );

          case "recommendations":
            return (
              <section key={`recs-${i}`} className="space-y-3">
                {sec.title ? <div className="text-xs font-semibold text-slate-700">{sec.title}</div> : null}

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
              </section>
            );

          case "actions":
            return (
              <section key={`actions-${i}`} className="rounded-xl border bg-white p-3">
                <div className="grid gap-2">
                  {sec.items.map((a: { action: "add_condition" | "open_map"; label: string }, idx: number) => (
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
              </section>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
