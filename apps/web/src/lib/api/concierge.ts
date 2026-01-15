// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";
import { apiPost } from "./http";

export type ConciergeNeed = {
  tags?: string[];
  hits?: Record<string, string[]>;
};

export type ConciergeBreakdown = {
  score_element: number; // 0/1/2
  score_need: number;
  score_popular: number; // 0..1
  score_total: number;
  weights: {
    element: number;
    need: number;
    popular: number;
  };
  matched_need_tags: string[];
};





export type {
  ConciergeThread,
  ConciergeMessage,
  ConciergeRecommendation,
  ConciergeChatRequest,
  ConciergeChatData,
  ConciergeChatResponse,
  ConciergeThreadDetail,
} from "./concierge/types";

import type {
  ConciergeThread,
  ConciergeChatRequest,
  ConciergeChatResponse,
  ConciergeThreadDetail,
} from "./concierge/types";

/* ====== チャット API ====== */

export async function postConciergeChat(body: ConciergeChatRequest): Promise<ConciergeChatResponse> {
  // ★ ここは今まで通り Next の /api/concierge/chat/ プロキシを叩く
  return apiPost<ConciergeChatResponse>("/concierge/chat/", body);
}

/* ====== スレッド API ====== */

export async function fetchThreads(): Promise<ConciergeThread[]> {
  // ★ ここも Next 経由（/api/concierge-threads/）にそろえる
  const res = await api.get<ConciergeThread[] | { results: ConciergeThread[] }>("/concierge-threads/");
  const data = res.data as any;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;

  return [];
}

export async function fetchThreadDetail(threadId: string): Promise<ConciergeThreadDetail | null> {
  try {
    const res = await api.get<ConciergeThreadDetail>(`/concierge-threads/${threadId}/`);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        // 未ログイン or 見えない/消えたスレッド
        return null;
      }
    }
    throw err;
  }
}
