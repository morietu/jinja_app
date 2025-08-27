"use client"

import { useEffect, useState } from "react"
import { Shrine, getShrines } from "@/lib/api/shrines"
import { GoriyakuTag, getTags } from "@/lib/api/tags"

export default function HomePage() {
  const [shrines, setShrines] = useState<Shrine[]>([])
  const [tags, setTags] = useState<GoriyakuTag[]>([])
  const [query, setQuery] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadShrines = async (params: { name?: string; tags?: string[] } = {}) => {
    try {
      const data = await getShrines(params)
      setShrines(data)
      setError(null)
    } catch (err) {
      setError("神社データ取得に失敗しました")
      console.error(err)
    }
  }

  const loadTags = async () => {
    try {
      const data = await getTags()
      setTags(data)
    } catch (err) {
      console.error("タグ取得失敗:", err)
    }
  }

  useEffect(() => {
    loadShrines()
    loadTags()
  }, [])

  const handleSearch = () => {
    loadShrines({ name: query, tags: selectedTags })
  }

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
          onClick={handleSearch}
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
                  ? prev.filter((t) => t !== tag.name)
                  : [...prev, tag.name]
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
