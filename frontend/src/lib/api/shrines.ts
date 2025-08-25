// src/lib/api/shrines.ts
import { apiFetch } from "./client"

// 共通のタグ型
export type GoriyakuTag = { id: number; name: string }

// 一覧用（軽量）
export type ShrineListItem = {
  id: number
  name_jp: string
  address: string
  score?: number  // ランキング用（任意）
}

// 詳細用（フルデータ）
export type ShrineDetail = {
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

// 一覧取得
export async function fetchShrines(): Promise<ShrineListItem[]> {
  return apiFetch<ShrineListItem[]>("/api/shrines/")
}

// 詳細取得
export async function getShrineDetail(id: number): Promise<ShrineDetail> {
  return apiFetch<ShrineDetail>(`/api/shrines/${id}/`)
}
