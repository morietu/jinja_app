import { describe, it, expect } from "vitest";
import { detailHrefFromRecommendation } from "../detailHref";

describe("detailHrefFromRecommendation", () => {
  it("registered: shrine_id があれば /shrines/:id を返す（ctx/tid 付き）", () => {
    const href = detailHrefFromRecommendation({ shrine_id: 100001, place_id: "ChIJxxx" } as any, {
      ctx: "concierge",
      tid: 139,
    });
    expect(href).toBe("/shrines/100001?ctx=concierge&tid=139");
  });

  it("unregistered: shrine_id が無く place_id があれば /shrines/resolve にフォールバックする", () => {
    const href = detailHrefFromRecommendation({ place_id: "ChIJxxx" } as any, {
      ctx: "concierge",
      tid: 139,
    });
    expect(href).toBe("/shrines/resolve?place_id=ChIJxxx&ctx=concierge&tid=139");
  });

  it("placeId / place_id どちらでも拾う（揺れ耐性）", () => {
    expect(detailHrefFromRecommendation({ placeId: "A" } as any)).toBe("/shrines/resolve?place_id=A&ctx=concierge");
    expect(detailHrefFromRecommendation({ place_id: "B" } as any)).toBe("/shrines/resolve?place_id=B&ctx=concierge");
  });

  it("どちらも無ければ null（導線を出さない用）", () => {
    expect(detailHrefFromRecommendation({} as any)).toBeNull();
  });
});
