// apps/web/src/lib/api/favorites.ts
import api from "@/lib/apiClient";               // ブリッジ経由で統一
import { refreshAccessToken } from "./auth";
import type { Shrine } from "../api/shrines";

const EP = "/favorites/";

export type FavoriteItem = {
  id: number;
  place_id?: string | null;
  place?: { place_id?: string | null; name?: string } | null;
  shrine?: { id: number; name_jp?: string } | null;
  created_at?: string;
};

// ---- 401時だけ1回リトライ ----
async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.response?.status === 401) {
      const ok = await refreshAccessToken();
      if (ok) return await fn();
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[favorites] api error", err?.response?.status, err?.response?.data || err?.message);
    }
    throw err;
  }
}

// ====== 基本CRUD ======
export async function listFavorites(): Promise<FavoriteItem[]> {
  const { data } = await withAuthRetry(() => api.get(EP));
  return data as FavoriteItem[];
}

export async function addFavoriteByShrineId(shrineId: number) {
  const { data } = await withAuthRetry(() => api.post(EP, { shrine: shrineId }));
  return data as FavoriteItem;
}

export async function addFavoriteByPlaceId(placeId: string) {
  const { shrineId } = await withAuthRetry(() => api.post(EP, { place_id: placeId }));
  return await addFavoriteByShrineId(shrineId);
}

export async function removeFavoriteById(favId: number) {
  await withAuthRetry(() => api.delete(`${EP}${favId}/`));
}

export async function removeFavoriteByPlaceId(placeId: string) {
  const items = await listFavorites();
  const hit = items.find((f) => f.place_id === placeId || f.place?.place_id === placeId);
  if (hit) await removeFavoriteById(hit.id);
}

export async function removeFavoriteByShrineId(shrineId: number): Promise<void> {
  const items = await listFavorites();
  const hit = items.find((f) => f.shrine?.id === shrineId);
  if (hit) await removeFavoriteById(hit.id);
}

export async function isFavoritedByPlaceId(placeId: string): Promise<boolean> {
  const items = await listFavorites();
  return items.some((f) => f.place_id === placeId || f.place?.place_id === placeId);
}

export async function isFavoritedByShrineId(shrineId: number): Promise<boolean> {
  const items = await listFavorites();
  return items.some((f) => f.shrine?.id === shrineId);
}

// ====== 便利系 ======
export type Favorite = {
  id: number;
  shrine: number | { id: number } | Shrine;
};

export async function getFavorites(): Promise<Favorite[]> {
  const list = await listFavorites();
  return list.map((x) => ({
    id: x.id,
    shrine: x.shrine?.id ?? (x.shrine as any) ?? 0,
  }));
}

async function ensureShrineFromPlace(placeId: string) {
  // ← GET ではなく POST に
  
  try {
    const { data } = await api.post("/places/find/", { params: { place_id: placeId } });
    const shrineId = data?.shrine_id ?? data?.shrine?.id ?? data?.id;
    if (!shrineId) throw new Error("shrineId not found in /places/find/ (GET)");
    return { shrineId, shrine: data?.shrine ?? null };
  } catch (e: any) {
    if (e?.response?.status === 405) {
      const { data } = await api.post("/places/find/", { place_id: placeId });
      const shrineId = data?.shrine_id ?? data?.shrine?.id ?? data?.id;
      if (!shrineId) throw new Error("shrineId not found in /places/find/ (POST)");
      return { shrineId, shrine: data?.shrine ?? null };
    }
    throw e;
  }
}


export async function importFromPlace(placeId: string, alsoFavorite = false) {
  const { shrineId, shrine } = await ensureShrineFromPlace(placeId);
  if (alsoFavorite) await addFavoriteByShrineId(shrineId);
  return shrine;
}

export async function createFavoriteByPlaceId(placeId: string) {
  const { shrineId } = await ensureShrineFromPlace(placeId);
  if (!shrineId) throw new Error("Could not resolve shrineId from placeId");
  await addFavoriteByShrineId(shrineId);
}

// ====== 旧API名互換（呼び出し側を触らずに済むように）======
export async function addFavorite(shrineId: number): Promise<void> {
  await addFavoriteByShrineId(shrineId);
}

export async function addFavoriteReturning(shrineId: number): Promise<Favorite> {
  const item = await addFavoriteByShrineId(shrineId);
  return { id: item.id, shrine: item.shrine?.id ?? 0 };
}

export async function removeFavoriteByPk(favoritePk: number): Promise<void> {
  await removeFavoriteById(favoritePk);
}

// ★不足していた互換エクスポート
export async function createFavoriteByShrineId(shrineId: number) {
  await addFavoriteByShrineId(shrineId);
}
