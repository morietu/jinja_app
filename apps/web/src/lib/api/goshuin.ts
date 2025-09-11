import axios from "axios";
import api from "./client";

export type Goshuin = {
  id: number;
  shrine: number;
  title?: string | null;
  image_url?: string | null;
  created_at?: string;
};

/** 末尾スラッシュ統一 */
function normalize(p: string) {
  let s = (p || "").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");

/** 環境変数で固定できる（例: NEXT_PUBLIC_GOSHUIN_PATH=/users/me/goshuin/） */
const ENV_PATH_RAW = (process.env.NEXT_PUBLIC_GOSHUIN_PATH || "").trim();

/** 候補（環境によりどれかが存在） */
const CANDIDATES = [
  "/goshuin",
  "/users/me/goshuin",
  "/temples/goshuin",
].map(normalize);

let EP_CACHE: string | null = ENV_PATH_RAW ? normalize(ENV_PATH_RAW) : null;

async function tryGet(path: string) {
  const ep = normalize(path);

  // 1) 通常は Next の rewrites 経由（相対 /api）
  try {
    const r = await api.get<Goshuin[]>(ep);
    return { kind: "ok" as const, data: r.data };
  } catch (err: any) {
    // 404 → 次候補
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      return { kind: "missing" as const };
    }
    // 401/403 → エンドポイントは存在（未ログイン）
    if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)) {
      return { kind: "exists" as const, data: [] as Goshuin[] };
    }
    // レスポンス無し → Network Error 等。絶対URLで再試行
    if (axios.isAxiosError(err) && !err.response) {
      try {
        const abs = `${PUBLIC_BASE}/api${ep}`;
        const r2 = await axios.get<Goshuin[]>(abs, {
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

/** 御朱印一覧（未ログイン・未実装でも UI は落とさない） */
export async function getGoshuin(): Promise<Goshuin[]> {
  // まず ENV or キャッシュを試す
  if (EP_CACHE) {
    const r = await tryGet(EP_CACHE);
    if (r.kind === "ok") return r.data;
    if (r.kind === "exists") return []; // 未ログイン
    EP_CACHE = null; // ダメなら破棄して探索
  }

  for (const p of CANDIDATES) {
    const r = await tryGet(p);
    if (r.kind === "ok") {
      EP_CACHE = p;
      return r.data;
    }
    if (r.kind === "exists") {
      EP_CACHE = p;
      return []; // 未ログイン（存在は確認）
    }
    // missing → 次候補
  }

  // 見つからない（未実装）→ フェイルソフト
  console.warn("[goshuin] endpoint not found; returning empty list");
  return [];
}
