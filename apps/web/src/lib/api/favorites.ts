// apps/web/src/lib/api/favorites.ts
import api from "./client";
import { refreshAccessToken } from "./auth";
import type { Shrine } from "./shrines";

/** サーバ実装に合わせて payload キーを切り替える場合はここだけ変更 */
const FAVORITE_PAYLOAD_KEY: "shrine" | "shrine_id" = "shrine";

/** お気に入りレコードの型（サーバに合わせて緩めに定義） */
export type Favorite = {
  id: number; // ← PK
  shrine: number | { id: number } | Shrine; // サーバの返し方に合わせて許容広め
  // 必要なら created_at / user なども追加
};

const EP = "/favorites/";

/** 401 のときだけ refresh → 1 回だけ再実行 */
async function withAuthRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (err?.response?.status === 401) {
      const ok = await refreshAccessToken();
      if (ok) return await fn();
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[favorites] api error", err?.response?.status, err?.response?.data);
    }
    throw err;
  }
}

/** 一覧（PK と shrine の対応を得る） */
export async function getFavorites(): Promise<Favorite[]> {
  return withAuthRetry(async () => {
    const { data } = await api.get<Favorite[]>(EP);
    return Array.isArray(data) ? data : [];
  });
}

/** 追加（POST /favorites/） */
export async function addFavorite(shrineId: number): Promise<void> {
  return withAuthRetry(async () => {
    await api.post(EP, { [FAVORITE_PAYLOAD_KEY]: shrineId });
  });
}

/** PK で削除（DELETE /favorites/{pk}/） */
export async function removeFavoriteByPk(favoritePk: number): Promise<void> {
  return withAuthRetry(async () => {
    await api.delete(`${EP}${favoritePk}/`);
  });
}

/** 神社IDしか手元に無い場合の削除ヘルパ
 *  一覧から該当の Favorite を探して PK で消す
 */
export async function removeFavoriteByShrineId(shrineId: number): Promise<void> {
  return withAuthRetry(async () => {
    const { data } = await api.get<Favorite[]>(EP);
    const f = (data || []).find((x) => {
      if (typeof x.shrine === "number") return x.shrine === shrineId;
      if (x.shrine && typeof (x.shrine as any).id === "number") {
        return (x.shrine as any).id === shrineId;
      }
      return false;
    });
    if (!f) return; // 既に外れている
    await api.delete(`${EP}${f.id}/`);
  });
}
