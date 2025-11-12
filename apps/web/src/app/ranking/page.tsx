"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchRanking } from "@/lib/api/ranking";
import type { RankingItem } from "@/lib/api/ranking";
import { useFavorite } from "@/hooks/useFavorite";
import { usePopularShrines } from "@/hooks/usePopularShrines";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ページ内だけで使う簡易型（必要な最小限)
type PopularShrine = {
  id: number; name_jp: string; popular_score: number;
};

/* --- 小物: お気に入り --- */
function FavButton({ shrineId }: { shrineId: number }) {
  const { fav, busy, toggle } = useFavorite({ shrineId, initial: false });
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
function RankingList({ data }: { data: RankingItem[] }) {
  const hasData = Array.isArray(data) && data.length > 0;
  return (
    <ol role="list" className="space-y-4">
      {!hasData && (
        <li className="p-4 text-gray-500">ランキングデータがありません</li>
      )}
      {hasData && data.map((shrine, idx) => (
        <li key={shrine.id ?? idx}>
          <Card
            className={`p-4 transition-colors duration-200 cursor-pointer ${
              idx === 0
                ? "bg-yellow-50 border border-yellow-200 hover:border-yellow-400"
                : idx === 1
                ? "bg-gray-50 border border-gray-200 hover:border-gray-400"
                : idx === 2
                ? "bg-amber-50 border border-amber-200 hover:border-amber-400"
                : "bg-white border hover:border-blue-300"
            }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                <span className="text-2xl">
                  {idx === 0
                    ? "🥇"
                    : idx === 1
                    ? "🥈"
                    : idx === 2
                    ? "🥉"
                    : `#${idx + 1}`}
                </span>
                <span className="font-bold">
                  {shrine?.name_jp ?? "名称不明"}
                </span>
                {typeof shrine.id === "number" && (
                  <span className="ml-auto">
                    <FavButton shrineId={shrine.id} />
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                {shrine?.address ?? "住所不明"}
              </p>

              {Array.isArray(shrine.goriyaku_tags) &&
                shrine.goriyaku_tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {shrine.goriyaku_tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

              <div className="flex gap-4 text-xs text-gray-500">
                <span>
                  参拝数:{" "}
                  {"visit_count" in shrine ? shrine.visit_count ?? 0 : 0}
                </span>
                <span>
                  お気に入り:{" "}
                  {"favorite_count" in shrine ? shrine.favorite_count ?? 0 : 0}
                </span>
              </div>

              {typeof shrine.id === "number" && (
                <Link
                  href={`/shrines/${shrine.id}`}
                  className="text-blue-600 underline text-sm inline-block mt-2"
                >
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

  const { items, loading, error, next, loadMore } = usePopularShrines({
    limit: 20,
    near,
    radiusKm: near ? 10 : undefined,
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
      }
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">人気の神社</h2>
        {!useNear ? (
          <button onClick={enableNear} className="px-3 py-1 rounded border">
            近くを表示
          </button>
        ) : (
          <span className="text-sm opacity-70">近傍表示中</span>
        )}
      </header>

      {error && (
        <div className="text-red-600">
          読み込みに失敗しました。
          <button onClick={() => location.reload()}>再試行</button>
        </div>
      )}

      <ul className="divide-y rounded-2xl shadow">
        {(items as PopularShrine[]).map((s) => (
          <li key={s.id} className="p-3">
            <div className="font-medium">{s.name_jp}</div>
            <div className="text-sm opacity-70">score: {s.popular_score}</div>
          </li>
        ))}
        {loading && <li className="p-3 opacity-70">読み込み中…</li>}
      </ul>

      {next && !loading && (
        <button onClick={loadMore} className="px-4 py-2 rounded border w-full">
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

  return (
    <main className="p-4 mx-auto max-w-3xl">
      <h1 className="text-xl font-bold mb-4">人気神社ランキング</h1>

      {/* 状態メッセージは見出しの下で表示するが、タブ本体は常時描画 */}
      {loading && <p className="mb-2 opacity-70">読み込み中…</p>}
      {error && <p className="mb-2 text-red-600">{error}</p>}

      <Tabs defaultValue="monthly">
        <TabsList className="mb-6">
          <TabsTrigger value="monthly">月間TOP10</TabsTrigger>
          <TabsTrigger value="yearly">年間TOP10</TabsTrigger>
          <TabsTrigger value="popular">人気（近く／ページング）</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <RankingList data={monthly ?? []} />
        </TabsContent>

        <TabsContent value="yearly">
          <RankingList data={yearly ?? []} />
        </TabsContent>

        <TabsContent value="popular">
          <PopularTab />
        </TabsContent>
      </Tabs>
    </main>
  );
}
