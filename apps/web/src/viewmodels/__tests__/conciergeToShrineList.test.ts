import { describe, expect, it } from "vitest";
import { conciergeToShrineListItems } from "../conciergeToShrineList";

it("money × strong では三峯神社の短句を返す", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "三峯神社",
          shrine_id: 101,
          reason: "金運を上げたい",
          breakdown: {
            score_element: 0,
            score_need: 1,
            score_popular: 0,
            score_total: 1.0,
            weights: { element: 0, need: 1, popular: 0 },
            matched_need_tags: ["money"],
          },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationPrimaryReason).toBe("金運や流れを動かす");
});

it("money × quiet では伊勢神宮（内宮）の短句を返す", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "伊勢神宮（内宮）",
          shrine_id: 102,
          reason: "金運を整えたい",
          breakdown: {
            score_element: 0,
            score_need: 1,
            score_popular: 0,
            score_total: 1.0,
            weights: { element: 0, need: 1, popular: 0 },
            matched_need_tags: ["money"],
          },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationPrimaryReason).toBe("金運や巡りを整える");
});

it("study × tight では乃木神社の短句を返す", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "乃木神社",
          shrine_id: 103,
          reason: "集中したい",
          breakdown: {
            score_element: 0,
            score_need: 1,
            score_popular: 0,
            score_total: 1.0,
            weights: { element: 0, need: 1, popular: 0 },
            matched_need_tags: ["study"],
          },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationPrimaryReason).toBe("集中や目標を定める");
});

it("primary が取れないときは fallbackText を返す", () => {
  const resp = {
    ok: true,
    data: {
      _need: { tags: ["protection"] },
      recommendations: [
        {
          name: "神社Z",
          shrine_id: 104,
          reason: "厄除けを願う参拝に",
          breakdown: {
            score_element: 0,
            score_need: 0,
            score_popular: 0,
            score_total: 0.5,
            weights: { element: 0, need: 1, popular: 0 },
            matched_need_tags: [],
          },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationPrimaryReason).toBe("厄除けを願う参拝に");
});
