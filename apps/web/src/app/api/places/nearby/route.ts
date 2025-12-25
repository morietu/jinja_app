import { NextResponse } from "next/server";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const upstream = await fetch(`${API_BASE}/api/places/nearby/?${qs}`, { cache: "no-store" });

  // ✅ ここが404ハンドリング（UIはemptyでOKになる）
  if (upstream.status === 404) {
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  // 404以外はそのまま
  const raw = await upstream.json().catch(() => null);
  const resultsRaw: any[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];

  const results: PlacesNearbyResult[] = resultsRaw
    .map((r) => {
      const place_id = String(r.place_id ?? "");
      const name = String(r.name ?? "");
      const address = String(r.address ?? r.formatted_address ?? "");
      const lat = Number(r.lat ?? r.geometry?.location?.lat);
      const lng = Number(r.lng ?? r.geometry?.location?.lng);
      if (!place_id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        place_id,
        name,
        address,
        lat,
        lng,
        distance_m: r.distance_m == null ? null : Number(r.distance_m),
        rating: r.rating == null ? null : Number(r.rating),
        user_ratings_total: r.user_ratings_total == null ? null : Number(r.user_ratings_total),
        icon: r.icon == null ? null : String(r.icon),
      } satisfies PlacesNearbyResult;
    })
    .filter((x): x is PlacesNearbyResult => Boolean(x));

  const body: PlacesNearbyResponse = { results };
  return NextResponse.json(body, { status: upstream.status });
}
