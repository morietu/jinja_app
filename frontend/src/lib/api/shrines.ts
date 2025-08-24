// src/lib/api/shrines.ts
import { apiFetch } from "./client"

export type GoriyakuTag = { id: number; name: string }

export type Shrine = {
  id: number
  name_jp: string
  name_romaji?: string
  address: string
  latitude: number
  longitude: number
  goriyaku?: string
  sajin?: string
  goriyaku_tags: GoriyakuTag[]
}

export async function fetchShrines(): Promise<Shrine[]> {
  return apiFetch<Shrine[]>("/api/shrines/")
}
