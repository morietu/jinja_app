import "server-only";

import type { Shrine } from "./types";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

export async function getShrinesServer(params?: { q?: string }): Promise<Shrine[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);

  const base = resolveServerBaseUrl();
  const url = `${base}/api/shrines/${sp.toString() ? `?${sp.toString()}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read body>");
    throw new Error(`getShrinesServer failed: ${res.status} url=${url} body=${body.slice(0, 800)}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}
