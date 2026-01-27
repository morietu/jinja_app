// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated, Shrine } from "./types";

export { fetchPopular as getPopularShrines } from "./popular";

export type { Shrine } from "./types";

// Next(3000) の /api を叩く（server/client どっちでも同じ）
const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

const WEB_API_BASE = `${WEB_BASE}/api`;

// ✅ 詳細は backend の /data/ を叩く（/api/shrines/:id/ は 404/blocked のため）
export async function getShrine(id: number): Promise<Shrine> {
  const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";
  const url = `${backend}/api/shrines/${id}/data/`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to fetch shrine(data): ${res.status}`);
  return (await res.json()) as Shrine;
}

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
  if (Array.isArray(data)) return { count: data.length, next: null, previous: null, results: data };
  return res.data as Paginated<Shrine>;
}

export async function createShrine(payload: Partial<Shrine> & Record<string, any>) {
  const res = await api.post("/shrines/", payload);
  return res.data as Shrine;
}

export { importFromPlace, type ImportResult } from "./favorites";
