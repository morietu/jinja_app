import api from "./client";
import type { Paginated, Shrine } from "./types";
import { getShrinePublicClient } from "./shrines.client";
import { getShrinePublicServer } from "./shrines.server";
import { getShrinesClient } from "./shrines.list.client";
import { getShrinesServer } from "./shrines.list.server";

export type { Shrine } from "./types";
export { fetchPopular as getPopularShrines } from "./popular";

export async function getShrinePublic(id: number): Promise<Shrine> {
  if (typeof window === "undefined") {
    return getShrinePublicServer(id);
  }
  return getShrinePublicClient(id);
}

export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  if (typeof window === "undefined") {
    return getShrinesServer(params);
  }
  return getShrinesClient(params);
}

/**
 * CSR専用（cookieが乗る前提）
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
 * 互換
 */
export const getShrine = getShrinePublic;

// 近くの神社（axios の baseURL が /api 前提）
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
  const res = await api.post("/my/shrines/", payload);
  return res.data as Shrine;
}
