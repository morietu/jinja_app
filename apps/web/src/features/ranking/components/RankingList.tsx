// apps/web/src/features/ranking/components/RankingList.tsx
"use client";

import { useRouter } from "next/navigation";
import type { ShrineRankingItem } from "../types";

type Props = {
  items: ShrineRankingItem[];
};

export function RankingList({ items }: Props) {
  const router = useRouter();

  const handleClick = (id: number) => {
    router.push(`/shrines/${id}`);
  };

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-xs hover:bg-gray-50"
          onClick={() => handleClick(item.id)}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
              {item.rank}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
              {item.address && <p className="mt-0.5 text-[10px] text-gray-500 line-clamp-1">{item.address}</p>}
              <div className="mt-1 flex gap-2 text-[10px] text-gray-400">
                {item.favorites !== undefined && <span>★ {item.favorites.toLocaleString()} お気に入り</span>}
                {item.views !== undefined && <span>👀 {item.views.toLocaleString()} 閲覧</span>}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400">詳細へ</span>
        </li>
      ))}
    </ul>
  );
}
