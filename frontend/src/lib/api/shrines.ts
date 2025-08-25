import api from "./client";

export type Shrine = {
  id: number;
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  goriyaku?: string;
  sajin?: string;
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
