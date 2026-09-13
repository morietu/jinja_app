import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Weekly Compass BFF. Deliberately identical in shape to
// src/app/api/compass/recommendations/route.ts -- a thin relay, no request
// reshaping, no independent JWT/Cookie handling.
//
// bffFetchWithAuthFromReq() already forwards the incoming Cookie header
// upstream and passes the backend's Set-Cookie back to the browser, so the
// anonymous Owner cookie (concierge_anon_id) that
// POST /api/compass/weekly/ issues needs no extra handling here.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  return bffFetchWithAuthFromReq(request, "/api/compass/weekly/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: rawBody ? rawBody : undefined,
  });
}
