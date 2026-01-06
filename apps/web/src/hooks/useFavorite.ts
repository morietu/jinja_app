// apps/web/src/hooks/useFavorite.ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFavoriteByShrineId,
  removeFavoriteByPk,
  removeFavoriteByShrineId,
  type Favorite,
} from "@/lib/api/favorites";

import { favoriteMatchKey } from "@/lib/favorites/normalize";

import {
  peekFavoritesCache,
  getFavoritesCached,
  upsertFavorite,
  removeFavoriteFromCacheByPk,
  removeFavoriteFromCacheByShrineId,
  clearFavoritesInFlight,
} from "@/lib/favoritesCache";

type Args = {
  shrineId?: number;
  initial?: boolean; // SSRなどで明示したい場合だけ使う
};

async function getFavoritesDirect(): Promise<Favorite[]> {
  const r = await fetch("/api/favorites/", { cache: "no-store" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export function useFavorite({ shrineId, initial }: Args) {
  const key = useMemo(() => {
    if (typeof shrineId === "number") return `shrine:${shrineId}`;
    return null;
  }, [shrineId]);

  // ① cache が既にあるなら即反映
  const cached = useMemo(() => {
    if (typeof shrineId !== "number") return null;
    const c = peekFavoritesCache();
    if (!c) return null;
    const hit = c.find((f) => favoriteMatchKey(f, { shrineId })) ?? null;
    return hit ? { fav: true, pk: hit.id } : { fav: false, pk: null };
  }, [shrineId]);

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

    // initial が明示されてる場合は fetch しない
    if (typeof initial === "boolean") {
      hydratedRef.current = true;
      return;
    }

    hydratedRef.current = true;

    (async () => {
      try {
        const list = await getFavoritesCached(getFavoritesDirect);
        const hit = list.find((f) => favoriteMatchKey(f, { shrineId })) ?? null;
        setFav(Boolean(hit));
        setFavPk(hit?.id ?? null);
      } catch {
        // noop
      }
    })();
  }, [key, shrineId, initial]);

  async function toggle() {
    if (!key || busy) return;
    if (typeof shrineId !== "number") return;

    setBusy(true);
    const prev = fav;
    setFav(!prev);

    try {
      if (!prev) {
        // add
        const createdRaw = await createFavoriteByShrineId(shrineId);

        // backend が id/created_at だけ返しても cache/normalize が成立するよう補完
        const created: Favorite = {
          ...createdRaw,
          shrine_id: shrineId as any,
          target_type: "shrine" as any,
          target_id: shrineId as any,
          shrine: { id: shrineId } as any,
        } as any;

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
      await removeFavoriteByShrineId(shrineId);
      removeFavoriteFromCacheByShrineId(shrineId);
      clearFavoritesInFlight();
    } catch (e) {
      setFav(prev);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return { fav, busy, toggle };
}
