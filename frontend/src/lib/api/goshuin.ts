import api from "./client";

export type Goshuin = {
  id: number;
  shrine_id: number;
  title: string;
  image_url: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export async function getGoshuin(): Promise<Goshuin[]> {
  try {
    // baseURL は http://localhost:8000/api を想定
    const res = await api.get("/goshuin/");
    return res.data as Goshuin[];
  } catch (err: any) {
    // API 未実装なら UI を壊さず空で返す
    if (err?.response?.status === 404) return [];
    throw err;
  }
}
