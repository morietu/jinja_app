// apps/web/src/app/api/concierge/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/bff/fetch";

export async function POST(req: Request) {
  const payload = await req.text(); // まずは生で取る（壊れてても落ちない）
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

  const upstream = await fetch(`${backendUrl}/api/concierge/chat/`, {
    method: "POST",
    headers: {
      "content-type": req.headers.get("content-type") ?? "application/json",
      "x-csrftoken": req.headers.get("x-csrftoken") ?? "",
      cookie: req.headers.get("cookie") ?? "",
    },
    body: payload,
  });

  const ct = upstream.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const body = await upstream.text(); // JSON決め打ちしない

  // そのまま返す（ステータスもcontent-typeも嘘つかない）
  return new Response(body, {
    status: upstream.status,
    headers: { "content-type": ct },
  });
}
