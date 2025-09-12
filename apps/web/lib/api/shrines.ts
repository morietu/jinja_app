// apps/web/src/lib/api/shrines.ts
import { get } from "./http";
import type { Shrine, ShrineSummary } from "@/types/shrine";

function toSummary(x: Shrine): ShrineSummary {
  return {
    id: Number(x.id),
    name: x.name_jp,
    address: x.address ?? null,
    lat: x.latitude ?? (x as any)?.location?.y ?? null, // 万一 location が来ても吸収
    lng: x.longitude ?? (x as any)?.location?.x ?? null,
    popularity: x.popular_score ?? null,
    is_favorite: x.is_favorite,
    goriyaku_tags: x.goriyaku_tags,
  };
}


// apps/web/src/lib/api/shrines.ts つづき
export type FetchPopularParams = {
  limit?: number;
  near?: { lat: number; lng: number };
  radius_km?: number;
};

/** 人気の神社一覧（軽量） */
export async function fetchPopular(
  params: FetchPopularParams = {}
): Promise<ShrineSummary[]> {
  const qs = new URLSearchParams({ limit: String(params.limit ?? 10) });
  if (params.near) {
    qs.set("near", `${params.near.lat},${params.near.lng}`);
    qs.set("radius_km", String(params.radius_km ?? 10));
  }

  try {
    // バックエンドは /api/shrines/popular/ を想定（rewrites 経由で /api に入る）
    const data = await get<Shrine[]>("/shrines/popular/?" + qs.toString());
    return Array.isArray(data) ? data.map(toSummary) : [];
  } catch (e) {
    console.warn("fetchPopular failed, returning fallback mock.", e);
    // ⚠ mock の id を number に寄せておくと後段が楽
    const mock: ShrineSummary[] = [
      { id: 1, name: "明神社",   address: "東京都千代田区…", popularity: 92, lat: 35.702, lng: 139.765 },
      { id: 2, name: "天満宮",   address: "東京都文京区…",   popularity: 88, lat: 35.715, lng: 139.752 },
      { id: 3, name: "住吉神社", address: "東京都中央区…",   popularity: 81, lat: 35.667, lng: 139.779 },
    ];
    return mock;
  }
}
