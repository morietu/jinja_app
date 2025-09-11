// apps/web/src/components/ShrineCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import axios from "axios";

import type { Shrine } from "@/lib/api/shrines";
import {
  toggleFavorite,
  addFavorite,
  removeFavorite,
} from "@/lib/api/favorites";
import { useAuth } from "@/lib/hooks/useAuth";

type Props = {
  shrine: Shrine;
  onToggled?: (isFav: boolean) => void;
};

export default function ShrineCard({ shrine, onToggled }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [isFavorite, setIsFavorite] = useState<boolean>(
    Boolean((shrine as any).is_favorite)
  );
  const [loading, setLoading] = useState(false);

  const goLoginWithReturn = () => {
    const next = `${pathname}${searchParams?.toString() ? `?${searchParams?.toString()}` : ""}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const handleFavorite = async () => {
    if (loading) return;

    // 未ログイン → ログイン画面へ誘導
    if (!isAuthenticated) {
      goLoginWithReturn();
      return;
    }

    const prev = isFavorite;
    // 楽観更新
    setIsFavorite(!prev);
    setLoading(true);

    try {
      // まずは標準のトグルAPI（/shrines/:id/favorite/）を試す
      const r = await toggleFavorite(shrine.id);
      const next = r.status === "added";
      setIsFavorite(next);
      onToggled?.(next);
    } catch (err: any) {
      // 401 → セッション切れ等。元に戻してログインへ。
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setIsFavorite(prev);
        goLoginWithReturn();
      }
      // 404 → トグルAPIが無い環境。/favorites/ にフォールバック
      else if (axios.isAxiosError(err) && err.response?.status === 404) {
        try {
          if (!prev) {
            await addFavorite(shrine.id);
            setIsFavorite(true);
            onToggled?.(true);
          } else {
            await removeFavorite(shrine.id);
            setIsFavorite(false);
            onToggled?.(false);
          }
        } catch (ee) {
          // フォールバック失敗 → ロールバック
          setIsFavorite(prev);
          console.error("お気に入り操作フォールバック失敗:", ee);
        }
      } else {
        // その他エラー → ロールバック
        setIsFavorite(prev);
        console.error("お気に入り操作エラー:", err);
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
        {(shrine as any).goriyaku && (
          <p className="text-sm mb-2">ご利益: {(shrine as any).goriyaku}</p>
        )}

        {!!(shrine as any).goriyaku_tags?.length && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(shrine as any).goriyaku_tags.map((tag: any) => (
              <span
                key={tag.id}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* ✅ ログイン時のみ活性化風（未ログインはクリックでログイン誘導） */}
        <button
          onClick={handleFavorite}
          disabled={loading}
          aria-pressed={isFavorite}
          className={`px-3 py-1 rounded text-sm ${
            isAuthenticated
              ? isFavorite
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-gray-200 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
          }`}
          title={
            isAuthenticated
              ? isFavorite
                ? "お気に入り解除"
                : "お気に入り追加"
              : "ログインでお気に入りが使えます"
          }
        >
          {loading
            ? "処理中..."
            : isAuthenticated
            ? isFavorite
              ? "お気に入り解除"
              : "お気に入り追加"
            : "ログインでお気に入り"}
        </button>
      </CardContent>
    </Card>
  );
}
