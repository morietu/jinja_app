// src/features/home/components/HomeRankingSection.tsx
"use client";

import Link from "next/link";

type ShrineRankingItem = {
  id: number;
  name: string;
  area: string;
  reason: string;
};

const mockRanking: ShrineRankingItem[] = [
  {
    id: 1,
    name: "赤坂氷川神社",
    area: "東京・赤坂",
    reason: "縁結びと仕事運の両方で人気",
  },
  {
    id: 2,
    name: "東京大神宮",
    area: "東京・飯田橋",
    reason: "恋愛成就の代表的な神社",
  },
  {
    id: 3,
    name: "日枝神社",
    area: "東京・永田町",
    reason: "出世・仕事運のご利益で知られる",
  },
];

export function HomeRankingSection() {
  const items = mockRanking; // TODO: 後でAPI連携に差し替え

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-50">今人気の神社ランキング（30日）</h2>
          <p className="text-[11px] text-slate-300">最近30日間のスコア（お気に入り数＋閲覧数）で集計しています。</p>
        </div>
        <Link href="/ranking" className="text-xs font-medium text-amber-200 hover:underline underline-offset-2">
          ランキング詳細へ
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/shrines/${item.id}`}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs shadow-sm transition active:scale-[0.99]"
          >
            <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <span className="text-[10px] text-slate-500">{item.area}</span>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-600">{item.reason}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
