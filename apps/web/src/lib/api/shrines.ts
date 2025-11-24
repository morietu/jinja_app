// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated, Shrine } from "./types";

export type { Shrine } from "./types";

const API_BASE =
process.env.PLAYWRIGHT_BASE_URL ||
process.env.NEXT_PUBLIC_API_BASE_URL ||
"http://127.0.0.1:8000/api";

export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  const searchParams = new URLSearchParams();
  if (params?.q) {
    searchParams.set("q", params.q);
  }

  const query = searchParams.toString();
  const url = query.length > 0 ? `${API_BASE}/shrines/?${query}` : `${API_BASE}/shrines/`;

  console.log("getShrines API_BASE =", API_BASE);
  console.log("getShrines URL      =", url);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch shrines");
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function getShrine(id: number): Promise<Shrine> {
  const shrines = await getShrines();
  const shrine = shrines.find((s) => s.id === id);

  if (!shrine) {
    throw new Error("shrine not found");
  }

  return shrine;
}

// ✅ 人気神社ランキング（/api/populars/ を直接叩く）
const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://127.0.0.1:8000";
const POPULARS_API_BASE = `${BACKEND_ORIGIN}/api/populars/`;

export async function getPopularShrines(params?: {
  limit?: number;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params?.limit != null) {
    searchParams.set("limit", String(params.limit));
  }
  if (
    params?.nearLat != null &&
    params?.nearLng != null &&
    params?.radiusKm != null
  ) {
    searchParams.set("near", `${params.nearLat},${params.nearLng}`);
    searchParams.set("radius_km", String(params.radiusKm));
  }

  const query = searchParams.toString();
  const url =
    query.length > 0
      ? `${POPULARS_API_BASE}?${query}`
      : POPULARS_API_BASE;

  console.log("getPopularShrines URL =", url);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("failed to fetch popular shrines");
  }

  const data = await res.json();

  // /api/populars/ は pagination 付き: {count, next, previous, results}
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items; // 念のため
  return [];
}

// 近くの神社（DRFページネーション形式）
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
  const res = await api.post("/shrines/", payload);
  return res.data as Shrine;
}

export { importFromPlace, type ImportResult } from "./favorites";
