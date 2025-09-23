import { get } from "./http";
import type { ShrineSummary } from "../types/shrine";

export type FetchPopularParams = {
  limit?: number; // default 10
  near?: { lat: number; lng: number }; // 位置許可時
  radius_km?: number; // default 10 when near given
};

/** 人気の神社一覧を取得（近場指定対応、フェイルセーフ付き） */
export async function fetchPopular(
  params: FetchPopularParams = {}
): Promise<ShrineSummary[]> {
  const limit = params.limit ?? 10;
  const qs = new URLSearchParams({ limit: String(limit) });

  if (params.near) {
    qs.set("near", `${params.near.lat},${params.near.lng}`);
    qs.set("radius_km", String(params.radius_km ?? 10));
  }

  try {
    return await get<ShrineSummary[]>(`/shrines/popular?${qs.toString()}`);
  } catch (e) {
    // モックフォールバック：UI開発を止めない
    console.warn("fetchPopular failed, returning fallback mock.", e);
    const mock: ShrineSummary[] = [
      {
        id: "mock-1",
        name: "明神社",
        address: "東京都千代田区…",
        popularity: 92,
        lat: 35.702,
        lng: 139.765,
      },
      {
        id: "mock-2",
        name: "天満宮",
        address: "東京都文京区…",
        popularity: 88,
        lat: 35.715,
        lng: 139.752,
      },
      {
        id: "mock-3",
        name: "住吉神社",
        address: "東京都中央区…",
        popularity: 81,
        lat: 35.667,
        lng: 139.779,
      },
    ];
    return mock;
  }
}
