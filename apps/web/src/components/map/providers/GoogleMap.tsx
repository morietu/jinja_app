// apps/web/src/components/map/providers/GoogleMap.tsx
"use client";
import { useEffect, useRef } from "react";

type LatLng = { lat: number; lng: number };
type Marker = { id: string; position: LatLng; label?: string };

declare global {
  interface Window {
    google?: any;
  }
}

function loadGoogleMaps(key: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.maps) return resolve();

    const existed = document.getElementById("google-maps-sdk");
    if (existed) {
      existed.addEventListener("load", () => resolve());
      return;
    }

    const s = document.createElement("script");
    s.id = "google-maps-sdk";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key
    )}&libraries=marker`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

export default function GoogleMap({
  center,
  zoom = 14,
  markers = [],
}: {
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
}) {
  const disabled = process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_APIS === "1";
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const wrapRef = useRef<HTMLDivElement>(null);

  if (disabled || !key) {
    return (
      <div className="absolute inset-0 grid place-items-center text-sm">
        Google Maps は無効（環境変数で OFF / キー未設定）
      </div>
    );
  }

  useEffect(() => {
    if (!wrapRef.current || !key) return;

    let map: google.maps.Map | null = null;
    let pins: google.maps.marker.AdvancedMarkerElement[] = [];

    loadGoogleMaps(key)
      .then(() => {

        map = new window.google.maps.Map(wrapRef.current!, {
          center,
          zoom,
          mapId: "DEMO_MAP", // 任意
          disableDefaultUI: true,
        });

        const { AdvancedMarkerElement } = window.google.maps.marker;
        pins = markers.map(
          (m) =>
            new AdvancedMarkerElement({
              map,
              position: m.position,
              title: m.label,
            })
        );
      })
      .catch(console.error);

    return () => {
      pins.forEach((p) => (p.map = null));
      pins = [];
      map = null;
    };
  }, [key, center.lat, center.lng, zoom, JSON.stringify(markers)]);

  return <div ref={wrapRef} style={{ width: "100%", height: "100%" }} />;
}
