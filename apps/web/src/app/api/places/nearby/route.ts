import { NextResponse } from "next/server";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";
import { serverLog, getRequestId } from "@/lib/server/logging";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

type MaybePlace = PlacesNearbyResult | null;

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/places/nearby-search/?${qs}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (e) {
    serverLog("warn", "BFF_NEARBY_UPSTREAM_FETCH_FAILED", {
      requestId,
      message: e instanceof Error ? e.message : String(e),
    });
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  if (upstream.status === 404) {
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  if (!upstream.ok) {
    const txt = await upstream.text().catch(() => "");
    serverLog("warn", "BFF_NEARBY_UPSTREAM_NOT_OK", {
      requestId,
      status: upstream.status,
      textLen: txt.length,
    });
    const body: PlacesNearbyResponse = { results: [] };
    return NextResponse.json(body, { status: 200 });
  }

  const text = await upstream.text().catch(() => "");
  let raw: any = null;
  try {
    raw = text ? JSON.parse(text) : null;
  } catch {
    serverLog("warn", "BFF_NEARBY_JSON_PARSE_FAILED", { requestId, textLen: text.length });
    raw = null;
  }

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

  if (DEBUG) {
    serverLog("debug", "BFF_NEARBY_OK", { requestId, count: results.length });
  }

  const body: PlacesNearbyResponse = { results };
  return NextResponse.json(body, { status: 200 });
}
