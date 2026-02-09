// apps/web/src/app/api/places/resolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";
import { serverLog } from "@/lib/server/logging";

export async function POST(req: NextRequest) {
  const payload = await req.text();

  // ここは Django 側のパスに合わせる。末尾スラッシュ有無は “Djangoの実装に合わせて固定”
  // 迷うなら Django 側が /api/places/resolve/ を受けてるならこっち：
  const upstream = await djFetch(req, "/api/places/resolve/", {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body: payload,
  });

  const ct = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();

  if (!upstream.ok) {
    serverLog("warn", "PLACES_RESOLVE_UPSTREAM_BAD", { status: upstream.status, body: body.slice(0, 300) });
  }

  return new NextResponse(body, { status: upstream.status, headers: { "content-type": ct } });
}
