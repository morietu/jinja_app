"use client";

import { useEffect, useState } from "react";
import { fetchRanking, RankingItem } from "@/lib/api/ranking";
import RankingCard from "@/components/RankingCard";
// shadcn/ui の Tabs コンポーネント
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

type Props = {
  onBack: () => void;
};

export default function RankingView({ onBack }: Props) {
  const [monthly, setMonthly] = useState<RankingItem[]>([]);
  const [yearly, setYearly] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchRanking("monthly").then(setMonthly),
      fetchRanking("yearly").then(setYearly),
    ])
      .catch(() => setError("ランキングの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-4">読み込み中...</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <main className="p-4">

      <h1 className="text-xl font-bold mb-4">人気神社ランキング</h1>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">月間TOP10</TabsTrigger>
          <TabsTrigger value="yearly">年間TOP10</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <RankingList data={monthly} />
        </TabsContent>

        <TabsContent value="yearly">
          <RankingList data={yearly} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function RankingList({ data }: { data: RankingItem[] }) {
  if (data.length === 0) {
    return <p className="p-4">ランキングデータがありません</p>;
  }

  return (
    <ol className="space-y-4">
      {data.map((shrine, idx) => (
        <li key={shrine.id} className="flex items-start gap-2">
          <span className="text-xl font-bold w-6">{idx + 1}</span>
          <RankingCard shrine={shrine} rank={idx + 1} />
        </li>
      ))}
    </ol>
  );
}
