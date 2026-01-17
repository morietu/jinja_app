// apps/web/src/features/concierge/sectionsBuilder.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";

export function buildConciergeSections(recs: ConciergeRecommendation[]): ConciergeSection[] {
  const safe = Array.isArray(recs) ? recs : [];
  if (safe.length === 0) return [];

  return [
    {
      kind: "primary",
      title: "おすすめ",
      items: safe.slice(0, 3),
      needTags: [],
    },
  ];
}
