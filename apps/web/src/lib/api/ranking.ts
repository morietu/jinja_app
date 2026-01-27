// src/lib/api/ranking.ts

import type { GoriyakuTag } from "./types";

// 固定でバックエンドの絶対 URL を指定して、localhost:3000 のプロキシ経由にならないようにする
const POPULARS_API_BASE = "http://127.0.0.1:8000/api/populars/";

export type RankingItem = {
  id: number;
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  score: number;
  visit_count: number;
  favorite_count: number;
  goriyaku_tags: GoriyakuTag[];
};

export type Period = "monthly" | "yearly";

/**
 * Normalize raw API items into our RankingItem shape.
 */
export function normalizeRankingItems(rawItems: any[]): RankingItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map(
    (s: any): RankingItem => ({
      id: s.id,
      name_jp: s.name_jp ?? s.name ?? "",
      address: s.address ?? "",
      latitude: s.latitude ?? 0,
      longitude: s.longitude ?? 0,
      score: s.score ?? 0,
      visit_count: s.visits_30d_dyn ?? s.visit_count ?? 0,
      favorite_count: s.favorites_30d_dyn ?? s.favorite_count ?? 0,
      goriyaku_tags: s.goriyaku_tags ?? [],
    }),
  );
}

export async function fetchRanking(period: Period): Promise<RankingItem[]> {
  const url = `${POPULARS_API_BASE}?period=${period}&limit=10`;

 

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch ranking");
  }

  const data = await res.json();

  // API may return either array directly or paginated shape { results: [...] } or { items: [...] }
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.items)
        ? data.items
        : [];

  return normalizeRankingItems(items);
}
