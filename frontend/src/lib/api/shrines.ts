import api from "./client";

export type Shrine = {
  id: number;
  name_jp: string;
  name_romaji?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  goriyaku?: string;
  sajin?: string;
  description?: string;
  element?: string;
  created_at: string;
  updated_at: string;
  goriyaku_tags?: { id: number; name: string }[];
};

// 一覧取得
export async function getShrines(): Promise<Shrine[]> {
  const res = await api.get("/shrines/");
  return res.data;
}

// 詳細取得
export async function getShrine(id: number): Promise<Shrine> {
  const res = await api.get(`/shrines/${id}/`);
  return res.data;
}
