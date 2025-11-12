// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated, Shrine } from "./types";
export type { Shrine } from "./types";

// 👉 検索パラメータは任意に（従来呼び出しを壊さない）
export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  const res = await api.get("/shrines/", { params });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}

// 近くの神社（DRFページネーション形式）
export async function fetchNearestShrines(params: {
  lat: number;
  lng: number;
  page?: number;
  page_size?: number;
  limit?: number; // 互換
  q?: string;
}): Promise<Paginated<Shrine>> {
  const res = await api.get("/shrines/nearest/", { params });
  const data = res.data;
  if (Array.isArray(data)) {
    // 一時互換: 配列→Paginatedへ
    return { count: data.length, next: null, previous: null, results: data };
  }
  return res.data as Paginated<Shrine>;
}

// 新規作成（必要なら）
export async function createShrine(
  payload: Partial<Shrine> & Record<string, any>
) {
  const res = await api.post("/shrines/", payload);
  return res.data as Shrine;
}

// 他モジュールの re-export
export { importFromPlace, type ImportResult } from "./favorites";
