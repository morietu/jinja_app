import api from "./client";
import { GoriyakuTag } from "./types";



export type Shrine = {
  is_favorite(is_favorite: any): [any, any];
  id: number;
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  goriyaku?: string;
  sajin?: string;
  description?: string | null;
  goriyaku_tags: GoriyakuTag[];
};

// 一覧取得 Qで一本化
export async function getShrines(params: { q?: string } = {}): Promise<Shrine[]> {
  const query = new URLSearchParams();
  if (params.q) query.append("q", params.q);

  const res = await api.get(`/shrines${query.toString() ? `?${query.toString()}` : ""}`);
  return res.data;
}

// 詳細取得（axiosで統一）　ここの詳細取得は残す？
export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}

export async function createShrine(data: {
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  goriyaku?: string;
  sajin?: string;
}) {
  const res = await api.post("/shrines/", data);
  return res.data;
}