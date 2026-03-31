// apps/web/src/lib/shrine/__tests__/buildShrineDetailModel.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShrineDetailModel } from "../buildShrineDetailModel";

vi.mock("@/components/shrine/buildShrineCardProps", () => ({
  buildShrineCardProps: vi.fn(() => ({
    cardProps: {
      title: "三峯神社",
      imageUrl: "https://example.com/card.jpg",
    },
  })),
}));

vi.mock("@/lib/shrine/getBenefitLabels", () => ({
  getBenefitLabels: vi.fn(() => ["開運", "厄除け", "金運"]),
}));

vi.mock("@/lib/shrine/buildShrineExplanation", () => ({
  buildShrineExplanation: vi.fn(() => ({
    title: "説明",
    summary: "説明サマリ",
  })),
}));

vi.mock("@/lib/shrine/buildShrineJudge", () => ({
  buildShrineJudge: vi.fn(() => ({
    score: 4,
    label: "おすすめ",
  })),
}));

vi.mock("@/lib/nav/buildShrineHref", () => ({
  buildShrineHref: vi.fn((id: number, args?: { subpath?: string; query?: Record<string, string> }) => {
    const subpath = args?.subpath ? `/${args.subpath}` : "";
    const query = args?.query ? `?${new URLSearchParams(args.query).toString()}` : "";
    return `/shrines/${id}${subpath}${query}`;
  }),
}));

const shrineStub = {
  id: 101,
  name: "三峯神社",
  kana: "みつみねじんじゃ",
  address: "埼玉県秩父市三峰298-1",
  description: "強いご神気で知られる神社",
  image_url: "https://example.com/shrine.jpg",
  website_url: "https://example.com",
  access: "西武秩父駅からバス",
  business_hours: "9:00-17:00",
  closed_days: null,
  parking_info: null,
  prefecture: "埼玉県",
  city: "秩父市",
  latitude: 35.909,
  longitude: 138.925,
  goshuin_available: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  benefits: [],
  types: [],
} as any;

const publicGoshuinsStub = [
  {
    id: 1,
    image_url: "https://example.com/goshuin-latest.jpg",
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: 2,
    image_url: "https://example.com/goshuin-old.jpg",
    created_at: "2026-02-01T10:00:00Z",
  },
] as any[];

const conciergeBreakdownStub = {
  matched_need_tags: ["courage", "money"],
  score_need: 2,
  score_element: 1,
  score_popular: 0.8,
  score_total: 2.6,
  weights: {
    element: 0.6,
    need: 0.3,
    popular: 0.1,
  },
} as any;

describe("buildShrineDetailModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("concierge文脈で conciergeDeepReason があれば proposalLead / proposalWhy / judgeSection.items を優先する", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: publicGoshuinsStub,
      conciergeBreakdown: conciergeBreakdownStub,
      conciergeReason: "旧来の理由文です",
      conciergeDeepReason: {
        interpretation: "迷いが長い時は、まず流れを切り替える視点が必要です。",
        shrineMeaning: "三峯神社は、停滞を断ち切る節目として置きやすい神社です。",
        action: "先延ばしを止めて一歩を決める参拝に向いています。",
        short: "止まった流れを動かす",
      },
      conciergeMode: "need",
      ctx: "concierge",
      tid: "thread-1",
    });

    expect(result.proposal).toBe("今回の相談の整理");
    expect(result.proposalLead).toBe("迷いが長い時は、まず流れを切り替える視点が必要です。");

    expect(result.proposalWhy).toEqual([
      {
        label: "相談との一致",
        text: "迷いが長い時は、まず流れを切り替える視点が必要です。",
      },
      {
        label: "神社のご利益",
        text: "三峯神社は、停滞を断ち切る節目として置きやすい神社です。",
      },
      {
        label: "補助的な一致",
        text: "先延ばしを止めて一歩を決める参拝に向いています。",
      },
    ]);

    expect(result.judgeSection.lead).toBe("迷いが長い時は、まず流れを切り替える視点が必要です。");

    expect(result.judgeSection.items).toEqual([
      {
        key: "interpretation",
        title: "今の状態との重なり",
        body: "迷いが長い時は、まず流れを切り替える視点が必要です。",
      },
      {
        key: "meaning",
        title: "この神社をすすめる理由",
        body: "三峯神社は、停滞を断ち切る節目として置きやすい神社です。",
      },
      {
        key: "action",
        title: "参拝を置く意味",
        body: "先延ばしを止めて一歩を決める参拝に向いています。",
      },
    ]);
  });

  it("concierge文脈でも conciergeDeepReason が無ければ従来ロジックへフォールバックする", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: publicGoshuinsStub,
      conciergeBreakdown: conciergeBreakdownStub,
      conciergeReason: "旧来の理由文です",
      conciergeMode: "need",
      ctx: "concierge",
      tid: "thread-1",
    });

    expect(result.proposal).toBe("今回の相談の整理");
    expect(result.proposalLead).toBe("旧来の理由文です");

    expect(result.proposalWhy).toEqual([
      {
        label: "相談との一致",
        text: "行動のきっかけや後押しを求める意図が中心にあり、金運面も立て直したい流れが見られます。",
      },
      {
        label: "神社のご利益",
        text: "三峯神社は開運・厄除け・金運に関わるご利益で知られ、止まっている流れを動かし始める節目や、背中を押す場として据えやすい神社です。",
      },
      {
        label: "補助的な一致",
        text: "三峯神社は、背中を押してほしい気持ちに加えて、金運や巡りの停滞も立て直したい今の段階で向いています。",
      },
    ]);

    expect(result.judgeSection.lead).toBe("旧来の理由文です");
    expect(result.judgeSection.items).toEqual([
      {
        key: "lead",
        title: "主軸",
        body: "今回の相談では、今の状態を整えたい意図が主軸にあります。",
      },
      {
        key: "reason",
        title: "相談との一致",
        body: "相談内容に近い要素が見られます。",
      },
      {
        key: "goriyaku",
        title: "この神社のご利益",
        body: "開運・厄除け・金運のご利益が、今回の相談内容に近い方向です。",
      },
      {
        key: "secondary",
        title: "補助的な方向性",
        body: "主軸を補う方向性があります。",
      },
    ]);
  });

  it("map文脈では conciergeDeepReason があっても従来表示を優先する", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: publicGoshuinsStub,
      conciergeBreakdown: conciergeBreakdownStub,
      conciergeReason: "旧来の理由文です",
      conciergeDeepReason: {
        interpretation: "これは map では使われないはず",
        shrineMeaning: "これは map では使われないはず",
        action: "これは map では使われないはず",
        short: "短句",
      },
      conciergeMode: "need",
      ctx: "map",
    });

    expect(result.proposal).toBe("金運と前進を後押しする参拝先");
    expect(result.proposalLead).toBe("今回の相談では、今の状態に近い悩みを主軸に見ています。");

    expect(result.proposalWhy).toEqual([
      {
        label: "相談との一致",
        text: "行動のきっかけや後押しを求める意図が中心にあり、金運面も立て直したい流れが見られます。",
      },
      {
        label: "神社のご利益",
        text: "三峯神社は開運・厄除け・金運に関わるご利益で知られ、止まっている流れを動かし始める節目や、背中を押す場として据えやすい神社です。",
      },
      {
        label: "補助的な一致",
        text: "三峯神社は、背中を押してほしい気持ちに加えて、金運や巡りの停滞も立て直したい今の段階で向いています。",
      },
    ]);

    expect(result.judgeSection.lead).toBe("今回の相談では、今の状態に近い悩みを主軸に見ています。");
  });

  it("heroImageUrl は最新の public goshuin を優先する", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: publicGoshuinsStub,
      ctx: "map",
    });

    expect(result.heroImageUrl).toBe("https://example.com/goshuin-latest.jpg");
  });

  it("goshuin 一覧 href に ctx と tid を引き継ぐ", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      ctx: "concierge",
      tid: "thread-xyz",
    });

    expect(result.publicGoshuinsViewAllHref).toBe("/shrines/101/goshuins?ctx=concierge&tid=thread-xyz");
  });
});
