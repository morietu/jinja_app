import { NextResponse } from "next/server";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type MaybePlace = PlacesNearbyResult | null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const upstream = await fetch(`${API_BASE}/api/places/nearby/?${qs}`, { cache: "no-store" });

  // ✅ 404 は空で返す（UIはempty）
  if (upstream.status === 404) {
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  const raw = await upstream.json().catch(() => null);
  const resultsRaw: any[] = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw) ? raw : [];

  const mapped: MaybePlace[] = resultsRaw.map((r): MaybePlace => {
    const place_id = String(r?.place_id ?? "");
    const name = String(r?.name ?? "");

    const addressRaw = r?.address ?? r?.formatted_address ?? null;
    const address: string | null = addressRaw == null ? null : String(addressRaw);

    const lat = Number(r?.lat ?? r?.geometry?.location?.lat);
    const lng = Number(r?.lng ?? r?.geometry?.location?.lng);

    if (!place_id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      place_id,
      name,
      address,
      lat,
      lng,
      distance_m: r?.distance_m ?? null,
      rating: r?.rating ?? null,
      user_ratings_total: r?.user_ratings_total ?? null,
      icon: r?.icon ?? null,
    } satisfies PlacesNearbyResult;
  });

  const nonNull = (x: MaybePlace): x is PlacesNearbyResult => x !== null;
  const results: PlacesNearbyResult[] = mapped.filter(nonNull);

  const body: PlacesNearbyResponse = { results };
  return NextResponse.json(body, { status: upstream.status });
}
