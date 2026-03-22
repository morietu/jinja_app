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

  if (set.has("mental") && set.has("rest")) {
    return "今の疲れを整えたいなら、この神社が合います。";
  }

  if (set.has("career") && set.has("mental") && set.has("courage")) {
    return "不安を整えながら次の一歩を踏み出すなら、この神社が合います。";
  }

  if (set.has("career") && set.has("courage")) {
    return "仕事や転機で前に進みたいなら、この神社が合います。";
  }

  if (set.has("money") && set.has("courage")) {
    return "金運と行動の流れを変えたいなら、この神社が合います。";
  }

  if (set.has("love")) {
    return "良縁を前向きに育てたいなら、この神社が合います。";
  }

  if (set.has("study")) {
    return "学業や合格に集中したいなら、この神社が合います。";
  }

  if (set.has("mental")) {
    return "心の不安を整えたいなら、この神社が合います。";
  }

  if (set.has("rest")) {
    return "落ち着いて心身を休めたいなら、この神社が合います。";
  }

  return "今の状況に合う参拝先として、この神社をおすすめします。";
}

function buildProposalReasonFromBreakdown(breakdown?: ConciergeBreakdown | null): string {
  const set = new Set(getMatchedNeedTags(breakdown));

  if (set.has("mental") && set.has("rest")) {
    return "心を落ち着けることと、しっかり休息したい状態の両方に合っています。";
  }

  if (set.has("career") && set.has("mental") && set.has("courage")) {
    return "不安を整えつつ、仕事や転機で前進したい状態に強く合っています。";
  }

  if (set.has("career") && set.has("courage")) {
    return "仕事や転機に向き合いながら、前へ進みたい状態に合っています。";
  }

  if (set.has("money") && set.has("courage")) {
    return "金運だけでなく、動き出すきっかけを求める状態にも合っています。";
  }

  if (set.has("love")) {
    return "良縁や恋愛を前向きに進めたい状態と噛み合っています。";
  }

  if (set.has("study")) {
    return "学業や合格に向けて、集中したい状態と噛み合っています。";
  }

  if (set.has("mental")) {
    return "不安や気持ちの揺れを整えたい状態に合っています。";
  }

  if (set.has("rest")) {
    return "落ち着いて休みたい状態に合っています。";
  }

  return "今回の相談内容と、この神社の特徴に重なる部分があります。";
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
  const fallbackProposalReason = buildProposalReasonFromBreakdown(conciergeBreakdown);

  const hasConciergeReason =
    ctx === "concierge" && typeof conciergeReason === "string" && conciergeReason.trim().length > 0;

  const proposal = hasConciergeReason ? "今回の相談に対するおすすめ理由" : fallbackProposal;

  const proposalReason = hasConciergeReason ? conciergeReason.trim() : fallbackProposalReason;

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
    proposalReason,
    publicGoshuinsPreview: publicGoshuins,
    publicGoshuinsViewAllHref,
  };
}
