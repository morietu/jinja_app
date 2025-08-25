// frontend/lib/api/ranking.ts
export type RankingItem = {
  id: number
  name_jp: string
  address: string
  score: number
}

export async function getRanking(): Promise<RankingItem[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/ranking/`)
  if (!res.ok) {
    throw new Error("ランキングデータ取得に失敗しました")
  }
  return res.json()
}
