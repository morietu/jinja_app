// apps/web/src/features/concierge/sectionsBuilder.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";

/**
 * 最小：1件目を primary、残りを recommendations
 */
export function buildConciergeSections(recommendations: ConciergeRecommendation[]): ConciergeSection[] {
  const recs = Array.isArray(recommendations) ? recommendations : [];
  if (recs.length === 0) return [];

  const out: ConciergeSection[] = [];

  out.push({
    kind: "primary",
    title: "おすすめ（まずはここ）",
    items: [recs[0]],
  });

  const rest = recs.slice(1);
  if (rest.length) {
    out.push({
      kind: "recommendations",
      title: "他の候補",
      items: rest,
    });
  }

  return out;
}
