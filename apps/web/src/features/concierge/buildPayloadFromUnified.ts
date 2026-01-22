// apps/web/src/features/concierge/buildPayloadFromUnified.ts
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
  const tid = tidRaw != null ? String(tidRaw) : null;

  const qsBase = new URLSearchParams();
  qsBase.set("ctx", "concierge");
  if (tid) qsBase.set("tid", tid);

  const items = recs
    .map((r: any) => {
      if (typeof r?.place_id === "string" && r.place_id.trim()) {
        const qs = new URLSearchParams(qsBase);
        return {
          kind: "place" as const,
          placeId: r.place_id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
          detailHref: `/shrines/from-place/${encodeURIComponent(r.place_id)}?${qs.toString()}`,
          detailLabel: "神社の詳細を見る",
        };
      }

      const rawShrineId = r?.shrine_id ?? r?.shrine?.id ?? r?.id ?? null;
      const shrineId = rawShrineId != null ? Number(rawShrineId) : null;

      if (typeof shrineId === "number" && Number.isFinite(shrineId) && shrineId > 0) {
        const qs = new URLSearchParams(qsBase);
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
          detailHref: `/shrines/${shrineId}?${qs.toString()}`,
          detailLabel: "神社の詳細を見る",
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

  // ✅ ここで _astro を UI に出す（型が確実に通る guide で出す）
  const astro = (u as any)?.data?._astro;
  if (astro) {
    const line = `${astro.sun_sign ?? ""} / ${astro.label_ja ?? astro.element ?? ""}${
      astro.element_code ? `（${astro.element_code}）` : ""
    }: ${astro.reason ?? ""}`.trim();

    sections.splice(2, 0, { type: "guide", text: `占星術フィルター: ${line}` } as any);
    // ↑ recommendations の直前に差し込む（見つけやすい）
  }

  return { version: 1, sections };
}
