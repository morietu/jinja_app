import { describe, expect, it } from "vitest";
import { buildRecommendationNarrative } from "@/lib/concierge/narrative/buildRecommendationNarrative";

describe("buildRecommendationNarrative", () => {
  it("primaryNeed から psychologicalTags を生成する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: [],
      shrineName: "三峯神社",
      shrineTone: "strong",
      benefitLabels: ["開運", "厄除け"],
    });

    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.psychologicalTags).toContain("前進");
  });

  it("psychologicalTags から symbolTags を生成する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "mental",
      secondaryNeedTags: ["rest"],
      shrineName: "伊勢神宮",
      shrineTone: "quiet",
      benefitLabels: ["浄化", "開運"],
    });

    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.symbolTags.length).toBeGreaterThan(0);
  });

  it("derivedSymbolTags と shrineSymbolTags を統合する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "study",
      secondaryNeedTags: [],
      shrineName: "乃木神社",
      shrineTone: "tight",
      benefitLabels: ["学業成就"],
      shrineSymbolTags: ["神紋", "剣"],
    });

    expect(result.symbolTags).toContain("神紋");
    expect(result.symbolTags).toContain("剣");
  });

  it("symbolTags の重複を除去する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: ["career"],
      shrineName: "三峯神社",
      shrineTone: "strong",
      benefitLabels: ["開運"],
      shrineSymbolTags: ["光", "光", "鳥居"],
    });

    expect(result.symbolTags).toEqual(Array.from(new Set(result.symbolTags)));
  });

  it("mode=compat でも psychologicalTags / symbolTags を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "compat",
      primaryNeed: "love",
      secondaryNeedTags: [],
      shrineName: "出雲大社",
      shrineTone: "neutral",
      benefitLabels: ["縁結び"],
      userElementLabel: "水の気質",
      primaryReasonLabel: "良縁",
    });

    expect(result.mode).toBe("compat");
    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.symbolTags.length).toBeGreaterThan(0);
  });
});
