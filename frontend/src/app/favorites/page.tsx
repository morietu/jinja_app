"use client";

import { useEffect, useState } from "react";
import { getFavorites } from "@/lib/api/favorites";
import { Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/ShrineCard";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Shrine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFavorites()
      .then(setFavorites)
      .catch(() => setError("お気に入りデータの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-4">読み込み中...</p>;
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">お気に入り神社</h1>

      {error && <p className="text-red-500">{error}</p>}

      <ul className="grid gap-4">
        {favorites.map((shrine) => (
          <li key={shrine.id}>
            <ShrineCard shrine={shrine} />
          </li>
        ))}
      </ul>
    </main>
  );
}
