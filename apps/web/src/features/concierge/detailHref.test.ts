import { describe, it, expect } from "vitest";
import { detailHrefFromRecommendation } from "./detailHref";

describe("detailHrefFromRecommendation", () => {
  it("prefers shrine_id over place_id", () => {
    expect(detailHrefFromRecommendation({ shrine_id: 100001, place_id: "abc" }, { ctx: "concierge", tid: 139 })).toBe(
      "/shrines/100001?ctx=concierge&tid=139",
    );
  });

  it("falls back to place_id", () => {
    expect(detailHrefFromRecommendation({ place_id: "abc" })).toBe("/shrines/resolve?place_id=abc&ctx=concierge");
  });

  it("returns null when no ids", () => {
    expect(detailHrefFromRecommendation({ name: "x" })).toBeNull();
  });
});
