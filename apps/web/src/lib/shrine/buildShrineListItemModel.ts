import type { Shrine } from "@/lib/api/shrines";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";

export function buildShrineListItemModel(shrine: Shrine) {
  const { cardProps } = buildShrineCardProps(shrine);
  return { cardProps };
}
