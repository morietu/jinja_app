"use client";

import { useMemo } from "react";
import GoogleMap from "@/components/map/providers/GoogleMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import NearbyPlaces from "@/components/NearbyPlaces";

export default function MapScreenLayout() {
  const { coords } = useGeolocation();
  const center = useMemo(() => coords ?? { lat: 35.681236, lng: 139.767125 }, [coords]);

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

          <div className="px-4 pb-2">
            <p className="text-xs font-semibold text-gray-700">近くの神社</p>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <NearbyPlaces />
          </div>
        </div>
      </div>
    </div>
  );
}
