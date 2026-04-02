import { describe, expect, it } from "vitest";
import { buildRecommendationNarrative } from "@/lib/concierge/narrative/buildRecommendationNarrative";

describe("buildRecommendationNarrative", () => {
  it("primaryNeed から psychologicalTags を生成する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: [],
      shrineName: "三峯神社",
      shrineTone: "strong",
      benefitLabels: ["開運", "厄除け"],
    });

    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.psychologicalTags).toContain("前進");
  });

  it("psychologicalTags から symbolTags を生成する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "mental",
      secondaryNeedTags: ["rest"],
      shrineName: "伊勢神宮",
      shrineTone: "quiet",
      benefitLabels: ["浄化", "開運"],
    });

    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.symbolTags.length).toBeGreaterThan(0);
  });

  it("derivedSymbolTags と shrineSymbolTags を統合する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "study",
      secondaryNeedTags: [],
      shrineName: "乃木神社",
      shrineTone: "tight",
      benefitLabels: ["学業成就"],
      shrineSymbolTags: ["神紋", "剣"],
    });

    expect(result.symbolTags).toContain("神紋");
    expect(result.symbolTags).toContain("剣");
  });

  it("symbolTags の重複を除去する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: ["career"],
      shrineName: "三峯神社",
      shrineTone: "strong",
      benefitLabels: ["開運"],
      shrineSymbolTags: ["光", "光", "鳥居"],
    });

    expect(result.symbolTags).toEqual(Array.from(new Set(result.symbolTags)));
  });

  it("mode=compat でも psychologicalTags / symbolTags を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "compat",
      primaryNeed: "love",
      secondaryNeedTags: [],
      shrineName: "出雲大社",
      shrineTone: "neutral",
      benefitLabels: ["縁結び"],
      userElementLabel: "水の気質",
      primaryReasonLabel: "良縁",
    });

    expect(result.mode).toBe("compat");
    expect(result.psychologicalTags.length).toBeGreaterThan(0);
    expect(result.symbolTags.length).toBeGreaterThan(0);
  });

  it("need+courage+strong で前進系の文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "courage",
      secondaryNeedTags: [],
      shrineName: "三峯神社",
      shrineTone: "strong",
      benefitLabels: ["開運", "厄除け"],
    });

    expect(result.match.userState).toContain("行動のきっかけや後押し");
    expect(result.match.shrineBenefit).toContain("止まっている流れを動かし始める");
    expect(result.match.actionMeaning).toContain("止まった流れを切り替える節目");
  });

  it("need+money+quiet で金運を整える系の文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "money",
      secondaryNeedTags: [],
      shrineName: "伊勢神宮",
      shrineTone: "quiet",
      benefitLabels: ["開運", "浄化"],
    });

    expect(result.match.userState).toContain("金運や流れを立て直したい意図");
    expect(result.match.shrineBenefit).toContain("金運や巡りを焦らず整え直したい");
    expect(result.match.actionMeaning).toContain("巡りを落ち着いて整え直す");
  });

  it("need+mental+rest で休息を含む補助文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "mental",
      secondaryNeedTags: ["rest"],
      shrineName: "伊勢神宮",
      shrineTone: "quiet",
      benefitLabels: ["浄化"],
    });

    expect(result.match.userState).toContain("落ち着いて休みたい状態");
    expect(result.match.actionMeaning).toContain("休みつつ立て直したい");
  });

  it("need+career+courage で転機と前進の複合文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "career",
      secondaryNeedTags: ["courage"],
      shrineName: "乃木神社",
      shrineTone: "tight",
      benefitLabels: ["仕事運", "勝負運"],
    });

    expect(result.match.userState).toContain("仕事や転機への意識が中心");
    expect(result.match.actionMeaning).toContain("次の一歩を決めたい");
  });

  it("compat で benefitLabels があると相性文言に神社要素を含む", () => {
    const result = buildRecommendationNarrative({
      mode: "compat",
      primaryNeed: "love",
      secondaryNeedTags: [],
      shrineName: "出雲大社",
      shrineTone: "neutral",
      benefitLabels: ["縁結び", "開運"],
      userElementLabel: "水の気質",
    });

    expect(result.match.userState).toContain("水の気質");
    expect(result.match.userState).toContain("縁結び・開運");
  });

  it("compat で benefitLabels がなく primaryReasonLabel があると補助一致文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "compat",
      primaryNeed: "love",
      secondaryNeedTags: [],
      shrineName: "出雲大社",
      shrineTone: "neutral",
      benefitLabels: [],
      userElementLabel: "火の気質",
      primaryReasonLabel: "良縁",
    });

    expect(result.match.userState).toContain("火の気質");
    expect(result.match.userState).toContain("良縁");
  });

  it("deepReason.interpretation があると lead に優先して使う", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "mental",
      secondaryNeedTags: [],
      shrineName: "神社A",
      shrineTone: "quiet",
      benefitLabels: ["浄化"],
      deepReason: {
        interpretation: "解決より先に気持ちを落ち着かせる段階です。",
        shrineMeaning: null,
        action: null,
        short: null,
      },
      conciergeReason: "これは使われない",
    });

    expect(result.meaning.lead).toBe("解決より先に気持ちを落ち着かせる段階です。");
  });

  it("deepReason がなく conciergeReason があると lead に fallback する", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "rest",
      secondaryNeedTags: [],
      shrineName: "神社B",
      shrineTone: "neutral",
      benefitLabels: [],
      conciergeReason: "少し立ち止まって整えるタイミングです。",
    });

    expect(result.meaning.lead).toBe("少し立ち止まって整えるタイミングです。");
  });

  it("benefitLabels が空でも shrineBenefit は fallback 文言を返す", () => {
    const result = buildRecommendationNarrative({
      mode: "need",
      primaryNeed: "rest",
      secondaryNeedTags: [],
      shrineName: "神社C",
      shrineTone: "neutral",
      benefitLabels: [],
    });

    expect(result.match.shrineBenefit).toContain("気持ちや優先順位を整え直す節目");
  });
});
