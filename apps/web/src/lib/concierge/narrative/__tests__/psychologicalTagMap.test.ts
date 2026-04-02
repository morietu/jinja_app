import { describe, expect, it } from "vitest";
import { NEED_TO_PSYCHOLOGICAL_TAGS } from "@/lib/concierge/narrative/psychologicalTagMap";

describe("psychologicalTagMap", () => {
  it("主要 NeedTag に心理タグが定義されている", () => {
    expect(NEED_TO_PSYCHOLOGICAL_TAGS.money.length).toBeGreaterThan(0);
    expect(NEED_TO_PSYCHOLOGICAL_TAGS.mental.length).toBeGreaterThan(0);
    expect(NEED_TO_PSYCHOLOGICAL_TAGS.study.length).toBeGreaterThan(0);
  });

  it("courage に前進系タグを含む", () => {
    expect(NEED_TO_PSYCHOLOGICAL_TAGS.courage).toContain("前進");
  });

  it("love に良縁系タグを含む", () => {
    expect(NEED_TO_PSYCHOLOGICAL_TAGS.love).toContain("良縁");
  });

  it("全 NeedTag が空配列ではない", () => {
    for (const tags of Object.values(NEED_TO_PSYCHOLOGICAL_TAGS)) {
      expect(tags.length).toBeGreaterThan(0);
    }
  });
});
