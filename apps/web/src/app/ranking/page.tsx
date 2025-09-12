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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <main className="p-4 mx-auto">
      <h1 className="text-xl font-bold mb-4">人気神社ランキング</h1>

      <Tabs defaultValue="monthly">
        <TabsList className="flex justify-center mb-6">
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
        <li key={shrine.id ?? idx}>
          <Card
            className={`p-4 transition-colors duration-200 cursor-pointer
              ${
                idx === 0
                  ? "bg-yellow-50 border border-yellow-200 hover:border-yellow-400"
                  : idx === 1
                  ? "bg-gray-50 border border-gray-200 hover:border-gray-400"
                  : idx === 2
                  ? "bg-amber-50 border border-amber-200 hover:border-amber-400"
                  : "bg-white border hover:border-blue-300"
              }`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-lg">
                {/* 順位アイコン */}
                <span className="text-2xl">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                </span>
                <span className="font-bold">{shrine?.name_jp ?? "名称不明"}</span>
              </CardTitle>
            </CardHeader>


                
              <CardContent className="space-y-3">
                {/* 住所 */}
              <p className="text-sm text-gray-600">{shrine?.address ?? "住所不明"}</p>

              {/* ご利益タグ */}
              {shrine.goriyaku_tags?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {shrine.goriyaku_tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* 参拝数・お気に入り数 */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span>参拝数: {shrine.visit_count ?? 0}</span>
                <span>お気に入り: {shrine.favorite_count ?? 0}</span>
              </div>

              
            </CardContent>
          </Card>
        </li>
      ))}
    </ol>
  );
}