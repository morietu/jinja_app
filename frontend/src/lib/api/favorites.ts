import api from "./client";
import { Shrine } from "./shrines";

// お気に入り一覧
export async function getFavorites(): Promise<Shrine[]> {
  const res = await api.get("/favorites/");
  return res.data; // バックエンドが Shrine のリストを返す仕様ならこのままでOK
}

// お気に入りトグル（追加 or 削除）
export async function toggleFavorite(shrineId: number) {
  const res = await api.post(`/shrines/${shrineId}/favorite/`);
  return res.data; // {status: "added" | "removed", shrine: {...}}
}
