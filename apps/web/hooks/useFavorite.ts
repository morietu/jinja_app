// apps/web/hooks/useFavorite.ts
"use client";
import { useCallback, useState } from "react";
import api from "@/lib/apiClient";

type FavItem = {
  id: number;
  shrine?: { id: number };
  place_id?: string | null;
};

export function useFavorite(initialFav: boolean, shrineId: string | number) {
  const sid = Number(shrineId);
  const [fav, setFav] = useState(!!initialFav);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!fav) {
        // 追加（エイリアス shrine でOK）
        await api.post("favorites/", { shrine: sid });
        setFav(true);
      } else {
        // 一覧から対象のfavorite.idを探して削除
        const { data } = await api.get<FavItem[]>("favorites/");
        const hit = (data || []).find((x) => x.shrine?.id === sid);
        if (hit) await api.delete(`favorites/${hit.id}/`);
        setFav(false);
      }
    } catch (e) {
      console.error("favorite toggle error", e);
    } finally {
      setBusy(false);
    }
  }, [busy, fav, sid]);

  return { fav, busy, toggle };
}
