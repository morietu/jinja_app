// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";
import { apiPost } from "./http";

/* ====== スレッド / メッセージ ====== */

export type ConciergeThread = {
  id: number;
  title: string;
  last_message: string;
  last_message_at: string | null;
  message_count: number;
};

export type ConciergeMessage = {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

/* ====== レコメンド候補 ====== */

export type ConciergeRecommendation = {
  id?: number | null;
  place_id?: string | null;

  name: string;
  display_name?: string;

  address?: string | null;
  display_address?: string | null;

  location?:
    | string
    | null
    | {
        lat: number;
        lng: number;
      };
  lat?: number | null;
  lng?: number | null;

  distance_m?: number | null;
  duration_min?: number | null;
  score?: number | null;
  popular_score?: number | null;

  tags?: string[];
  deities?: string[];

  reason: string;

  photo_url?: string | null;
  __dummy?: boolean;
};

/* ====== チャット API ====== */

export type ConciergeChatRequest = {
  query: string;
  thread_id?: number | string | null;
};

export type ConciergeChatData = {
  recommendations?: ConciergeRecommendation[];
  raw?: string;
  reply?: string;
};

export type ConciergeChatResponse = {
  ok: boolean;
  data?: ConciergeChatData;
  reply?: string;
  note?: string;
  thread?: ConciergeThread;
};

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

export type ConciergeThreadDetail = {
  thread: ConciergeThread;
  messages: ConciergeMessage[];
  recommendations?: ConciergeRecommendation[];
};

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
