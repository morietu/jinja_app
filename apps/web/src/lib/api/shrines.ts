// apps/web/src/lib/api/shrines.ts
import api from "./client";

export type GoriyakuTag = { id: number; name: string };

// バックエンドに合わせて拡張（足りないプロパティは全部 optional）
export type Shrine = {
  id: number;
  name_jp: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance_m?: number;
  // 詳細ページが参照している項目をoptionalで追加
  goriyaku?: string;
  sajin?: string;
  goriyaku_tags?: GoriyakuTag[];
};

// 👉 検索パラメータは任意に（従来呼び出しを壊さない）
export async function getShrines(params?: { q?: string }): Promise<Shrine[]> {
  const res = await api.get("/shrines/", { params });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}

// 近くの神社
export async function fetchNearestShrines(
  lat: number,
  lng: number,
  radiusM = 2000
): Promise<Shrine[]> {
  const res = await api.get("/shrines/nearby/", {
    params: { lat, lng, radius_m: radiusM },
  });
  return Array.isArray(res.data) ? res.data : res.data?.results ?? [];
}

// 新規作成（必要なら）
export async function createShrine(
  payload: Partial<Shrine> & Record<string, any>
) {
  const res = await api.post("/shrines/", payload);
  return res.data as Shrine;
}

// 他モジュールのre-export（必要なら残す）
export { importFromPlace, type ImportResult } from "./favorites";
