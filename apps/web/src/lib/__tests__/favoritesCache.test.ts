// apps/web/src/lib/__tests__/favoritesCache.test.ts

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Favorite } from "@/lib/api/favorites";

import {
  __resetFavoritesCacheForTest,
  clearFavoritesInFlight,
  getFavoritesCached,
  peekFavoritesCache,
  upsertFavorite,
  removeFavoriteFromCacheByPk,
  removeFavoriteFromCacheByShrineId,
  removeFavoriteFromCacheByPlaceId,
} from "@/lib/favoritesCache";

beforeEach(() => {
  __resetFavoritesCacheForTest();
});

describe("favoritesCache", () => {
  it("getFavoritesCached: cache がある時は即返し、fetcher は呼ばれない", async () => {
    clearFavoritesInFlight();

    // ✅ 先にキャッシュを作る（他テストで何が入っていてもOK）
    upsertFavorite({ id: 2, shrine_id: 9 } as any);

    const fetcher = vi.fn(async (): Promise<Favorite[]> => {
      return [{ id: 999, shrine_id: 999 } as Favorite];
    });

    const xs = await getFavoritesCached(fetcher);

    // cache があるので fetcher は呼ばれない
    expect(fetcher).toHaveBeenCalledTimes(0);

    // cache の先頭が id:2 になっていることを確認（上書きではなく “前に積む” 想定）
    expect(xs[0].id).toBe(2);
  });

  it("getFavoritesCached: 2回目以降は cache を即返し、fetcher は呼ばれない", async () => {
    const fetcher = vi.fn(async () => [{ id: 2 } as any]);

    // 1回目：fetcher 呼ばれる
    const first = await getFavoritesCached(fetcher);
    expect(first[0].id).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // 2回目：cache 直返し（fetcher 増えない）
    const second = await getFavoritesCached(fetcher);
    expect(second[0].id).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("removeFavoriteFromCacheByShrineId / PlaceId: key一致のものだけ消える", () => {
    upsertFavorite({ id: 10, target_type: "shrine", target_id: 5, shrine: { id: 5 } } as any);
    upsertFavorite({ id: 11, target_type: "shrine", target_id: 9, shrine: { id: 9 } } as any);
    upsertFavorite({ id: 12, target_type: "place", target_id: 123 } as any);

    // shrineId=5 を消す → 10だけ消える想定
    removeFavoriteFromCacheByShrineId(5);
    expect(
      peekFavoritesCache()
        ?.map((x) => x.id)
        .sort(),
    ).toEqual([11, 12]);

    // placeId は今回の normalize が target_id から作れないので、place_id 付きでテストする
    upsertFavorite({ id: 13, place_id: "ChIJxxx" } as any);
    removeFavoriteFromCacheByPlaceId("ChIJxxx");
    expect(peekFavoritesCache()?.some((x) => x.id === 13)).toBe(false);

    // pk削除
    removeFavoriteFromCacheByPk(11);
    removeFavoriteFromCacheByPk(12);
    expect(peekFavoritesCache()?.length).toBe(0);
  });
});
