import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";
import { serverLog, getRequestId } from "@/lib/server/logging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEBUG = process.env.NODE_ENV !== "production" && process.env.DEBUG_LOG === "1";

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);

  if (DEBUG) {
    serverLog("debug", "BFF_FAVORITES_GET", {
      requestId,
      cookieLen: req.headers.get("cookie")?.length ?? 0,
      hasAccess: req.cookies.has("access_token"),
      hasRefresh: req.cookies.has("refresh_token"),
    });
  }

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
