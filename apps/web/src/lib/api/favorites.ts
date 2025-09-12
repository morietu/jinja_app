// apps/web/src/lib/api/favorites.ts
import axios from "axios";
import api from "./client";
import type { Shrine } from "./shrines";

// ---- 設定/ユーティリティ ----
const PUBLIC_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");
const ENV_FAV = (process.env.NEXT_PUBLIC_FAVORITES_PATH || "").trim() || null;

const CANDIDATES = [
  "/favorites/",
  "/users/me/favorites/",
  "/temples/favorites/",
] as const;

const EXISTS_STATUS = new Set<number>([200,201,202,204,301,302,307,308,401,403,405]);

let _favEndpoint: string | null = null;

function normPath(p: string) {
  let s = (p || "").trim();
  try { const u = new URL(s); s = u.pathname; } catch {}
  if (s.startsWith("/api/")) s = s.slice(4);
  if (!s.startsWith("/")) s = "/" + s;
  if (!s.endsWith("/")) s += "/";
  return s;
}
function absUrl(path: string) {
  return `${PUBLIC_BASE}/api${path}`;
}
function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const tk = localStorage.getItem("access_token") || localStorage.getItem("access");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}

// 相対→絶対の順で存在確認
async function probe(path: string): Promise<"exists" | "notfound" | "retry"> {
  // 1) 相対 /api（rewrite 経由）
  try {
    await api.get(path);
    return "exists";
  } catch (e: any) {
    if (axios.isAxiosError(e)) {
      const code = e.response?.status;
      if (code && EXISTS_STATUS.has(code)) return "exists";
      if (code === 404) {
        // 2) 絶対URL（直叩き）
        try {
          await axios.get(absUrl(path), { headers: authHeaders() });
          return "exists";
        } catch (ee: any) {
          if (axios.isAxiosError(ee) && ee.response?.status === 404) return "notfound";
          return "retry";
        }
      }
    }
    return "retry";
  }
}

async function resolveFavoritesEndpoint(): Promise<string> {
  if (_favEndpoint) return _favEndpoint;

  if (ENV_FAV) {
    const p = normPath(ENV_FAV);
    const r = await probe(p);
    if (r === "exists") { _favEndpoint = p; return p; }
    console.warn(`[favorites] ENV path ${p} unusable -> fallback`);
  }

  for (const raw of CANDIDATES) {
    const p = normPath(raw);
    const r = await probe(p);
    if (r === "exists") { _favEndpoint = p; return p; }
  }

  // 最後の保険
  _favEndpoint = "/favorites/";
  console.warn("[favorites] no endpoint confirmed; using default /favorites/");
  return _favEndpoint;
}

// ---- API ----

// 一覧
export async function getFavorites(): Promise<Shrine[]> {
  const ep = await resolveFavoritesEndpoint();

  // 1) 相対 /api
  try {
    const { data } = await api.get<Shrine[]>(ep);
    return data;
  } catch {
    // 2) 絶対URL
    const { data } = await axios.get<Shrine[]>(absUrl(ep), { headers: authHeaders() });
    return data;
  }
}

// 追加
export async function addFavorite(shrineId: number): Promise<void> {
  const ep = await resolveFavoritesEndpoint();
  try {
    await api.post(ep, { shrine_id: shrineId });
  } catch {
    await axios.post(absUrl(ep), { shrine_id: shrineId }, { headers: { "Content-Type": "application/json", ...authHeaders() } });
  }
}

// 削除（/favorites/<id>/ パターン前提）
export async function removeFavorite(favoriteId: number): Promise<void> {
  const ep = await resolveFavoritesEndpoint();
  const url = `${ep}${favoriteId}/`;
  try {
    await api.delete(url);
  } catch {
    await axios.delete(absUrl(url), { headers: authHeaders() });
  }
}

// トグル（既存の /shrines/:id/favorite/ を優先）
export async function toggleFavorite(shrineId: number) {
  const rel = `/shrines/${shrineId}/favorite/`;
  try {
    const { data } = await api.post(rel);
    return data; // {status: "added" | "removed", shrine: {...}}
  } catch {
    const abs = `${PUBLIC_BASE}/api${rel}`;
    const { data } = await axios.post(abs, null, { headers: authHeaders() });
    return data;
  }
}
