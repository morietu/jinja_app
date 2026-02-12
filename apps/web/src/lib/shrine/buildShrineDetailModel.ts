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

export function buildShrineDetailModel({
  shrine,
  publicGoshuins,
  conciergeBreakdown = null,
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

  // dev only（必要なら）
  // devLog("ShrineDetailModel", {
  //   shrineId: shrine.id,
  //   publicLen: publicGoshuins.length,
  //   previewLen: publicGoshuinsPreview.length,
  //   hasMore: publicGoshuinsHasMore,
  //   ctx,
  //   tid,
  // });

  return {
    shrineId: shrine.id,
    cardProps,
    heroImageUrl,
    benefitLabels, // 既存（互換）
    tags, // ✅追加（新規）
    judge,
    conciergeBreakdown,
    exp,
    // ✅ 全件を渡す（切るのはUI）
    publicGoshuinsPreview: publicGoshuins,
    publicGoshuinsViewAllHref,
  };
}
