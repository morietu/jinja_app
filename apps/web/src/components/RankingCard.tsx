// src/components/RankingCard.tsx
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
        <p className="text-xs text-gray-500 mb-2">スコア: {shrine.score}</p>

        {shrine.goriyaku_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shrine.goriyaku_tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
