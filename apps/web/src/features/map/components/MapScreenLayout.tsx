"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GoogleMap from "@/components/map/providers/GoogleMap";

import { useGeolocation } from "@/hooks/useGeolocation";
import NearbyPlaces from "@/components/NearbyPlaces";

export default function MapScreenLayout() {
  const router = useRouter();
  const { coords } = useGeolocation();

  // どの place を選んだか
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const center = useMemo(() => coords ?? { lat: 35.681236, lng: 139.767125 }, [coords]);

  const ensureShrine = useCallback(async (placeId: string) => {
    const r = await fetch("/api/shrines/from-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    });
    if (!r.ok) throw new Error("from-place failed");
    return (await r.json()) as { shrine_id: number };
  }, []);

  const goFromPlace = useCallback(async () => {
    if (!selectedPlaceId) return;
    const { shrine_id } = await ensureShrine(selectedPlaceId);
    router.push(`/shrines/from-place/${shrine_id}?from=${encodeURIComponent("/map")}`);
  }, [selectedPlaceId, ensureShrine, router]);

  const markers: { id: string; position: { lat: number; lng: number }; label?: string }[] = [];

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="h-1/2 min-h-[220px] border-b">
        <GoogleMap center={center} zoom={13} markers={markers} className="h-full w-full" />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex justify-center py-2">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          <div className="flex items-center justify-between px-4 pb-2">
            <p className="text-xs font-semibold text-gray-700">近くの神社</p>

            {/* 選択済みの時だけ押せる */}
            <button
              type="button"
              onClick={goFromPlace}
              disabled={!selectedPlaceId}
              className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              この神社で続ける
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <NearbyPlaces
              limit={10}
              onSelectPlaceId={(pid) => setSelectedPlaceId(pid)}
              selectedPlaceId={selectedPlaceId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
