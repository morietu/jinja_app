import { NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";
import { serverLog, getRequestId } from "@/lib/server/logging";

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";
type MaybePlace = PlacesNearbyResult | null;

export async function GET(req: Request) {
  const fallback: PlacesNearbyResponse = { results: [] };

  try {
    const requestId = getRequestId(req);

    const url = new URL(req.url);
    const qs = url.searchParams.toString();

    let upstream: Response;
    try {
      upstream = await djFetch(`/api/places/nearby/?${qs}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
    } catch (e) {
      serverLog("warn", "BFF_NEARBY_UPSTREAM_FETCH_FAILED", {
        requestId,
        message: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json(fallback, { status: 200 });
    }

    if (upstream.status === 404) {
      return NextResponse.json(fallback, { status: 200 });
    }

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => "");
      serverLog("warn", "BFF_NEARBY_UPSTREAM_NOT_OK", {
        requestId,
        status: upstream.status,
        textLen: txt.length,
      });
      // フロントを殺さない。BFFの責務。
      return NextResponse.json(fallback, { status: 200 });
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

    let dropped = 0;
    const mapped: MaybePlace[] = resultsRaw.map((r) => {
      const place_id = String(r?.place_id ?? r?.placeId ?? r?.id ?? "");
      const name = String(r?.name ?? r?.title ?? r?.displayName?.text ?? "");

      const address = r?.address ?? r?.formatted_address ?? r?.formattedAddress ?? undefined;

      const lat = Number(r?.lat ?? r?.location?.latitude ?? r?.location?.lat ?? r?.geometry?.location?.lat);
      const lng = Number(r?.lng ?? r?.location?.longitude ?? r?.location?.lng ?? r?.geometry?.location?.lng);

      const shrine_id_raw = r?.shrine_id ?? r?.shrineId ?? r?.registered_shrine_id ?? null;
      const shrine_id_num = Number(shrine_id_raw);
      const shrine_id = Number.isFinite(shrine_id_num) && shrine_id_num > 0 ? shrine_id_num : null;

      if (!place_id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        dropped++;
        return null;
      }

      return {
        place_id,
        name,
        ...(address ? { address } : {}),
        lat,
        lng,
        ...(shrine_id ? { shrine_id } : {}),
        distance_m: r?.distance_m ?? null,
        rating: r?.rating ?? null,
        user_ratings_total: r?.user_ratings_total ?? null,
        icon: r?.icon ?? null,
      } satisfies PlacesNearbyResult;
    });

    const results = mapped.filter((x): x is PlacesNearbyResult => x !== null);

    if (DEBUG) {
      serverLog("debug", "BFF_NEARBY_SHAPE", {
        requestId,
        rawCount: resultsRaw.length,
        dropped,
        out: results.length,
      });
    }

    return NextResponse.json({ results } satisfies PlacesNearbyResponse, { status: 200 });
  } catch (e) {
    serverLog("error", "BFF_NEARBY_HANDLER_CRASH", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json(fallback, { status: 200 });
  }
}
