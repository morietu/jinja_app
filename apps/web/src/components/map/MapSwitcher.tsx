// apps/web/src/components/map/MapSwitcher.tsx
"use client";

import { useMemo } from "react";

export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };

type Props = {
  initial: "maplibre" | "google";
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
  className?: string;
};

export default function MapSwitcher({
  initial,
  center,
  zoom = 13,
  markers = [],
  className,
}: Props) {
  const provider = useMemo<"maplibre" | "google">(() => initial, [initial]);

  if (provider === "google") {
    const GoogleMap = require("./providers/GoogleMap").default;
    return (
      <GoogleMap
        center={center}
        zoom={zoom}
        markers={markers}
        className={className}
      />
    );
  }

  const MapLibreMap = require("./providers/MapLibreMap").default;
  return (
    <MapLibreMap
      center={center}
      zoom={zoom}
      markers={markers}
      className={className}
    />
  );
}
