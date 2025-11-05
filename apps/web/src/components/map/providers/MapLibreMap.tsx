// apps/web/src/components/map/providers/MapLibreMap.tsx
"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type LatLng = { lat: number; lng: number };
type Marker = { id: string; position: LatLng; label?: string };

export default function MapLibreMap({
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
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: "https://demotiles.maplibre.org/style.json", // TODO: 後で商用スタイルへ
      center: [center.lng, center.lat],
      zoom,
    });

    // マーカー描画
    markersRef.current = markers.map((m) => {
      const el = document.createElement("div");
      el.style.cssText =
        "background:#e11d48;color:white;padding:2px 6px;border-radius:8px;font-size:12px;";
      el.textContent = m.label || "";
      return new maplibregl.Marker({ color: "#ef4444", element: el })
        .setLngLat([m.position.lng, m.position.lat])
        .addTo(map);
    });

    return () => {
      markersRef.current.forEach((mk) => mk.remove());
      map.remove();
    };
  }, [center.lat, center.lng, zoom]);

  // マーカー更新（座標/件数が変わったとき）
  useEffect(() => {
    // NOTE: 簡易のため再生成
    // 本格運用では差分更新 or ソース/レイヤで管理推奨
  }, [markers]);

  return (
    <div ref={ref} className={className ?? "w-full h-[calc(100dvh-64px)]"} />
  );
}
