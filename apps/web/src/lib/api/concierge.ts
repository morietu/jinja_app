// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";
import { apiPost } from "./http";

/* ====== スレッド / メッセージ ====== */

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

/* ====== レコメンド候補 ====== */
/**
 * バックエンドのダミー候補：
 * {
 *   "id": 0,
 *   "name": "おすすめの神社",
 *   "display_name": "おすすめの神社",
 *   "location": null,
 *   "score": 0.0,
 *   "popular_score": 0.0,
 *   "tags": [],
 *   "deities": [],
 *   "reason": "静かに手を合わせたい社",
 *   "__dummy": true
 * }
 *
 * 将来の LLM では距離・時間・place_id なども入る前提なので
 * それらは optional にして 1つの型にまとめておく。
 */
export type ConciergeRecommendation = {
  id?: number | null;
  place_id?: string | null;

  // 表示用
  name: string;
  display_name?: string;

  // 住所・位置
  address?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;

  // 距離・時間・スコア
  distance_m?: number | null;
  duration_min?: number | null;
  score?: number | null;
  popular_score?: number | null;

  // メタ情報
  tags?: string[];
  deities?: string[];

  // 推薦理由（UIで必ず出したいので必須）
  reason: string;

  // 画像
  photo_url?: string | null;

  // ダミーフラグ
  __dummy?: boolean;
};

/* ====== チャット API ====== */

export type ConciergeChatRequest = {
  query: string;
  thread_id?: number | string | null;
};
export type ConciergeChatData = {
  recommendations?: ConciergeRecommendation[];
  raw?: string; // hooks.ts が参照しているフィールド
  reply?: string; // hooks.ts が参照しているフィールド
};

export type ConciergeChatResponse = {
  ok: boolean;
  // いまのバックエンド実装：
  // {
  //   "ok": true,
  //   "data": { "recommendations": [...] },
  //   "reply": "候補: おすすめの神社"
  // }
  data?: ConciergeChatData;
  reply?: string;
  note?: string;
  thread?: ConciergeThread;
};

/**
 * コンシェルジュへの問い合わせ
 * - /api/concierge/chat/ (Next プロキシ) 経由で DRF を叩く
 */
export async function postConciergeChat(body: ConciergeChatRequest): Promise<ConciergeChatResponse> {
  const res = await apiPost<ConciergeChatResponse>("/concierge/chat/", body);
  return res;
}

/* ====== スレッド API ====== */

export type ConciergeThreadDetail = {
  thread: ConciergeThread;
  messages: ConciergeMessage[];
  recommendations?: ConciergeRecommendation[];
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
