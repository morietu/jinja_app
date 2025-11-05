"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/gmaps";

type MapProps = {
  lat: number;
  lon: number; // longitude
  zoom?: number;
  height?: number | string;
};

export default function Map({ lat, lon, zoom = 16, height = 360 }: MapProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const h = typeof height === "number" ? `${height}px` : height;

  const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!divRef.current || !hasKey) return;

    let cancelled = false;
    let map: google.maps.Map | null = null;
    let marker: google.maps.Marker | null = null;

    (async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !divRef.current) return;

        const center = { lat, lng: lon };

        map = new google.maps.Map(divRef.current, {
          center,
          zoom,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
          gestureHandling: "greedy",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        marker = new google.maps.Marker({ position: center, map, title: "Shrine" });
      } catch (e) {
        console.error("Failed to load Google Maps:", e);
      }
    })();

    return () => {
      cancelled = true;
      marker?.setMap(null);
      if (map) {
        google.maps.event.clearInstanceListeners(map);
      }
    };
  }, [lat, lon, zoom, hasKey]);

  if (!hasKey) {
    return (
      <div className="rounded border p-3 text-sm text-gray-600 bg-gray-50">
        地図を表示できません（APIキー未設定）
      </div>
    );
  }

  return <div ref={divRef} style={{ width: "100%", height: h }} />;
}
