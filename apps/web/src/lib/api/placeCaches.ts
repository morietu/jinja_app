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

export async function fetchPlaceCacheSuggest(q: string, limit = 10) {
  const params = new URLSearchParams({
    q,
    limit: String(limit),
    dedupe: "1",
  });
  const res = await fetch(`/api/place-caches/?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`place-caches failed: ${res.status}`);
  const data = await res.json();
  return (data?.results ?? []) as PlaceCacheItem[];
}
