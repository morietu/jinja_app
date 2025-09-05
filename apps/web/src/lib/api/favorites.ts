import api from "./client";
import type { Shrine } from "./shrines";

// お気に入り一覧
export async function getFavorites(): Promise<Shrine[]> {
  // ← ここを "/favorites/" に修正（/api は付けない）
  const res = await api.get("/favorites/");
  return res.data;
}

// お気に入りトグル（追加 or 削除）
// baseURL=/api 前提で /shrines/<id>/favorite/ は正しい
export async function toggleFavorite(shrineId: number) {
  const res = await api.post(`/shrines/${shrineId}/favorite/`);
  return res.data; // {status: "added" | "removed", shrine: {...}}
}
