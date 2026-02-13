// apps/web/src/lib/api/placeCaches.ts
// 目的: 神社名検索に一本化（/api/shrines?q=...）
// 既存呼び出し元が placeCaches を使っていても壊れないように互換関数名を残す

import type { Shrine } from "@/lib/api/shrines";

type ShrineListResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Shrine[];
};

export async function fetchPlaceCaches(params: {
  q: string;
  limit?: number;
  dedupe?: boolean;
}): Promise<{ results: Shrine[]; count: number }> {
  const qs = new URLSearchParams();
  qs.set("q", params.q);

  // Django側がlimitを受けないなら無視されるだけ。受けるなら有効。
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));

  const res = await fetch(`/api/shrines?${qs.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`fetchPlaceCaches failed: ${res.status}`);

  const data = (await res.json()) as Partial<ShrineListResponse>;
  const results = Array.isArray(data.results) ? data.results : [];
  const count = typeof data.count === "number" ? data.count : results.length;

  const limit = params.limit ?? results.length;
  return { results: results.slice(0, limit), count };
}

// 互換: 既存のSuggestBoxがこれを使ってても動くように残す
export async function fetchPlaceCacheSuggest(q: string, limit = 10): Promise<Shrine[]> {
  const data = await fetchPlaceCaches({ q, limit, dedupe: true });
  return data.results ?? [];
}
