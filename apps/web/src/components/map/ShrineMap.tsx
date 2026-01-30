// apps/web/src/components/map/ShrineMap.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import { GoogleMap, Marker, useLoadScript } from "@react-google-maps/api";
import { useRouter, useSearchParams } from "next/navigation";
import { resolvePlace } from "@/lib/api/places";

type MapMarker =
  | { kind: "db"; id: number; name: string; lat: number; lng: number }
  | { kind: "place"; place_id: string; name: string; lat: number; lng: number };

type Props = { markers: MapMarker[] };

const containerStyle = { width: "100%", height: "100%" };
const FALLBACK = { lat: 35.681236, lng: 139.767125 };

export default function ShrineMap({ markers }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
  });

  const clickable = useMemo(
    () => (markers ?? []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
    [markers],
  );

  const [center, setCenter] = useState(() =>
    clickable[0] ? { lat: clickable[0].lat, lng: clickable[0].lng } : FALLBACK,
  );
  const [zoom, setZoom] = useState(13);
  const [locError, setLocError] = useState<string | null>(null);

  const tid = sp.get("tid");
  const hrefSp = new URLSearchParams();
  hrefSp.set("ctx", "map");
  if (tid) hrefSp.set("tid", tid);

  const handleLocate = useCallback(() => {
    setLocError(null);
    if (!navigator.geolocation) return setLocError("現在地取得に対応していない端末です");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setZoom(15);
      },
      () => setLocError("現在地を取得できませんでした"),
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
        options={{ disableDefaultUI: true, zoomControl: true }}
      >
        {clickable.map((m) => (
          <Marker
            key={m.kind === "db" ? `db:${m.id}` : `place:${m.place_id}`}
            position={{ lat: m.lat, lng: m.lng }}
            title={m.name}
            onClick={async () => {
              const q = hrefSp.toString();
              if (m.kind === "db") {
                router.push(`/shrines/${m.id}?${q}`);
                return;
              }
              try {
                const r = await resolvePlace(m.place_id);
                router.push(`/shrines/${r.shrine_id}?${q}`);
              } catch {
                // 最悪フォールバック（resolve落ちたら旧ルートへ）
                const qs = new URLSearchParams(q);
                qs.set("place_id", m.place_id);
                router.push(`/shrines/resolve?${qs.toString()}`);
              }
            }}
          />
        ))}
      </GoogleMap>

      <button
        type="button"
        onClick={handleLocate}
        className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center text-lg active:scale-95"
        aria-label="現在地に移動"
      >
        📍
      </button>

      {locError && (
        <div className="absolute bottom-4 left-4 max-w-xs text-xs bg-black/70 text-white px-2 py-1 rounded">
          {locError}
        </div>
      )}
    </div>
  );
}
