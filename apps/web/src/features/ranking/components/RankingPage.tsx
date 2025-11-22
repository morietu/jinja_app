// apps/web/src/features/ranking/components/RankingPage.tsx
"use client";

import { useState } from "react";
import type { ShrineRankingItem } from "../types";
import { RankingList } from "./RankingList";

type Period = "weekly" | "monthly" | "yearly";

const PERIOD_LABEL: Record<Period, string> = {
  weekly: "週間",
  monthly: "月間",
  yearly: "年間",
};

// 仮のダミーデータ（API実装後に削除）
const mockItems: ShrineRankingItem[] = [
  {
    id: "1",
    name: "明治神宮",
    address: "東京都渋谷区代々木神園町1-1",
    rank: 1,
    favorites: 120,
    views: 340,
  },
  {
    id: "2",
    name: "伏見稲荷大社",
    address: "京都府京都市伏見区深草藪之内町68",
    rank: 2,
    favorites: 95,
    views: 280,
  },
];

export default function RankingPage() {
  const [period, setPeriod] = useState<Period>("monthly");

  // TODO: 後でAPIフックに差し替え
  // const { data, loading, error } = useShrineRanking(period);
  const loading = false;
  const error = null as string | null;
  const items = mockItems;

  return (
    <div className="flex h-full flex-col rounded-2xl border bg-white shadow-sm">
      {/* タブ（週間 / 月間 / 年間） */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="inline-flex rounded-full bg-gray-100 p-1 text-xs">
          {(["weekly", "monthly", "yearly"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full px-3 py-1 ${
                period === p ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400">{PERIOD_LABEL[period]} TOP10</p>
      </div>

      {/* 中身 */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading && <p className="px-2 py-4 text-xs text-gray-500">ランキングを読み込み中です…</p>}

        {error && !loading && (
          <p className="px-2 py-4 text-xs text-red-600">
            ランキングの取得に失敗しました。時間をおいて再度お試しください。
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="px-2 py-4 text-xs text-gray-500">まだランキングデータがありません。</p>
        )}

        {!loading && !error && items.length > 0 && <RankingList items={items} />}
      </div>
    </div>
  );
}
