import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
} from "@/features/concierge/sections/types";

export function buildPayloadFromUnified(
  u: UnifiedConciergeResponse | null,
  filterState: ConciergeFilterState,
): ConciergeSectionsPayload | null {
  const recs = u?.data?.recommendations;
  if (!Array.isArray(recs) || recs.length === 0) return null;

  const tidRaw = (u as any)?.thread?.id ?? (u as any)?.thread_id ?? (u as any)?.data?.thread_id ?? null;

  const tid = typeof tidRaw === "number" || typeof tidRaw === "string" ? String(tidRaw) : null;

  const items = recs
    .map((r: any) => {
      if (typeof r?.id === "number") {
        const shrineId = r.id as number;

        const qs = new URLSearchParams();
        qs.set("ctx", "concierge");
        if (tid) qs.set("tid", tid);

        return {
          kind: "registered" as const,
          shrineId,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          
          address: r.display_address ?? r.address ?? r.location ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
          goriyakuTags: [],
          initialFav: false,
          breakdown: r.breakdown ?? null,

          // ✅ 追加：詳細導線
          detailHref: `/shrines/${shrineId}?${qs.toString()}`,
          detailLabel: "神社の詳細を見る",
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

  const sections: ConciergeSection[] = [
    {
      type: "filter",
      title: "条件を追加して絞る",
      closedLabel: "条件を追加して絞る",
      state: filterState,
    },
    { type: "guide", text: "状況を整理しました。必要なら条件を追加して絞れます。" },
    { type: "recommendations", title: "おすすめ", items: items as any[] },
    {
      type: "actions",
      items: [
        { action: "add_condition", label: "条件を追加して絞る" },
        { action: "open_map", label: "地図で近くの神社を見る" },
      ],
    },
  ];

  return { version: 1, sections };
}
