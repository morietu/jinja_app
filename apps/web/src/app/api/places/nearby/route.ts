import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString(); // lat/lng/limit

  const upstream = await fetch(`${API_BASE}/api/places/nearby/?${qs}`, {
    cache: "no-store",
  });

  const text = await upstream.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: upstream.status });
  } catch {
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8" },
    });
  }
}
