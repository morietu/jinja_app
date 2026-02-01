// apps/web/src/app/api/concierge/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { djFetch } from "@/lib/server/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const payload = await req.text();

  const upstream = await djFetch(req, "/api/concierge/chat/", {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      // djFetch 側でcookie/csrf forwardするので、基本いらない
    },
    body: payload,
  });

  const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const body = await upstream.text();

  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": ct },
  });
}
