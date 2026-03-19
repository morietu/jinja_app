// apps/web/src/features/mypage/components/FavoritesSection.tsx
"use client";

import Link from "next/link";
import type { Favorite } from "@/lib/api/favorites";
import { useFavorites } from "./hooks/useFavorites";
import { FavoriteShrineCard } from "./FavoriteShrineCard";

type Props = { initialFavorites: Favorite[] };

export default function FavoritesSection({ initialFavorites }: Props) {
  const { items, count, unSave, error } = useFavorites({ initialFavorites });

  const hasData = count > 0;
  const visible = items.slice(0, 3);


  

  return (
    <section className="space-y-3 pt-1 pb-2">
      <header className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <p>
          <span className="font-medium text-gray-700">保存した神社</span>
          <span className="ml-2 text-[11px] text-gray-500">{hasData ? `${count}件` : "0件"}</span>
        </p>
        {hasData && (
          <Link
            href="/favorites"
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            すべて見る
          </Link>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {!hasData ? (
        <div className="space-y-2 rounded-lg border bg-orange-50/50 px-4 py-6 text-center text-sm text-gray-700">
          <div className="text-2xl">📌</div>
          <p className="font-semibold">保存した神社はまだありません</p>
          <p className="text-xs text-gray-500">神社詳細ページで「保存」をタップすると、ここに一覧で表示されます。</p>
          <Link
            href="/map"
            className="mt-2 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-medium text-white hover:bg-orange-600"
          >
            近くの神社を探す
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((f) => (
            <FavoriteShrineCard key={f.id} favorite={f} onUnsave={() => unSave(f)} />
          ))}
        </div>
      )}
    </section>
  );
}
