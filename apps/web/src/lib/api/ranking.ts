// apps/web/src/lib/api/ranking.ts
import type { GoriyakuTag } from "./types";

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

function toItems(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function fetchRanking(period: Period): Promise<RankingItem[]> {
  const sp = new URLSearchParams();
  sp.set("period", period);
  sp.set("limit", "10");

  const res = await fetch(`/api/populars/?${sp.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch ranking");

  const data = await res.json();
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.items)
        ? data.items
        : [];

  return normalizeRankingItems(items);
}
