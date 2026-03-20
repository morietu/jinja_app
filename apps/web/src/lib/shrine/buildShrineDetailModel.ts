import type { Shrine } from "@/lib/api/shrines";
import type { ShrineTag } from "@/lib/shrine/tags/types";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import type { ConciergeExplanation } from "@/features/concierge/sections/types";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { getBenefitLabels } from "@/lib/shrine/getBenefitLabels";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";
import { buildShrineJudge } from "@/lib/shrine/buildShrineJudge";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import {
  buildStructuralProposal,
  buildStructuralProposalReason,
  buildCompatSummary,
  buildCompatReason,
} from "@/lib/shrine/buildStructuralProposal";

type Args = {
  shrine: Shrine;
  publicGoshuins: PublicGoshuinItem[];
  conciergeBreakdown?: ConciergeBreakdown | null;
  conciergeExplanation?: ConciergeExplanation | null;
  ctx?: "map" | "concierge" | null;
  tid?: string | null;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
  conciergeMode?: "need" | "compat" | null;
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

function getAstroElements(shrine: Shrine): string[] {
  const raw = (shrine as any)?.astro_elements;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

export function buildShrineDetailModel({
  shrine,
  publicGoshuins,
  conciergeBreakdown = null,
  conciergeExplanation = null,
  ctx = null,
  tid = null,
  signals,
  conciergeMode = null,
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

  const matchedNeedTags = getMatchedNeedTags(conciergeBreakdown);
  const astroElements = getAstroElements(shrine);
  const explanationSummary = typeof conciergeExplanation?.summary === "string" ? conciergeExplanation.summary : null;

  const structuralInput = {
    matchedNeedTags,
    astroElements,
    benefitLabels,
    explanationSummary,
  };

  const proposal = buildStructuralProposal(structuralInput);
  const proposalReason = buildStructuralProposalReason(structuralInput);

  const scoreElement = conciergeBreakdown?.score_element ?? 0;

  const compatSummary = conciergeMode === "compat" ? buildCompatSummary({ astroElements, scoreElement }) : null;

  const compatReason = conciergeMode === "compat" ? buildCompatReason({ astroElements, scoreElement }) : null;

  return {
    shrineId: shrine.id,
    cardProps,
    heroImageUrl,
    benefitLabels,
    tags,
    judge,
    conciergeBreakdown,
    conciergeExplanation,
    exp,
    proposal,
    proposalReason,
    compatSummary,
    compatReason,
    publicGoshuinsPreview: publicGoshuins,
    publicGoshuinsViewAllHref,
  };
}
