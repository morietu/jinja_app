// apps/web/src/lib/shrine/buildShrineListCardModel.ts
import type { Shrine } from "@/lib/api/shrines";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";

export function buildShrineListCardModel(shrine: Shrine) {
  const { cardProps } = buildShrineCardProps(shrine);

  return {
    ...cardProps,
    address: null,
    rating: null,
    reviewCount: null,
  };
}
