// apps/web/src/features/concierge/sectionsBuilder.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";

export function buildConciergeSections(recs: ConciergeRecommendation[], needTags: string[] = []): ConciergeSection[] {
  const items = Array.isArray(recs) ? recs : [];
  if (items.length === 0) return [];

  const sections: ConciergeSection[] = [{ kind: "primary", title: "おすすめ", items, initialIndex: 0, needTags }];

  // note（任意：needTags がある時だけ）
  if (needTags.length > 0) {
    sections.push({
      kind: "note",
      title: "今回の条件（抽出）",
      text: needTags.join(" / "),
    });
  }

  return sections;
}
