// apps/web/src/features/concierge/sectionsBuilder.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";



export function buildConciergeSections(recs: ConciergeRecommendation[], needTags: string[] = []): ConciergeSection[] {
  const items = Array.isArray(recs) ? recs : [];
  if (items.length === 0) return [];

  const safeNeedTags = Array.isArray(needTags) ? needTags.filter((t) => typeof t === "string" && t.trim()) : [];

  const sections: ConciergeSection[] = [
    {
      kind: "primary",
      title: "おすすめ",
      items,
      initialIndex: 0,
      needTags: safeNeedTags,
    },
  ];

  if (safeNeedTags.length > 0) {
    sections.push({
      kind: "note",
      title: "今回の条件（抽出）",
      text: safeNeedTags.join(" / "),
    });
  }

  return sections;
}
