// apps/web/src/lib/shrine/buildShrineListItemModel.ts
import type { Shrine } from "@/lib/api/shrines";
import { buildShrineListCardModel } from "@/lib/shrine/buildShrineListCardModel";

export function buildShrineListItemModel(shrine: Shrine) {
  return {
    cardProps: buildShrineListCardModel(shrine),
  };
}
