import type { Shrine } from "./types";

export async function getShrinesClient(params?: { q?: string }): Promise<Shrine[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);

  const url = `/api/shrines/${sp.toString() ? `?${sp.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read body>");
    throw new Error(`getShrinesClient failed: ${res.status} body=${body.slice(0, 800)}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}
