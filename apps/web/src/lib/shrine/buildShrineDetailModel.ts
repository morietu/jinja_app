// apps/web/src/lib/shrine/buildShrineDetailModel.ts
import type { Shrine } from "@/lib/api/shrines";
import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { getBenefitLabels } from "@/lib/shrine/getBenefitLabels";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";
import { buildShrineJudge } from "@/lib/shrine/buildShrineJudge";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

type Args = {
  shrine: Shrine;
  publicGoshuins: PublicGoshuinItem[];
  conciergeBreakdown?: ConciergeBreakdown | null;
  conciergeReason?: string | null;
  conciergeExplanationPayload?: ExplanationPayload | null;
  conciergeMode?: ConciergeMode | null;
  ctx?: "map" | "concierge" | null;
  tid?: string | null;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

type ExplanationPrimaryReason = {
  type?: string | null;
  label?: string | null;
  label_ja?: string | null;
  evidence?: string[] | null;
  score?: number | null;
  is_primary?: boolean | null;
};

type ExplanationPayload = {
  primary_need_tag?: string | null;
  primary_need_label_ja?: string | null;
  primary_reason?: ExplanationPrimaryReason | null;
  secondary_reasons?: ExplanationPrimaryReason[] | null;
  original_reason?: string | null;
  score?: {
    element?: number | null;
    need?: number | null;
    total?: number | null;
    total_ranked?: number | null;
  } | null;
};

type ConciergeMode = "need" | "compat";

function resolveConciergeMode(value: unknown): ConciergeMode {
  return value === "compat" ? "compat" : "need";
}

function buildJudgeSectionOrder(args: {
  mode: ConciergeMode;
  explanationPayload?: ExplanationPayload | null;
  breakdown?: ConciergeBreakdown | null;
  goriyakuText?: string | null;
}): Array<{
  key: string;
  title: string;
  body: string;
}> {
  const mode = args.mode;
  const payload = args.explanationPayload ?? null;
  const primaryNeedLabel = payload?.primary_need_label_ja ?? null;
  const primaryReasonLabel = payload?.primary_reason?.label_ja ?? null;
  const secondaryReasons = Array.isArray(payload?.secondary_reasons) ? payload!.secondary_reasons! : [];

  const sectionsForNeed = [
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
      body:
        secondaryReasons.length > 0
          ? secondaryReasons
              .map((r) => r.label_ja)
              .filter(Boolean)
              .slice(0, 2)
              .join("・")
          : "主軸を補う方向性があります。",
    },
  ];

  const sectionsForCompat = [
    {
      key: "compat",
      title: "生年月日との相性",
      body: "今回の提案では、生年月日との相性を主軸に候補を整理しています。",
    },
    {
      key: "element",
      title: "神社の要素",
      body: "神社が持つ要素との噛み合いを見ています。",
    },
    {
      key: "reason",
      title: "相談との一致",
      body: primaryReasonLabel
        ? `${primaryReasonLabel}に関わる相談内容との補助的な重なりもあります。`
        : "相談内容との補助的な一致も見られます。",
    },
    {
      key: "goriyaku",
      title: "この神社のご利益",
      body: args.goriyakuText ?? "ご利益面でも補助的な一致があります。",
    },
  ];

  return mode === "compat" ? sectionsForCompat : sectionsForNeed;
}

type ProposalWhyItem = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致";
  text: string;
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



function buildProposalFromBreakdown(breakdown?: ConciergeBreakdown | null): string {
  const set = new Set(getMatchedNeedTags(breakdown));

  if (set.has("money") && set.has("courage")) {
    return "金運と前進を後押しする参拝先";
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
    : "今回の相談では、今の状態に近い悩みを主軸に見ています。";
}

type NeedTag = "money" | "courage" | "career" | "mental" | "rest" | "love" | "study";
type ShrineTone = "strong" | "quiet" | "tight" | "neutral";

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

function buildProposalWhyFromBreakdown(
  breakdown?: ConciergeBreakdown | null,
  benefitLabels: string[] = [],
  shrineName?: string | null,
): ProposalWhyItem[] {
  const primary = getPrimaryNeedTag(breakdown);
  const secondary = getSecondaryNeedTags(breakdown);
  const shrineText = shrineName?.trim() || "この神社";
  const shrineTone = getShrineTone(shrineText);

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
  ];
}

export function buildShrineDetailModel({
  shrine,
  publicGoshuins,
  conciergeBreakdown = null,
  conciergeReason = null,
  conciergeExplanationPayload = null,
  conciergeMode = null,
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
  const fallbackProposalWhy = buildProposalWhyFromBreakdown(conciergeBreakdown, benefitLabels, cardProps.title ?? null);

  const hasConciergeReason =
    ctx === "concierge" && typeof conciergeReason === "string" && conciergeReason.trim().length > 0;

  const proposal = hasConciergeReason ? "今回の相談の整理" : fallbackProposal;
  const proposalLead = hasConciergeReason
    ? conciergeReason.trim()
    : buildProposalLead({
        mode: resolveConciergeMode(conciergeMode),
        explanationPayload: conciergeExplanationPayload ?? null,
      });

  const proposalWhy = fallbackProposalWhy;

  const mode = resolveConciergeMode(conciergeMode);
  const explanationPayload = conciergeExplanationPayload ?? null;

  const judgeLead = buildProposalLead({
    mode,
    explanationPayload,
  });

  const goriyakuText =
    benefitLabels.length > 0
      ? `${benefitLabels.slice(0, 3).join("・")}のご利益が、今回の相談内容に近い方向です。`
      : "この神社のご利益が、今回の相談内容に近い方向です。";

  const judgeItems = buildJudgeSectionOrder({
    mode,
    explanationPayload,
    breakdown: conciergeBreakdown,
    goriyakuText,
  });

  return {
    shrineId: shrine.id,
    cardProps,
    heroImageUrl,
    benefitLabels,
    tags,
    judge,
    conciergeBreakdown,
    exp,
    proposal,
    proposalLead,
    proposalWhy,
    publicGoshuinsPreview: publicGoshuins,
    publicGoshuinsViewAllHref,
    judgeSection: {
      disclosureTitle: mode === "compat" ? "相性の根拠" : "おすすめの根拠",
      title: mode === "compat" ? "今回の相性に応じた参拝先" : "今回の相談に応じた参拝先",
      lead: judgeLead,
      items: judgeItems,
    },
  };
}
