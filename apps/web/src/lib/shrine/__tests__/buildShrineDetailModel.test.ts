// apps/web/src/lib/shrine/__tests__/buildShrineDetailModel.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildShrineDetailModel } from "../buildShrineDetailModel";

vi.mock("@/components/shrine/buildShrineCardProps", () => ({
  buildShrineCardProps: vi.fn((shrine: any) => ({
    cardProps: {
      title: shrine.name ?? `神社 #${shrine.id}`,
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
      {
        label: "上位になった理由",
        text: "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
      },
      {
        label: "他候補との差",
        text: "三峯神社は、今回の候補の中でも行動のきっかけを持ちやすい候補です。",
      },
    ]);
    expect(result.rankReason).toBe(
      "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
    );

    expect(result.judgeSection.lead).toBe("迷いが長い時は、まず流れを切り替える視点が必要です。");

    expect(result.judgeSection.items).toEqual([
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
      {
        label: "上位になった理由",
        text: "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
      },
      {
        label: "他候補との差",
        text: "三峯神社は、今回の候補の中でも行動のきっかけを持ちやすい候補です。",
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
      {
        key: "rank",
        title: "上位になった理由",
        body: "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
      },
    ]);
    expect(result.rankReason).toBe(
      "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
    );
    expect(result.explanation.rankReason).toBe(
      "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
    );
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

    expect(result.proposal).toBe("流れを立て直し、次の一歩を決めたい時の参拝先");
    expect(result.proposalLead).toBe("今の状態を整理すると、まず向き合うべきテーマがあります。");

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
      {
        label: "上位になった理由",
        text: "今回は「前進」のテーマとの一致が強く、他候補より行動のきっかけを持ちやすい候補として上位に入りました。",
      },
      {
        label: "他候補との差",
        text: "三峯神社は、今回の候補の中でも行動のきっかけを持ちやすい候補です。",
      },
    ]);

    expect(result.judgeSection.lead).toBe("今の状態を整理すると、まず向き合うべきテーマがあります。");
  });
  it("explanation に proposal / judgeSection / rankReason を集約する", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      conciergeBreakdown: conciergeBreakdownStub,
      conciergeMode: "need",
      ctx: "map",
    });

    expect(result.explanation).toBeDefined();
    expect(result.explanation.proposal).toBe(result.proposal);
    expect(result.explanation.proposalLead).toBe(result.proposalLead);
    expect(result.explanation.proposalWhy).toEqual(result.proposalWhy);
    expect(result.explanation.judgeSection).toEqual(result.judgeSection);
    expect(result.explanation.rankReason).toBe(result.rankReason);
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

  it("career + courage では仕事や転機に向き合う参拝先になる", () => {
    const result = buildShrineDetailModel({
      shrine: {
        ...shrineStub,
        id: 102,
        name: "乃木神社",
      } as any,
      publicGoshuins: [],
      conciergeBreakdown: {
        matched_need_tags: ["career", "courage"],
      } as any,
      ctx: "map",
    });

    expect(result.proposal).toBe("仕事や転機に向き合う参拝先");
    expect(result.proposalWhy[0]).toEqual({
      label: "相談との一致",
      text: "行動のきっかけや後押しを求める意図が相談の中心にあります。",
    });
  });

  it("mental + rest では気持ちを整えて休息したい時の参拝先になる", () => {
    const result = buildShrineDetailModel({
      shrine: {
        ...shrineStub,
        id: 103,
        name: "伊勢神宮（内宮）",
      } as any,
      publicGoshuins: [],
      conciergeBreakdown: {
        matched_need_tags: ["mental", "rest"],
      } as any,
      ctx: "map",
    });

    expect(result.proposal).toBe("気持ちを整えて休息したい時の参拝先");
    expect(result.proposalWhy[0]).toEqual({
      label: "相談との一致",
      text: "不安や気持ちの揺れを整えたい意図が中心にあり、落ち着いて休みたい状態も見られます。",
    });
  });

  it("love では良縁を願う参拝先になる", () => {
    const result = buildShrineDetailModel({
      shrine: {
        ...shrineStub,
        id: 104,
        name: "神社L",
      } as any,
      publicGoshuins: [],
      conciergeBreakdown: {
        matched_need_tags: ["love"],
      } as any,
      ctx: "map",
    });

    expect(result.proposal).toBe("良縁を願う参拝先");
    expect(result.proposalWhy[0]).toEqual({
      label: "相談との一致",
      text: "良縁や恋愛を前向きに進めたい意図が相談の中心にあります。",
    });
  });

  it("study では学業や合格に集中したい時の参拝先になる", () => {
    const result = buildShrineDetailModel({
      shrine: {
        ...shrineStub,
        id: 105,
        name: "乃木神社",
      } as any,
      publicGoshuins: [],
      conciergeBreakdown: {
        matched_need_tags: ["study"],
      } as any,
      ctx: "map",
    });

    expect(result.proposal).toBe("学業や合格に集中したい時の参拝先");
    expect(result.proposalWhy[0]).toEqual({
      label: "相談との一致",
      text: "学業や合格に集中したい意図が相談の中心にあります。",
    });
  });

  it("money × quiet では神社のご利益文が quiet 向けになる", () => {
    const result = buildShrineDetailModel({
      shrine: {
        ...shrineStub,
        id: 106,
        name: "伊勢神宮（内宮）",
      } as any,
      publicGoshuins: [],
      conciergeBreakdown: {
        matched_need_tags: ["money"],
      } as any,
      ctx: "map",
    });

    expect(result.proposalWhy[1]).toEqual({
      label: "神社のご利益",
      text: "伊勢神宮（内宮）は開運・厄除け・金運に関わるご利益で知られ、金運や巡りを焦らず整え直したい段階で判断材料にしやすい神社です。",
    });
  });

  it("mode=compat では judgeSection が相性ベースになる", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      conciergeMode: "compat",
      conciergeExplanationPayload: {
        primary_reason: {
          label_ja: "生年月日との相性",
        },
        secondary_reasons: [],
      } as any,
      ctx: "map",
    });

    expect(result.judgeSection.disclosureTitle).toBe("相性の根拠");
    expect(result.judgeSection.title).toBe("今回の相性に応じた参拝先");
    expect(result.judgeSection.items[0]).toEqual({
      key: "compat",
      title: "生年月日との相性",
      body: "今回の提案では、生年月日との相性を主軸に候補を整理しています。",
    });
  });

  it("mode=need では judgeSection が相談ベースになる", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      conciergeMode: "need",
      conciergeExplanationPayload: {
        primary_need_label_ja: "金運",
        primary_reason: {
          label_ja: "金運",
        },
        secondary_reasons: [{ label_ja: "前進・後押し" }],
      } as any,
      ctx: "map",
    });

    expect(result.judgeSection.disclosureTitle).toBe("おすすめの根拠");
    expect(result.judgeSection.title).toBe("今回の相談に応じた参拝先");
    expect(result.judgeSection.items[0]).toEqual({
      key: "lead",
      title: "主軸",
      body: "今回の相談では、金運に関わる悩みが主軸にあります。",
    });
  });

  it("public goshuin が無いときは cardProps.imageUrl を heroImageUrl に使う", () => {
    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      ctx: "map",
    });

    expect(result.heroImageUrl).toBe("https://example.com/card.jpg");
  });

  it("public goshuin も cardProps.imageUrl も無いときは heroImageUrl が null", async () => {
    const { buildShrineCardProps } = await import("@/components/shrine/buildShrineCardProps");
    vi.mocked(buildShrineCardProps).mockReturnValueOnce({
      cardProps: {
        title: "三峯神社",
        imageUrl: null,
      },
    } as any);

    const result = buildShrineDetailModel({
      shrine: shrineStub,
      publicGoshuins: [],
      ctx: "map",
    });

    expect(result.heroImageUrl).toBeNull();
  });
});
