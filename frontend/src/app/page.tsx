"use client";

import { useEffect, useState } from "react";
import { Shrine, getShrines } from "@/lib/api/shrines";
import { fetchRanking, RankingItem } from "@/lib/api/ranking";
import { GoriyakuTag, getTags } from "@/lib/api/tags";
import RankingCard from "@/components/RankingCard";
import Link from "next/link";

export default function HomePage() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [shrines, setShrines] = useState<Shrine[]>([]);
  const [tags, setTags] = useState<GoriyakuTag[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ランキングTOP3
  useEffect(() => {
    fetchRanking("monthly")
      .then((data) => setRanking(data.slice(0, 3)))
      .catch(() => setError("ランキングの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  // 神社データ & タグ
  useEffect(() => {
    loadShrines();
    loadTags();
  }, []);

  const loadShrines = async (params: { name?: string; tags?: string[] } = {}) => {
    try {
      const data = await getShrines(params);
      setShrines(data);
      setError(null);
    } catch (err) {
      setError("神社データ取得に失敗しました");
      console.error(err);
    }
  };

  const loadTags = async () => {
    try {
      const data = await getTags();
      setTags(data);
    } catch (err) {
      console.error("タグ取得失敗:", err);
    }
  };

  const handleSearch = () => {
    loadShrines({ name: query, tags: selectedTags });
  };

  return (
    <main className="p-4 space-y-12">
      {/* 検索フォーム */}
      <section>
        <h1 className="text-xl font-bold mb-4">神社検索</h1>

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
      </section>

      {/* 人気神社ランキング */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">人気神社ランキング（月間TOP3）</h2>
          <Link href="/ranking" className="text-sm text-blue-600 hover:underline">
            もっと見る →
          </Link>
        </div>

        {loading && <p>読み込み中...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && ranking.length === 0 && <p>ランキングデータがありません</p>}

        <ol className="space-y-4">
          {ranking.map((shrine, idx) => (
            <li key={shrine.id} className="flex items-start gap-2">
              <span className="text-xl font-bold w-6">{idx + 1}</span>
              <RankingCard shrine={shrine} rank={idx + 1} />
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
