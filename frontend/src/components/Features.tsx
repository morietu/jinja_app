"use client";

import { Sparkles, MapPin, Star } from "lucide-react";

type Props = {
  setCurrentView: (v: "home" | "consultation" | "route" | "ranking") => void;
};

export default function Features({ setCurrentView }: Props) {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-bold mb-8 text-center">機能メニュー</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {/* AIコンシェルジュ */}
          <div
            className="p-6 flex flex-col items-center justify-center text-center border rounded-lg hover:shadow-lg transition cursor-pointer"
            onClick={() => setCurrentView("consultation")}
          >
            <Sparkles className="w-10 h-10 text-pink-500 mb-3" />
            <p className="font-semibold">AIコンシェルジュ</p>
            <p className="text-sm text-gray-600">
              あなたの運勢に基づいた神社診断
            </p>
          </div>

          {/* ルート検索 */}
          <div
            className="p-6 flex flex-col items-center justify-center text-center border rounded-lg hover:shadow-lg transition cursor-pointer"
            onClick={() => setCurrentView("route")}
          >
            <MapPin className="w-10 h-10 text-blue-500 mb-3" />
            <p className="font-semibold">最適ルート検索</p>
            <p className="text-sm text-gray-600">
              現在地から神社までの最短ルートを表示
            </p>
          </div>

          {/* 人気神社ランキング */}
          <div
            className="p-6 flex flex-col items-center justify-center text-center border rounded-lg hover:shadow-lg transition cursor-pointer"
            onClick={() => setCurrentView("ranking")}
          >
            <Star className="w-10 h-10 text-yellow-500 mb-3" />
            <p className="font-semibold">人気神社ランキング</p>
            <p className="text-sm text-gray-600">
              口コミやアクセス数で人気の神社
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
