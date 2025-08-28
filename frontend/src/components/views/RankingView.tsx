"use client";

import { RankingItem } from "@/lib/api/ranking";
import RankingCard from "@/components/RankingCard";

type Props = {
  ranking: RankingItem[];
  loading: boolean;
  error: string | null;
  onBack: () => void;
};

export default function RankingView({
  ranking,
  loading,
  error,
  onBack,
}: Props) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-blue-500">
        ← 戻る
      </button>

      <h2 className="text-2xl font-bold mb-4">人気神社ランキング</h2>

      {loading && <p>読み込み中...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && ranking.length === 0 && (
        <p>ランキングデータがありません</p>
      )}

      <ol className="space-y-4">
        {ranking.map((shrine, idx) => (
          <li key={shrine.id} className="flex items-start gap-2">
            <span className="text-xl font-bold w-6">{idx + 1}</span>
            <RankingCard shrine={shrine} rank={idx + 1} />
          </li>
        ))}
      </ol>
    </div>
  );
}
