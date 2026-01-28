//apps/web/src/app/api/users/me/route.ts;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export async function GET(req: NextRequest) {
  return bffFetchWithAuthFromReq(req, "/api/users/me/", { method: "GET" });
}

export async function PATCH(req: NextRequest) {
  const bodyText = await req.text();
  return bffFetchWithAuthFromReq(req, "/api/users/me/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
  });
}
