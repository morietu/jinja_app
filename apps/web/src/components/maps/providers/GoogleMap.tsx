// apps/web/src/components/maps/providers/GoogleMap.tsx
"use client";
export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };
export default function GoogleMap({}: {
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
}) {
  return (
    <div style={{ width: "100%", height: "100%" }} data-testid="google-map" />
  );
}
