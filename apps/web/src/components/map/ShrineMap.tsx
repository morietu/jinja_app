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

  // 最初のセンター（神社があればその位置、なければ東京駅）
  const initialCenter = useMemo(() => {
    if (markers.length > 0) {
      return {
        lat: Number(markers[0].latitude),
        lng: Number(markers[0].longitude),
      };
    }
    return { lat: 35.681236, lng: 139.767125 }; // fallback: 東京駅
  }, [markers]);

  // 現在の center / zoom を state で持つ
  const [center, setCenter] = useState(initialCenter);
  const [zoom, setZoom] = useState(13);

  // 現在地取得の状態＆エラー
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const handleLocateMe = () => {
    if (!("geolocation" in navigator)) {
      setLocError("この端末では位置情報が利用できません");
      return;
    }

    setLocLoading(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter({ lat: latitude, lng: longitude });
        setZoom(15); // ちょっと寄る
        setLocLoading(false);
      },
      () => {
        setLocError("位置情報を取得できませんでした");
        setLocLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  if (loadError) {
    return (
      <div className="h-64 w-full rounded-lg bg-red-50 flex items-center justify-center text-sm text-red-500">
        地図の読み込みに失敗しました
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="h-64 w-full rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500">
        地図を読み込み中…
      </div>
    );
  }

  return (
    <div className="relative h-64 w-full rounded-lg overflow-hidden">
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
            onClick={() => {
              router.push(`/shrines/${s.id}`);
            }}
          />
        ))}
      </GoogleMap>

      {/* 現在地ボタン（右下） */}
      <button
        type="button"
        onClick={handleLocateMe}
        disabled={locLoading}
        className="absolute bottom-3 right-3 rounded-full bg-white shadow-md border text-xs px-3 py-2 disabled:opacity-60"
      >
        {locLoading ? "現在地取得中…" : "現在地"}
      </button>

      {/* エラーメッセージ（左下・小さく） */}
      {locError && (
        <div className="absolute bottom-3 left-3 text-[11px] px-2 py-1 rounded bg-black/70 text-white">{locError}</div>
      )}
    </div>
  );
}
