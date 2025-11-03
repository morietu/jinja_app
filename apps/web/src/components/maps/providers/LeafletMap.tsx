// apps/web/src/components/maps/providers/LeafletMap.tsx
"use client";

export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };

export default function LeafletMap({
  center,
  zoom = 13,
  markers = [],
}: {
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
}) {
  // mark as used for eslint/no-unused-vars
  void center;
  void zoom;
  void markers;

  return (
    <div style={{ width: "100%", height: "100%" }} data-testid="leaflet-map" />
  );
}
