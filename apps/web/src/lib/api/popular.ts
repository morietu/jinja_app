// apps/web/src/lib/api/popular.ts
export type Shrine = {
  id: number;
  name_jp: string;
  latitude: number;
  longitude: number;
  popular_score: number;
};

type PopularResponse = {
  results?: Shrine[];
  items?: Shrine[];
  next?: string | null;
};

export async function fetchPopular(params: {
  limit?: number;
  near?: string; // "lat,lng"
  radius_km?: number;
  urlOverride?: string; // next のURL（同一オリジン前提）
}) {
  const url =
    params.urlOverride ??
    `/api/shrines/popular?${new URLSearchParams({
      ...(params.limit ? { limit: String(params.limit) } : {}),
      ...(params.near ? { near: params.near } : {}),
      ...(params.radius_km ? { radius_km: String(params.radius_km) } : {}),
    })}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Popular fetch failed: ${res.status}`);
  const data: PopularResponse = await res.json();
  const list = data.results ?? data.items ?? [];
  return { items: list, next: data.next ?? null };
}
