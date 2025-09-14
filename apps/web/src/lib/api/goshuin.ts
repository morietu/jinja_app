// apps/web/src/lib/api/goshuin.ts
import axios from "axios";
import api from "./client";

export type Goshuin = {
  id: number;
  shrine: number;
  title?: string | null;
  image_url?: string | null;
  created_at?: string;
  is_public: boolean;
  shrine_name?: string;
};

/** 公開一覧（認証不要） */
export async function fetchPublicGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/goshuin/");
  return r.data ?? [];
}

/** 自分の一覧（要認証） */
export async function fetchMyGoshuin(): Promise<Goshuin[]> {
  const r = await api.get<Goshuin[]>("/my/goshuin/");
  return r.data ?? [];
}

/* ====== 以下：自動判定 ====== */
function normalize(p: string) {
  let s = (p || "").trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}

const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const ENV_PATH_RAW = (process.env.NEXT_PUBLIC_GOSHUIN_PATH || "").trim();

const CANDIDATES = ["/goshuin", "/users/me/goshuin", "/temples/goshuin"].map(normalize);
let EP_CACHE: string | null = ENV_PATH_RAW ? normalize(ENV_PATH_RAW) : null;

async function tryGet(path: string) {
  const ep = normalize(path);
  try {
    const r = await api.get<Goshuin[]>(ep);
    return { kind: "ok" as const, data: r.data };
  } catch (err: any) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return { kind: "missing" as const };
    if (axios.isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403))
      return { kind: "exists" as const, data: [] as Goshuin[] };

    if (axios.isAxiosError(err) && !err.response) {
      try {
        const abs = `${PUBLIC_BASE}/api${ep}`;
        const r2 = await axios.get<Goshuin[]>(abs, { headers: api.defaults.headers.common });
        return { kind: "ok" as const, data: r2.data };
      } catch {
        return { kind: "error" as const, error: err };
      }
    }
    return { kind: "error" as const, error: err };
  }
}

/** 自動判定：環境に合わせて最も近いエンドポイントから一覧を返す */
export async function getGoshuin(): Promise<Goshuin[]> {
  if (EP_CACHE) {
    const r = await tryGet(EP_CACHE);
    if (r.kind === "ok") return r.data;
    if (r.kind === "exists") return [];
    EP_CACHE = null;
  }
  for (const p of CANDIDATES) {
    const r = await tryGet(p);
    if (r.kind === "ok") { EP_CACHE = p; return r.data; }
    if (r.kind === "exists") { EP_CACHE = p; return []; }
  }
  console.warn("[goshuin] endpoint not found; returning empty list");
  return [];
}

// 好きなら別名も出しておく
export const getGoshuinAuto = getGoshuin;
