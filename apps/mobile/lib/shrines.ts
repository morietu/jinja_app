// apps/mobile/lib/shrines.ts
import { get } from "./http";
import type { ShrineSummary } from "../types/shrine";

export type FetchPopularParams = {
  limit?: number; // default 10
  near?: { lat: number; lng: number }; // 位置許可時
  radius_km?: number; // default 10 when near given
};

function normalizePopularItem(s: any): ShrineSummary {
  return {
    id: String(s?.id ?? ""),
    name: String(s?.name ?? "").trim(),
    address: String(s?.address ?? s?.prefecture ?? "").trim(),
    popularity: Number(s?.popularity ?? 0),
    lat: (s?.lat ?? s?.latitude) as number | undefined,
    lng: (s?.lng ?? s?.longitude) as number | undefined,

    rating: typeof s?.rating === "number" ? s.rating : typeof s?.stars === "number" ? s.stars : undefined,

    photo_url:
      typeof s?.photo_url === "string"
        ? s.photo_url
        : typeof s?.imageUrl === "string"
          ? s.imageUrl
          : typeof s?.image_url === "string"
            ? s.image_url
            : undefined,
  };
}

/** 人気の神社一覧を取得（近場指定対応、フェイルセーフ付き） */
export async function fetchPopular(params: FetchPopularParams = {}): Promise<ShrineSummary[]> {
  const limit = params.limit ?? 10;
  const radius = params.radius_km ?? 10;

  const qs = new URLSearchParams();
  qs.set("limit", String(limit));

  if (params.near) {
    qs.set("lat", String(params.near.lat));
    qs.set("lng", String(params.near.lng));
    qs.set("radius_km", String(radius));
  }

  try {
    const raw = await get<any>(`/shrines/popular?${qs.toString()}`);

    // 返り値が { results: [] } or [] のどっちでも吸収
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];

    return arr.map(normalizePopularItem);
  } catch (e) {
    console.warn("fetchPopular failed, returning fallback mock.", e);

    const mock: ShrineSummary[] = [
      {
        id: "mock-1",
        name: "明神社",
        address: "東京都千代田区…",
        popularity: 92,
        lat: 35.702,
        lng: 139.765,
        rating: 4.7,
        photo_url: undefined,
      },
      {
        id: "mock-2",
        name: "天満宮",
        address: "東京都文京区…",
        popularity: 88,
        lat: 35.715,
        lng: 139.752,
        rating: 4.6,
        photo_url: undefined,
      },
      {
        id: "mock-3",
        name: "住吉神社",
        address: "東京都中央区…",
        popularity: 81,
        lat: 35.667,
        lng: 139.779,
        rating: 4.5,
        photo_url: undefined,
      },
    ];

    return mock;
  }
}
