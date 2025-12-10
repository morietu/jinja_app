// apps/web/src/app/favorites/page.tsx
import Link from "next/link";
import ShrineCard from "@/components/ShrineCard";
import { getFavorites, type Favorite } from "@/lib/api/favorites";
import type { Shrine } from "@/lib/api/shrines";

type FavoriteLike = Favorite & { shrine?: Shrine | number };

export default async function FavoritesPage() {
  let favorites: Favorite[] = [];
  try {
    favorites = await getFavorites();
  } catch {
    favorites = [];
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">お気に入り</h1>
        {/* 将来的にフィルタやソートを足す余地をここに残す */}
      </header>

      {favorites.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-orange-50/40 px-4 py-6 text-sm text-gray-700">
          <p className="font-semibold mb-1">お気に入りの神社はまだありません</p>
          <p className="text-xs text-gray-500">
            神社詳細ページから「お気に入り」をタップすると、ここに一覧で表示されます。
          </p>
          <Link
            href="/search"
            className="mt-3 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-medium text-white hover:bg-orange-600"
          >
            神社を探す
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {favorites.map((f0) => {
            const f = f0 as FavoriteLike;

            const shrineObj: Shrine | null =
              f && typeof f.shrine === "object" && f.shrine ? (f.shrine as Shrine) : null;

            const shrineId = typeof f.shrine === "number" ? (f.shrine as number) : ((f.shrine as any)?.id ?? null);

            return (
              <li key={f.id}>
                {shrineObj ? (
                  <ShrineCard shrine={shrineObj} />
                ) : shrineId ? (
                  <div className="rounded border bg-white p-4">
                    <p className="mb-2 text-sm text-gray-600">このお気に入りは神社詳細の完全情報を含んでいません。</p>
                    <Link
                      href={`/shrines/${shrineId}`}
                      className="inline-block rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                    >
                      神社の詳細を見る
                    </Link>
                  </div>
                ) : (
                  <div className="rounded border bg-white p-4 text-sm text-gray-500">
                    参照先が不明なお気に入りです（id: {f.id}）
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
