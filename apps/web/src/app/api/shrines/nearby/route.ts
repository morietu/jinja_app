import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const limit = searchParams.get("limit") ?? "20";

  if (!lat || !lng) {
    return NextResponse.json({ error: "missing_lat_lng" }, { status: 400 });
  }

  const upstreamPath = `/api/shrines/nearby/?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=${encodeURIComponent(limit)}`;
  const upstream = await djFetch(req, upstreamPath, { method: "GET" });

  const text = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status, body: text.slice(0, 500) },
      { status: 502 },
    );
  }

  return new NextResponse(text, { status: 200, headers: { "Content-Type": "application/json" } });
}

