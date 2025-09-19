// apps/web/src/lib/api/favorites.ts
import { apiGet, apiPost, apiDelete, isAuthError } from "@/lib/api/http";

// ---- 型（最終形：フック等で使う形）----
export type Favorite = {
  id: number;
  shrine: number | null;        // shrine の PK
  place_id?: string | null;
  created_at?: string;
};

// 一覧（正規の公開関数）
export async function getFavorites(): Promise<Favorite[]> {
  // サーバは normalized を返している想定。もし生データならここで整形してください。
  return apiGet<Favorite[]>("/favorites/");
}

// 追加（神社ID から）
export async function createFavoriteByShrineId(shrineId: number): Promise<Favorite> {
  return apiPost<Favorite>("/favorites/", { shrine: shrineId });
}

// 削除（Favorite PK で）
export async function deleteFavorite(id: number): Promise<void> {
  await apiDelete(`/favorites/${id}/`);
}

// トグル（存在すれば削除、無ければ作成）
export async function toggleFavorite(getId: () => Promise<number | null>, shrineId: number) {
  const existingId = await getId();
  if (existingId) {
    await deleteFavorite(existingId);
    return { added: false as const };
  }
  const f = await createFavoriteByShrineId(shrineId);
  return { added: true as const, favorite: f };
}

// UI で 401 を握りたいときの補助
export function isFavoritesAuthError(e: unknown) {
  return isAuthError(e);
}

/* =========================
   互換レイヤー（旧API名の復活）
   ========================= */

// 旧名: removeFavoriteByPk → 新名: deleteFavorite
export async function removeFavoriteByPk(favoritePk: number) {
  return deleteFavorite(favoritePk);
}

// 旧名: removeFavoriteByShrineId
export async function removeFavoriteByShrineId(shrineId: number) {
  const list = await getFavorites();
  const hit = list.find((f) => f.shrine === shrineId);
  if (hit) await deleteFavorite(hit.id);
}

// 旧名: removeFavoriteByPlaceId
export async function removeFavoriteByPlaceId(placeId: string) {
  const list = await getFavorites();
  const hit = list.find((f) => f.place_id === placeId);
  if (hit) await deleteFavorite(hit.id);
}

// 旧: placeId → shrine を作成（必要ならお気に入り化）
// shrines.ts が再輸出していたので維持します。
export type ImportResult = unknown;
export async function importFromPlace(placeId: string, alsoFavorite = false): Promise<ImportResult> {
  // バックエンドの /places/find/ は { shrine_id?, shrine? } を返す想定
  const data = await apiPost<any>("/places/find/", { place_id: placeId });
  const shrineId: number | null = data?.shrine_id ?? data?.shrine?.id ?? data?.id ?? null;
  if (!shrineId) throw new Error("shrineId not found in /places/find/");
  if (alsoFavorite) await createFavoriteByShrineId(shrineId);
  return data?.shrine ?? { id: shrineId };
}

// 便宜上：placeId からお気に入りを作る（旧実装互換）
export async function createFavoriteByPlaceId(placeId: string): Promise<Favorite> {
  const data = await apiPost<any>("/places/find/", { place_id: placeId });
  const shrineId: number | null = data?.shrine_id ?? data?.shrine?.id ?? data?.id ?? null;
  if (!shrineId) throw new Error("shrineId not found in /places/find/");
  return createFavoriteByShrineId(shrineId);
}
