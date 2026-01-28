//apps/web/src/features/concierge/buildPayloadFromUnified.ts;
import type { UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type {
  ConciergeSectionsPayload,
  ConciergeSection,
  ConciergeFilterState,
} from "@/features/concierge/sections/types";

import { shrineDetailHref } from "@/lib/navigation/shrineHref";

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
      const rawShrineId = r?.shrine_id ?? r?.shrine?.id ?? null;
      const shrineId = rawShrineId != null ? Number(rawShrineId) : null;
      const placeId = (r?.place_id ?? null)?.toString().trim() || null;

      const detailHref = shrineDetailHref({
        shrineId,
        placeId,
        ctx: "concierge",
        tid,
      });

      if (typeof r?.place_id === "string" && r.place_id.trim()) {

        return {
          kind: "place" as const,
          placeId: r.place_id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? r.location ?? r.address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
          breakdown: r.breakdown ?? null, // ← 追加（ここが“落ちてる”）
          detailHref,
          detailLabel: "神社の詳細を見る",
        };
      }

    
      

      if (typeof shrineId === "number" && Number.isFinite(shrineId) && shrineId > 0) {

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
          detailHref,
        };
      }

      return null;
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  const sections: ConciergeSection[] = [
    {
      type: "filter",
      title: "条件を追加",
      closedLabel: "条件を追加",
      state: filterState,
    },

    { type: "recommendations", title: "候補", items: items as any[] },
    {
      type: "actions",
      items: [
        { action: "add_condition", label: "条件を追加" },
        { action: "open_map", label: "地図で近くの神社を見る" },
      ],
    },
  ];

  // astro（既存のまま）
  const astroRaw = (u as any)?.data?._signals?.astro ?? (u as any)?.data?._astro ?? null;
  const astro = astroRaw && typeof astroRaw === "object" ? astroRaw : null;

  if (astro && (astro.label_ja || astro.element || astro.reason || astro.sun_sign)) {
    const idx = sections.findIndex((s) => s.type === "recommendations");
    const insertAt = idx >= 0 ? idx : 2;

    sections.splice(insertAt, 0, {
      type: "astro",
      title: "占星術フィルター",
      sunSign: typeof astro.sun_sign === "string" ? astro.sun_sign : undefined,
      element: String(astro.label_ja ?? astro.element ?? ""),
      elementCode: typeof astro.element_code === "string" ? astro.element_code : undefined,
      reason: typeof astro.reason === "string" ? astro.reason : undefined,
    });
  }

  // ✅ ここで meta.mode を積む
  const mode = (u as any)?.data?._signals?.mode ?? null;

  return { version: 1, sections, meta: { mode } };
}
