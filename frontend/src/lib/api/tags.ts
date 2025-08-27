import api from "./client"

export type GoriyakuTag = {
  id: number
  name: string
}

export async function getTags(): Promise<GoriyakuTag[]> {
  const res = await api.get("/goriyaku-tags/")
  return res.data
}
