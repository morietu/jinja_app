// apps/web/src/lib/api/concierge.ts
import axios from "axios";
import api from "./client";

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
    if (r.kind === "ok") { HISTORY_EP_CACHE = path; return r.data; }
    if (r.kind === "exists") { HISTORY_EP_CACHE = path; return []; }
  }
  console.warn("[concierge] history endpoint not found; returning empty list");
  return [];
}
