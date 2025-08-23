"use client"
import { useEffect, useState } from "react"
import { fetchShrines, Shrine } from "../lib/api"

export default function HomePage() {
  const [shrines, setShrines] = useState<Shrine[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShrines()
      .then(setShrines)
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <div>エラー: {error}</div>

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">神社一覧</h1>
      <ul className="space-y-2">
        {shrines.map((shrine) => (
          <li key={shrine.id} className="border p-2 rounded">
            <p className="font-semibold">{shrine.name_jp}</p>
            <p className="text-sm text-gray-500">{shrine.address}</p>
            <p className="text-sm">ご利益: {shrine.goriyaku}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
