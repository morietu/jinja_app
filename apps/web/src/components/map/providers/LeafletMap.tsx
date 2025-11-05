"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";

type LatLng = { lat: number; lng: number };
type Marker = { id: string; position: LatLng; label?: string };

export default function LeafletMap({
  center,
  zoom = 14,
  markers = [],
}: {
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<L.Map | null>(null);



  useEffect(() => {
    if (!mapRef.current) return;

    // 既存インスタンスがあれば破棄して作り直し
    if (instanceRef.current) {
      instanceRef.current.remove();
      instanceRef.current = null;
    }

    const map = L.map(mapRef.current).setView([center.lat, center.lng], zoom);
    instanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    markers.forEach((m) => {
      const marker = L.marker([m.position.lat, m.position.lng]).addTo(map);
      if (m.label) marker.bindPopup(m.label);
    });

    return () => {
      map.remove();
    };
  }, [center, markers, zoom]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
}
