"use client";

import { useMemo } from "react";
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

  // とりあえず先頭 or 東京駅あたりをセンターに
  const center = useMemo(() => {
    if (markers.length > 0) {
      return {
        lat: Number(markers[0].latitude),
        lng: Number(markers[0].longitude),
      };
    }
    return { lat: 35.681236, lng: 139.767125 }; // fallback
  }, [markers]);

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
    <div className="h-64 w-full rounded-lg overflow-hidden">
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
    </div>
  );
}
