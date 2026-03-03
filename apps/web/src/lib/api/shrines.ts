// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated } from "./types";
import type { Shrine } from "./types";

export type { Shrine } from "./types";
export { fetchPopular as getPopularShrines } from "./popular";

// Next(3000) の /api を叩く（server/client どっちでも同じ）
const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000";
const WEB_API_BASE = `${WEB_BASE}/api`;
/**
 * ✅ SSRでも使える公開ルート（cookie不要）
 * ※ まだ /api/public/shrines/[id] が無いなら作るか、既存BFFへ合わせてURLを変える
 */
export async function getShrinePublic(id: number): Promise<Shrine> {
  const url = `${WEB_API_BASE}/public/shrines/${id}/`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read body>");
    throw new Error(`getShrinePublic failed: ${res.status} url=${url} body=${body.slice(0, 800)}`);
  }
  return (await res.json()) as Shrine;
}

/**
 * ✅ CSR専用（cookieが乗る前提）
 * 必要になったら Shrine 型で返してもいい（今は any のままでもOK）
 */
export async function getShrinePrivate(id: number): Promise<any> {
  const url = `/api/shrines/${id}/data/`;
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  if (!res.ok) {
    const body = await res.text().catch(() => "<failed to read body>");
    throw new Error(`getShrinePrivate failed: ${res.status} body=${body.slice(0, 800)}`);
  }
  return res.json();
}

/**
 * ✅ 互換：既存の呼び出しを壊さないため一旦残す（中身は public）
 * 入口を1つにしたいなら、呼び出し側を置換し終えたタイミングで消す。
 */
export const getShrine = getShrinePublic;

export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);

  const url = `${WEB_API_BASE}/shrines/${sp.toString() ? `?${sp.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to fetch shrines: ${res.status}`);

  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

// 近くの神社（axios の baseURL が /api ならこのままでOK）
export async function fetchNearestShrines(params: {
  lat: number;
  lng: number;
  page?: number;
  page_size?: number;
  limit?: number;
  q?: string;
}): Promise<Paginated<Shrine>> {
  const res = await api.get("/shrines/nearest/", { params });
  const data = res.data;
  if (Array.isArray(data)) {
    return { count: data.length, next: null, previous: null, results: data };
  }
  return res.data as Paginated<Shrine>;
}

export async function createShrine(payload: Partial<Shrine> & Record<string, any>) {
  // axios baseURL が /api 前提
  const res = await api.post("/my/shrines/", payload);
  return res.data as Shrine;
}
