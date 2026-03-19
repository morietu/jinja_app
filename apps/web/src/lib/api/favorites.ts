import api from "./client";

export type Favorite = {
  id: number;
  shrine_id?: number | null;
  place_id?: string | null;
  target_type?: "shrine" | "place" | string;
  target_id?: number | string | null;
  public_goshuin_count?: number | null;
  created_at?: string | null;
  shrine?: {
    id?: number | null;
    name_jp?: string | null;
    address?: string | null;
  } | null;
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



export async function removeFavoriteByPk(pk: number) {
  await api.delete(`/favorites/${pk}/`);
}

export async function removeFavoriteByShrineId(shrineId: number) {
  await api.delete(`/favorites/by-shrine/${shrineId}/`);
}
