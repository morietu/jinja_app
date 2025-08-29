"use client";

import { Sparkles, MapPin, Star, User } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { RankingItem } from "@/lib/api/ranking";

type Props = {
  setCurrentView: (v: "home" | "consultation" | "route" | "ranking") => void;
  ranking?: RankingItem[]; // TOP3を渡す
};

export default function Features({ setCurrentView, ranking = [] }: Props) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-bold mb-8 text-center">機能メニュー</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {/* AIコンシェルジュ */}
          <Card
            className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105"
            onClick={() => setCurrentView("consultation")}
          >
            <CardHeader className="flex flex-col items-center text-center">
              <Sparkles className="w-10 h-10 text-pink-500 mb-3" />
              <CardTitle>AIコンシェルジュ</CardTitle>
              <CardDescription>運勢に基づいた神社診断</CardDescription>
            </CardHeader>
          </Card>

          {/* ルート検索 */}
          <Card
            className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105"
            onClick={() => setCurrentView("route")}
          >
            <CardHeader className="flex flex-col items-center text-center">
              <MapPin className="w-10 h-10 text-blue-500 mb-2" />
              <CardTitle>最適ルート検索</CardTitle>
              <CardDescription>現在地から最短ルートを表示</CardDescription>
            </CardHeader>
          </Card>

          {/* 人気神社ランキング */}
          <Card
            className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105"
            onClick={() => setCurrentView("ranking")}
          >
            <CardHeader className="flex flex-col items-center text-center">
              <Star className="w-10 h-10 text-yellow-500 mb-2" />
              <CardTitle>人気神社ランキング</CardTitle>
              <CardDescription>今注目の神社TOP3</CardDescription>
            </CardHeader>

            <CardContent>
              {ranking.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">
                  データがありません
                </p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {ranking.slice(0, 3).map((shrine, idx) => (
                    <li key={shrine.id} className="flex justify-between">
                      <span
                        className={`font-bold ${
                          idx === 0
                            ? "text-yellow-500"
                            : idx === 1
                            ? "text-gray-400"
                            : "text-amber-700"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <Link
                        href={`/shrines/${shrine.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {shrine.name_jp}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* マイページ */}
          <Link href="/mypage">
            <Card className="cursor-pointer hover:shadow-xl transition-transform hover:scale-105">
              <CardHeader className="flex flex-col items-center text-center">
                <User className="w-10 h-10 text-green-500 mb-2" />
                <CardTitle>マイページ</CardTitle>
                <CardDescription>
                  お気に入りや参拝履歴を確認
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </section>
  );
}
