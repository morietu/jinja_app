// apps/web/src/app/favorites/page.tsx
import Link from "next/link";
import ShrineCard from "@/components/ShrineCard";
import { getFavorites, type Favorite } from "@/lib/api/favorites";
import type { Shrine } from "@/lib/api/shrines";

// サーバーコンポーネントで取得
export default async function FavoritesPage() {
  let favorites: Favorite[] = [];
  try {
    favorites = await getFavorites();
  } catch {
    favorites = [];
  }

  return (
    <main className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">お気に入り</h1>

      {favorites.length === 0 ? (
        <p className="text-gray-500">お気に入りはまだありません。</p>
      ) : (
        <ul className="grid gap-3">
          {favorites.map((f) => {
            // shrine がオブジェクトならカード描画、数値ならリンクだけ出す
            const shrineObj: Shrine | null =
              f && typeof f.shrine === "object" && f.shrine
                ? (f.shrine as Shrine)
                : null;

            const shrineId =
              typeof f.shrine === "number"
                ? f.shrine
                : (f.shrine as any)?.id ?? null;

            return (
              <li key={f.id}>
                {shrineObj ? (
                  <ShrineCard shrine={shrineObj} />
                ) : shrineId ? (
                  <div className="rounded border p-4">
                    <p className="text-sm text-gray-600 mb-2">
                      このお気に入りは神社詳細の完全情報を含んでいません。
                    </p>
                    <Link
                      href={`/shrines/${shrineId}`}
                      className="inline-block px-3 py-1 bg-blue-600 text-white rounded"
                    >
                      神社の詳細を見る
                    </Link>
                  </div>
                ) : (
                  <div className="rounded border p-4 text-gray-500">
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
