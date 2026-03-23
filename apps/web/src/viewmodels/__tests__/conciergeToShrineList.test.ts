import { describe, expect, it } from "vitest";
import { conciergeToShrineListItems } from "../conciergeToShrineList";

describe("conciergeToShrineListItems", () => {
  it("matched_need_tags を優先し、summary と reason を concierge card props に写す", () => {
    const resp = {
      ok: true,
      thread_id: "thread-123",
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
              score_element: 0,
              score_need: 1,
              score_popular: 0,
              score_total: 1.23,
              weights: {
                element: 0,
                need: 1,
                popular: 0,
              },
              matched_need_tags: ["career"],
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("shrine_10");
    expect(items[0].tid).toBe("thread-123");
    expect(items[0].cardProps.shrineId).toBe(10);
    expect(items[0].cardProps.title).toBe("神社A");
    expect(items[0].cardProps.address).toBe("東京都千代田区");
    expect(items[0].cardProps.explanationSummary).toBe("転機・仕事に向き合う参拝に");
    expect(items[0].cardProps.explanationPrimaryReason).toBe("仕事や転機を整える");
    expect(items[0].cardProps.badgesOverride).toEqual(["転機・仕事"]);
    expect(items[0].cardProps.breakdown?.matched_need_tags).toEqual(["career"]);
  });

  it("_need.tags を fallback tag として使う", () => {
    const resp = {
      ok: true,
      thread_id: "thread-456",
      data: {
        _need: { tags: ["mental", "rest"] },
        recommendations: [
          {
            name: "神社B",
            reason: "心を整えたいときの参拝に",
            location: "東京都港区",
            breakdown: {
              score_element: 0,
              score_need: 0,
              score_popular: 0,
              score_total: 0.8,
              weights: {
                element: 0,
                need: 1,
                popular: 0,
              },
              matched_need_tags: [],
            },
            shrine_id: 20,
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("shrine_20");
    expect(items[0].tid).toBe("thread-456");
    expect(items[0].cardProps.shrineId).toBe(20);
    expect(items[0].cardProps.title).toBe("神社B");
    expect(items[0].cardProps.address).toBe("東京都港区");
    expect(items[0].cardProps.explanationSummary).toBeNull();
    expect(items[0].cardProps.explanationPrimaryReason).toBe("不安や気持ちを整える");
    expect(items[0].cardProps.badgesOverride).toEqual(["不安・心", "休息"]);
  });

  it("ok=false のときは空配列を返す", () => {
    const items = conciergeToShrineListItems({ ok: false });
    expect(items).toEqual([]);
  });

  it("matched_need_tags を breakdown に残し、日本語タグを badgesOverride に入れる", () => {
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
            shrine_id: 30,
            bullets: ["落ち着いて気持ちを整えやすい雰囲気", "静かに参拝しやすい"],
            breakdown: {
              score_element: 0,
              score_need: 2,
              score_popular: 0,
              score_total: 1.1,
              weights: {
                element: 0,
                need: 1,
                popular: 0,
              },
              matched_need_tags: ["mental", "rest"],
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].cardProps.shrineId).toBe(30);
    expect(items[0].cardProps.title).toBe("神社C");
    expect(items[0].cardProps.explanationPrimaryReason).toBe("不安や気持ちを整える");
    expect(items[0].cardProps.badgesOverride).toEqual(["不安・心", "休息"]);
    expect(items[0].cardProps.breakdown?.matched_need_tags).toEqual(["mental", "rest"]);
  });

  it("summary が無いときは reason を explanationPrimaryReason に使う", () => {
    const resp = {
      ok: true,
      data: {
        recommendations: [
          {
            name: "神社D",
            shrine_id: 40,
            reason: "前進・後押しを願う参拝に",
            breakdown: {
              score_element: 0,
              score_need: 1,
              score_popular: 0,
              score_total: 0.9,
              weights: {
                element: 0,
                need: 1,
                popular: 0,
              },
              matched_need_tags: ["courage"],
            },
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);

    expect(items).toHaveLength(1);
    expect(items[0].cardProps.shrineId).toBe(40);
    expect(items[0].cardProps.title).toBe("神社D");
    expect(items[0].cardProps.explanationSummary).toBeNull();
    expect(items[0].cardProps.explanationPrimaryReason).toBe("次の一歩を後押しする");
    expect(items[0].cardProps.badgesOverride).toEqual(["前進・後押し"]);
  });

  it("shrine_id が無い recommendation は除外する", () => {
    const resp = {
      ok: true,
      data: {
        recommendations: [
          {
            name: "神社E",
            place_id: "place_123",
            reason: "place候補",
          },
        ],
      },
    };

    const items = conciergeToShrineListItems(resp as any);
    expect(items).toEqual([]);
  });
});
