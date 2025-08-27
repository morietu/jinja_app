import api from "./client";

export type Shrine = {
  id: number;
  name_jp: string;
  name_romaji?: string;
  address: string;
  latitude: number | null;   // ← null 許容に変更
  longitude: number | null;  // ← null 許容に変更
  goriyaku?: string;
  sajin?: string;
  description?: string;
  element?: string;
  created_at: string;
  updated_at: string;
  goriyaku_tags?: { id: number; name: string }[];
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
