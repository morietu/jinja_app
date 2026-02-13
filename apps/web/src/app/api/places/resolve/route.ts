// apps/web/src/app/api/places/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

async function passthrough(upstream: Response) {
  const body = await upstream.arrayBuffer();
  const res = new NextResponse(body, { status: upstream.status });
  upstream.headers.forEach((v, k) => res.headers.set(k, v));
  if (!res.headers.get("content-type")) res.headers.set("content-type", "application/json");
  return res;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const qs = searchParams.toString();
  const upstream = await djFetch(req, `/api/places/resolve/${qs ? `?${qs}` : ""}`, { method: "GET" });
  return passthrough(upstream);
}
