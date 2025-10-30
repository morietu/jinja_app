// apps/web/src/lib/api/favorites.ts
import { apiDelete, apiPost } from "@/lib/api/http";

export type Favorite = { id: number; shrine: number };

export async function createFavorite(shrineId: number): Promise<Favorite> {
  return apiPost<Favorite>("favorites/", { shrine: shrineId });
}

export async function deleteFavorite(id: number): Promise<void> {
  await apiDelete(`favorites/${id}/`);
} // ← ← ← これが無くてエラーになってた

// トグル（存在すれば削除、無ければ作成）
export async function toggleFavorite(
  getId: () => Promise<number | null>,
  shrineId: number
) {
  const existingId = await getId();
  if (existingId) {
    await deleteFavorite(existingId);
    return { removed: true, id: existingId };
  } else {
    const fav = await createFavorite(shrineId);
    return { added: true, id: fav.id };
  }
}
