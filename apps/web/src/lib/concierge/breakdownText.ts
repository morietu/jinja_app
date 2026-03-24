import type { ConciergeBreakdown } from "@/lib/api/concierge";

function toNum(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function pickReasonLabel(b?: ConciergeBreakdown | null): string | null {
  if (!b) return null;

  const w = b.weights ?? { element: 0, need: 0, popular: 0 };

  const contrib = {
    element: toNum(b.score_element) * toNum(w.element),
    need: toNum(b.score_need) * toNum(w.need),
    popular: toNum(b.score_popular) * toNum(w.popular),
  } as const;

  const entries = Object.entries(contrib) as Array<[keyof typeof contrib, number]>;
  entries.sort((a, c) => c[1] - a[1]);

  const [topKey, topVal] = entries[0] ?? [null, 0];
  if (!topKey || topVal <= 0) return null;

  if (topKey === "need") return (b.matched_need_tags?.length ?? 0) > 0 ? "ご利益が一致" : "希望条件に合う";
  if (topKey === "element") return "雰囲気が合う";
  if (topKey === "popular") return "人気の傾向を考慮";
  return null;
}

export function buildConciergeHint(b?: ConciergeBreakdown | null): string | null {
  if (!b) return null;
  const tags = Array.isArray(b.matched_need_tags) ? b.matched_need_tags.filter(Boolean) : [];
  const head = tags.slice(0, 3).join(" / ");
  return head ? `一致した条件：${head}${tags.length > 3 ? " ほか" : ""}` : "おすすめ理由の内訳があります";
}
