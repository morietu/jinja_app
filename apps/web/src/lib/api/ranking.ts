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

function pickItems(data: any): any[] {
  return Array.isArray(data)
    ? data
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.items)
        ? data.items
        : [];
}

export async function fetchRanking(period: Period): Promise<RankingItem[]> {
  const sp = new URLSearchParams({ period, limit: "10" });
  const url = `/api/populars/?${sp.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch ranking");

  const data = await res.json();
  return normalizeRankingItems(pickItems(data));
}
