// apps/web/src/hooks/useFavorite.ts
import { useState, useCallback } from "react";
import { addFavorite, removeFavoriteByShrineId } from "@/lib/api/favorites";

/** 神社ID（number|string）と初期状態でトグルするフック */
export function useFavorite(shrineId: number | string, initial = false) {
  const [fav, setFav] = useState<boolean>(initial);
  const [busy, setBusy] = useState(false);

  // 文字列でも安全に数値化
  const idNum = typeof shrineId === "string" ? Number(shrineId) : shrineId;
  const validId = Number.isFinite(idNum) ? (idNum as number) : null;

  const toggle = useCallback(async () => {
    if (busy || validId == null) return;
    setBusy(true);
    const prev = fav;
    setFav(!fav); // 楽観更新
    try {
      if (!prev) {
        await addFavorite(validId);
      } else {
        await removeFavoriteByShrineId(validId);
      }
    } catch (e) {
      setFav(prev); // 失敗時ロールバック
      console.error(e);
      alert("お気に入り更新に失敗しました");
    } finally {
      setBusy(false);
    }
  }, [fav, busy, validId]);

  return { fav, busy, toggle };
}
