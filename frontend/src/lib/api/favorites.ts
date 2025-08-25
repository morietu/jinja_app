import api from "./client";
import { Shrine } from "./shrines";

// お気に入り一覧
export async function getFavorites(): Promise<Shrine[]> {
  const res = await api.get("/favorites/");
  return res.data;
}

// お気に入り追加
export async function addFavorite(shrineId: number) {
  const res = await api.post("/favorites/", { shrine: shrineId });
  return res.data;
}

// お気に入り削除
export async function removeFavorite(shrineId: number) {
  const res = await api.delete(`/favorites/${shrineId}/`);
  return res.data;
}
