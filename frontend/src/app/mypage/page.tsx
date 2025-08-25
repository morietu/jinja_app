"use client";

import { useEffect, useState } from "react";
import { getFavorites } from "@/lib/api/favorites";
import { getVisits, Visit } from "@/lib/api/visits";
import { Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/ShrineCard";

export default function MyPage() {
  const [favorites, setFavorites] = useState<Shrine[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getFavorites(), getVisits()])
      .then(([favs, vis]) => {
        setFavorites(favs);
        setVisits(vis);
      })
      .catch(() => setError("データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-4">読み込み中...</p>;
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-6">マイページ</h1>

      {error && <p className="text-red-500">{error}</p>}

     {/* ユーザー設定 */}
  <section>...</section>

  {/* コンシェルジュ設定 */}
  <section>...</section>

  {/* お気に入り */}
  <section>...</section>

  {/* 参拝履歴 */}
  <section>...</section>

  {/* アカウント管理 */}
  <section>...</section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">お気に入り神社</h2>
        <ul className="grid gap-4">
          {favorites.map((shrine) => (
            <li key={shrine.id}>
              <ShrineCard shrine={shrine} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">参拝履歴</h2>
        <ul className="grid gap-4">
          {visits.map((visit) => (
            <li key={visit.id}>
              <ShrineCard shrine={visit.shrine} />
              <p className="text-sm text-gray-500">
                参拝日: {new Date(visit.visited_at).toLocaleDateString("ja-JP")}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
