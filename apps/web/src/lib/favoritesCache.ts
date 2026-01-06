// apps/web/src/lib/favoritesCache.ts
import type { Favorite } from "@/lib/api/favorites";
import { favoriteMatchKey } from "@/lib/favorites/normalize";

let favoritesCache: Favorite[] | null = null;
let favoritesInFlight: Promise<Favorite[]> | null = null;

export function peekFavoritesCache() {
  return favoritesCache;
}

export function clearFavoritesInFlight() {
  favoritesInFlight = null;
}

export async function getFavoritesCached(fetcher: () => Promise<Favorite[]>): Promise<Favorite[]> {
  if (favoritesCache) return favoritesCache;

  if (!favoritesInFlight) {
    favoritesInFlight = fetcher()
      .then((xs) => {
        favoritesCache = xs;
        return xs;
      })
      .finally(() => {
        favoritesInFlight = null;
      });
  }
  return favoritesInFlight;
}

export function upsertFavorite(f: Favorite) {
  if (!favoritesCache) {
    favoritesCache = [f];
    return;
  }

  const idx = favoritesCache.findIndex((x) => x.id === f.id);
  if (idx >= 0) {
    favoritesCache = [...favoritesCache.slice(0, idx), f, ...favoritesCache.slice(idx + 1)];
    return;
  }

  favoritesCache = [f, ...favoritesCache];
}

export function removeFavoriteFromCacheByPk(pk: number) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((x) => x.id !== pk);
}

export function removeFavoriteFromCacheByShrineId(shrineId: number) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((x) => !favoriteMatchKey(x, { shrineId }));
}

export function removeFavoriteFromCacheByPlaceId(placeId: string) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((x) => !favoriteMatchKey(x, { placeId }));
}



export function __resetFavoritesCacheForTest() {
  favoritesCache = null;
  favoritesInFlight = null;
}
