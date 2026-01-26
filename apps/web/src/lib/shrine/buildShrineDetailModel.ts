// apps/web/src/lib/shrine/buildShrineDetailModel.ts
import type { Shrine } from "@/lib/api/shrines";
import type { PublicGoshuinItem } from "@/components/shrine/detail/PublicGoshuinSection";
import type { ConciergeBreakdown } from "@/lib/api/concierge";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { getBenefitLabels } from "@/lib/shrine/getBenefitLabels";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";
import { buildShrineJudge } from "@/lib/shrine/buildShrineJudge";

type Args = {
  shrine: Shrine;
  publicGoshuins: PublicGoshuinItem[];
  conciergeBreakdown?: ConciergeBreakdown | null;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

export function buildShrineDetailModel({ shrine, publicGoshuins, conciergeBreakdown = null, signals }: Args) {
  const { cardProps } = buildShrineCardProps(shrine);
  const benefitLabels = getBenefitLabels(shrine);

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

  return {
    shrineId: shrine.id,
    cardProps,
    heroImageUrl,
    benefitLabels,
    publicGoshuins,
    judge,
    conciergeBreakdown,
    exp,
  };
}
