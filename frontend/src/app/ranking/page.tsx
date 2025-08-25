"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { getRanking, RankingItem } from "@/lib/api/ranking"

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRanking()
      .then(setRanking)
      .catch(() => setError("ランキングの取得に失敗しました"))
  }, [])

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">人気神社ランキング</h1>

      {error && <p className="text-red-500">{error}</p>}

      <ol className="space-y-2">
        {ranking.map((item, index) => (
          <li key={item.id} className="border p-3 rounded">
            <span className="mr-2 font-bold">{index + 1}位</span>
            <Link
              href={`/shrines/${item.id}`}
              className="text-blue-600 hover:underline"
            >
              {item.name_jp}
            </Link>
            <p className="text-sm text-gray-500">{item.address}</p>
            <p className="text-sm">スコア: {item.score}</p>
          </li>
        ))}
      </ol>
    </main>
  )
}
