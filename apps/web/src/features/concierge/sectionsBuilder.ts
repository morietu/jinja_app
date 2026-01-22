// apps/web/src/features/concierge/sectionsBuilder.ts
import type { ConciergeRecommendation } from "@/lib/api/concierge";
import type { ConciergeSection } from "@/features/concierge/types/sections";

function cleanTags(needTags: string[] = []) {
  return Array.isArray(needTags) ? needTags.filter((t) => typeof t === "string" && t.trim()) : [];
}

export function buildConciergeSections(recs: ConciergeRecommendation[], needTags: string[] = []): ConciergeSection[] {
  const safeNeedTags = cleanTags(needTags);
  const items = Array.isArray(recs) ? recs.slice(0, 3) : [];

  // ✅ 0件でも「何か」を返す（初回送信で真っ白になるのを防ぐ）
  if (items.length === 0) {
    const hint = safeNeedTags.length ? `今の条件：${safeNeedTags.join(" / ")}` : "条件を追加すると精度が上がります。";
    return [
      {
        kind: "note",
        title: "ガイド",
        text: `まだ候補を絞り切れていません。${hint}`,
      },
      {
        kind: "note",
        title: "ヒント",
        text: "「場所（例：渋谷/京都駅）」や「ご利益（例：縁結び/厄除け）」を足すと出やすいです。",
      },
    ];
  }

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