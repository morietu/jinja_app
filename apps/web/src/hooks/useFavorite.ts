// apps/web/src/hooks/useFavorite.ts
import { useState, useCallback } from "react";
import { addFavorite, removeFavorite, toggleFavorite } from "@/lib/api/favorites";

export function useFavorite(initial: boolean, shrineId: string) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const prev = fav;
    setFav(!fav); // 楽観更新
    try {
      const r = await toggleFavorite(shrineId);
      const next = r.status === "added";
      setFav(next);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          if (!prev) { await addFavorite(shrineId); setFav(true); }
          else { await removeFavorite(shrineId); setFav(false); }
        } catch {
          setFav(prev);
        }
      } else {
        setFav(prev);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, fav, shrineId]);

  return { fav, busy, toggle };
}
