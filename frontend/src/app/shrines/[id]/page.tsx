"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getShrineDetail, ShrineDetail } from "@/lib/api/shrines"
import RouteMap from "@/components/maps/RouteMap"

export default function ShrineDetailPage() {
  const params = useParams()
  const id = Number(params?.id)

  const [shrine, setShrine] = useState<ShrineDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // 仮の現在地（東京駅）
  const [origin] = useState({ lat: 35.681236, lng: 139.767125 })

  useEffect(() => {
    if (!id) return
    getShrineDetail(id)
      .then((data) => setShrine(data))
      .catch(() => setError("神社データの取得に失敗しました"))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-4">読み込み中...</p>
  if (error) return <p className="p-4 text-red-500">{error}</p>
  if (!shrine) return <p className="p-4">神社が見つかりません</p>

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-2">{shrine.name_jp}</h1>
      <p className="text-gray-600 mb-4">{shrine.address}</p>

      {shrine.goriyaku && (
        <section className="mb-4">
          <h2 className="font-semibold">ご利益</h2>
          <p>{shrine.goriyaku}</p>
        </section>
      )}

      {shrine.sajin && (
        <section className="mb-4">
          <h2 className="font-semibold">祭神</h2>
          <p>{shrine.sajin}</p>
        </section>
      )}

      {shrine.goriyaku_tags?.length > 0 && (
        <section className="mb-4">
          <h2 className="font-semibold">タグ</h2>
          <ul className="flex flex-wrap gap-2 mt-1">
            {shrine.goriyaku_tags.map((tag) => (
              <li
                key={tag.id}
                className="px-2 py-1 bg-gray-200 rounded text-sm"
              >
                {tag.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- ✅ Google Maps のルート表示 --- */}
      <section className="mt-6">
        <h2 className="font-semibold mb-2">ルート案内</h2>
        <RouteMap
          origin={origin}
          destination={{ lat: shrine.latitude, lng: shrine.longitude }}
        />
      </section>
    </main>
  )
}

