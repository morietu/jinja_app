"use client"
import { useEffect, useState } from "react"
import { Shrine } from "@/lib/api/shrines"
// ⚠️ Sentry を使う場合は適切に import が必要です
// import * as Sentry from "@sentry/nextjs"

type GoriyakuTag = {
  id: number
  name: string
}

export default function HomePage() {
  const [shrines, setShrines] = useState<Shrine[]>([])
  const [tags, setTags] = useState<GoriyakuTag[]>([])
  const [query, setQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([]) // ← 配列に変更
  const [error, setError] = useState<string | null>(null)

  const fetchShrines = async (params: { name?: string; tags?: string[] } = {}) => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_BASE}/api/shrines/`
      const queryParams = new URLSearchParams()
      if (params.name) queryParams.append("name", params.name)
      if (params.tags && params.tags.length > 0) {
        params.tags.forEach((t) => queryParams.append("tag", t)) // ← 1つずつ追加
      }
      if (queryParams.toString()) url += `?${queryParams.toString()}`

      const res = await fetch(url)
      if (!res.ok) {
        const errText = await res.text() // JSON以外でも拾えるように

        if (process.env.NODE_ENV === "development") {
          console.error("Fetch failed:", {
            url,
            status: res.status,
            statusText: res.statusText,
            body: errText,
          })
        } else {
          // 本番では Sentry に送る
          Sentry.captureException(
            new Error(`Shrine API failed: ${res.status} ${res.statusText}`),
            {
              extra: { url, body: errText },
            }
          )
        }
        throw new Error(`APIエラー (${res.status})`)
      }

      const data = await res.json()
      setShrines(data)
      setError(null)
    } catch (err: unknown) {
      // ユーザー向けには簡潔なエラー
      setError("神社データ取得に失敗しました。時間をおいて再度お試しください。")

      // 開発者向け詳細ログ
      if (process.env.NODE_ENV === "development") {
        console.error("Shrine fetch error:", err)
      }
    }
  }

  const fetchTags = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/api/goriyaku-tags/`)
    const data = await res.json()
    setTags(data)
  }

  useEffect(() => {
    fetchShrines()
    fetchTags()
  }, [])

  // タグ選択が変わったら検索実行
  useEffect(() => {
    if (selectedTags.length > 0) {
      fetchShrines({ tags: selectedTags })
    }
  }, [selectedTags])

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">神社検索</h1>

      {/* 名前検索 */}
      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="神社名で検索"
          className="border rounded p-2 flex-1"
        />
        <button
          onClick={() => fetchShrines({ name: query })}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          検索
        </button>
      </div>

      {/* ご利益タグ検索 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() =>
              setSelectedTags((prev) =>
                prev.includes(tag.name)
                  ? prev.filter((t) => t !== tag.name) // 解除
                  : [...prev, tag.name] // 追加
              )
            }
            className={`px-3 py-1 rounded border ${
              selectedTags.includes(tag.name)
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>

      {error && <div className="text-red-500">エラー: {error}</div>}

      {/* 検索結果リスト */}
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
