"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RankingItem } from "@/lib/api/ranking";

export default function RankingCard({ shrine, rank }: { shrine: RankingItem; rank: number }) {
  const router = useRouter();

  return (
    <Card
      className="hover:shadow-md transition cursor-pointer"
      onClick={() => router.push(`/shrines/${shrine.id}`)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-700">{rank}</span>
          <span className="text-blue-600 hover:underline">{shrine.name_jp}</span>
        </CardTitle>
        <CardDescription>{shrine.address}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-500">スコア: {shrine.score}</p>
      </CardContent>
    </Card>
  );
}
