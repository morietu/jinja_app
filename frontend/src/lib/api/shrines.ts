import api from "./client";
import { GoriyakuTag } from "./types";



export type Shrine = {
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

// 一覧取得
export async function getShrines(params: { name?: string; tags?: string[] } = {}): Promise<Shrine[]> {
  const query = new URLSearchParams();
  if (params.name) query.append("name", params.name);
  if (params.tags) params.tags.forEach((t) => query.append("tag", t));

  const res = await api.get(`/shrines/${query.toString() ? `?${query.toString()}` : ""}`);
  return res.data;
}

// 詳細取得（axiosで統一）
export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}
