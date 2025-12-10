export default function FavoritesSection() {
  const { items, rawItems, loading, error, toggleFavorite } = useFavorites();

  const hasData = (rawItems?.length ?? 0) > 0;
  const visibleItems = items.slice(0, 3); // マイページでは最大3件だけ表示

  const headerText = (() => {
    if (loading) return "読み込み中…";
    if (!hasData) return "お気に入り 0件";
    return `お気に入り ${rawItems!.length}件`;
  })();

  return (
    <section className="space-y-3 pt-1 pb-2">
      {/* 上部：件数 + 一覧ページへのリンク */}
      <header className="flex items-center justify-between gap-2 text-xs text-gray-500">
        {/* 🔽 ここを headerText に差し替え */}
        <p className="font-medium text-gray-700">{headerText}</p>

        {hasData && (
          <Link
            href="/favorites"
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] text-gray-700 hover:bg-gray-50"
          >
            すべて見る
          </Link>
        )}
      </header>

      {/* 状態出し分け */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
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
            神社詳細ページから「お気に入り」をタップすると、ここに一覧で表示されます。
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
          {visibleItems.map((s) => (
            <FavoriteShrineCard key={s.id} shrine={s} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </section>
  );
}
