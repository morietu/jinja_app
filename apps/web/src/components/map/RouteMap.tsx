// apps/web/src/components/map/RouteMap.tsx
"use client";

import MapSwitcher, { LatLng, Marker } from "./MapSwitcher";

type Props = {
  origin: LatLng;
  destination: LatLng;
};

export default function RouteMap({ origin, destination }: Props) {
  const center: LatLng = origin;
  const markers: Marker[] = [
    { id: "origin", position: origin, label: "出発" },
    { id: "dest", position: destination, label: "目的地" },
  ];

  return (
    <MapSwitcher
      initial="maplibre"
      center={center}
      zoom={14}
      markers={markers}
      origin={origin}
      destination={destination}
    />
  );
}
