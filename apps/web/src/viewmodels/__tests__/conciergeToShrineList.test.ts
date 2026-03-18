import { describe, expect, it } from "vitest";
import { conciergeToShrineListItems } from "../conciergeToShrineList";

describe("conciergeToShrineListItems", () => {
  it("matched_need_tags を優先し、summary を recommendReason に写す", () => {
    const resp = {
      ok: true,
      data: {
        _need: { tags: ["mental", "rest"] },
        recommendations: [
          {
            name: "神社A",
            display_name: "神社A",
            reason: "旧理由",
            location: "東京都千代田区",
            distance_m: 123,
            shrine_id: 10,
            explanation: {
              summary: "転機・仕事に向き合う参拝に",
              reasons: [
                {
                  code: "NEED_MATCH",
                  label: "相談との一致",
                  text: "今の相談内容と、転機・仕事に関わる願いごとが重なる神社です。",
                },
              ],
            },
            breakdown: {
              matched_need_tags: ["career"],
              score_total: 1.23,
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("shrine_10");
    expect(items[0].cardProps.name).toBe("神社A");
    expect(items[0].cardProps.address).toBe("東京都千代田区");
    expect(items[0].cardProps.recommendReason).toBe("転機・仕事に向き合う参拝に");
    expect(items[0].cardProps.distanceM).toBe(123);
    expect(items[0].cardProps.tags).toEqual(["転機・仕事"]);
    expect(items[0].cardProps.compatibilityLabels).toEqual(["転機・仕事"]);
    expect(items[0].cardProps.href).toBe("/shrines/10");
    expect(items[0].cardProps.explanationReasons?.[0].text).toBe(
      "今の相談内容と、転機・仕事に関わる願いごとが重なる神社です。",
    );
  });

  it("_need.tags を fallback tag として使う", () => {
    const resp = {
      ok: true,
      data: {
        _need: { tags: ["mental", "rest"] },
        recommendations: [
          {
            name: "神社B",
            reason: "心を整えたいときの参拝に",
            location: "東京都港区",
            distance_m: 456,
            breakdown: {
              matched_need_tags: [],
              score_total: 0.8,
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("name_%E7%A5%9E%E7%A4%BEB");
    expect(items[0].cardProps.name).toBe("神社B");
    expect(items[0].cardProps.address).toBe("東京都港区");
    expect(items[0].cardProps.recommendReason).toBe("心を整えたいときの参拝に");
    expect(items[0].cardProps.distanceM).toBe(456);
    expect(items[0].cardProps.tags).toEqual(["不安・心", "休息"]);
    expect(items[0].cardProps.href).toBeUndefined();
  });

  it("ok=false のときは空配列を返す", () => {
    const items = conciergeToShrineListItems({ ok: false });
    expect(items).toEqual([]);
  });

  it("compatibilityLabels / subReason / 日本語タグ化 を cardProps に写す", () => {
    const resp = {
      ok: true,
      data: {
        _need: { tags: ["mental", "rest"] },
        recommendations: [
          {
            name: "神社C",
            display_name: "神社C",
            reason: "不安・心に向き合う参拝に",
            location: "東京都渋谷区",
            distance_m: 789,
            bullets: ["落ち着いて気持ちを整えやすい雰囲気", "静かに参拝しやすい"],
            breakdown: {
              matched_need_tags: ["mental", "rest"],
              score_total: 1.1,
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].cardProps.name).toBe("神社C");
    expect(items[0].cardProps.recommendReason).toBe("不安・心に向き合う参拝に");
    expect(items[0].cardProps.distanceM).toBe(789);
    expect(items[0].cardProps.tags).toEqual(["不安・心", "休息"]);
    expect(items[0].cardProps.compatibilityLabels).toEqual(["不安・心"]);
    expect(items[0].cardProps.subReason).toBe("落ち着いて気持ちを整えやすい雰囲気");
  });

  it("explanation を cardProps に写す", () => {
    const resp = {
      ok: true,
      data: {
        recommendations: [
          {
            name: "神社A",
            explanation: {
              summary: "不安・心に向き合う参拝に",
              reasons: [
                { code: "NEED_MATCH", label: "相談との一致", text: "不安・心に関する相談内容との一致が見られます。" },
                { code: "SHRINE_FEATURE", label: "神社の特徴", text: "落ち着いて気持ちを整えやすい雰囲気" },
              ],
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items[0].cardProps.explanationSummary).toBe("不安・心に向き合う参拝に");
    expect(items[0].cardProps.explanationReasons).toHaveLength(2);
    expect(items[0].cardProps.explanationReasons?.[0].code).toBe("NEED_MATCH");
    expect(items[0].cardProps.explanationReasons?.[0].text).toBe("不安・心に関する相談内容との一致が見られます。");
  });
});
