// apps/web/src/lib/api/favorites.ts
import api from "./client";

export type Favorite = {
  id: number;

  // 旧形式（既存互換）
  shrine_id?: number | null;
  place_id?: string | null;

  // 新形式（現状のAPIレスポンスに合わせる）
  target_type?: "shrine" | "place" | string;
  target_id?: number | null;

  // ネストで shrine が返るケース（あなたのプレビューにある）
  shrine?: { id?: number | null; name_jp?: string | null; address?: string | null } | null;
};

export async function getFavorites(): Promise<Favorite[]> {
  const r = await api.get("/favorites/");
  return Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
}

export async function createFavoriteByShrineId(shrineId: number): Promise<Favorite> {
  const r = await api.post("/favorites/", { shrine_id: shrineId });
  return r.data;
}

export async function createFavoriteByPlaceId(placeId: string): Promise<Favorite> {
  const r = await api.post("/favorites/", { place_id: placeId });
  return r.data;
}

export async function removeFavoriteByPk(pk: number) {
  await api.delete(`/favorites/${pk}/`);
}

export async function removeFavoriteByShrineId(shrineId: number) {
  await api.delete(`/favorites/by-shrine/${shrineId}/`);
}

export async function removeFavoriteByPlaceId(placeId: string) {
  await api.delete(`/favorites/by-place/${placeId}/`);
}

export type ImportResult = { imported: number; shrine_id?: number };
export async function importFromPlace(placeId: string): Promise<ImportResult> {
  const r = await api.post(`/favorites/import-from-place/`, {
    place_id: placeId,
  });
  return r.data;
}
