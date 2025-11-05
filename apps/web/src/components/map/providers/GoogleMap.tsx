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
      const loader = new Loader({ apiKey, version: "weekly" });
      const { Map } = (await loader.importLibrary("maps")) as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = (await loader.importLibrary("marker")) as google.maps.MarkerLibrary;

      if (cancelled || !ref.current) return;

      mapRef.current = new Map(ref.current, { center, zoom, disableDefaultUI: true });

      markerObjs.current.forEach((m) => (m.map = null as any));
      markerObjs.current = markers.map((m) => {
        const el = document.createElement("div");
        el.style.cssText = "background:#2563eb;color:white;padding:2px 6px;border-radius:8px;font-size:12px;";
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
  }, [center.lat, center.lng, zoom]);

  return <div ref={ref} className={className ?? "w-full h-[calc(100dvh-64px)]"} />;
}
