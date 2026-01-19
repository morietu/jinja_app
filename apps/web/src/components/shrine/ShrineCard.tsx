// apps/web/src/components/shrine/ShrineCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";

type GoriyakuTag = { id: number; name: string };

type Props = {
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  goriyakuTags?: readonly GoriyakuTag[];

  /** 表示制御 */
  showFavorite?: boolean;
  readOnly?: boolean;

  /** お気に入り初期値 */
  initialFav?: boolean;

  /**
   * 詳細リンクを上書きできるようにする（map/concierge対策）
   * 例: `/shrines/from-place/${placeId}?ctx=map`
   */
  detailHref?: string;
};

export default function ShrineCard({
  shrineId,
  title,
  address,
  description,
  imageUrl,
  goriyakuTags = [],
  showFavorite = true,
  initialFav = false,
  readOnly = false,
  detailHref,
}: Props) {
  const { fav, busy, toggle } = useFavorite({
    shrineId,
    initial: initialFav,
  });

  const favButton = !showFavorite ? null : (
    <button
      onClick={toggle}
      disabled={busy || readOnly}
      className="text-sm font-semibold"
      aria-pressed={fav}
      aria-label={fav ? "お気に入り解除" : "お気に入りに追加"}
      title={fav ? "お気に入り解除" : "お気に入りに追加"}
    >
      {fav ? "★" : "☆"}
    </button>
  );

  // NaN対策：detailHrefが渡されていればそれを優先。なければ shrineId ベース。
  const safeDetailHref = detailHref ?? (Number.isFinite(shrineId) ? `/shrines/${shrineId}` : undefined);

  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      isPrimary
      badges={["正式登録", ...goriyakuTags.map((t) => t.name)]}
      detailHref={safeDetailHref}
      headerRight={favButton}
      disclosureTitle="この神社について"
      disclosureBody={
        <div className="space-y-2">
          <p>{description}</p>
          {goriyakuTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {goriyakuTags.map((t) => (
                <span key={t.id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
