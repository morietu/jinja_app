"use client";

// Weekly Featured Shrines（今週の神社）。
//
// 入力は Backend Weekly API の `featured_shrines`（既存 ShrineListSerializer の
// 公開表現 = 既存 `Shrine` 型）。Backendが最大3件を保証しているため、この
// componentは slice / 再ranking / 不足件数の補充を一切行わず、**Backendの順序を
// そのまま**描画する。Snapshot保存後に表示不可となったShrineはBackend側で除外
// 済みなので、成功時でも0〜3件になり得る。0件のときはダミー神社を出さずに
// 何も表示しない。
//
// カードUIは既存 ShrineCard を再利用する（Weekly専用のShrine Card systemは
// 作らない）。props組み立ても既存 buildShrineCardProps() を通す。
// `buildShrineListCardModel()` の `isNew` はWeeklyでは不要なため使わない。
import DetailSection from "@/components/shrine/DetailSection";
import { buildShrineCardProps } from "@/components/shrine/buildShrineCardProps";
import ShrineCard from "@/components/shrines/ShrineCard";
import type { Shrine } from "@/lib/api/shrines";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";

export type WeeklyFeaturedShrinesSectionProps = {
  shrines: Shrine[];
};

export default function WeeklyFeaturedShrinesSection({ shrines }: WeeklyFeaturedShrinesSectionProps) {
  if (!shrines?.length) return null;

  return (
    <DetailSection title="今週の神社" variant="secondary">
      {/* `grid gap-4` だけだと暗黙カラムが `auto`（= min-content 下限）になり、
          長い神社名（ShrineCard内の `truncate` = white-space:nowrap）の
          min-content幅までカラムが広がって375pxでカードがはみ出す。
          `grid-cols-1`（= repeat(1, minmax(0,1fr))）でカラム下限を0にし、
          コンテナ幅を超えないようにする。ShrineCard側は変更しない。 */}
      <ul className="grid grid-cols-1 gap-4">
        {shrines.map((shrine) => {
          const { cardProps } = buildShrineCardProps(shrine);
          return (
            <li key={cardProps.shrineId}>
              <ShrineCard
                name={cardProps.title}
                shrineId={cardProps.shrineId}
                address={cardProps.address ?? undefined}
                recommendReason={cardProps.description ?? undefined}
                imageUrl={cardProps.imageUrl ?? undefined}
                tags={cardProps.badges ?? []}
                // recommendationInstanceId / recommendationRank はWeeklyには
                // 存在しない。既存Monthly Recommendationの遷移契約を模倣して
                // 偽の値を載せない（buildShrineHrefへも渡さない）。
                href={buildShrineHref(cardProps.shrineId)}
                analyticsSource="compass"
              />
            </li>
          );
        })}
      </ul>
    </DetailSection>
  );
}
