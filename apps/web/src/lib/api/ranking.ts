// src/lib/api/ranking.ts
import api from "./client";
import { GoriyakuTag } from "./types";

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

// 月間／年間ランキングを取得
export async function fetchRanking(
  type: "monthly" | "yearly" = "monthly"
): Promise<RankingItem[]> {
  const res = await api.get(`/populars/?period=${type}`);
  const data = res.data;
  // res.data が配列ならそのまま、そうでなければ data.results を使う
  return Array.isArray(data) ? data : (data?.results ?? []);
}
