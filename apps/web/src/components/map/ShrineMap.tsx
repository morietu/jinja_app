// apps/web/src/components/map/ShrineMap.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import type { Shrine } from "@/lib/api/shrines";

type Props = {
  shrines: Shrine[];
};

const containerStyle = {
  width: "100%",
  height: "100%",
};

export default function ShrineMap({ shrines }: Props) {
  const router = useRouter();

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const markers = useMemo(() => shrines.filter((s) => s.latitude != null && s.longitude != null), [shrines]);

  const [center, setCenter] = useState(() => {
    if (markers.length > 0) {
      return {
        lat: Number(markers[0].latitude),
        lng: Number(markers[0].longitude),
      };
    }
    return { lat: 35.681236, lng: 139.767125 }; // 東京駅
  });

  const [zoom, setZoom] = useState(13);
  const [locError, setLocError] = useState<string | null>(null);

  const handleLocate = useCallback(() => {
    setLocError(null);

    if (!navigator.geolocation) {
      setLocError("現在地取得に対応していない端末です");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter({ lat: latitude, lng: longitude });
        setZoom(15);
      },
      () => {
        setLocError("現在地を取得できませんでした");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  if (loadError) {
    return (
      <div className="h-full w-full rounded-lg bg-red-50 flex items-center justify-center text-sm text-red-500">
        地図の読み込みに失敗しました
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500">
        地図を読み込み中…
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-xl overflow-hidden relative">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
        }}
      >
        {markers.map((s) => (
          <Marker
            key={s.id}
            position={{
              lat: Number(s.latitude),
              lng: Number(s.longitude),
            }}
            title={s.name_jp}
            onClick={() => router.push(`/shrines/${s.id}`)}
          />
        ))}
      </GoogleMap>

      {/* 現在地ボタン（右下の丸ボタン） */}
      <button
        type="button"
        onClick={handleLocate}
        className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-lg active:scale-95"
        aria-label="現在地に移動"
      >
        📍
      </button>

      {/* エラーメッセージ（左下に小さく） */}
      {locError && (
        <div className="absolute bottom-4 left-4 max-w-xs text-xs bg-black/70 text-white px-2 py-1 rounded">
          {locError}
        </div>
      )}
    </div>
  );
}
