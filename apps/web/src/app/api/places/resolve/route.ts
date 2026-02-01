// apps/web/src/app/api/places/resolve/route.ts

import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export async function POST(req: NextRequest) {
  const payload = await req.text(); // JSON決め打ちしない（壊れてても落ちない）

  const upstream = await djFetch(req, "/api/places/resolve/", {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
    },
    body: payload,
  });

  const ct = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();

  return new NextResponse(body, { status: upstream.status, headers: { "content-type": ct } });
}
