// apps/web/src/app/api/places/nearby/route.ts
import { NextResponse } from "next/server";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type MaybePlace = PlacesNearbyResult | null;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/places/nearby-search/?${qs}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    console.error("[nearby] upstream fetch failed:", e);
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  // 404 は「近く無し」扱い
  if (upstream.status === 404) {
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  // upstream がエラーなら UI は壊さず empty に倒す（ログだけ出す）
  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    console.error("[nearby] upstream not ok:", upstream.status, txt.slice(0, 300));
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  const raw = await upstream.json().catch(async () => {
    const txt = await upstream.text().catch(() => "");
    console.error("[nearby] upstream json parse failed:", txt.slice(0, 300));
    return null;
  });

  const resultsRaw: any[] = Array.isArray(raw?.results) ? raw.results : [];

  const mapped: MaybePlace[] = resultsRaw.map((r) => {
    const place_id = String(r.place_id ?? r.placeId ?? r.id ?? "");
    const name = String(r.name ?? r.title ?? "");
    const address = r.address ?? r.formatted_address ?? r.formattedAddress ?? undefined;

    const lat = Number(r.lat ?? r.location?.latitude ?? r.location?.lat ?? r.geometry?.location?.lat);
    const lng = Number(r.lng ?? r.location?.longitude ?? r.location?.lng ?? r.geometry?.location?.lng);

    if (!place_id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return {
      place_id,
      name,
      ...(address ? { address } : {}),
      lat,
      lng,
      distance_m: r.distance_m ?? null,
      rating: r.rating ?? null,
      user_ratings_total: r.user_ratings_total ?? null,
      icon: r.icon ?? null,
    } satisfies PlacesNearbyResult;
  });

  const results = mapped.filter((x): x is PlacesNearbyResult => x !== null);

  const body: PlacesNearbyResponse = { results };
  return NextResponse.json(body, { status: 200 });
}
