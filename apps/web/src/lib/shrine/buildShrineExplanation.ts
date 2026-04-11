import type { Shrine } from "@/lib/api/shrines";
import { buildShrineExplanation } from "@/lib/shrine/buildShrineExplanation";

export type RecommendationNarrative = {
  reason: string;
  consultationSummary: string;
  shrineMeaning: string;
  supplement: string;
};

type BuildRecommendationNarrativeArgs = {
  shrine: Shrine;
  signals?: {
    publicGoshuinsCount?: number;
    views30d?: number;
    fav30d?: number;
  };
};

export function buildRecommendationNarrative(
  args: BuildRecommendationNarrativeArgs
): RecommendationNarrative {
  const explanation = buildShrineExplanation(args);

  return {
    reason: explanation.reason,
    consultationSummary: explanation.consultationSummary,
    shrineMeaning: explanation.shrineMeaning,
    supplement: explanation.supplement,
  };
}
