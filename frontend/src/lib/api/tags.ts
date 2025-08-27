import api from "./client"

export type GoriyakuTag = {
  id: number
  name: string
}

export async function getTags() {
  const res = await api.get("/goriyaku-tags/"); // ✅ バックエンドに合わせる
  return res.data;
}