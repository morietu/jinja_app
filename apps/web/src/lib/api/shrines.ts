import api from "./client";
import type { Paginated, Shrine } from "./types";

export type { Shrine } from "./types";
export { fetchPopular as getPopularShrines } from "./popular";

export async function getShrinePublic(id: number): Promise<Shrine> {
  const { getShrinePublicClient } = await import("./shrines.client");
  return getShrinePublicClient(id);
}

export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  const { getShrinesClient } = await import("./shrines.list.client");
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

export const getShrine = getShrinePublic;

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
