// apps/web/src/components/map/MapSwitcher.tsx
"use client";
import { useMemo } from "react";
import GoogleMap from "./providers/GoogleMap";
import MapLibreMap from "./providers/MapLibreMap";

export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };

// 正式: "maplibre" / "google"。過去互換: "leaflet" → "maplibre" に正規化
type Provider = "google" | "maplibre";
type LegacyProvider = "leaflet";
type AnyProvider = Provider | LegacyProvider;

export type MapSwitcherProps = {
  initial?: AnyProvider;
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
  origin?: LatLng | null;
  destination?: LatLng | null;
};

function normalizeProvider(p?: AnyProvider): Provider {
  if (p === "leaflet") return "maplibre";
  return (p as Provider) ?? "maplibre";
}

export default function MapSwitcher({
  initial = "maplibre",
  center,
  zoom = 14,
  markers = [],
  origin = null,
  destination = null,
}: MapSwitcherProps) {
  const provider = useMemo(() => normalizeProvider(initial), [initial]);

  if (provider === "google") {
    // まずはマーカーのみ（必要なら後で origin/destination 対応）
    return <GoogleMap center={center} zoom={zoom} markers={markers} />;
  }

  // MapLibre: 直線ルート & ピン対応
  return (
    <MapLibreMap
      center={center}
      zoom={zoom}
      markers={markers}
      origin={origin}
      destination={destination}
    />
  );
}
