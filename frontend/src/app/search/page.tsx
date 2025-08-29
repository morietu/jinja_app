"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getShrines, Shrine } from "@/lib/api/shrines";
import { GoriyakuTag } from "@/lib/api/types";
import api from "@/lib/api/client";
import ShrineCard from "@/components/ShrineCard";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") || "";

  const [shrines, setShrines] = useState<Shrine[]>([]);
  const [tags, setTags] = useState<GoriyakuTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ご利益タグ一覧をロード
  useEffect(() => {
    api.get("/goriyaku-tags/").then((res) => setTags(res.data));
  }, []);

  // 神社検索
  useEffect(() => {
     // 🔍 条件が空なら検索しない
  if (!keyword && selectedTags.length === 0) {
    setShrines([]);
    setLoading(false);
    return;
  }

    const fetchData = async () => {
    setLoading(true);
    try {
      // 🔍 keyword と tags を q にまとめる
      const q = [keyword, ...selectedTags].filter(Boolean).join(" ");
      const results = await getShrines({ q });
      setShrines(results);
      setError(null);
    } catch (err) {
      console.error("検索エラー:", err);
      setError("検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };
    fetchData();
  }, [keyword, selectedTags]);

  // タグのON/OFF切り替え
  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName) // 選択解除
        : [...prev, tagName] // 選択追加
    );
  };

  // ✅ カテゴリごとにタグをグループ化
  const grouped = tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, GoriyakuTag[]>);

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">
        検索結果: 「{keyword}」
      </h1>

      {/* ✅ ご利益タグフィルタ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        {Object.entries(grouped).map(([category, tags]) => (
          <div key={category}>
            <h2 className="text-lg font-semibold mb-2">{category}</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.name)}
                  className={`w-full text-left px-3 py-2 rounded-full border text-sm ${
                    selectedTags.includes(tag.name)
                      ? "bg-blue-500 text-white border-blue-600"
                      : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 検索結果 */}
      {!keyword && selectedTags.length === 0 ? (
  <p className="text-gray-500">条件を入力して検索してください</p>
) : loading ? (
  <p className="p-4">読み込み中...</p>
) : error ? (
  <p className="p-4 text-red-500">{error}</p>
) : shrines.length === 0 ? (
  <p className="text-gray-500">該当する神社はありませんでした</p>
) : (
  <ul className="grid gap-4">
    {shrines.map((shrine) => (
      <li key={shrine.id}>
        <ShrineCard shrine={shrine} />
      </li>
    ))}
  </ul>
)}
    </main>
  );
}
