// apps/web/src/app/search/DbSearchSection.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ShrineCard from "@/components/ShrineCard";
import api from "@/lib/api/client";
import { getShrines, type Shrine } from "@/lib/api/shrines";
import type { GoriyakuTag } from "@/lib/api/types";

export default function DbSearchSection({ keyword }: { keyword: string }) {
  const [shrines, setShrines] = useState<Shrine[]>([]);
  const [tags, setTags] = useState<GoriyakuTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ご利益タグ一覧
  useEffect(() => {
    let mounted = true;
    api
      .get("/goriyaku-tags/")
      .then((res) => mounted && setTags(res.data ?? []))
      .catch(() => mounted && setTags([]));
    return () => {
      mounted = false;
    };
  }, []);

  // 神社検索（keyword or tags があるときだけ）
  useEffect(() => {
    const hasCond =
      (keyword?.trim().length ?? 0) > 0 || selectedTags.length > 0;
    if (!hasCond) {
      setShrines([]);
      setLoading(false);
      setError(null);
      return;
    }

    let aborted = false;
    setLoading(true);
    (async () => {
      try {
        const q = [keyword, ...selectedTags].filter(Boolean).join(" ");
        const results = await getShrines({ q });
        if (!aborted) {
          setShrines(results);
          setError(null);
        }
      } catch (e) {
        if (!aborted) {
          console.error("検索エラー:", e);
          setError("検索に失敗しました");
          setShrines([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [keyword, selectedTags]);

  // ✅ カテゴリごとにグループ化（重複宣言しないように一意の名前に）
  const groupedTags = useMemo(() => {
    const acc: Record<string, GoriyakuTag[]> = {};
    for (const tag of tags) {
      (acc[tag.category] = acc[tag.category] ?? []).push(tag);
    }
    return acc;
  }, [tags]);

  const toggleTag = (name: string) =>
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );

  return (
    <section className="space-y-6 border-t pt-6">
      <h2 className="text-lg font-semibold">自前DBからの絞り込み（ご利益タグ）</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Object.entries(groupedTags).map(([category, items]) => (
          <div key={category}>
            <h3 className="font-medium mb-2">{category}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map((tag) => (
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
        <p className="p-2">読み込み中...</p>
      ) : error ? (
        <p className="p-2 text-red-500">{error}</p>
      ) : shrines.length === 0 ? (
        <p className="text-gray-500">該当する神社はありませんでした</p>
      ) : (
        <ul className="grid gap-4">
          {shrines.map((shrine) => (
            <li key={shrine.id}>
              <Link href={`/shrines/${shrine.id}`}>
                <ShrineCard shrine={shrine} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
