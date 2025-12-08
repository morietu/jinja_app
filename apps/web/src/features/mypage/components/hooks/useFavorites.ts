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

export type FavoritesFilter = {
  query: string;
  category: "all" | "frequent" | "work" | "love" | "health" | "nearby";
  orderBy: "recent" | "count" | "name" | "benefit";
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

  const [filter, setFilter] = useState<FavoritesFilter>({
    query: "",
    category: "all",
    orderBy: "recent",
  });

  useEffect(() => {
    // TODO: 後で fetch("/api/my/favorites") 的な本実装に差し替え
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      setItems(MOCK_FAVORITES);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const filtered = (items ?? []).filter((s) => {
    // 検索
    if (filter.query.trim()) {
      const q = filter.query.trim().toLowerCase();
      const hit =
        s.name.toLowerCase().includes(q) ||
        s.area.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) return false;
    }

    // カテゴリ（タグベースの簡易フィルタ）
    switch (filter.category) {
      case "frequent":
        return s.tags.includes("よく行く");
      case "work":
        return s.tags.includes("仕事運");
      case "love":
        return s.tags.includes("恋愛");
      case "health":
        return s.tags.includes("健康");
      case "nearby":
        return s.distance_km != null && s.distance_km <= 10;
      case "all":
      default:
        return true;
    }
  });

  // 並び替え（簡易）
  const ordered = [...filtered].sort((a, b) => {
    if (filter.orderBy === "name") {
      return a.name.localeCompare(b.name, "ja");
    }
    if (filter.orderBy === "benefit") {
      // ご利益タグ順：雑に tags の文字列でソート
      return (a.tags[0] ?? "").localeCompare(b.tags[0] ?? "", "ja");
    }
    if (filter.orderBy === "count") {
      // TODO: 将来 visit_count が取れたらここで使用
      return 0;
    }
    // recent（last_visited_at の降順）
    const da = a.last_visited_at ?? "";
    const db = b.last_visited_at ?? "";
    return db.localeCompare(da);
  });

  function updateFilter(next: Partial<FavoritesFilter>) {
    setFilter((prev) => ({ ...prev, ...next }));
  }

  function toggleFavorite(id: number) {
    // TODO: 将来 API 連携時は optimistic update にする
    setItems((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  return {
    items: ordered,
    rawItems: items,
    loading,
    error,
    filter,
    updateFilter,
    toggleFavorite,
  };
}
