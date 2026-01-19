// apps/web/src/features/concierge/buildPayloadFromUnified.ts
import type { ConciergeSectionsPayload } from "@/features/concierge/sections/types";
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";

export function buildPayloadFromUnified(u: UnifiedConciergeResponse | null): ConciergeSectionsPayload | null {
  const recs = u?.data?.recommendations;
  if (!Array.isArray(recs) || recs.length === 0) return null;

  const items = recs
    .map((r: any) => {
      if (typeof r?.id === "number") {
        return {
          kind: "registered" as const,
          shrineId: r.id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
          goriyakuTags: [],
          initialFav: false,
        };
      }

      if (typeof r?.place_id === "string") {
        return {
          kind: "place" as const,
          placeId: r.place_id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
        };
      }

      return null;
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  return {
    version: 1,
    sections: [
      { type: "guide", text: "おすすめを表示しました。必要なら条件を追加して絞れます。" },
      { type: "recommendations", title: "おすすめ", items: items as any[] },
      {
        type: "actions",
        items: [
          { action: "add_condition", label: "条件を追加して絞る" },
          { action: "open_map", label: "地図で近くの神社を見る" },
        ],
      },
    ],
  };
}
