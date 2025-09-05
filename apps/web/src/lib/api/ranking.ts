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
export async function fetchRanking(type: "monthly" | "yearly" = "monthly"): Promise<RankingItem[]> {
  const res = await api.get(`/ranking/?period=${type}`);
  return res.data;
}
