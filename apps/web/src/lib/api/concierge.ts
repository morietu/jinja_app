// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";


/* ====== 既存: 履歴API ====== */

export type ConciergeHistory = {
  id: number;
  shrine: number;
  shrine_name?: string;
  reason?: string | null;
  tags?: string[] | null;
  created_at?: string;
};

// 先頭/末尾スラッシュを保証
function normalize(p: string) {
  let s = (p || "").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

/** 候補: 環境によりどれかが存在 */
const HISTORY_CANDIDATES = [
  "/concierge/history",
  "/users/me/concierge-history",
  "/temples/concierge/history",
].map(normalize);

let HISTORY_EP_CACHE: string | null = null;

async function tryGet(path: string) {
  const ep = normalize(path);
  try {
    const r = await api.get<ConciergeHistory[]>(ep); // ← 必ず /api 経由（Cookie送信）
    return { kind: "ok" as const, data: r.data };
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { kind: "missing" as const };
    }
    if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
      return { kind: "exists" as const, data: [] as ConciergeHistory[] }; // 存在はするが未ログイン
    }
    // 認証系は絶対URLにフォールバックしない（Cookieが載らないため）
    return { kind: "error" as const, error: err };
  }
}

/** 履歴一覧（ログイン必須。未ログインや未実装でも UI を落とさない） */
export async function getConciergeHistory(): Promise<ConciergeHistory[]> {
  if (HISTORY_EP_CACHE) {
    const r = await tryGet(HISTORY_EP_CACHE);
    if (r.kind === "ok") return r.data;
    if (r.kind === "exists") return [];
    HISTORY_EP_CACHE = null;
  }
  for (const path of HISTORY_CANDIDATES) {
    const r = await tryGet(path);
    if (r.kind === "ok") {
      HISTORY_EP_CACHE = path;
      return r.data;
    }
    if (r.kind === "exists") {
      HISTORY_EP_CACHE = path;
      return [];
    }
  }
  console.warn("[concierge] history endpoint not found; returning empty list");
  return [];
}


/* ====== 新規: スレッドAPI ====== */

export type ConciergeThread = {
  id: string;
  title: string;
  last_message_at: string;
};

export type ConciergeMessage = {
  id: string;
  thread_id: string;
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
  messages: ConciergeMessage[]; // 直近の履歴 or 追加分、バックエンド仕様に合わせて
};

// api の baseURL が /api なので、ここでは /concierge/... にしておく
export async function fetchThreads(): Promise<ConciergeThread[]> {
  try {
    const res = await api.get<ConciergeThread[]>("/concierge-threads/");
    return res.data ?? [];
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;

      // 404: バックエンドに未実装（または URL 未配線）の環境
      if (status === 404) {
        console.warn("[concierge] threads endpoint not found; returning empty list");
        return [];
      }

      // 401/403: ログインしていない環境 → 「スレッドなし」として扱う
      if (status === 401 || status === 403) {
        console.warn("[concierge] threads endpoint unauthorized; treat as empty");
        return [];
      }
    }
    // それ以外は素直に投げる（デバッグ用）
    throw err;
  }
}

export async function fetchThreadDetail(id: string): Promise<ConciergeThreadDetail | null> {
  try {
    const res = await api.get<ConciergeThreadDetail>(`/concierge-threads/${id}/`);
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        // 未ログイン or 見えない/消えたスレッド → null で呼び出し側に返す
        return null;
      }
    }
    throw err;
  }
}

export async function postConciergeChat(
  body: ConciergeChatRequest,
): Promise<ConciergeChatResponse> {
  const res = await api.post<ConciergeChatResponse>("/concierge/chat/", body);
  return res.data;
}
