// apps/web/src/components/map/providers/GoogleMap.tsx
"use client";

import { useEffect, useRef, useMemo } from "react";
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
  const centerKey = `${center.lat},${center.lng}`;
  const markersKey = useMemo(
    () =>
      markers
        .map((m) => m.id ?? `${m.position.lat},${m.position.lng}`)
        .join("|"),
    [markers]
  );
  // effect内で参照する値はメモ化したものに限定（ルール回避＆無駄な再描画防止）
  const memoCenter = useMemo(() => ({ lat: center.lat, lng: center.lng }), [centerKey]);
  const memoMarkers = useMemo(() => markers, [markersKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
      const loader = new Loader({ apiKey, version: "weekly" });

      // 新しい AdvancedMarker を使う（v=weekly）
      const { Map } = (await loader.importLibrary(
        "maps"
      )) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await loader.importLibrary(
        "marker"
      )) as google.maps.MarkerLibrary;

      if (cancelled || !ref.current) return;

      mapRef.current = new Map(ref.current, {
        center: memoCenter,
        zoom,
        disableDefaultUI: true,
      });

      // 既存クリア
      markerObjs.current.forEach((m) => (m.map = null as any));
      markerObjs.current = [];

      // マーカー描画
      markerObjs.current = memoMarkers.map((m) => {
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
  }, [centerKey, markersKey, zoom]);

  // マーカー更新は簡易化（必要に応じて依存配列に markers を追加して再生成）
  return (
    <div ref={ref} className={className ?? "w-full h-[calc(100dvh-64px)]"} />
  );
}
