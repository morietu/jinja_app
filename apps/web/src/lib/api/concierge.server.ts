import { headers } from "next/headers";
import type { ConciergeThreadDetail } from "./concierge/types";
import { resolveServerBaseUrlFromHeaders } from "@/lib/server/resolveServerBaseUrl";

export async function getConciergeThreadServer(tid: string): Promise<ConciergeThreadDetail | null> {
  const h = await headers();
  const baseUrl = resolveServerBaseUrlFromHeaders(h);
  const cookieHeader = h.get("cookie") ?? "";

  const res = await fetch(`${baseUrl}/api/concierge-threads/${encodeURIComponent(tid)}/`, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  });

  if (res.status === 401 || res.status === 403 || res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`getConciergeThreadServer failed: ${res.status}`);
  }

  return (await res.json()) as ConciergeThreadDetail;
}
