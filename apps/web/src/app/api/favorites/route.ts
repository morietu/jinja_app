// apps/web/src/app/api/favorites/route.ts
import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/bff/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  console.log("[/api/favorites GET] cookieLen=", req.headers.get("cookie")?.length ?? 0);
  console.log("[/api/favorites GET] hasAccess=", req.cookies.has("access_token"));
  console.log("[/api/favorites GET] hasRefresh=", req.cookies.has("refresh_token"));
  return bffFetchWithAuthFromReq(req, "/api/favorites/", { method: "GET" });
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  return bffFetchWithAuthFromReq(req, "/api/favorites/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
  });
}
