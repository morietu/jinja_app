"use client";

import { useEffect, useState } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import ConsultationView from "@/components/views/ConsultationView";
import RouteView from "@/components/views/RouteView";
import RankingView from "@/components/views/RankingView";
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
  const [currentView, setCurrentView] = useState<
    "home" | "consultation" | "route" | "ranking"
  >("home");

  // 初期データ読み込み
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [rankingData, shrineData, tagData] = await Promise.all([
          fetchRanking("monthly"),
          getShrines(),
          getTags(),
        ]);
        setRanking(rankingData.slice(0, 3)); // TOP3のみ
        setShrines(shrineData);
        setTags(tagData);
      } catch (err) {
        console.error(err);
        setError("データの読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // 神社検索
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

  const handleSearch = () => {
    loadShrines({ name: query, tags: selectedTags });
  };

  // ビュー切り替え
  if (currentView === "consultation") {
    return <ConsultationView onBack={() => setCurrentView("home")} />;
  }
  if (currentView === "route") {
    return <RouteView onBack={() => setCurrentView("home")} />;
  }
  if (currentView === "ranking") {
    return (
      <RankingView
        ranking={ranking}
        loading={loading}
        error={error}
        onBack={() => setCurrentView("home")}
      />
    );
  }

  // ホームビュー
  return (
    <main className="p-4 space-y-12">
      <Hero setCurrentView={setCurrentView} />
      <Features setCurrentView={setCurrentView} />

      {/* 🔍 神社検索 */}
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

        {/* ご利益タグ */}
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

      {/* ⭐ 人気神社ランキングTOP3 */}
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
