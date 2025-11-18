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
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">今人気の神社ランキング</h2>
        <span className="text-[10px] text-gray-400">お気に入り数・閲覧数ベース</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <Link
            key={item.id}
            href={`/shrines/${item.id}`}
            className="flex items-start gap-3 rounded-xl border bg-white px-3 py-2 text-xs shadow-sm active:scale-[0.99] transition"
          >
            <div className="mt-1 h-6 w-6 flex items-center justify-center rounded-full bg-gray-900 text-[11px] font-bold text-white">
              {index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{item.name}</p>
                <span className="text-[10px] text-gray-500">{item.area}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-600 leading-snug">{item.reason}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
