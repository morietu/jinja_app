// apps/web/src/features/mypage/components/hooks/useFavorites.ts
import { useEffect, useState } from "react";

export type FavoriteShrine = {
  id: number;
  name: string;
  area: string; // "東京都" など
  distance_km?: number | null;
  last_visited_at?: string | null; // "YYYY-MM-DD"
  image_url?: string | null;
  tags: string[]; // ["仕事運", "恋愛"] など
};

const MOCK_FAVORITES: FavoriteShrine[] = [
  {
    id: 1,
    name: "○○神社",
    area: "東京都",
    distance_km: 3.2,
    last_visited_at: "2025-11-23",
    image_url: null,
    tags: ["仕事運", "よく行く"],
  },
  {
    id: 2,
    name: "△△神社",
    area: "神奈川県",
    distance_km: 12.5,
    last_visited_at: null,
    image_url: null,
    tags: ["恋愛", "初詣スポット"],
  },
];

export function useFavorites() {
  const [items, setItems] = useState<FavoriteShrine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: 後で /api/my/favorites に差し替え
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      setItems(MOCK_FAVORITES);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  function toggleFavorite(id: number) {
    // TODO: API 連携時は optimistic update にする
    setItems((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  return {
    items: items ?? [],
    rawItems: items,
    loading,
    error,
    toggleFavorite,
  };
}
