// apps/web/src/features/ranking/components/RankingPage.tsx
"use client";

import { useEffect, useState } from "react";
import type { ShrineRankingItem } from "../types";
import { RankingList } from "./RankingList";
import type { Shrine } from "@/lib/api/shrines";
import { getPopularShrines } from "@/lib/api/shrines";

type Period = "weekly" | "monthly" | "yearly";

const PERIOD_LABEL: Record<Period, string> = {
  weekly: "週間",
  monthly: "月間",
  yearly: "年間",
};

export default function RankingPage() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [items, setItems] = useState<ShrineRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 今は period ごとの差はつけず、どのタブでも同じAPIを叩く（将来差分実装）
    setLoading(true);
    setError(null);

    getPopularShrines({ limit: 10 })
      .then((shrines: Shrine[]) => {
        if (cancelled) return;

        const mapped: ShrineRankingItem[] = shrines.map((s: Shrine, index: number) => ({
          id: s.id, // ★ String(...) をやめて number のまま
          name: (s as any).name_jp ?? (s as any).name ?? "",
          address: (s as any).address ?? "",
          rank: index + 1,
          favorites: (s as any).favorites_30d ?? (s as any).favorites ?? undefined,
          views: (s as any).visits_30d ?? (s as any).views ?? undefined,
        }));

        setItems(mapped);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "unknown error");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []); // period でフィルタ変えるならここに period を入れる

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
