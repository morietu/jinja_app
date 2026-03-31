import { expect, it } from "vitest";
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

it("resp.ok=false のときは空配列を返す", () => {
  const items = conciergeToShrineListItems({ ok: false } as any);
  expect(items).toEqual([]);
});

it("top-level thread_id を tid に入れる", () => {
  const resp = {
    ok: true,
    thread_id: "thread-top",
    data: {
      recommendations: [
        {
          name: "神社A",
          shrine_id: 201,
          reason: "前に進みたい",
          breakdown: { matched_need_tags: ["courage"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].tid).toBe("thread-top");
});

it("data.thread_id を tid に入れる", () => {
  const resp = {
    ok: true,
    data: {
      thread_id: "thread-data",
      recommendations: [
        {
          name: "神社B",
          shrine_id: 202,
          reason: "休みたい",
          breakdown: { matched_need_tags: ["rest"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].tid).toBe("thread-data");
});

it("display_name を title に優先し、address を表示する", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "正式名",
          display_name: "表示名",
          shrine_id: 203,
          address: "東京都千代田区1-1",
          reason: "仕事を整えたい",
          breakdown: { matched_need_tags: ["career"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.title).toBe("表示名");
  expect(items[0].cardProps.address).toBe("東京都千代田区1-1");
});

it("address が無いときは location を使う", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "神社C",
          shrine_id: 204,
          location: "渋谷エリア",
          reason: "恋愛を進めたい",
          breakdown: { matched_need_tags: ["love"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.address).toBe("渋谷エリア");
});

it("primary_reason.label があるとそれを優先して短句を作る", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "三峯神社",
          shrine_id: 205,
          reason: "別の理由文",
          _explanation_payload: {
            primary_reason: { label: "courage" },
            original_reason: "元の理由文",
          },
          breakdown: { matched_need_tags: ["money"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationPrimaryReason).toBe("止まった流れを動かす");
});

it("explanation.summary があれば explanationSummary と rawReason に使う", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "神社D",
          shrine_id: 206,
          explanation: {
            summary: "気持ちを整えたい時に向いています",
          },
          breakdown: { matched_need_tags: ["mental"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.explanationSummary).toBe("気持ちを整えたい時に向いています");
  expect(items[0].cardProps.explanationPrimaryReason).toBe("不安や気持ちを整える");
});

it("matched_need_tags が空なら _need.tags を badgesOverride に使う", () => {
  const resp = {
    ok: true,
    data: {
      _need: { tags: ["money", "rest"] },
      recommendations: [
        {
          name: "神社E",
          shrine_id: 207,
          reason: "整えたい",
          breakdown: { matched_need_tags: [] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items[0].cardProps.badgesOverride).toEqual(["金運", "休息"]);
});

it("shrine_id がない recommendation は除外される", () => {
  const resp = {
    ok: true,
    data: {
      recommendations: [
        {
          name: "place only shrine",
          place_id: "place_123",
          reason: "理由あり",
          breakdown: { matched_need_tags: ["money"] },
        },
      ],
    },
  };

  const items = conciergeToShrineListItems(resp as any);
  expect(items).toEqual([]);
});


