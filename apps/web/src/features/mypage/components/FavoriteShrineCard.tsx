// apps/web/src/features/mypage/components/FavoriteShrineCard.tsx
"use client";

import Image from "next/image";
import type { FavoriteShrine } from "./hooks/useFavorites";

type Props = {
  shrine: FavoriteShrine;
  onToggleFavorite?: (id: number) => void;
};

export function FavoriteShrineCard({ shrine, onToggleFavorite }: Props) {
  const distance = shrine.distance_km != null ? `${shrine.distance_km.toFixed(1)}km` : null;

  return (
    <div className="flex gap-3 rounded-lg border bg-white p-3 shadow-sm">
      {/* サムネイル */}
      <div className="relative h-16 w-16 overflow-hidden rounded-md bg-gray-100">
        {shrine.image_url ? (
          <Image src={shrine.image_url} alt={shrine.name} fill className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No Image</div>
        )}
      </div>

      {/* 本文 */}
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">{shrine.name}</p>
            <p className="text-xs text-gray-500">
              {shrine.area}
              {distance && ` / 自宅から${distance}`}
            </p>
          </div>

          {/* お気に入りトグル */}
          <button
            type="button"
            onClick={() => onToggleFavorite?.(shrine.id)}
            className="text-yellow-400 transition hover:scale-110"
            aria-label="お気に入りから外す"
          >
            {/* 固定で塗りつぶしスター（お気に入り済み想定） */}★
          </button>
        </div>

        {/* タグ群 */}
        <div className="flex flex-wrap gap-1">
          {shrine.tags.map((t) => (
            <span key={t} className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] text-orange-700">
              #{t}
            </span>
          ))}
        </div>

        {/* 最終お参り情報 */}
        {shrine.last_visited_at && (
          <p className="mt-1 text-[11px] text-gray-500">最近のお参り: {shrine.last_visited_at}</p>
        )}
      </div>
    </div>
  );
}
