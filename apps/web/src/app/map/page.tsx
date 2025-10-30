"use client";
import dynamic from "next/dynamic";
import MapSwitcher from "@/components/map/MapSwitcher";

const MapSwitcher = dynamic(() => import("@/components/map/MapSwitcher"), { ssr: false });

export default function MapPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontWeight: 700, marginBottom: 12 }}>Map preview</h1>
      <MapSwitcher
        initial="leaflet"
        center={{ lat: 35.6812, lng: 139.7671 }}
        zoom={14}
        markers={[
          { id: "tokyo", position: { lat: 35.6812, lng: 139.7671 }, label: "東京駅" },
        ]}
      />
    </main>
  );
}
