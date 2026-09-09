"use client";

import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchRanking } from "@/lib/api/ranking";
import type { RankingItem } from "@/lib/api/ranking";
import { useFavorite } from "@/hooks/useFavorite";
import {
  preloadFavoritesByShrineIds,
  type FavoritePreloadMap,
} from "@/lib/api/favorites";
import { usePopularShrines } from "../../hooks/usePopularShrines";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const EMPTY_FAVORITE_INITIAL = { fav: false, favorite_id: null } as const;

function getInitialFavorite(
  shrineId: number,
  initialFavorites?: FavoritePreloadMap,
) {
  return initialFavorites?.[String(shrineId)] ?? EMPTY_FAVORITE_INITIAL;
}

/* --- 小物: お気に入り --- */
function FavButton({
  shrineId,
  initial,
}: {
  shrineId: number;
  initial?: { fav: boolean; favorite_id: number | null };
}) {
  const { fav, busy, toggle } = useFavorite({
    shrineId,
    initial: initial ?? EMPTY_FAVORITE_INITIAL,
  });
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      className="text-sm"
    >
      {busy ? "…" : fav ? "★" : "☆"}
    </button>
  );
}

/* --- 小物: ランキングカードリスト --- */
function RankingList({
  data,
  initialFavorites,
}: {
  data: RankingItem[];
  initialFavorites?: FavoritePreloadMap;
}) {
  const hasData = Array.isArray(data) && data.length > 0;
  return (
    <ol role="list" className="space-y-4">
      {!hasData && <li className="p-4 text-[var(--kt-color-text-secondary)]">ランキングデータがありません</li>}
      {hasData &&
        data.map((shrine, idx) => (
          <li key={shrine.id ?? idx}>
            <Card
              className={`p-4 transition-colors duration-200 cursor-pointer ${
                idx === 0
                  ? "bg-yellow-50 border border-yellow-200 hover:border-yellow-400"
                  : idx === 1
                    ? "bg-[var(--kt-color-surface-default)] border border-[var(--kt-color-border-default)] hover:border-[var(--kt-color-border-strong)]"
                    : idx === 2
                      ? "bg-amber-50 border border-amber-200 hover:border-amber-400"
                      : "bg-[var(--kt-color-surface-default)] border hover:border-blue-300"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="text-2xl">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </span>
                  <span className="font-bold">{shrine?.name_jp ?? "名称不明"}</span>
                  {typeof shrine.id === "number" && (
                    <span className="ml-auto">
                      <FavButton
                        shrineId={shrine.id}
                        initial={getInitialFavorite(shrine.id, initialFavorites)}
                      />
                    </span>
                  )}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                <p className="text-sm text-[var(--kt-color-text-secondary)]">{shrine?.address ?? "住所不明"}</p>

                {Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {shrine.goriyaku_tags.map((tag) => (
                      <span key={tag.id} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-[var(--kt-color-action-primary)]">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 text-xs text-[var(--kt-color-text-secondary)]">
                  <span>参拝数: {"visit_count" in shrine ? (shrine.visit_count ?? 0) : 0}</span>
                  <span>お気に入り: {"favorite_count" in shrine ? (shrine.favorite_count ?? 0) : 0}</span>
                </div>

                {typeof shrine.id === "number" && (
                  <Link href={buildShrineHref(shrine.id)} className="text-[var(--kt-color-action-primary)] underline text-sm inline-block mt-2">

                    詳細へ
                  </Link>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
    </ol>
  );
}


/* --- タブ: 人気（近傍＋ページング）--- */
function PopularTab() {
  const [useNear, setUseNear] = useState(false);
  const [near, setNear] = useState<string | undefined>(undefined);
  const [initialFavorites, setInitialFavorites] = useState<FavoritePreloadMap>({});

  const { items, loading, error, next, loadMore, isFallback } = usePopularShrines({
    limit: 20,
    near,
    radiusKm: near ? 30 : undefined,
  });

  function enableNear() {
    setUseNear(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setNear(`${lat},${lng}`);
      },
      () => {
        /* 許可されなかった場合はそのまま全体人気を表示 */
      },
    );
  }

  // /api/populars/ のレスポンスを RankingItem に寄せる
  const normalized: RankingItem[] = useMemo(
    () =>
      (items as any[]).map((s) => ({
        id: s.id,
        name_jp: s.name_jp ?? s.name ?? "",
        address: s.address ?? "",
        latitude: s.latitude ?? 0,
        longitude: s.longitude ?? 0,
        score: s.popular_score ?? 0,
        visit_count: s.visit_count ?? 0,
        favorite_count: s.favorite_count ?? 0,
        goriyaku_tags: s.goriyaku_tags ?? [],
      })),
    [items],
  );

  const shrineIds = useMemo(
    () => normalized.map((s) => s.id).filter((id): id is number => typeof id === "number"),
    [normalized],
  );

  useEffect(() => {
    let cancelled = false;

    if (shrineIds.length === 0) {
      setInitialFavorites({});
      return;
    }

    (async () => {
      try {
        const map = await preloadFavoritesByShrineIds(shrineIds);
        if (!cancelled) setInitialFavorites(map);
      } catch {
        if (!cancelled) setInitialFavorites({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shrineIds]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">近くの人気神社</h2>
        {!useNear ? (
          <button onClick={enableNear} className="px-3 py-1 rounded border text-sm">
            現在地から探す
          </button>
        ) : (
          <span className="text-sm opacity-70">現在地付近を表示中</span>
        )}
      </header>

      {error && (
        <div className="text-[var(--kt-color-status-error)] text-sm">
          読み込みに失敗しました。{" "}
          <button onClick={() => location.reload()} className="underline">
            再試行
          </button>
        </div>
      )}

      {isFallback && (
        <p className="text-xs text-muted-foreground">
          近くにはまだデータがありません。全国の人気神社を表示しています。
        </p>
      )}

      {/* ★ ここを RankingList に統一 */}
      <RankingList data={normalized} initialFavorites={initialFavorites} />

      {next && !loading && (
        <button onClick={loadMore} className="px-4 py-2 rounded border w-full text-sm">
          さらに表示
        </button>
      )}
    </section>
  );
}



/* --- ページ本体 --- */
export default function RankingPage() {
  const [monthly, setMonthly] = useState<RankingItem[]>([]);
  const [yearly, setYearly] = useState<RankingItem[]>([]);
  const [monthlyInitialFavorites, setMonthlyInitialFavorites] = useState<FavoritePreloadMap>({});
  const [yearlyInitialFavorites, setYearlyInitialFavorites] = useState<FavoritePreloadMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, y] = await Promise.all([
          fetchRanking("monthly"),
          fetchRanking("yearly"),
        ]);
        setMonthly(m);
        setYearly(y);
      } catch {
        setError("ランキングの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const monthlyShrineIds = useMemo(
    () => monthly.map((s) => s.id).filter((id): id is number => typeof id === "number"),
    [monthly],
  );
  const yearlyShrineIds = useMemo(
    () => yearly.map((s) => s.id).filter((id): id is number => typeof id === "number"),
    [yearly],
  );

  useEffect(() => {
    let cancelled = false;

    if (monthlyShrineIds.length === 0) {
      setMonthlyInitialFavorites({});
      return;
    }

    (async () => {
      try {
        const map = await preloadFavoritesByShrineIds(monthlyShrineIds);
        if (!cancelled) setMonthlyInitialFavorites(map);
      } catch {
        if (!cancelled) setMonthlyInitialFavorites({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monthlyShrineIds]);

  useEffect(() => {
    let cancelled = false;

    if (yearlyShrineIds.length === 0) {
      setYearlyInitialFavorites({});
      return;
    }

    (async () => {
      try {
        const map = await preloadFavoritesByShrineIds(yearlyShrineIds);
        if (!cancelled) setYearlyInitialFavorites(map);
      } catch {
        if (!cancelled) setYearlyInitialFavorites({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [yearlyShrineIds]);

  return (
    <main className="p-4 mx-auto max-w-3xl">
      <h1 className="text-xl font-bold mb-4">人気神社ランキング</h1>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        月間TOP10は直近30日間の人気、年間TOP10は過去1年分のデータを元にしたランキングです。
      </p>

      {/* 状態メッセージは見出しの下で表示するが、タブ本体は常時描画 */}
      {loading && <p className="mb-2 opacity-70">読み込み中…</p>}
      {error && <p className="mb-2 text-[var(--kt-color-status-error)]">{error}</p>}

      <Tabs defaultValue="popular">
        <TabsList className="mb-6">
          <TabsTrigger value="popular">近くの人気神社</TabsTrigger>
          <TabsTrigger value="monthly">月間TOP10</TabsTrigger>
          <TabsTrigger value="yearly">年間TOP10</TabsTrigger>
        </TabsList>

        <TabsContent value="popular">
          <PopularTab />
        </TabsContent>

        <TabsContent value="monthly">
          <RankingList data={monthly ?? []} initialFavorites={monthlyInitialFavorites} />
        </TabsContent>

        <TabsContent value="yearly">
          <RankingList data={yearly ?? []} initialFavorites={yearlyInitialFavorites} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
