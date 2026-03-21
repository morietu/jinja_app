import { describe, expect, it } from "vitest";
import { buildRecommendationReasonViewModel } from "../buildRecommendationReasonViewModel";

describe("buildRecommendationReasonViewModel", () => {
  it("query入力で primary_reason が need系になる", () => {
    const vm = buildRecommendationReasonViewModel({
      rec: {
        breakdown: { matched_need_tags: ["転機", "仕事"] },
        fallback_mode: "none",
      },
      index: 0,
      mode: "need",
      needTags: ["転機", "仕事"],
    });

    expect(vm.inputType).toBe("query");
    expect(vm.primaryReason).toContain("転機");
    expect(vm.reasonKeys.primary).toBe("need_match");
    expect(vm.topReasonLabel).toBe("最も一致度が高い");
  });

  it("birthdateのみで primary_reason が相性系になる", () => {
    const vm = buildRecommendationReasonViewModel({
      rec: {
        astro_elements: ["water"],
        astro_priority: 2,
        fallback_mode: "none",
      },
      index: 0,
      mode: "compat",
      birthdate: "1992-08-10",
      needTags: [],
    });

    expect(vm.inputType).toBe("birthdate");
    expect(vm.primaryReason).toMatch(/相性|要素/);
    expect(["element_match", "sign_match"]).toContain(vm.reasonKeys.primary);
  });

  it("fallback時に need文が出ない", () => {
    const vm = buildRecommendationReasonViewModel({
      rec: {
        breakdown: { matched_need_tags: ["転機"] },
        fallback_mode: "nearby_unfiltered",
        distance_m: 550,
      },
      index: 0,
      mode: "need",
      needTags: ["転機"],
    });

    expect(vm.inputType).toBe("fallback");
    expect(vm.primaryReason).not.toContain("転機");
    expect(vm.summary).not.toContain("願い");
  });

  it("secondary_reason が2件以上出ない", () => {
    const vm = buildRecommendationReasonViewModel({
      rec: {
        breakdown: { matched_need_tags: ["仕事", "転機", "挑戦"] },
        fallback_mode: "none",
        distance_m: 300,
        popular_score: 0.8,
      },
      index: 1,
      mode: "need",
      needTags: ["仕事"],
    });

    expect(typeof vm.secondaryReason === "string" || typeof vm.secondaryReason === "undefined").toBe(true);
  });

  it("summary が1行で重複しない", () => {
    const vm = buildRecommendationReasonViewModel({
      rec: {
        breakdown: { matched_need_tags: ["厄除け"] },
        fallback_mode: "none",
      },
      index: 1,
      mode: "need",
      needTags: ["厄除け"],
    });

    expect(vm.summary.includes("\n")).toBe(false);
    expect(vm.summary).not.toBe(vm.primaryReason);
    expect(vm.summary).not.toBe(vm.secondaryReason);
  });

  it("top1 のみ reason_label が表示される", () => {
    const a = buildRecommendationReasonViewModel({
      rec: { breakdown: { matched_need_tags: ["転機"] }, fallback_mode: "none" },
      index: 0,
      mode: "need",
      needTags: ["転機"],
    });

    const b = buildRecommendationReasonViewModel({
      rec: { breakdown: { matched_need_tags: ["転機"] }, fallback_mode: "none" },
      index: 1,
      mode: "need",
      needTags: ["転機"],
    });

    expect(a.topReasonLabel).toBeTruthy();
    expect(b.topReasonLabel).toBeUndefined();
  });
});
