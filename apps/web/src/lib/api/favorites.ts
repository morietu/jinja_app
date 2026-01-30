import api from "./client";

export type Favorite = {
  id: number;
  shrine_id?: number | null;
  place_id?: string | null;
  target_type?: "shrine" | "place" | string;
  target_id?: number | string | null;
  shrine?: { id?: number | null; name_jp?: string | null; address?: string | null } | null;
};

export async function getFavorites(): Promise<Favorite[]> {
  const r = await api.get("/favorites/");
  return Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
}

export async function createFavoriteByShrineId(shrineId: number): Promise<Favorite> {
  const r = await api.post("/favorites/", { shrine_id: shrineId });
  const raw = r.data as Favorite;
  return {
    ...raw,
    shrine_id: raw.shrine_id ?? shrineId,
    target_type: raw.target_type ?? "shrine",
    target_id: raw.target_id ?? shrineId,
    shrine: raw.shrine ?? ({ id: shrineId } as any),
  };
}

// ✅ place_id で作成し、バックエンドが薄くてもフロント側で最低限補完する
export async function createFavoriteByPlaceId(placeId: string): Promise<Favorite> {
  // シンプルに place_id で作成し、バックエンドが何も返さなくても自前で補完する
  const r = await api.post("/favorites/", { place_id: placeId });
  const raw = r.data as Favorite;
  return {
    ...raw,
    place_id: raw.place_id ?? placeId,
    target_type: raw.target_type ?? "place",
    target_id: raw.target_id ?? placeId,
  };
}

export async function removeFavoriteByPk(pk: number) {
  await api.delete(`/favorites/${pk}/`);
}

export async function removeFavoriteByShrineId(shrineId: number) {
  await api.delete(`/favorites/by-shrine/${shrineId}/`);
}

export async function removeFavoriteByPlaceId(placeId: string) {
  // 互換用に残す。将来的に消したいなら呼び出し側を全部 shrine_id 化してから。
  await api.delete(`/favorites/by-place/${placeId}/`);
}

export type ImportResult = { imported: number; shrine_id?: number };
export async function importFromPlace(placeId: string): Promise<ImportResult> {
  const r = await api.post(`/favorites/import-from-place/`, { place_id: placeId });
  return r.data;
}
