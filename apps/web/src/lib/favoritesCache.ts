// apps/web/src/lib/favoritesCache.ts
import type { Favorite } from "@/lib/api/favorites";

let favoritesCache: Favorite[] | null = null;
let favoritesInFlight: Promise<Favorite[]> | null = null;

export function peekFavoritesCache(): Favorite[] | null {
  return favoritesCache;
}

export function setFavoritesCache(xs: Favorite[]) {
  favoritesCache = xs;
}

export function invalidateFavoritesCache() {
  favoritesCache = null;
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

// --- mutate helpers ---
export function upsertFavorite(created: Favorite) {
  if (!favoritesCache) {
    favoritesCache = [created];
    return;
  }
  const exists = favoritesCache.some((f) => f.id === created.id);
  favoritesCache = exists ? favoritesCache : [created, ...favoritesCache];
}

export function removeFavoriteFromCacheByPk(pk: number) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((f) => f.id !== pk);
}

export function removeFavoriteFromCacheByShrineId(shrineId: number) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((f: any) => (f.shrine_id ?? f.target_id ?? f.shrine?.id) !== shrineId);
}

export function removeFavoriteFromCacheByPlaceId(placeId: string) {
  if (!favoritesCache) return;
  favoritesCache = favoritesCache.filter((f: any) => String(f.place_id ?? "") !== String(placeId));
}

// 「揺れ」対策：外で inFlight を握ってた場合に備えて潰す
export function clearFavoritesInFlight() {
  favoritesInFlight = null;
}
