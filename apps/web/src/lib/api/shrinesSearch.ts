// apps/web/src/lib/api/shrinesSearch.ts
import type { Shrine } from "@/lib/api/shrines";

export type ShrineListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Shrine[];
};

export async function fetchShrines(params: {
  q: string;
  limit?: number;
}): Promise<{ results: Shrine[]; count: number }> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));

  const res = await fetch(`/api/shrines?${qs.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fetchShrines failed: ${res.status}`);

  const data = (await res.json()) as Partial<ShrineListResponse>;
  const results = Array.isArray(data.results) ? data.results : [];
  const count = typeof data.count === "number" ? data.count : results.length;

  const limit = params.limit ?? results.length;
  return { results: results.slice(0, limit), count };
}

export async function fetchShrineSuggest(q: string, limit = 10): Promise<Shrine[]> {
  const data = await fetchShrines({ q, limit });
  return data.results ?? [];
}
