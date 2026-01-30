// apps/web/src/features/mypage/components/FavoriteShrineCard.tsx
"use client";

import Link from "next/link";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite } from "@/lib/favorites/normalize";
import { LABELS } from "@/lib/ui/labels";

type Props = {
  favorite: Favorite;
  onUnsave?: () => void;
  onAddGoshuin?: () => void;

  disabled?: boolean;
  unsaveLoading?: boolean;
  addLoading?: boolean;

  canAddGoshuin?: boolean; // 任意：強制的に表示/非表示制御したい時だけ使う
};

export function FavoriteShrineCard({
  favorite,
  onUnsave,
  onAddGoshuin,
  disabled,
  unsaveLoading,
  addLoading,
  canAddGoshuin,
}: Props) {
  const { shrineId, placeId } = normalizeFavorite(favorite);

  const href = shrineId
    ? `/shrines/${shrineId}`
    : placeId
      ? `/shrines/resolve?place_id=${encodeURIComponent(placeId)}`
      : "/map";
      
  const title =
    (favorite.shrine?.name_jp && favorite.shrine.name_jp.trim()) ||
    (shrineId ? `神社 #${shrineId}` : placeId ? `place_id: ${placeId}` : `id: ${favorite.id}`);

  const sub = (favorite.shrine?.address && favorite.shrine.address.trim()) || null;

  const allowAdd = canAddGoshuin ?? Boolean(shrineId || placeId);

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-gray-500">{sub}</p>}

        {href && (
          <Link href={href} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
            {LABELS.shrineDetail}
          </Link>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {onAddGoshuin && (
          <button
            type="button"
            onClick={onAddGoshuin}
            disabled={disabled || addLoading || !allowAdd}
            className="rounded-md border px-3 py-1 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
          >
            {addLoading ? LABELS.moving : LABELS.addGoshuin}
          </button>
        )}

        {onUnsave && (
          <button
            type="button"
            onClick={onUnsave}
            disabled={disabled || unsaveLoading}
            className="rounded-md border px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {unsaveLoading ? LABELS.removing : LABELS.unsave}
          </button>
        )}
      </div>
    </div>
  );
}
