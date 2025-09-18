// apps/web/src/hooks/useFavorite.ts
import { useCallback, useMemo, useState } from "react";
import {
  createFavoriteByShrineId,
  createFavoriteByPlaceId,
  removeFavoriteByPk,
  removeFavoriteByShrineId,
  removeFavoriteByPlaceId,
  type Favorite,
} from "@/lib/api/favorites";

type Args = {
  shrineId?: number;
  placeId?: string;
  initial?: boolean;
  initialFavoritePk?: number | null;
  disabled?: boolean; // ★ 追加
};

export function useFavorite({
  shrineId,
  placeId,
  initial = false,
  initialFavoritePk = null,
  disabled = false,
}: Args) {
  const canFav = !disabled && (!!shrineId || !!placeId);

  const [fav, setFav] = useState<boolean>(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const [favoritePk, setFavoritePk] = useState<number | null>(
    initialFavoritePk ?? null
  );

  const add = useCallback(async (): Promise<Favorite | null> => {
    if (!canFav) {
      // ここで止める（コンソール騒がせない）
      return null;
    }
    setBusy(true);
    try {
      if (shrineId) {
        const f = await createFavoriteByShrineId(shrineId);
        setFavoritePk(f.id ?? null);
        setFav(true);
        return f;
      } else if (placeId) {
        const f = await createFavoriteByPlaceId(placeId);
        setFavoritePk(f.id ?? null);
        setFav(true);
        return f;
      }
      return null;
    } finally {
      setBusy(false);
    }
  }, [canFav, shrineId, placeId]);

  const remove = useCallback(async () => {
    if (!canFav && !favoritePk) return;
    setBusy(true);
    try {
      if (favoritePk) {
        await removeFavoriteByPk(favoritePk);
      } else if (shrineId) {
        await removeFavoriteByShrineId(shrineId);
      } else if (placeId) {
        await removeFavoriteByPlaceId(placeId);
      }
      setFav(false);
      setFavoritePk(null);
    } finally {
      setBusy(false);
    }
  }, [canFav, favoritePk, shrineId, placeId]);

  const toggle = useCallback(async () => {
    if (!canFav) return;
    if (fav) {
      await remove();
    } else {
      await add();
    }
  }, [canFav, fav, add, remove]);

  return useMemo(
    () => ({ fav, busy, toggle, add, remove, canFav, favoritePk }),
    [fav, busy, toggle, add, remove, canFav, favoritePk]
  );
}
