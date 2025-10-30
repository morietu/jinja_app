"use client";
import React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";


// 型（必要最低限）
type LatLng = { lat: number; lng: number };
type Marker = { id: string; position: LatLng; label?: string };
type Provider = "leaflet" | "google";

// 動的 import（SSR 回避）
const LeafletMap = dynamic(() => import("./providers/LeafletMap"), { ssr: false });
const GoogleMap = dynamic(() => import("./providers/GoogleMap"), { ssr: false });

export default function MapSwitcher(props: {
  initial?: Provider;
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
}) {
  const [provider, setProvider] = useState<Provider>(props.initial ?? "leaflet");

  const disableExternal = process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_APIS === "1";
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // env 的に Google が使えないときは強制 Leaflet
  useEffect(() => {
    if (disableExternal || !googleKey) setProvider("leaflet");
  }, [disableExternal, googleKey]);

  const ui = useMemo(
    () => (
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button
          onClick={() => setProvider("leaflet")}
          disabled={provider === "leaflet"}
          style={{ padding: "6px 10px" }}
        >
          Leaflet
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
          style={{ padding: "6px 10px" }}
        >
          Google
        </button>
      </div>
    ),
    [provider, disableExternal, googleKey]
  );

  return (
    <div>
      {ui}
      <div style={{ width: "100%", height: 480, borderRadius: 12, overflow: "hidden" }}>
        {provider === "google" ? (
          <GoogleMap center={props.center} zoom={props.zoom ?? 14} markers={props.markers ?? []} />
        ) : (
          <LeafletMap center={props.center} zoom={props.zoom ?? 14} markers={props.markers ?? []} />
        )}
      </div>
      <p style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
        Provider: <b>{provider}</b>{" "}
        {disableExternal && "(external APIs disabled by env)"}
      </p>
    </div>
  );
}
