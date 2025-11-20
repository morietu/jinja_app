// apps/web/src/components/map/ShrineMap.tsx
"use client";

import { useMemo, useState } from "react";
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

  // lat/lng が入っている神社だけ使う
  const markers = useMemo(() => shrines.filter((s) => s.latitude != null && s.longitude != null), [shrines]);

  // 初期センター（先頭 or 東京駅）
  const initialCenter = useMemo(() => {
    if (markers.length > 0) {
      return {
        lat: Number(markers[0].latitude),
        lng: Number(markers[0].longitude),
      };
    }
    // fallback: 東京駅
    return { lat: 35.681236, lng: 139.767125 };
  }, [markers]);

  const [center, setCenter] = useState(initialCenter);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCurrentLocationClick = () => {
    setErrorMessage(null);

    if (!navigator.geolocation) {
      setErrorMessage("現在地が取得できませんでした");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter({
          lat: latitude,
          lng: longitude,
        });
      },
      () => {
        setErrorMessage("現在地の取得に失敗しました");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

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
    <div className="h-full w-full rounded-lg overflow-hidden relative">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
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
            onClick={() => {
              router.push(`/shrines/${s.id}`);
            }}
          />
        ))}
      </GoogleMap>

      {/* 現在地ボタン（右下の丸ボタン） */}
      <button
        type="button"
        onClick={handleCurrentLocationClick}
        className="absolute bottom-4 right-4 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center text-lg border border-gray-200 active:scale-95"
        aria-label="現在地に移動"
      >
        📍
      </button>

      {/* エラーメッセージ（あれば下に小さく表示） */}
      {errorMessage && (
        <div className="absolute left-4 bottom-4 mr-16 px-2 py-1 rounded bg-black/70 text-[11px] text-white">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
