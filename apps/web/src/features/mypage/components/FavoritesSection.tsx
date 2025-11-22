// apps/web/src/features/mypage/components/FavoritesSection.tsx
"use client";

import Link from "next/link";

export default function FavoritesSection() {
  // TODO: 後で useFavorites() 等に差し替え
  const loading = false;
  const error: string | null = null;
  const items: { id: number; name: string; address?: string }[] = [];

  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">お気に入り神社</h2>
        <Link href="/favorites" className="text-[11px] text-emerald-700 underline">
          一覧へ
        </Link>
      </header>

      {loading && <p className="text-xs text-gray-500">読み込み中です…</p>}
      {error && <p className="text-xs text-red-600">お気に入りの取得に失敗しました。</p>}

      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-gray-500">まだお気に入りは登録されていません。</p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2 text-xs">
          {items.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{s.name}</p>
                {s.address && <p className="text-[11px] text-gray-500 line-clamp-1">{s.address}</p>}
              </div>
              <Link href={`/shrines/${s.id}`} className="text-[11px] text-emerald-700 underline">
                詳細
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
