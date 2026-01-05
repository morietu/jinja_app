// apps/web/src/hooks/useFavorite.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFavoriteByShrineId,
  createFavoriteByPlaceId,
  removeFavoriteByPk,
  removeFavoriteByShrineId,
  removeFavoriteByPlaceId,
  type Favorite,
} from "@/lib/api/favorites";

import { favoriteMatchKey } from "@/lib/favorites/normalize";


import {
  peekFavoritesCache,
  getFavoritesCached,
  upsertFavorite,
  removeFavoriteFromCacheByPk,
  removeFavoriteFromCacheByShrineId,
  removeFavoriteFromCacheByPlaceId,
  clearFavoritesInFlight,
} from "@/lib/favoritesCache";

type Args = {
  shrineId?: number;
  placeId?: string;
  initial?: boolean; // SSRなどで明示したい場合だけ使う
};

async function getFavoritesDirect(): Promise<Favorite[]> {
  const r = await fetch("/api/favorites/", { cache: "no-store" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}



export function useFavorite({ shrineId, placeId, initial }: Args) {
  const key = useMemo(() => {
    if (typeof shrineId === "number") return `shrine:${shrineId}`;
    if (placeId) return `place:${placeId}`;
    return null;
  }, [shrineId, placeId]);

  // ① cache が既にあるなら即反映（初期描画の体感が良くなる）
  const cached = useMemo(() => {
    const c = peekFavoritesCache();
    if (!c) return null;
    const hit = c.find((f) => favoriteMatchKey(f, { shrineId, placeId })) ?? null;
    return hit ? { fav: true, pk: hit.id } : { fav: false, pk: null };
  }, [key, shrineId, placeId]);

  const [fav, setFav] = useState<boolean>(() => {
    if (typeof initial === "boolean") return initial;
    if (cached) return cached.fav;
    return false;
  });
  const [favPk, setFavPk] = useState<number | null>(() => (cached ? cached.pk : null));
  const [busy, setBusy] = useState(false);

  const hydratedRef = useRef(false);

  // ② cache が無い/不確実なら一度だけ取得して復元
  useEffect(() => {
    if (!key) return;
    if (hydratedRef.current) return;

    // initial が明示されてる場合は fetch しない（SSR初期値が真実）
    if (typeof initial === "boolean") {
      hydratedRef.current = true;
      return;
    }

    hydratedRef.current = true;

    (async () => {
      try {
        const list = await getFavoritesCached(getFavoritesDirect);
        const hit = list.find((f) => favoriteMatchKey(f, { shrineId, placeId })) ?? null;
        setFav(Boolean(hit));
        setFavPk(hit?.id ?? null);
      } catch {
        // noop
      }
    })();
  }, [key, shrineId, placeId, initial]);

  async function toggle() {
    if (!key || busy) return;
    setBusy(true);

    const prev = fav;
    setFav(!prev);

    try {
      if (!prev) {
        // add
        let created: Favorite;
        if (typeof shrineId === "number") created = await createFavoriteByShrineId(shrineId);
        else if (placeId) created = await createFavoriteByPlaceId(placeId);
        else throw new Error("no id");

        setFavPk(created.id);
        upsertFavorite(created);
        clearFavoritesInFlight();
        return;
      }

      // remove
      if (favPk != null) {
        await removeFavoriteByPk(favPk);
        removeFavoriteFromCacheByPk(favPk);
        setFavPk(null);
        clearFavoritesInFlight();
        return;
      }

      // pk不明フォールバック
      if (typeof shrineId === "number") {
        await removeFavoriteByShrineId(shrineId);
        removeFavoriteFromCacheByShrineId(shrineId);
        clearFavoritesInFlight();
        return;
      }
      if (placeId) {
        await removeFavoriteByPlaceId(placeId);
        removeFavoriteFromCacheByPlaceId(placeId);
        clearFavoritesInFlight();
        return;
      }
    } catch (e) {
      setFav(prev);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return { fav, busy, toggle };
}
