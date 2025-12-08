// apps/web/src/features/mypage/components/FavoritesSection.tsx
"use client";

import Link from "next/link";
import { FavoriteShrineCard } from "./FavoriteShrineCard";
import { useFavorites } from "./hooks/useFavorites";

export default function FavoritesSection() {
  const { items, rawItems, loading, error, filter, updateFilter, toggleFavorite } = useFavorites();

  const hasData = (rawItems?.length ?? 0) > 0;

  return (
    <section className="space-y-4">
      {/* ヘッダー */}
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">お気に入り</h2>
          {hasData && <p className="text-[11px] text-gray-500">{items.length}件表示中</p>}
        </div>
        {/* 並び替え（簡易セレクト） */}
        <select
          className="rounded border bg-white px-2 py-1 text-xs"
          value={filter.orderBy}
          onChange={(e) =>
            updateFilter({
              orderBy: e.target.value as typeof filter.orderBy,
            })
          }
        >
          <option value="recent">最近追加順</option>
          <option value="name">名前順</option>
          <option value="benefit">ご利益タグ順</option>
          {/* count は将来用 */}
        </select>
      </header>

      {/* 上部フィルタ UI */}
      <div className="space-y-2">
        {/* 検索 */}
        <input
          type="search"
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="神社名・エリア・ご利益で検索"
          value={filter.query}
          onChange={(e) => updateFilter({ query: e.target.value })}
        />

        {/* チップフィルタ（横スクロール） */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[
            { key: "all", label: "すべて" },
            { key: "frequent", label: "よく行く" },
            { key: "work", label: "仕事運" },
            { key: "love", label: "恋愛" },
            { key: "health", label: "健康" },
            { key: "nearby", label: "近くの神社" },
          ].map((c) => {
            const active = filter.category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() =>
                  updateFilter({
                    category: c.key as typeof filter.category,
                  })
                }
                className={
                  "whitespace-nowrap rounded-full border px-3 py-1 text-xs " +
                  (active ? "border-orange-300 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 状態出し分け */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-lg border bg-white p-3 shadow-sm">
              <div className="h-16 w-16 rounded-md bg-gray-100" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-1/2 rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
                <div className="flex gap-2">
                  <div className="h-4 w-12 rounded-full bg-gray-100" />
                  <div className="h-4 w-10 rounded-full bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          お気に入り一覧の取得に失敗しました。
          <br />
          時間をおいて再度お試しください。
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="space-y-2 rounded-lg border border-dashed bg-orange-50/50 px-4 py-6 text-center text-sm text-gray-700">
          <div className="text-2xl">⭐</div>
          <p className="font-semibold">お気に入りの神社はまだありません</p>
          <p className="text-xs text-gray-500">
            神社詳細ページから「お気に入り」をタップすると、 ここに一覧で表示されます。
          </p>
          <Link
            href="/search"
            className="mt-2 inline-block rounded-full bg-orange-500 px-4 py-1 text-xs font-medium text-white hover:bg-orange-600"
          >
            神社を探す
          </Link>
        </div>
      )}

      {!loading && !error && hasData && (
        <div className="space-y-3">
          {items.map((s) => (
            <FavoriteShrineCard key={s.id} shrine={s} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </section>
  );
}
