"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// 仮の型
type Shrine = {
  id: number;
  name_jp: string;
  address: string;
};

type Visit = {
  id: number;
  shrine: Shrine;
  visited_at: string;
};

export default function MyPageView({ onBack }: { onBack: () => void }) {
  const [favorites, setFavorites] = useState<Shrine[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // TODO: API接続に置き換え
        setFavorites([
          { id: 1, name_jp: "明治神宮", address: "東京都渋谷区代々木神園町1-1" },
        ]);
        setVisits([
          {
            id: 1,
            shrine: { id: 2, name_jp: "伏見稲荷大社", address: "京都市伏見区" },
            visited_at: "2025-08-25",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <p className="p-4">読み込み中...</p>;

  return (
    <div className="p-6 space-y-8">
      <button onClick={onBack} className="text-blue-500 mb-4">← 戻る</button>

      {/* プロフィール */}
      <section>
        <h2 className="text-xl font-bold mb-4">プロフィール</h2>
        <Card>
          <CardHeader>
            <CardTitle>ユーザー名 (仮)</CardTitle>
          </CardHeader>
          <CardContent>
            <p>ここに自己紹介やアイコンを表示予定</p>
          </CardContent>
        </Card>
      </section>

      {/* お気に入り神社 */}
      <section>
        <h2 className="text-xl font-bold mb-4">お気に入り神社</h2>
        <div className="space-y-3">
          {favorites.map((shrine) => (
            <Card key={shrine.id}>
              <CardHeader>
                <CardTitle>{shrine.name_jp}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{shrine.address}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 参拝履歴 */}
      <section>
        <h2 className="text-xl font-bold mb-4">参拝履歴</h2>
        <ul className="space-y-2">
          {visits.map((visit) => (
            <li key={visit.id} className="border rounded p-3">
              <p className="font-semibold">{visit.shrine.name_jp}</p>
              <p className="text-sm text-gray-500">{visit.visited_at}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
