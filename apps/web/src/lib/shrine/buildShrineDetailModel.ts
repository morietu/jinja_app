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
  ctx?: "map" | "concierge" | null;
  tid?: string | null;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

type NeedTag = "money" | "courage" | "career" | "mental" | "rest" | "love" | "study";

type ProposalWhyItem = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致";
  text: string;
};

function needLabelJa(tag: string): string {
  if (tag === "money") return "金運";
  if (tag === "courage") return "前に進むきっかけ";
  if (tag === "career") return "仕事や転機";
  if (tag === "mental") return "不安や気持ちの揺れ";
  if (tag === "rest") return "休息";
  if (tag === "love") return "良縁や恋愛";
  if (tag === "study") return "学業や合格";
  return tag;
}

function buildNeedMatchText(primary: string | null, secondary: string[]): string {
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

function buildBenefitText(shrineText: string, benefitLabels: string[]): string {
  const labels = benefitLabels.filter(Boolean).slice(0, 3);

  if (labels.length >= 3) {
    return `${shrineText}は${labels[0]}・${labels[1]}・${labels[2]}に関わるご利益で知られています。`;
  }

  if (labels.length === 2) {
    return `${shrineText}は${labels[0]}と${labels[1]}に関わるご利益で知られています。`;
  }

  if (labels.length === 1) {
    return `${shrineText}は${labels[0]}に関わるご利益で知られています。`;
  }

  return `${shrineText}には今回の相談で重視したい方向と見比べやすい特徴があります。`;
}

function buildSecondaryText(primary: string | null, secondary: string[]): string {
  if (secondary.length === 0) {
    return "主軸に対する一致が特に強く出ています。";
  }

  const secondaryJa = secondary.map(needLabelJa);

  if (primary === "courage" && secondary.includes("money")) {
    return "前に進みたい気持ちだけでなく、金運面の流れも整えたい意図があります。";
  }

  if (primary === "money" && secondary.includes("courage")) {
    return "金運面だけでなく、動き出すきっかけも必要としている状態です。";
  }

  if (primary === "mental" && secondary.includes("rest")) {
    return "気持ちを整えることに加えて、しっかり休みたい意図も見られます。";
  }

  if (primary === "career" && secondary.includes("courage")) {
    return "仕事や転機への意識に加えて、前へ進む後押しも必要としている状態です。";
  }

  if (primary === "rest" && secondary.includes("mental")) {
    return "休息だけでなく、気持ちの揺れを整えたい意図も見られます。";
  }

  return `${secondaryJa.join("、")}に関する意図もあり、主軸以外の要素も含まれています。`;
}

function buildProposalWhyFromBreakdown(
  breakdown?: ConciergeBreakdown | null,
  benefitLabels: string[] = [],
  shrineName?: string | null,
): ProposalWhyItem[] {
  const primary = getPrimaryNeedTag(breakdown);
  const secondary = getSecondaryNeedTags(breakdown);
  const shrineText = shrineName?.trim() || "この神社";

  return [
    {
      label: "相談との一致",
      text: buildNeedMatchText(primary, secondary),
    },
    {
      label: "神社のご利益",
      text: buildBenefitText(shrineText, benefitLabels),
    },
    {
      label: "補助的な一致",
      text: buildSecondaryText(primary, secondary),
    },
  ];
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

function getMatchedNeedTags(breakdown?: ConciergeBreakdown | null): string[] {
  return (breakdown?.matched_need_tags ?? []).filter((v): v is string => typeof v === "string" && v.trim().length > 0);
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

  return "今回の相談に近い参拝先";
}




function getSecondaryNeedTags(breakdown?: ConciergeBreakdown | null): string[] {
  const primary = getPrimaryNeedTag(breakdown);
  return getMatchedNeedTags(breakdown).filter((tag) => tag !== primary);
}

function getPrimaryNeedTag(breakdown?: ConciergeBreakdown | null): string | null {
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

function buildProposalLeadFromBreakdown(breakdown?: ConciergeBreakdown | null): string {
  const primary = getPrimaryNeedTag(breakdown);

  if (primary === "courage") {
    return "まず前に進むきっかけを持ちたい意図が主軸にあります。";
  }

  if (primary === "money") {
    return "まず金運や流れを立て直したい意図が主軸にあります。";
  }

  if (primary === "career") {
    return "まず仕事や転機に向き合いたい意図が主軸にあります。";
  }

  if (primary === "mental") {
    return "まず不安や気持ちの揺れを整えたい意図が主軸にあります。";
  }

  if (primary === "rest") {
    return "まず落ち着いて休みたい意図が主軸にあります。";
  }

  if (primary === "love") {
    return "まず良縁や恋愛を前向きに進めたい意図が主軸にあります。";
  }

  if (primary === "study") {
    return "まず学業や合格に集中したい意図が主軸にあります。";
  }

  return "今回の相談では、今の状態を整えたい意図が主軸にあります。";
}

export function buildShrineDetailModel({
  shrine,
  publicGoshuins,
  conciergeBreakdown = null,
  conciergeReason = null,
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
  const fallbackProposalLead = buildProposalLeadFromBreakdown(conciergeBreakdown);
  const fallbackProposalWhy = buildProposalWhyFromBreakdown(conciergeBreakdown, benefitLabels, cardProps.title ?? null);

  const hasConciergeReason =
    ctx === "concierge" && typeof conciergeReason === "string" && conciergeReason.trim().length > 0;

  const proposal = hasConciergeReason ? "今回の相談の整理" : fallbackProposal;

  const proposalLead = hasConciergeReason ? conciergeReason.trim() : fallbackProposalLead;

  const proposalWhy = fallbackProposalWhy;

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
  };
}
