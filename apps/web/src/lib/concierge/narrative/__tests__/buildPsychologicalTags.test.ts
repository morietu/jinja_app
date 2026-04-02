import { describe, expect, it } from "vitest";
import { buildPsychologicalTags } from "@/lib/concierge/narrative/buildPsychologicalTags";

describe("buildPsychologicalTags", () => {
  it("primaryNeed から心理タグを返す", () => {
    const result = buildPsychologicalTags({
      primaryNeed: "courage",
      secondaryNeeds: [],
    });

    expect(result.length).toBeGreaterThan(0);
  });

  it("secondaryNeeds を含めて重複なく返す", () => {
    const result = buildPsychologicalTags({
      primaryNeed: "money",
      secondaryNeeds: ["courage", "courage"],
    });

    expect(Array.from(new Set(result))).toEqual(result);
  });

  it("primaryNeed がなくても secondaryNeeds から返す", () => {
    const result = buildPsychologicalTags({
      primaryNeed: null,
      secondaryNeeds: ["mental"],
    });

    expect(result.length).toBeGreaterThan(0);
  });

  it("何もなければ空配列を返す", () => {
    const result = buildPsychologicalTags({
      primaryNeed: null,
      secondaryNeeds: [],
    });

    expect(result).toEqual([]);
  });
});
