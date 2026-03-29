import type { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const upstreamPath = `/api/concierge-threads/${id}/`;

  const cookieHeader = req.headers.get("cookie") ?? "";
  const hasAuthHeader = Boolean(req.headers.get("authorization"));
  const hasAnonCookie = /(?:^|;\s*)concierge_anon_id=/.test(cookieHeader);
  const hasAccessCookie = /(?:^|;\s*)access_token=/.test(cookieHeader);
  const hasRefreshCookie = /(?:^|;\s*)refresh_token=/.test(cookieHeader);

  console.log("[BFF_THREAD_ROUTE_IN]", {
    id,
    method: req.method,
    hasAuthHeader,
    hasCookieHeader: Boolean(cookieHeader),
    hasAnonCookie,
    hasAccessCookie,
    hasRefreshCookie,
  });

  console.log("[BFF_THREAD_DETAIL_REQUEST]", {
    path: upstreamPath,
    hasCookieHeader: Boolean(req.headers.get("cookie")),
    cookieHeader: req.headers.get("cookie"),
  });

  console.log("[BFF_THREAD_DETAIL_UPSTREAM]", {
    upstreamPath,
  });

  return bffFetchWithAuthFromReq(req, upstreamPath, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
