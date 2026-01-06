// apps/web/src/features/mypage/components/hooks/useFavorites.ts
"use client";

import { useState } from "react";
import type { Favorite } from "@/lib/api/favorites";
import { removeFavoriteByPk } from "@/lib/api/favorites";
import { removeFavoriteFromCacheByPk, clearFavoritesInFlight } from "@/lib/favoritesCache";

type Options = { initialFavorites: Favorite[] };

export function useFavorites({ initialFavorites }: Options) {
  const [items, setItems] = useState<Favorite[]>(initialFavorites);
  const [error, setError] = useState<string | null>(null);

  async function unSave(f: Favorite) {
    setError(null);

    let snapshot: Favorite[] = [];
    setItems((prev) => {
      snapshot = prev;
      return prev.filter((x) => x.id !== f.id);
    });

    try {
      await removeFavoriteByPk(f.id);
      removeFavoriteFromCacheByPk(f.id);
      clearFavoritesInFlight();
    } catch {
      setItems(snapshot);
      setError("保存解除に失敗しました");
    }
  }

  return { items, count: items.length, unSave, error };
}
