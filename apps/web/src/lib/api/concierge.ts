import api from "./client";

export type ConciergeResponse = {
  recommendation: string;
  reason: string;
  tags: string[];
};

export type ConciergeHistory = {
  id: number;
  shrine: number | null;
  shrine_name: string;
  reason: string;
  tags: string[];
  created_at: string;
};

// baseURL は http://localhost:8000/api を想定
// まず /concierge/history/、無ければ /concierge/recommendations/ を使う
const HISTORY_CANDIDATES = [
  "/concierge/history/",
  "/concierge/recommendations/",
];

export async function getConciergeHistory(): Promise<ConciergeHistory[]> {
  let last404: any = null;
  for (const path of HISTORY_CANDIDATES) {
    try {
      const res = await api.get(path);
      return res.data as ConciergeHistory[];
    } catch (err: any) {
      if (err?.response?.status === 404) {
        last404 = err;
        continue; // 次の候補へ
      }
      throw err; // 404 以外は即エラー
    }
  }
  console.warn("No concierge history endpoint found. Returning empty list.", last404?.response?.status);
  return [];
}

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
    theme: theme ?? "",
  });
  return res.data as ConciergeResponse;
}
