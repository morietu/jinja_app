// apps/web/src/app/api/concierge/chat/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { bffPostJsonWithAuthFromReq } from "@/lib/bff/fetch";

export async function POST(req: NextRequest) {
  const payload = await req.json();
  return bffPostJsonWithAuthFromReq(req, "/api/concierge/chat/", payload, {
    retryOn401: true,
    setAccessCookie: true,
  });
}
