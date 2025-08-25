import api from "./client";

export type RankingItem = {
  id: number;
  name_jp: string;
  address: string;
  score: number;
};

// 年間/月間を選べるAPI（拡張用）
export async function fetchRanking(type: "monthly" | "yearly") {
  const res = await api.get(`/ranking/${type}/`);
  return res.data;
}

// 年間ランキング固定（MVP用）
export async function getRanking(): Promise<RankingItem[]> {
  const res = await api.get("/ranking/");
  return res.data;
}
