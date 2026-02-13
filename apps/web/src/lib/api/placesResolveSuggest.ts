export type PlacesResolveResponse = {
  results: Array<{
    place_id: string;
    name: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    types?: string[];
    rating?: number | null;
    user_ratings_total?: number | null;
  }>;
};

export async function fetchPlacesResolveSuggest(q: string, limit = 5) {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const r = await fetch(`/api/places/resolve?${qs.toString()}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`fetchPlacesResolveSuggest failed: ${r.status}`);
  const data = (await r.json()) as Partial<PlacesResolveResponse>;
  return Array.isArray(data.results) ? data.results : [];
}
