import type { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

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

  return bffFetchWithAuthFromReq(req, `/api/concierge-threads/${id}/`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
}
