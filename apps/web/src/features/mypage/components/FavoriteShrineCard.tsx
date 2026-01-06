"use client";

import Link from "next/link";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite } from "@/lib/favorites/normalize";

type Props = {
  favorite: Favorite;
  onUnsave?: () => void;
};

export function FavoriteShrineCard({ favorite, onUnsave }: Props) {
  const { shrineId, placeId } = normalizeFavorite(favorite);

  const href = shrineId
    ? `/shrines/${shrineId}`
    : placeId
      ? `/shrines/from-place/${encodeURIComponent(placeId)}`
      : null;

  const title =
    (favorite.shrine?.name_jp && favorite.shrine.name_jp.trim()) ||
    (shrineId ? `神社 #${shrineId}` : placeId ? `place_id: ${placeId}` : `id: ${favorite.id}`);

  const sub = (favorite.shrine?.address && favorite.shrine.address.trim()) || null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-white p-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-500 truncate">{sub}</p>}

        {href && (
          <Link href={href} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
            神社の詳細を見る
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={onUnsave}
        className="shrink-0 rounded-md border px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        保存解除
      </button>
    </div>
  );
}
