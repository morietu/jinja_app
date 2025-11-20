// apps/web/src/components/map/ShrineMap.tsx
"use client";

import { useRouter } from "next/navigation";
import type { Shrine } from "@/lib/api/shrines";

type Props = {
  shrines: Shrine[];
};

export default function ShrineMap({ shrines }: Props) {
  const router = useRouter();

  const clickableShrines = shrines; // 後で latitude/longitude があるものだけに絞ってもOK

  return (
    <div className="space-y-3">
      {/* TODO: ここを既存の GoogleMap コンポーネントに差し替える */}
      <div className="h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500">
        {/* 仮のプレースホルダ */}
        地図コンポーネント（後で実装）
      </div>

      {/* とりあえずリストで確認できるようにしておく */}
      <ul className="space-y-2 text-sm">
        {clickableShrines.map((s) => (
          <li
            key={s.id}
            className="border rounded p-2 cursor-pointer hover:bg-gray-50"
            onClick={() => router.push(`/shrines/${s.id}`)}
          >
            <div className="font-semibold">{s.name_jp}</div>
            <div className="text-gray-600 text-xs">{s.address}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
