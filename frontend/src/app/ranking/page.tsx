"use client";
import { useEffect, useState } from "react";
import { getRanking, RankingItem } from "@/lib/api/ranking";
import ShrineCard from "@/components/ShrineCard";

export default function RankingPage() {
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRanking() // 年間ランキングを取得（MVPはこれだけ）
      .then(setRanking)
      .catch(() => setError("ランキングの取得に失敗しました"));
  }, []);

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">年間人気神社ランキング</h1>

      {error && <p className="text-red-500">{error}</p>}

      <ol className="space-y-4">
        {ranking.map((shrine, idx) => (
          <li key={shrine.id} className="flex items-start gap-2">
            <span className="text-xl font-bold w-6">{idx + 1}</span>
            <ShrineCard shrine={shrine} />
          </li>
        ))}
      </ol>
    </main>
  );
}
