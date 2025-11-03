"use client";
import dynamic from "next/dynamic";

export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };

const LeafletMap = dynamic(() => import("@/components/maps/providers/LeafletMap"), { ssr: false });
const GoogleMap  = dynamic(() => import("@/components/maps/providers/GoogleMap"),  { ssr: false });

type Props = {
  initial?: "leaflet" | "google";
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
};

export default function MapSwitcher({ initial = "leaflet", center, zoom = 14, markers = [] }: Props) {
  return initial === "leaflet"
    ? <LeafletMap center={center} zoom={zoom} markers={markers} />
    : <GoogleMap  center={center} zoom={zoom} markers={markers} />;
}
