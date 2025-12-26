// apps/web/src/app/api/shrines/from-place/route.ts
import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const place_id = body?.place_id;

  if (!place_id || typeof place_id !== "string") {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  const upstream = await fetch(`${API_BASE}/api/shrines/from-place/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ place_id }),
    cache: "no-store",
  });

  const data = await upstream.json().catch(() => null);

  return NextResponse.json(data ?? { error: "upstream failed" }, { status: upstream.status });
}
