// apps/web/src/lib/api/shrines.ts
import api from "./client";
import type { Paginated, Shrine } from "./types";

export type { Shrine } from "./types";


// すでに getShrine で使っているものがあればそれを再利用してOK
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
  // DRF の pagination / 非pagination 両対応
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}


// 既存の API_BASE / getShrines はそのまま

export async function getShrine(id: number): Promise<Shrine> {
  // ① まず一覧を取得
  const shrines = await getShrines();

  // ② id が一致するものを探す
  const shrine = shrines.find((s) => s.id === id);

  if (!shrine) {
    throw new Error("shrine not found");
  }

  return shrine;
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

// 新規作成（必要なら）
export async function createShrine(payload: Partial<Shrine> & Record<string, any>) {
  const res = await api.post("/shrines/", payload);
  return res.data as Shrine;
}

// 他モジュールの re-export
export { importFromPlace, type ImportResult } from "./favorites";
