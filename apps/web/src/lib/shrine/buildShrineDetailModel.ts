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

type ProposalWhyItem = {
  label: "相談との一致" | "神社のご利益" | "補助的な一致";
  text: string;
};

function buildProposalWhyFromBreakdown(
  breakdown?: ConciergeBreakdown | null,
  benefitLabels: string[] = [],
  shrineName?: string | null,
): ProposalWhyItem[] {
  const primary = getPrimaryNeedTag(breakdown);
  const secondary = getSecondaryNeedTags(breakdown);
  const shrineText = shrineName?.trim() || "この神社";
  const benefitText = benefitLabels.slice(0, 3).join("・");

  const items: ProposalWhyItem[] = [];

  if (primary === "courage") {
    items.push({
      label: "相談との一致",
      text: "行動のきっかけや後押しを求める内容が強く出ています。",
    });
  } else if (primary === "money") {
    items.push({
      label: "相談との一致",
      text: "金運や流れを立て直したい意図が相談の中心にあります。",
    });
  } else if (primary === "career") {
    items.push({
      label: "相談との一致",
      text: "仕事や転機に向き合いたい意図が相談の中心にあります。",
    });
  } else if (primary === "mental") {
    items.push({
      label: "相談との一致",
      text: "不安や気持ちの揺れを整えたい意図が相談の中心にあります。",
    });
  } else {
    items.push({
      label: "相談との一致",
      text: "主軸に加えて、周辺の悩みや意図とも接点があります。",
    });
  }

  items.push({
    label: "神社のご利益",
    text: benefitText
      ? `${shrineText}は${benefitText}に関わる特徴があります。`
      : `${shrineText}には今回の相談と接点のある特徴があります。`,
  });

  if (secondary.length > 0) {
    const secondaryText = secondary
      .map((tag) => {
        if (tag === "money") return "金運面も整えたい意図";
        if (tag === "courage") return "前に進むきっかけを求める意図";
        if (tag === "career") return "仕事や転機への意識";
        if (tag === "mental") return "不安を整えたい意図";
        if (tag === "rest") return "休息したい意図";
        if (tag === "love") return "良縁を求める意図";
        if (tag === "study") return "学業に集中したい意図";
        return null;
      })
      .filter(Boolean)
      .join("、");

    items.push({
      label: "補助的な一致",
      text: `${secondaryText}もあり、主軸以外の相談内容ともつながります。`,
    });
  } else {
    items.push({
      label: "補助的な一致",
      text: "主軸に対する一致が特に強く出ています。",
    });
  }

  return items;
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
