// apps/web/src/components/map/providers/GoogleMap.tsx
"use client";

import { useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";

type LatLng = { lat: number; lng: number };
type Marker = { id: string; position: LatLng; label?: string };

export default function GoogleMap({
  center,
  zoom = 13,
  markers = [],
  className,
}: {
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerObjs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
      const loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string,
        version: "weekly",
        libraries: ["places"],
      });

      await loader.load();

      const { Map } = (await google.maps.importLibrary(
        "maps"
      )) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await google.maps.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;
      if (cancelled || !ref.current) return;

      // Map生成
      mapRef.current = new Map(ref.current, {
        center,
        zoom,
        disableDefaultUI: true,
      });

      // 既存マーカークリア
      markerObjs.current.forEach((m) => (m.map = null as any));
      markerObjs.current = [];

      // マーカー再描画
      markerObjs.current = markers.map((m) => {
        const el = document.createElement("div");
        el.style.cssText =
          "background:#2563eb;color:white;padding:2px 6px;border-radius:8px;font-size:12px;";
        el.textContent = m.label || "";
        return new AdvancedMarkerElement({
          map: mapRef.current!,
          position: m.position,
          content: el,
        });
      });
    })();

    return () => {
      cancelled = true;
      markerObjs.current.forEach((m) => (m.map = null as any));
      markerObjs.current = [];
      mapRef.current = null;
    };
  }, [center, markers, zoom]);

  return (
    <div ref={ref} className={className ?? "w-full h-[calc(100dvh-64px)]"} />
  );
}


