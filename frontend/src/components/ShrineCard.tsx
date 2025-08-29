// src/components/ShrineCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

import { Shrine } from "@/lib/api/shrines";
import { toggleFavorite } from "@/lib/api/favorites";

export default function ShrineCard({ shrine }: { shrine: Shrine }) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(shrine.is_favorite);
  const [loading, setLoading] = useState(false);

  const handleFavorite = async () => {
  const prev = isFavorite;
  setIsFavorite(!prev);
  try {
    setLoading(true);
    const result = await toggleFavorite(shrine.id);
    setIsFavorite(result.status === "added");
  } catch (err: any) {
    console.error("お気に入り操作エラー:", err);

    // 👇 401ならログインページに飛ばす
    if (err.response?.status === 401) {
      router.push("/mypage");
    } else {
      // 401以外なら元に戻す
      setIsFavorite(prev);
    }
  } finally {
    setLoading(false);
  }
};



  return (
    <Card className="hover:shadow-md transition">
      <CardHeader>
        <CardTitle>
          <Link
            href={`/shrines/${shrine.id}`}
            className="text-blue-600 hover:underline"
          >
            {shrine.name_jp}
          </Link>
        </CardTitle>
        <CardDescription>{shrine.address}</CardDescription>
      </CardHeader>

      <CardContent>
        {shrine.goriyaku && (
          <p className="text-sm mb-2">ご利益: {shrine.goriyaku}</p>
        )}

        {shrine.goriyaku_tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shrine.goriyaku_tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* ✅ お気に入りボタン */}
        <button
          onClick={handleFavorite}
          disabled={loading}
          className={`px-3 py-1 rounded text-sm ${
            isFavorite
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-gray-200 hover:bg-gray-300"
          }`}
        >
          {loading
            ? "処理中..."
            : isFavorite
            ? "お気に入り解除"
            : "お気に入り追加"}
        </button>
      </CardContent>
    </Card>
  );
}
