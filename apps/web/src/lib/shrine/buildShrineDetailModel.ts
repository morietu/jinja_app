// apps/web/src/lib/shrine/buildShrineDetailModel.ts
import type { Shrine } from "@/lib/api/shrines";
import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import type {
  DetailMeaningItem,
  DetailMeaningSection,
  DetailProposalSection,
  DetailReasonGroup,
  DetailReasonSection,
  DetailSupplementGroup,
  DetailSupplementSection,
  ShrineDetailSectionModel,
} from "@/components/shrine/detail/types";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { getBenefitLabels } from "@/lib/shrine/getBenefitLabels";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";
import { buildShrineJudge } from "@/lib/shrine/buildShrineJudge";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import {
  type ConciergeMode,
  type NeedTag,
  type ShrineTone,
  type ExplanationPayload,
  type NarrativeFallback,
} from "@/lib/concierge/narrative/types";
import { buildComparisonText } from "@/lib/concierge/narrative/buildComparisonText";
import { buildRecommendationNarrative } from "@/lib/concierge/narrative/buildRecommendationNarrative";


type Args = {
  shrine: Shrine;
  publicGoshuins: PublicGoshuinItem[];
  conciergeBreakdown?: ConciergeBreakdown | null;
  conciergeReason?: string | null;
  conciergeDeepReason?: NarrativeFallback | null;
  conciergeExplanationPayload?: ExplanationPayload | null;
  conciergeMode?: ConciergeMode | null;
  recommendationRankExplanation?: RankExplanation | null;
  recommendationRankComparison?: RankComparison | null;
  ctx?: "map" | "concierge" | null;
  tid?: string | null;
  recommendationReasonDetail?: {
    heroMeaningCopy?: string | null;
    consultationSummary?: string | null;
    shrineMeaning?: string | null;
    actionMeaning?: string | null;
  } | null;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};



type RecommendationWhySection = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致" | "上位になった理由" | "他候補との差";
  text: string;
};

type RecommendationJudgeSection = {
  disclosureTitle: string;
  title: string;
  lead: string;
  items: JudgeSectionItem[];
};

type ShrineRecommendationExplanation = {
  proposal: string;
  proposalLead: string;
  proposalWhy: RecommendationWhySection[];
  judgeSection: RecommendationJudgeSection;
  rankReason: string | null;
};

type JudgeSectionItem = {
  key: string;
  title: string;
  body: string;
};

type RankExplanation = {
  version: number;
  summary?: string;
  primary_axis?: string;
  primary_axis_ja?: string;
  primary_label?: string | null;
  primary_label_ja?: string | null;
};

type RankComparison = {
  version: number;
  rank?: number;
  is_top?: boolean;
  top_name?: string | null;
  gap_from_top?: number;
  comparison_summary?: string | null;
};

type RecommendationMeta = {
  rankExplanation?: RankExplanation | null;
  rankComparison?: RankComparison | null;
  rankTitle?: string | null;
  rankBody?: string | null;
};


function buildRecommendationMeta(args: {
  rankExplanation?: RankExplanation | null;
  rankComparison?: RankComparison | null;
}): RecommendationMeta | null {
  const rankExplanation = args.rankExplanation ?? null;
  const rankComparison = args.rankComparison ?? null;

  const isTop = Boolean(rankComparison?.is_top);
  const rankTitle = isTop ? "この神社が1位の理由" : "1位との違い";

  const rankBody = isTop ? (rankExplanation?.summary ?? null) : (rankComparison?.comparison_summary ?? null);

  if (!rankTitle || !rankBody) return null;

  return {
    rankExplanation,
    rankComparison,
    rankTitle,
    rankBody,
  };
}

function resolveConciergeMode(value: unknown): ConciergeMode {
  return value === "compat" ? "compat" : "need";
}

function normalizeShrineName(name?: string | null): string {
  return (name ?? "").replace(/\s+/g, "").trim();
}

function getShrineTone(shrineName?: string | null): ShrineTone {
  const name = normalizeShrineName(shrineName);

  if (name.includes("三峯")) return "strong";
  if (name.includes("伊勢神宮") || name.includes("内宮")) return "quiet";
  if (name.includes("乃木")) return "tight";

  return "neutral";
}

const NEED_REASON_LABELS: Record<NeedTag, string> = {
  money: "金運",
  courage: "前進のきっかけ",
  career: "仕事や転機",
  mental: "気持ちを整えたい",
  rest: "休息したい",
  love: "良縁や恋愛",
  study: "学業や合格",
};

const NEED_STATE_LABELS: Record<NeedTag, string> = {
  money: "流れを立て直したい",
  courage: "前に進むきっかけがほしい",
  career: "判断や転機を整理したい",
  mental: "気持ちを整えたい",
  rest: "無理せず休みたい",
  love: "関係性を前向きに整えたい",
  study: "集中を立て直したい",
};

function needLabelJa(tag: NeedTag): string {
  if (tag === "money") return "金運";
  if (tag === "courage") return "前に進むきっかけ";
  if (tag === "career") return "仕事や転機";
  if (tag === "mental") return "不安や気持ちの揺れ";
  if (tag === "rest") return "休息";
  if (tag === "love") return "良縁や恋愛";
  return "学業や合格";
}

function isNeedTag(tag: string): tag is NeedTag {
  return ["money", "courage", "career", "mental", "rest", "love", "study"].includes(tag);
}

function getMatchedNeedTags(breakdown?: ConciergeBreakdown | null): NeedTag[] {
  return (breakdown?.matched_need_tags ?? [])
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .filter(isNeedTag);
}

function getPrimaryNeedTag(breakdown?: ConciergeBreakdown | null): NeedTag | null {
  const tags = getMatchedNeedTags(breakdown);

  if (tags.includes("courage")) return "courage";
  if (tags.includes("money")) return "money";
  if (tags.includes("career")) return "career";
  if (tags.includes("mental")) return "mental";
  if (tags.includes("rest")) return "rest";
  if (tags.includes("love")) return "love";
  if (tags.includes("study")) return "study";

  return tags[0] ?? null;
}

function getSecondaryNeedTags(breakdown?: ConciergeBreakdown | null): NeedTag[] {
  const primary = getPrimaryNeedTag(breakdown);
  return getMatchedNeedTags(breakdown).filter((tag) => tag !== primary);
}


function buildNeedMatchText(primary: NeedTag | null, secondary: NeedTag[]): string {
  if (primary === "courage") {
    return secondary.includes("money")
      ? "行動のきっかけや後押しを求める意図が中心にあり、金運面も立て直したい流れが見られます。"
      : "行動のきっかけや後押しを求める意図が相談の中心にあります。";
  }

  if (primary === "money") {
    return secondary.includes("courage")
      ? "金運や流れを立て直したい意図が中心にあり、動き出すきっかけも求めている状態です。"
      : "金運や流れを立て直したい意図が相談の中心にあります。";
  }

  if (primary === "career") {
    return secondary.includes("courage")
      ? "仕事や転機への意識が中心にあり、前に進むきっかけも必要としている状態です。"
      : "仕事や転機に向き合いたい意図が相談の中心にあります。";
  }

  if (primary === "mental") {
    return secondary.includes("rest")
      ? "不安や気持ちの揺れを整えたい意図が中心にあり、落ち着いて休みたい状態も見られます。"
      : "不安や気持ちの揺れを整えたい意図が相談の中心にあります。";
  }

  if (primary === "rest") {
    return secondary.includes("mental")
      ? "休息したい意図が中心にあり、気持ちの揺れも整えたい状態が見られます。"
      : "落ち着いて休みたい意図が相談の中心にあります。";
  }

  if (primary === "love") {
    return "良縁や恋愛を前向きに進めたい意図が相談の中心にあります。";
  }

  if (primary === "study") {
    return "学業や合格に集中したい意図が相談の中心にあります。";
  }

  return "相談内容の中に、今の状態を整えたい意図が見られます。";
}

function buildCompatMatchText(args: {
  userElementLabel?: string | null;
  shrineElementLabels?: string[] | null;
  primaryReasonLabel?: string | null;
}): string {
  const user = args.userElementLabel ?? "今回の生年月日傾向";
  const shrine = (args.shrineElementLabels ?? []).filter(Boolean).slice(0, 2).join("・");

  if (shrine) {
    return `${user}と、${shrine}の要素を持つこの神社の噛み合いを主軸に見ています。`;
  }

  if (args.primaryReasonLabel) {
    return `${user}を主軸に見つつ、${args.primaryReasonLabel}に関わる相談内容との重なりも補助的に見ています。`;
  }

  return `${user}と、この神社が持つ要素の噛み合いを主軸に見ています。`;
}

function toBenefitTag(label: string): ShrineTag {
  const v = label.trim();
  return {
    id: `benefit:${encodeURIComponent(v)}`,
    label: v,
    type: "benefit",
    source: "official",
    confidence: "high",
  };
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean))];
}

function buildCompatReasonItems(payload?: ExplanationPayload | null, benefitLabels: string[] = []): {
  consultation: string[];
  states: string[];
  shrineFactors: string[];
} {
  const consultation = payload?.primary_reason?.label_ja ? [payload.primary_reason.label_ja] : [];

  const states = payload?.primary_need_label_ja ? [payload.primary_need_label_ja] : ["生年月日との相性を見ています"];

  const shrineFactors = benefitLabels.slice(0, 3);

  return { consultation, states, shrineFactors };
}

function buildReasonSection(args: {
  mode: ConciergeMode;
  breakdown?: ConciergeBreakdown | null;
  explanationPayload?: ExplanationPayload | null;
  benefitLabels: string[];
}): DetailReasonSection | null {
  const primary = getPrimaryNeedTag(args.breakdown);
  const secondary = getSecondaryNeedTags(args.breakdown);
  const payload = args.explanationPayload ?? null;

  if (args.mode === "compat") {
    const compat = buildCompatReasonItems(payload, args.benefitLabels);

    const groups: DetailReasonGroup[] = [
      { title: "一致した相談", items: compat.consultation },
      { title: "一致した状態", items: compat.states },
      { title: "一致した神社要素", items: compat.shrineFactors },
    ].filter((g) => g.items.length > 0);

    return groups.length > 0
      ? {
          kind: "reason",
          heading: "① この神社が出てきた理由",
          groups,
        }
      : null;
  }

  const consultation = uniqueNonEmpty([
    primary ? NEED_REASON_LABELS[primary] : null,
    ...secondary.map((tag) => NEED_REASON_LABELS[tag]),
  ]);

  const states = uniqueNonEmpty([
    primary ? NEED_STATE_LABELS[primary] : null,
    ...secondary.map((tag) => NEED_STATE_LABELS[tag]),
  ]);

  const shrineFactors = uniqueNonEmpty(args.benefitLabels.slice(0, 3));

  const groups: DetailReasonGroup[] = [
    { title: "一致した相談", items: consultation },
    { title: "一致した状態", items: states },
    { title: "一致した神社要素", items: shrineFactors },
  ].filter((g) => g.items.length > 0);

  return groups.length > 0
    ? {
        kind: "reason",
        heading: "① この神社が出てきた理由",
        groups,
      }
    : null;
}

function buildProposalSection(args: {
  lead?: string | null;
  consultationSummary?: string | null;
  proposal?: string | null;
  ctx?: "map" | "concierge" | null;
}): DetailProposalSection | null {
  if (args.ctx !== "concierge") return null;

  return {
    kind: "proposal",
    heading: "② 今回の相談の整理",
    lead: args.consultationSummary ?? args.lead ?? "",
    body: args.proposal ?? null,
  };
}

function buildProposalFromBreakdown(breakdown?: ConciergeBreakdown | null): string {
  const set = new Set(getMatchedNeedTags(breakdown));

  if (set.has("money") && set.has("courage")) {
    return "流れを立て直し、次の一歩を決めたい時の参拝先";
  }

  if (set.has("career") && set.has("courage")) {
    return "仕事や転機に向き合う参拝先";
  }

  if (set.has("mental") && set.has("rest")) {
    return "気持ちを整えて休息したい時の参拝先";
  }

  if (set.has("love")) {
    return "良縁を願う参拝先";
  }

  if (set.has("study")) {
    return "学業や合格に集中したい時の参拝先";
  }

  if (set.has("mental")) {
    return "不安や気持ちの揺れを整えたい時の参拝先";
  }

  if (set.has("rest")) {
    return "落ち着いて休みたい時の参拝先";
  }

  return "今回の相談に応じた参拝先";
}

function buildProposalLead(args: { mode: ConciergeMode; explanationPayload?: ExplanationPayload | null }): string {
  const payload = args.explanationPayload ?? null;

  if (args.mode === "compat") {
    return "今回の提案では、生年月日との相性を主軸に見ています。";
  }

  return payload?.primary_need_label_ja
    ? `今回の相談では、${payload.primary_need_label_ja}が中心テーマです。`
    : "今の状態を整理すると、まず向き合うべきテーマがあります。";
}

function resolveDetailLead(args: {
  ctx?: "map" | "concierge" | null;
  recommendationReasonDetail?: {
    consultationSummary?: string | null;
  } | null;
  conciergeDeepReason?: NarrativeFallback | null;
  conciergeReason?: string | null;
  generatedLead?: string | null;
}): string {
  if (args.ctx === "concierge") {
    const detailLead = args.recommendationReasonDetail?.consultationSummary?.trim();
    if (detailLead) return detailLead;

    const deepReasonLead = args.conciergeDeepReason?.interpretation?.trim();
    if (deepReasonLead) return deepReasonLead;

    const conciergeReason = args.conciergeReason?.trim();
    if (conciergeReason) return conciergeReason;
  }

  return args.generatedLead?.trim() || "";
}

function buildBenefitText(
  shrineText: string,
  benefitLabels: string[],
  primary: NeedTag | null,
  shrineTone: ShrineTone,
): string {
  const labels = benefitLabels.filter(Boolean).slice(0, 3);
  const joined =
    labels.length >= 3
      ? `${labels[0]}・${labels[1]}・${labels[2]}`
      : labels.length === 2
        ? `${labels[0]}と${labels[1]}`
        : labels.length === 1
          ? labels[0]
          : null;

  if (!joined) {
    return `${shrineText}は、今回の相談内容に照らして、気持ちや優先順位を整え直す節目として置きやすい神社です。`;
  }

  if (primary === "courage") {
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、止まっている流れを動かし始める節目や、背中を押す場として据えやすい神社です。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、迷いを断ち切って一歩を決めたい段階で判断材料にしやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、勢いで進むより気持ちを整えてから一歩を決めたい段階で節目として置きやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、次の一歩を踏み出すきっかけを持ちたい段階で参拝先として据えやすい神社です。`;
  }

  if (primary === "money") {
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、停滞した巡りを切り替えて流れを再開したい段階で節目として置きやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、金運や巡りを焦らず整え直したい段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、金運や巡りの停滞を立て直したい段階で意識を向けやすい神社です。`;
  }

  if (primary === "mental") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、揺れた気持ちを静かに整え直し、落ち着きを取り戻したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は${joined}に関わるご利益で知られ、沈んだ流れを切り替えつつ気持ちを立て直したい段階で節目として置きやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、気持ちを整えながら無理のない形で立て直したい段階で気持ちを向けやすい神社です。`;
  }

  if (primary === "career") {
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への姿勢を引き締め、判断をぶらさず整理したい段階で判断材料にしやすい神社です。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への向き合い方を急がず見直したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、仕事や転機への向き合い方を整理し、次の判断を落ち着いて考えたい段階で節目として置きやすい神社です。`;
  }

  if (primary === "rest") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、消耗した状態を静かに整え直したい段階で一度立ち止まる場として使いやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、無理に進まず消耗を立て直したい段階で参拝先として置きやすい神社です。`;
  }

  if (primary === "love") {
    if (shrineTone === "quiet") {
      return `${shrineText}は${joined}に関わるご利益で知られ、良縁や恋愛に対して気持ちを静かに整えたい段階で気持ちを向けやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、良縁や恋愛を丁寧に見直しながら前へ進めたい段階で参拝先として据えやすい神社です。`;
  }

  if (primary === "study") {
    if (shrineTone === "tight") {
      return `${shrineText}は${joined}に関わるご利益で知られ、学業や合格に向けて気持ちを引き締め直したい段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は${joined}に関わるご利益で知られ、学業や合格に向けて乱れた集中やペースを立て直したい段階で参拝先として置きやすい神社です。`;
  }

  return `${shrineText}は${joined}に関わるご利益で知られ、今回の相談内容に照らして参拝先として検討しやすい神社です。`;
}

function buildSecondaryText(primary: NeedTag | null, secondary: NeedTag[], shrineName?: string): string {
  const shrineText = shrineName?.trim() || "この神社";
  const shrineTone = getShrineTone(shrineText);

  if (secondary.length === 0) {
    if (primary === "courage") {
      if (shrineTone === "strong") {
        return `${shrineText}は、静かに様子を見る場というより、止まった流れを切り替える節目として使いやすい神社です。`;
      }
      if (shrineTone === "tight") {
        return `${shrineText}は、勢いで動く場というより、迷いを整理して一歩を定めるための神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、強く背中を押す場というより、気持ちを整えてから一歩を決めるための神社です。`;
      }
      return `${shrineText}は、結論を急ぐより、まず最初の一歩を決めたい段階で向いています。`;
    }

    if (primary === "money") {
      if (shrineTone === "strong") {
        return `${shrineText}は、運を待つ場というより、停滞した流れを切り替える節目として使いやすい神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、一気の好転を狙う場というより、巡りを落ち着いて整え直すための神社です。`;
      }
      return `${shrineText}は、金運や巡りを整え直したい今の段階で向いています。`;
    }

    if (primary === "career") {
      if (shrineTone === "tight") {
        return `${shrineText}は、感覚で決める場というより、仕事や転機への姿勢を引き締めて判断するための神社です。`;
      }
      if (shrineTone === "quiet") {
        return `${shrineText}は、結論を急ぐ場というより、向き合い方を静かに整理するための神社です。`;
      }
      return `${shrineText}は、仕事や転機への向き合い方を整えたい今の段階で向いています。`;
    }

    if (primary === "mental") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、強く前へ押し出す場というより、揺れた気持ちを静かに整え直すための神社です。`;
      }
      if (shrineTone === "strong") {
        return `${shrineText}は、ただ休む場というより、沈んだ流れを切り替えて立て直す節目として使いやすい神社です。`;
      }
      if (shrineTone === "tight") {
        return `${shrineText}は、感情に流されるまま過ごすより、気持ちを引き締めて整えたい段階で向いています。`;
      }
      return `${shrineText}は、不安や揺れを整えたい今の段階で向いています。`;
    }

    if (primary === "rest") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、何かを進める場というより、消耗を静かに整え直すための神社です。`;
      }
      return `${shrineText}は、無理に予定を前へ進めるより、疲れを立て直したい今の段階で向いています。`;
    }

    if (primary === "love") {
      if (shrineTone === "quiet") {
        return `${shrineText}は、気持ちを勢いで動かす場というより、関係性を静かに見直すための神社です。`;
      }
      return `${shrineText}は、良縁や関係性を丁寧に整えたい今の段階で向いています。`;
    }

    if (primary === "study") {
      if (shrineTone === "tight") {
        return `${shrineText}は、焦って結果だけを追う場というより、集中や姿勢を引き締め直すための神社です。`;
      }
      return `${shrineText}は、学業や合格に向けた集中を整え直したい今の段階で向いています。`;
    }

    return `${shrineText}は、今の状態を整えながら次を決めたい今の段階で向いています。`;
  }

  if (primary === "courage" && secondary.includes("money")) {
    return `${shrineText}は、背中を押してほしい気持ちに加えて、金運や巡りの停滞も立て直したい今の段階で向いています。`;
  }

  if (primary === "money" && secondary.includes("courage")) {
    if (shrineTone === "strong") {
      return `${shrineText}は、停滞した巡りを切り替えつつ、止まった状態から動き出すきっかけも欲しい今の段階で向いています。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は、巡りを焦って変えるより、落ち着いて整えながら次の一歩も決めたい今の段階で向いています。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、巡りを立て直しつつ、迷いを絞って動き出す判断も固めたい今の段階で向いています。`;
    }
    return `${shrineText}は、巡りを整えるだけでなく、止まった状態から動き出すきっかけも欲しい今の段階で向いています。`;
  }

  if (primary === "career" && secondary.includes("courage")) {
    if (shrineTone === "strong") {
      return `${shrineText}は、仕事や転機への向き合い方を整理しながら、次の一歩へ切り替える節目も欲しい今の段階で向いています。`;
    }
    if (shrineTone === "quiet") {
      return `${shrineText}は、仕事や転機への向き合い方を静かに見直しながら、急がず次の一歩も定めたい今の段階で向いています。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、仕事や転機への姿勢を引き締めつつ、迷いを減らして次の一歩を決めたい今の段階で向いています。`;
    }
    return `${shrineText}は、仕事や転機への向き合い方を整理しつつ、次の一歩も決めたい今の段階で向いています。`;
  }

  if (primary === "mental" && secondary.includes("rest")) {
    if (shrineTone === "quiet") {
      return `${shrineText}は、気持ちを静かに整えながら、無理に進まず休みつつ立て直したい今の段階で向いています。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は、沈んだ流れを切り替えながら、気持ちと休息の両方を立て直したい今の段階で向いています。`;
    }
    return `${shrineText}は、気持ちを整えることに加えて、無理に進まず休みながら立て直したい今の段階で向いています。`;
  }

  if (primary === "rest" && secondary.includes("mental")) {
    if (shrineTone === "quiet") {
      return `${shrineText}は、休息を取りながら、気持ちの揺れも静かに整え直したい今の段階で一度立ち止まる場として使いやすい神社です。`;
    }
    if (shrineTone === "strong") {
      return `${shrineText}は、休息を取りながら、沈んだ流れも切り替えて立て直したい今の段階で節目として置きやすい神社です。`;
    }
    if (shrineTone === "tight") {
      return `${shrineText}は、休息を取りながら、気持ちの揺れを引き締め直して整えたい今の段階で判断材料にしやすい神社です。`;
    }
    return `${shrineText}は、休息を取りながら、気持ちの揺れも静かに整え直したい今の段階で向いています。`;
  }

  return `${shrineText}は、${secondary.map(needLabelJa).join("、")}も視野に入れながら、優先順位を落ち着いて整理したい段階で向いています。`;
}

function buildRankReasonText(args: {
  mode: ConciergeMode;
  breakdown?: ConciergeBreakdown | null;
  primaryNeed?: NeedTag | null;
  secondaryNeedTags?: NeedTag[];
}): string {
  const total = args.breakdown?.score_total ?? null;
  const element = args.breakdown?.score_element ?? null;

  if (args.mode === "compat") {
    if (typeof element === "number" && element > 0) {
      return "今回は生年月日との相性要素が強く、相性軸で上位に入りました。";
    }
    return "今回は相性軸を主に見たときに、他候補より噛み合いが見られました。";
  }

  if (args.mode === "need" && args.primaryNeed === "courage") {
    return "今回は『前進』のテーマとの一致が強く、他候補と比べても行動のきっかけを持ちやすい候補として上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "mental") {
    return "今回は「気持ちを整える」テーマとの一致が強く、他候補より落ち着きを取り戻す参拝先として位置づけやすいため上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "career") {
    return "今回は「仕事や転機」のテーマとの一致が強く、他候補より判断を整理する節目として置きやすいため上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "money") {
    return "今回は「金運や巡り」のテーマとの一致が強く、他候補より流れを立て直す節目として置きやすいため上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "rest") {
    return "今回は「休息」のテーマとの一致が強く、他候補より無理に進まず立て直す参拝先として位置づけやすいため上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "love") {
    return "今回は「良縁や関係性」のテーマとの一致が強く、他候補より気持ちを整えながら向き合いやすい候補として上位に入りました。";
  }

  if (args.mode === "need" && args.primaryNeed === "study") {
    return "今回は「学業や合格」のテーマとの一致が強く、他候補より集中や姿勢を立て直す参拝先として置きやすいため上位に入りました。";
  }

  if (typeof total === "number") {
    return "今回は複数の観点を合わせた総合評価で上位に入りました。";
  }

  return "今回は今回の相談軸に近い候補として上位に入りました。";
}


function buildProposalWhyFromBreakdown(args: {
  mode: ConciergeMode;
  breakdown?: ConciergeBreakdown | null;
  benefitLabels?: string[];
  shrineName?: string | null;
  explanationPayload?: ExplanationPayload | null;
}): RecommendationWhySection[] {
  const primary = getPrimaryNeedTag(args.breakdown);
  const secondary = getSecondaryNeedTags(args.breakdown);
  const shrineText = args.shrineName?.trim() || "この神社";
  const shrineTone = getShrineTone(shrineText);
  const benefitLabels = args.benefitLabels ?? [];
  const payload = args.explanationPayload ?? null;
  const userElementLabel = payload?.primary_need_label_ja ?? null;
  const primaryReasonLabel = payload?.primary_reason?.label_ja ?? null;

  if (args.mode === "compat") {
    return [
      {
        label: "相談との一致",
        text: buildCompatMatchText({
          userElementLabel,
          shrineElementLabels: benefitLabels,
          primaryReasonLabel,
        }),
      },
      {
        label: "神社のご利益",
        text: buildBenefitText(shrineText, benefitLabels, primary, shrineTone),
      },
      {
        label: "補助的な一致",
        text: primaryReasonLabel
          ? `${primaryReasonLabel}に関わる相談内容との補助的な重なりも見られます。`
          : "相談内容との補助的な一致も見られます。",
      },
      {
        label: "上位になった理由",
        text: buildRankReasonText({
          mode: args.mode,
          breakdown: args.breakdown,
          primaryNeed: primary,
          secondaryNeedTags: secondary,
        }),
      },
      {
        label: "他候補との差",
        text: buildComparisonText({
          mode: args.mode,
          primaryNeed: primary,
          shrineName: shrineText,
          shrineTone,
        }),
      },
    ];
  }

  return [
    {
      label: "相談との一致",
      text: buildNeedMatchText(primary, secondary),
    },
    {
      label: "神社のご利益",
      text: buildBenefitText(shrineText, benefitLabels, primary, shrineTone),
    },
    {
      label: "補助的な一致",
      text: buildSecondaryText(primary, secondary, shrineText),
    },
    {
      label: "上位になった理由",
      text: buildRankReasonText({
        mode: args.mode,
        breakdown: args.breakdown,
        primaryNeed: primary,
        secondaryNeedTags: secondary,
      }),
    },
    {
      label: "他候補との差",
      text: buildComparisonText({
        mode: args.mode,
        primaryNeed: primary,
        shrineName: shrineText,
        shrineTone,
      }),
    },
  ];
}

function buildProposalWhyFromNarrativeSources(args: {
  recommendationReasonDetail?: {
    consultationSummary?: string | null;
    shrineMeaning?: string | null;
    actionMeaning?: string | null;
  } | null;
  deepReason?: NarrativeFallback | null;
  rankReason?: string | null;
  comparisonText?: string | null;
}): RecommendationWhySection[] | null {
  const items: RecommendationWhySection[] = [];

  // fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. no value here; caller must fall back to generated proposalWhy
  const consultationText =
    args.recommendationReasonDetail?.consultationSummary?.trim() || args.deepReason?.interpretation?.trim() || "";
  const shrineMeaningText =
    args.recommendationReasonDetail?.shrineMeaning?.trim() || args.deepReason?.shrineMeaning?.trim() || "";
  const actionText = args.recommendationReasonDetail?.actionMeaning?.trim() || args.deepReason?.action?.trim() || "";

  const hasNarrativeSource = Boolean(consultationText || shrineMeaningText || actionText);
  if (!hasNarrativeSource) {
    return null;
  }

  if (consultationText) {
    items.push({
      label: "相談との一致",
      text: consultationText,
    });
  }

  if (shrineMeaningText) {
    items.push({
      label: "神社のご利益",
      text: shrineMeaningText,
    });
  }

  if (actionText) {
    items.push({
      label: "補助的な一致",
      text: actionText,
    });
  }

  if (args.rankReason) {
    items.push({
      label: "上位になった理由",
      text: args.rankReason,
    });
  }

  if (args.comparisonText) {
    items.push({
      label: "他候補との差",
      text: args.comparisonText,
    });
  }

  return items.length > 0 ? items : null;
}

function buildJudgeSectionOrder(args: {
  mode: ConciergeMode;
  explanationPayload?: ExplanationPayload | null;
  breakdown?: ConciergeBreakdown | null;
  goriyakuText?: string | null;
}): JudgeSectionItem[] {
  const mode = args.mode;
  const payload = args.explanationPayload ?? null;
  const primaryNeedLabel = payload?.primary_need_label_ja ?? null;
  const primaryReasonLabel = payload?.primary_reason?.label_ja ?? null;
  const secondaryReasons = Array.isArray(payload?.secondary_reasons) ? payload.secondary_reasons : [];
  const secondaryReasonText =
    secondaryReasons.length > 0
      ? secondaryReasons
          .map((r) => r.label_ja)
          .filter((v): v is string => Boolean(v))
          .slice(0, 2)
          .join("・")
      : null;

  const sectionsForNeed: JudgeSectionItem[] = [
    {
      key: "lead",
      title: "主軸",
      body: primaryNeedLabel
        ? `今回の相談では、${primaryNeedLabel}に関わる悩みが主軸にあります。`
        : "今回の相談では、今の状態を整えたい意図が主軸にあります。",
    },
    {
      key: "reason",
      title: "相談との一致",
      body: primaryReasonLabel
        ? `${primaryReasonLabel}に関わる相談内容との重なりが見られます。`
        : "相談内容に近い要素が見られます。",
    },
    {
      key: "goriyaku",
      title: "この神社のご利益",
      body: args.goriyakuText ?? "この神社のご利益が、今回の相談内容に近い方向です。",
    },
    {
      key: "secondary",
      title: "補助的な方向性",
      body: secondaryReasonText ?? "主軸を補う方向性があります。",
    },
    {
      key: "rank",
      title: "上位になった理由",
      body: buildRankReasonText({
        mode,
        breakdown: args.breakdown,
        primaryNeed: getPrimaryNeedTag(args.breakdown),
        secondaryNeedTags: getSecondaryNeedTags(args.breakdown),
      }),
    },
  ];

  const sectionsForCompat: JudgeSectionItem[] = [
    {
      key: "compat",
      title: "生年月日との相性",
      body: primaryNeedLabel
        ? `${primaryNeedLabel}を主軸に、生年月日との相性から候補を整理しています。`
        : "今回の提案では、生年月日との相性を主軸に候補を整理しています。",
    },
    {
      key: "element",
      title: "神社の要素",
      body: args.goriyakuText ?? "この神社が持つ要素と、ご利益面の噛み合いを見ています。",
    },
    {
      key: "reason",
      title: "相談との一致",
      body: primaryReasonLabel
        ? `${primaryReasonLabel}に関わる相談内容との補助的な重なりもあります。`
        : "相談内容との補助的な一致も見られます。",
    },
    {
      key: "secondary",
      title: "補助的な方向性",
      body: secondaryReasonText ?? "相性軸を補う方向性があります。",
    },
    {
      key: "rank",
      title: "上位になった理由",
      body: buildRankReasonText({
        mode,
        breakdown: args.breakdown,
        primaryNeed: getPrimaryNeedTag(args.breakdown),
        secondaryNeedTags: getSecondaryNeedTags(args.breakdown),
      }),
    },
  ];

  return mode === "compat" ? sectionsForCompat : sectionsForNeed;
}

function buildJudgeItemsFromNarrativeSources(args: {
  recommendationReasonDetail?: {
    shrineMeaning?: string | null;
    actionMeaning?: string | null;
  } | null;
  deepReason?: NarrativeFallback | null;
}): JudgeSectionItem[] | null {
  const items: JudgeSectionItem[] = [];

  // fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. no value here; caller must fall back to generated judge items
  const shrineMeaningText =
    args.recommendationReasonDetail?.shrineMeaning?.trim() || args.deepReason?.shrineMeaning?.trim() || "";
  const actionText = args.recommendationReasonDetail?.actionMeaning?.trim() || args.deepReason?.action?.trim() || "";

  if (shrineMeaningText) {
    items.push({
      key: "meaning",
      title: "この神社をすすめる理由",
      body: shrineMeaningText,
    });
  }

  if (actionText) {
    items.push({
      key: "action",
      title: "参拝を置く意味",
      body: actionText,
    });
  }

  return items.length > 0 ? items : null;
}

function buildMeaningSection(args: {
  lead: string;
  deepReason?: NarrativeFallback | null;
  recommendationReasonDetail?: {
    shrineMeaning?: string | null;
    actionMeaning?: string | null;
  } | null;
  shrineName?: string | null;
  benefitLabels: string[];
  mode: ConciergeMode;
  breakdown?: ConciergeBreakdown | null;
}): DetailMeaningSection {
  // fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. generated fallback from shrine/breakdown data
  const detailItems: DetailMeaningItem[] = [
    args.recommendationReasonDetail?.shrineMeaning
      ? {
          key: "meaning",
          title: "この神社をすすめる理由",
          body: args.recommendationReasonDetail.shrineMeaning,
        }
      : null,
    args.recommendationReasonDetail?.actionMeaning
      ? {
          key: "action",
          title: "参拝を置く意味",
          body: args.recommendationReasonDetail.actionMeaning,
        }
      : null,
  ].filter((item): item is DetailMeaningItem => Boolean(item));

  const narrativeItems =
    detailItems.length > 0
      ? detailItems
      : buildJudgeItemsFromNarrativeSources({
          recommendationReasonDetail: args.recommendationReasonDetail,
          deepReason: args.deepReason,
        });

  const fallbackItems: DetailMeaningItem[] = narrativeItems ?? [
    {
      key: "meaning",
      title: "この神社をすすめる理由",
      body: buildBenefitText(
        args.shrineName?.trim() || "この神社",
        args.benefitLabels,
        getPrimaryNeedTag(args.breakdown),
        getShrineTone(args.shrineName ?? null),
      ),
    },
    {
      key: "action",
      title: "参拝を置く意味",
      body: buildSecondaryText(
        getPrimaryNeedTag(args.breakdown),
        getSecondaryNeedTags(args.breakdown),
        args.shrineName ?? undefined,
      ),
    },
  ];

  return {
    kind: "meaning",
    heading: "③ 神社との意味の接続",
    lead: args.lead,
    items: fallbackItems,
  };
}

function buildSupplementSection(args: {
  benefitLabels: string[];
  psychologicalTags?: string[] | null;
  symbolTags?: string[] | null;
  mode: ConciergeMode;
  explanationPayload?: ExplanationPayload | null;
}): DetailSupplementSection | null {
  const groups: DetailSupplementGroup[] = [
    {
      title: "ご利益",
      items: uniqueNonEmpty(args.benefitLabels.slice(0, 5)),
    },
    {
      title: "象徴",
      items: uniqueNonEmpty((args.symbolTags ?? []).slice(0, 5)),
    },
    {
      title: "相性・補助情報",
      items: uniqueNonEmpty((args.psychologicalTags ?? []).slice(0, 5)),
    },
  ].filter((g) => g.items.length > 0);

  return groups.length > 0
    ? {
        kind: "supplement",
        heading: "④ 補足（象徴・ご利益）",
        groups,
      }
    : null;
}

const HERO_MEANING_BY_TAG: Record<NeedTag, string> = {
  courage: "止まった流れを切り替え、次の一歩を定め直す神社",
  money: "巡りと流れを整え、立て直しの軸を取り戻す神社",
  career: "判断を整え、仕事や転機の方向を見直す神社",
  mental: "気持ちを静め、受け取り方を整え直す神社",
  rest: "心身をゆるめ、回復の順番を取り戻す神社",
  love: "関係性を見つめ直し、縁の受け取り方を整える神社",
  study: "集中を整え、目標に向き直る神社",
};

const HERO_MEANING_BY_LABEL_JA: Record<string, string> = {
  金運: "巡りと流れを整え、立て直しの軸を取り戻す神社",
  "前に進むきっかけ": "止まった流れを切り替え、次の一歩を定め直す神社",
  "仕事や転機": "判断を整え、仕事や転機の方向を見直す神社",
  "不安や気持ちの揺れ": "気持ちを静め、受け取り方を整え直す神社",
  休息: "心身をゆるめ、回復の順番を取り戻す神社",
  "良縁や恋愛": "関係性を見つめ直し、縁の受け取り方を整える神社",
  "学業や合格": "集中を整え、目標に向き直る神社",
};

function compressShrineMeaning(text?: string | null): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const cleaned = raw
    .replace(/^.*?は、/, "")
    .replace(/今の状態で|今回の相談では|今回の相談において/g, "")
    .replace(/参拝先として|候補として/g, "")
    .replace(/重ねやすい|据えやすい|置きやすい/g, "")
    .replace(/段階で/g, "")
    .replace(/です。?$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;

  if (cleaned.includes("決断や覚悟")) {
    return "止まった流れを切り替え、決断と覚悟を定め直す神社";
  }

  if (cleaned.includes("原点に戻りたい") || cleaned.includes("巡りを整え")) {
    return "焦りを静めて、巡りと原点を整え直す神社";
  }

  if (cleaned.includes("集中") || cleaned.includes("目標設定")) {
    return "気持ちを引き締め、目標に向き直る神社";
  }

  const normalized = cleaned.replace(/ための$/, "").replace(/ために$/, "").replace(/したい$/, "").trim();

  return normalized.endsWith("神社") ? normalized : `${normalized}神社`;
}

function resolveHeroMeaningFallbackKey(args: {
  conciergeExplanationPayload?: ExplanationPayload | null;
  conciergeBreakdown?: ConciergeBreakdown | null;
  recommendationRankExplanation?: {
    primary_axis?: string;
    primary_label_ja?: string | null;
  } | null;
}): NeedTag | null {
  const labelJa =
    args.conciergeExplanationPayload?.primary_need_label_ja ??
    args.conciergeExplanationPayload?.primary_reason?.label_ja ??
    args.recommendationRankExplanation?.primary_label_ja ??
    null;

  if (labelJa && HERO_MEANING_BY_LABEL_JA[labelJa]) {
    const matched = Object.entries(HERO_MEANING_BY_TAG).find(([, value]) => value === HERO_MEANING_BY_LABEL_JA[labelJa]);
    return (matched?.[0] as NeedTag | undefined) ?? null;
  }

  return getPrimaryNeedTag(args.conciergeBreakdown);
}

function buildHeroMeaningCopy(args: {
  conciergeMode: ConciergeMode | null;
  recommendationReasonDetail?: {
    heroMeaningCopy?: string | null;
  } | null;
  conciergeDeepReason: NarrativeFallback | null;
  conciergeExplanationPayload?: ExplanationPayload | null;
  conciergeBreakdown?: ConciergeBreakdown | null;
  recommendationRankExplanation?: {
    primary_axis?: string;
    primary_label_ja?: string | null;
  } | null;
  shrineName?: string | null;
}): string | null {
  const mode = resolveConciergeMode(args.conciergeMode);

  // fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. generated fallback from explanation/breakdown/mode
  const detailHeroMeaningCopy = args.recommendationReasonDetail?.heroMeaningCopy?.trim();
  if (detailHeroMeaningCopy) return detailHeroMeaningCopy;

  const explicitHeroMeaning = args.conciergeDeepReason?.heroMeaningCopy?.trim();
  if (explicitHeroMeaning) return explicitHeroMeaning;
  const fromShrineMeaning = compressShrineMeaning(args.conciergeDeepReason?.shrineMeaning);
  if (fromShrineMeaning) return fromShrineMeaning;

  const fallbackKey = resolveHeroMeaningFallbackKey({
    conciergeExplanationPayload: args.conciergeExplanationPayload ?? null,
    conciergeBreakdown: args.conciergeBreakdown ?? null,
    recommendationRankExplanation: args.recommendationRankExplanation ?? null,
  });

  if (fallbackKey && HERO_MEANING_BY_TAG[fallbackKey]) {
    return HERO_MEANING_BY_TAG[fallbackKey];
  }

  if (mode === "compat") {
    return "相性の面から無理なく受け取りやすい神社";
  }

  return "今の流れを整え、次の見方を作る神社";
}


export function buildShrineDetailModel({
  shrine,
  publicGoshuins,
  conciergeBreakdown = null,
  conciergeReason = null,
  conciergeDeepReason = null,
  conciergeExplanationPayload = null,
  conciergeMode = null,
  recommendationRankExplanation = null,
  recommendationRankComparison = null,
  recommendationReasonDetail = null,
  ctx = null,
  tid = null,
  signals,
}: Args) {
  const { cardProps } = buildShrineCardProps(shrine);

  const qs = new URLSearchParams();
  if (ctx) qs.set("ctx", ctx);
  if (tid) qs.set("tid", String(tid));

  const query = Object.fromEntries(qs.entries());
  const publicGoshuinsViewAllHref = buildShrineHref(shrine.id, {
    subpath: "goshuins",
    query: Object.keys(query).length ? query : undefined,
  });

  const benefitLabels = getBenefitLabels(shrine);
  const tags: ShrineTag[] = benefitLabels.map(toBenefitTag);

  const latestGoshuinImage =
    publicGoshuins
      .filter((g) => typeof g?.image_url === "string" && g.image_url.trim().length > 0)
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0]?.image_url ?? null;

  const heroImageUrl = latestGoshuinImage ?? cardProps.imageUrl ?? null;

  const exp = buildShrineExplanation({
    shrine,
    signals: {
      publicGoshuinsCount: signals?.publicGoshuinsCount ?? publicGoshuins.length,
      views30d: signals?.views30d,
      fav30d: signals?.fav30d,
    },
  });

  const judge = buildShrineJudge(exp, conciergeBreakdown);

  const fallbackProposal = buildProposalFromBreakdown(conciergeBreakdown);

  const mode = resolveConciergeMode(conciergeMode);
  const explanationPayload = conciergeExplanationPayload ?? null;

  const recommendationMeta = buildRecommendationMeta({
    rankExplanation: recommendationRankExplanation,
    rankComparison: recommendationRankComparison,
  });

  const heroMeaningCopy = buildHeroMeaningCopy({
    conciergeMode: mode,
    recommendationReasonDetail,
    conciergeDeepReason,
    conciergeExplanationPayload: explanationPayload,
    conciergeBreakdown,
    recommendationRankExplanation,
    shrineName: cardProps.title ?? null,
  });

  const primaryNeed = getPrimaryNeedTag(conciergeBreakdown);
  const secondaryNeedTags = getSecondaryNeedTags(conciergeBreakdown);
  const isConciergeContext = ctx === "concierge";

  const narrative = buildRecommendationNarrative({
    mode,
    primaryNeed,
    secondaryNeedTags,
    shrineName: cardProps.title ?? null,
    shrineTone: getShrineTone(cardProps.title ?? null),
    breakdown: conciergeBreakdown,
    explanationPayload,
    deepReason: conciergeDeepReason,
    conciergeReason,
    benefitLabels,
    userElementLabel: explanationPayload?.primary_need_label_ja ?? null,
    primaryReasonLabel: explanationPayload?.primary_reason?.label_ja ?? null,
    shrineSymbolTags: null,
  });

  const consultationSummary = isConciergeContext ? (recommendationReasonDetail?.consultationSummary ?? null) : null;

  // concierge narrative existence check follows the same order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. conciergeReason text
  const hasConciergeNarrative =
    isConciergeContext &&
    Boolean(
      recommendationReasonDetail?.consultationSummary ||
      recommendationReasonDetail?.shrineMeaning ||
      recommendationReasonDetail?.actionMeaning ||
      conciergeDeepReason?.interpretation ||
      conciergeDeepReason?.shrineMeaning ||
      conciergeDeepReason?.action ||
      (typeof conciergeReason === "string" && conciergeReason.trim().length > 0),
    );

  const proposal = hasConciergeNarrative ? "今回の相談の整理" : fallbackProposal;

  // lead fallback order:
  // 1. recommendationReasonDetail.consultationSummary
  // 2. conciergeDeepReason.interpretation / conciergeReason
  // 3. generated lead
  const proposalLead = resolveDetailLead({
    ctx,
    recommendationReasonDetail,
    conciergeDeepReason,
    conciergeReason,
    generatedLead: isConciergeContext
      ? (narrative.meaning.lead ??
        buildProposalLead({
          mode,
          explanationPayload,
        }))
      : buildProposalLead({
          mode,
          explanationPayload,
        }),
  });

  const rankReason = narrative.ranking.rankReason;

  const comparisonText = narrative.ranking.comparisonText;

  const fallbackProposalWhy = buildProposalWhyFromBreakdown({
    mode,
    breakdown: conciergeBreakdown,
    benefitLabels,
    shrineName: cardProps.title ?? null,
    explanationPayload,
  });

  // proposalWhy fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. generated breakdown-based fallback
  const narrativeProposalWhy = buildProposalWhyFromNarrativeSources({
    recommendationReasonDetail,
    deepReason: conciergeDeepReason,
    rankReason,
    comparisonText,
  });

  const proposalWhy = isConciergeContext && narrativeProposalWhy ? narrativeProposalWhy : fallbackProposalWhy;

  // lead fallback order:
  // 1. recommendationReasonDetail.consultationSummary
  // 2. conciergeDeepReason.interpretation / conciergeReason
  // 3. generated lead
  const judgeLead = resolveDetailLead({
    ctx,
    recommendationReasonDetail,
    conciergeDeepReason,
    conciergeReason,
    generatedLead: isConciergeContext
      ? (narrative.meaning.lead ??
        buildProposalLead({
          mode,
          explanationPayload,
        }))
      : buildProposalLead({
          mode,
          explanationPayload,
        }),
  });

  const goriyakuText =
    benefitLabels.length > 0
      ? `${benefitLabels.slice(0, 3).join("・")}のご利益が、今回の相談内容に近い方向です。`
      : "この神社のご利益が、今回の相談内容に近い方向です。";

  // judgeItems fallback order:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. generated judge items
  const narrativeJudgeItems = buildJudgeItemsFromNarrativeSources({
    recommendationReasonDetail,
    deepReason: conciergeDeepReason,
  });

  const judgeItems =
    isConciergeContext && narrativeJudgeItems
      ? narrativeJudgeItems
      : buildJudgeSectionOrder({
          mode,
          explanationPayload,
          breakdown: conciergeBreakdown,
          goriyakuText,
        });

  const judgeSection: RecommendationJudgeSection = {
    disclosureTitle: mode === "compat" ? "相性の根拠" : "おすすめの根拠",
    title: mode === "compat" ? "今回の相性に応じた参拝先" : "今回の相談に応じた参拝先",
    lead: judgeLead,
    items: judgeItems,
  };

  const explanation: ShrineRecommendationExplanation = {
    proposal,
    proposalLead,
    proposalWhy,
    judgeSection,
    rankReason,
  };

  const reasonSection = buildReasonSection({
    mode,
    breakdown: conciergeBreakdown,
    explanationPayload,
    benefitLabels,
  });

  const proposalSection = buildProposalSection({
    lead: proposalLead,
    consultationSummary,
    proposal,
    ctx,
  });

  // meaningSection fallback order is handled inside buildMeaningSection:
  // 1. recommendationReasonDetail
  // 2. conciergeDeepReason
  // 3. generated fallback
  const meaningSection = buildMeaningSection({
    lead: judgeLead,
    deepReason: conciergeDeepReason,
    recommendationReasonDetail,
    shrineName: cardProps.title ?? null,
    benefitLabels,
    mode,
    breakdown: conciergeBreakdown,
  });

  const supplementSection = buildSupplementSection({
    benefitLabels,
    psychologicalTags: narrative.psychologicalTags,
    symbolTags: narrative.symbolTags,
    mode,
    explanationPayload,
  });

  const sections: ShrineDetailSectionModel[] = [
    ...(reasonSection ? [reasonSection] : []),
    ...(proposalSection ? [proposalSection] : []),
    ...(meaningSection ? [meaningSection] : []),
    ...(supplementSection ? [supplementSection] : []),
  ];

  return {
    shrineId: shrine.id,
    cardProps,
    heroImageUrl,
    heroMeaningCopy,
    benefitLabels,
    tags,
    judge,
    conciergeBreakdown,
    exp,
    sections,
    reasonSection,
    proposalSection,
    meaningSection,
    supplementSection,
    proposal: explanation.proposal,
    proposalLead: explanation.proposalLead,
    proposalWhy: explanation.proposalWhy,
    explanation,
    publicGoshuinsPreview: publicGoshuins,
    publicGoshuinsViewAllHref,
    judgeSection: explanation.judgeSection,
    rankReason: explanation.rankReason,
    recommendationMeta,
    psychologicalTags: narrative.psychologicalTags,
    symbolTags: narrative.symbolTags,
  };
}
