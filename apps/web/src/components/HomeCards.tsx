// apps/web/src/components/HomeCards.tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // shadcn/ui 前提。なければ <a> に置換。
import { useAuth } from "@/lib/hooks/useAuth";

export default function HomeCards() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const next = `${pathname || "/"}${searchParams?.toString() ? `?${searchParams?.toString()}` : ""}`;
  const loginHref = `/login?next=${encodeURIComponent("/mypage/")}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 1) OpenAIコンシェルジュ */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>OpenAI コンシェルジュ</CardTitle>
          <CardDescription>参拝計画や御朱印の相談をAIに。</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild>
            <Link href="/concierge">開く</Link>
          </Button>
        </CardContent>
      </Card>

      {/* 2) 神社検索 */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>神社検索</CardTitle>
          <CardDescription>エリア・ご利益・タグで探す。</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild>
            <Link href="/shrines/search">検索する</Link>
          </Button>
        </CardContent>
      </Card>

      {/* 3) ランキング */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>らんきんぐ</CardTitle>
          <CardDescription>30日・月間・年間の人気TOP10。</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild>
            <Link href="/shrines/ranking?period=30d">見る</Link>
          </Button>
        </CardContent>
      </Card>

      {/* 4) マイページ導線（お気に入り一覧） */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle>マイページ</CardTitle>
          <CardDescription>お気に入り神社の一覧を表示。</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {isAuthenticated ? "ログイン済み" : "ログインが必要です"}
          </span>
          <Button asChild>
            <Link href={isAuthenticated ? "/mypage/" : loginHref}>
              {isAuthenticated ? "マイページへ" : "ログインして開く"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
