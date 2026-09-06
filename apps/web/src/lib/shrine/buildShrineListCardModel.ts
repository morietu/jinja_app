// apps/web/src/lib/shrine/buildShrineListCardModel.ts
import type { Shrine } from "@/lib/api/shrines";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import { isNewShrine } from "@/lib/shrine/isNewShrine";

/**
 * @param now 「新着」判定の基準時刻。テストで固定できるよう引数で受ける（既定は現在時刻）。
 */
export function buildShrineListCardModel(shrine: Shrine, now?: Date) {
  const { cardProps } = buildShrineCardProps(shrine);

  return {
    ...cardProps,
    rating: null,
    reviewCount: null,
    // created_atは一覧APIの事実値。新着判定はFrontendの責務（追加通信はしない）。
    isNew: isNewShrine(shrine.created_at, now),
  };
}
