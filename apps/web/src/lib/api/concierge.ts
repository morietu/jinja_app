// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";

/* ====== スレッドAPI ====== */

export type ConciergeThread = {
  id: number;
  title: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
};

export type ConciergeMessage = {
  id: number;
  thread_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ConciergeThreadDetail = {
  thread: ConciergeThread;
  messages: ConciergeMessage[];
};

export type ConciergeChatRequest = {
  message: string;
  thread_id?: string | null;
};

export type ConciergeChatResponse = {
  thread: ConciergeThread;
  messages: ConciergeMessage[];
};

export async function fetchThreads(): Promise<ConciergeThread[]> {
  const res = await api.get<ConciergeThread[] | { results: ConciergeThread[] }>("/concierge-threads/");
  const data = res.data as any;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;

  return [];
}

export async function fetchThreadDetail(id: string): Promise<ConciergeThreadDetail | null> {
  try {
    const res = await api.get<ConciergeThreadDetail>(`/concierge-threads/${id}/`);
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

export async function postConciergeChat(body: ConciergeChatRequest): Promise<ConciergeChatResponse> {
  const res = await api.post<ConciergeChatResponse>("/concierge/chat/", body);
  return res.data;
}
