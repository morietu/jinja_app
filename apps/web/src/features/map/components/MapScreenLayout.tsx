// apps/web/src/features/map/components/MapScreenLayout.tsx
"use client";

import { useMemo } from "react";
import GoogleMap from "@/components/map/providers/GoogleMap";
import NearbyShrines from "@/components/NearbyShrines";
import { useGeolocation } from "@/hooks/useGeolocation";

export default function MapScreenLayout() {
  const { coords } = useGeolocation();

  // 位置情報がまだ取れてない場合のフォールバック（東京駅あたり）
  const center = useMemo(
    () =>
      coords ?? {
        lat: 35.681236,
        lng: 139.767125,
      },
    [coords],
  );

  // ★ とりあえずマーカーは空配列（あとで近隣神社と紐付けてもOK）
  const markers: { id: string; position: { lat: number; lng: number }; label?: string }[] = [];

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      {/* 上：地図エリア */}
      <div className="h-1/2 min-h-[220px] border-b">
        <GoogleMap center={center} zoom={13} markers={markers} className="h-full w-full" />
      </div>

      {/* 下：近隣神社リスト */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          {/* つまみバー（ボトムシート風） */}
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          <div className="flex items-center justify-between px-4 pb-2">
            <p className="text-xs font-semibold text-gray-700">近くの神社</p>
            <p className="text-[10px] text-gray-400">距離順に最大10件まで表示</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {/* NearbyShrines は自分の中で useGeolocation + fetch するので center は渡さなくてOK */}
            <NearbyShrines limit={10} />
          </div>
        </div>
      </div>
    </div>
  );
}
