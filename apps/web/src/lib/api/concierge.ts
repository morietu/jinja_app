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

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

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

  // 1) 通常は Next の rewrites 経由（/api ベース）
  try {
    const r = await api.get<ConciergeHistory[]>(ep);
    return { kind: "ok" as const, data: r.data };
  } catch (err: any) {
    // 404 → 次候補へ
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { kind: "missing" as const };
    }
    // 401/403 → エンドポイントは「存在」するが未ログイン
    if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
      return { kind: "exists" as const, data: [] as ConciergeHistory[] };
    }
    // レスポンス無し → Network Error など。絶対URLでフォールバックを一度試す
    if (axios.isAxiosError(err) && !err.response) {
      try {
        const abs = `${PUBLIC_BASE}/api${ep}`;
        const r2 = await axios.get<ConciergeHistory[]>(abs, {
          headers: api.defaults.headers.common, // Authorization を引き継ぐ
        });
        return { kind: "ok" as const, data: r2.data };
      } catch {
        return { kind: "error" as const, error: err };
      }
    }
    return { kind: "error" as const, error: err };
  }
}

/** 履歴一覧（ログイン必須。未ログインや未実装でも UI を落とさない） */
export async function getConciergeHistory(): Promise<ConciergeHistory[]> {
  // キャッシュがあれば最初に試す
  if (HISTORY_EP_CACHE) {
    const r = await tryGet(HISTORY_EP_CACHE);
    if (r.kind === "ok") return r.data;
    if (r.kind === "exists") return []; // 未ログイン
    // missing / error → キャッシュ破棄して再探索
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
      return []; // 未ログイン（存在は確認できた）
    }
    // missing → 次候補へ
  }

  // どれも見つからない（未実装）→ フェイルソフト
  console.warn("[concierge] history endpoint not found; returning empty list");
  return [];
}
