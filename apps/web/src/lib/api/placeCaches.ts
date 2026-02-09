// apps/web/src/lib/api/placeCaches.ts

export type PlaceCacheItem = {
  place_id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  types: string[];
  updated_at: string;
};

export async function fetchPlaceCaches(params: {
  q: string;
  limit?: number;
  dedupe?: boolean;
}): Promise<{ results: PlaceCacheItem[]; count: number }> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);
  qs.set("limit", String(params.limit ?? 10));
  if (params.dedupe) qs.set("dedupe", "1");

  const res = await fetch(`/api/place-caches/?${qs.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`fetchPlaceCaches failed: ${res.status}`);
  return res.json();
}

// 互換が必要なら残す（今 PlaceSuggestBox が fetchPlaceCaches を直接使ってるなら不要）
export async function fetchPlaceCacheSuggest(q: string, limit = 10): Promise<PlaceCacheItem[]> {
  const data = await fetchPlaceCaches({ q, limit, dedupe: true });
  return data.results ?? [];
}
