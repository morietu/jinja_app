import api from "./client";

export type ConciergeResponse = {
  recommendation: string;
  reason: string;
  tags: string[];
};

export async function getConciergeRecommendation(
  birthYear: number,
  birthMonth?: number,
  birthDay?: number,
  theme?: string
): Promise<ConciergeResponse> {
  const res = await api.post("/concierge/", {
    birth_year: birthYear,
    birth_month: birthMonth,
    birth_day: birthDay,
    theme: theme || "",
  });
  return res.data;
}

export type ConciergeHistory = {
  id: number;
  shrine: number | null;
  shrine_name: string;
  reason: string;
  tags: string[];
  created_at: string;
};

// 履歴取得
export async function getConciergeHistory(): Promise<ConciergeHistory[]> {
  const res = await api.get("/concierge/history/");
  return res.data;
}
