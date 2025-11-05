"use client";
import { useMemo } from "react";
import GoogleMap from "./providers/GoogleMap";
import MapLibreMap from "./providers/MapLibreMap";

export type LatLng = { lat: number; lng: number };
export type Marker = { id: string; position: LatLng; label?: string };

// ここを変更: "maplibre" を正式に採用し、後方互換で "leaflet" も受け取る
type Provider = "google" | "maplibre";
type LegacyProvider = "leaflet"; // 互換
type AnyProvider = Provider | LegacyProvider;

type Props = {
  initial?: AnyProvider;
  center: LatLng;
  zoom?: number;
  markers?: Marker[];
};

function normalizeProvider(p?: AnyProvider): Provider {
  if (p === "leaflet") return "maplibre";
  return p ?? "maplibre";
}

export default function MapSwitcher(props: Props) {
  const { center, zoom = 14, markers = [] } = props;
  const provider = useMemo(
    () => normalizeProvider(props.initial),
    [props.initial]
  );

  if (provider === "google") {
    return <GoogleMap center={center} zoom={zoom} markers={markers} />;
  }
  // maplibre デフォルト
  return <MapLibreMap center={center} zoom={zoom} markers={markers} />;
}

export type { Props as MapSwitcherProps };
