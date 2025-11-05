"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { LatLng, Marker } from "@/components/map/MapSwitcher";

const MapSwitcher = dynamic(() => import("@/components/map/MapSwitcher"), {
  ssr: false,
});

export default function MapPage() {
  const center: LatLng = { lat: 35.681236, lng: 139.767125 };
  const markers: Marker[] = [{ id: "tokyo", position: center, label: "Tokyo" }];

  const disableExternal = process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_APIS === "1";
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // ここは "google" | "maplibre" でOK
  const [provider, setProvider] = useState<"google" | "maplibre">("google");

  useEffect(() => {
    if (disableExternal || !googleKey) setProvider("maplibre");
  }, [disableExternal, googleKey]);

  const ui = useMemo(
    () => (
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setProvider("maplibre")}
          disabled={provider === "maplibre"}
        >
          MapLibre
        </button>
        <button
          onClick={() => setProvider("google")}
          disabled={disableExternal || !googleKey || provider === "google"}
          title={
            disableExternal
              ? "DISABLE_EXTERNAL_APIS=1 なので無効"
              : !googleKey
              ? "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY 未設定"
              : ""
          }
        >
          Google
        </button>
      </div>
    ),
    [provider, disableExternal, googleKey]
  );

  return (
    <main style={{ padding: 16 }}>
      {ui}
      <div
        style={{
          width: "100%",
          height: 480,
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <MapSwitcher
          initial={provider}
          center={center}
          zoom={14}
          markers={markers}
        />
      </div>
    </main>
  );
}
