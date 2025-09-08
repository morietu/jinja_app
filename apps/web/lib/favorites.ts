import { api } from "./api";

export async function addFavorite(shrineId: number) {
  const { data } = await api.post("/api/favorites/", { shrine_id: shrineId });
  return data as { id: number; shrine: { id: number; name_jp: string } };
}

export async function listFavorites() {
  const { data } = await api.get("/api/favorites/");
  return data as { id: number; shrine: { id: number; name_jp: string } }[];
}

export async function removeFavorite(favoriteId: number) {
  await api.delete(`/api/favorites/${favoriteId}/`);
}
