import { describe, expect, it } from "vitest";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildRankReason } from "@/lib/concierge/narrative/buildRankReason";

describe("buildRankReason", () => {
  it("need で候補比較と上位理由だけを返し、相談整理文を含まない", () => {
    const text = buildRankReason({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: [],
      breakdown: null,
    });

    expect(text).not.toContain("状況や気持ちを整理");
    expect(text).toContain("他候補と比べても");
    expect(text).toContain("上位に入りました");
  });

  it("compat で secondaryNeedTags がないと相性軸の上位理由だけを返す", () => {
    const text = buildRankReason({
      mode: "compat",
      primaryNeed: "love",
      secondaryNeedTags: [],
      breakdown: {
        score_total: 1,
        score_element: 2,
        score_need: 0,
        score_popular: 0,
        weights: {
          element: 1,
          need: 1,
          popular: 1,
        },
        matched_need_tags: [],
      } satisfies ConciergeBreakdown,
    });

    expect(text).toContain("相性軸で他候補より上位");
    expect(text).not.toContain("他の相談軸とも比較");
  });
});
