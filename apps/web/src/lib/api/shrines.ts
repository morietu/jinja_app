// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated, Shrine } from "./types";

export type { Shrine } from "./types";

// Next(3000) の /api を叩く（E2E/CIでも動くように absolute）
const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000";

const WEB_API_BASE = `${WEB_BASE}/api`;

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

export async function getPopularShrines(params?: {
  limit?: number;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.nearLat != null && params?.nearLng != null && params?.radiusKm != null) {
    sp.set("near", `${params.nearLat},${params.nearLng}`);
    sp.set("radius_km", String(params.radiusKm));
  }

  // フロントは Next(3000) の /api を叩く（server/client どっちでも同じにする）
  const url = `${WEB_API_BASE}/populars/${sp.toString() ? `?${sp.toString()}` : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("failed to fetch popular shrines");

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

export async function getShrine(id: number): Promise<Shrine> {
  const url = `${WEB_API_BASE}/shrines/${id}/`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`failed to fetch shrine: ${res.status}`);
  return (await res.json()) as Shrine;
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
