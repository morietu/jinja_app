import { describe, expect, it } from "vitest";
import { buildSymbolTags } from "@/lib/concierge/narrative/buildSymbolTags";

describe("buildSymbolTags", () => {
  it("心理タグから象徴タグを返す", () => {
    const result = buildSymbolTags({
      psychologicalTags: ["前進"],
    });

    expect(result.length).toBeGreaterThan(0);
  });

  it("複数の心理タグから象徴タグをまとめて返す", () => {
    const result = buildSymbolTags({
      psychologicalTags: ["前進", "決断"],
    });

    expect(result.length).toBeGreaterThan(0);
  });

  it("重複を除去する", () => {
    const result = buildSymbolTags({
      psychologicalTags: ["前進", "前進"],
    });

    expect(Array.from(new Set(result))).toEqual(result);
  });

  it("入力が空なら空配列を返す", () => {
    const result = buildSymbolTags({
      psychologicalTags: [],
    });

    expect(result).toEqual([]);
  });
});
