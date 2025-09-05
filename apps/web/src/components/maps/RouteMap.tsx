"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type Props = {
  origin: LatLng;
  destination: LatLng;
  zoom?: number;
  height?: string;
};

export default function RouteMap({ origin, destination, zoom = 14, height = "384px" }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<google.maps.TravelMode>("WALKING");

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const bounds = useMemo(() => {
    const b = new google.maps.LatLngBounds();
    b.extend(origin);
    b.extend(destination);
    return b;
  }, [origin, destination]);

  useEffect(() => {
    if (!divRef.current || !apiKey) return;

    const loader = new Loader({ apiKey, version: "weekly" });
    let map: google.maps.Map | null = null;
    let renderer: google.maps.DirectionsRenderer | null = null;

    loader.load().then(() => {
      if (!divRef.current) return;

      map = new google.maps.Map(divRef.current, {
        center: origin,
        zoom,
        mapId,
        gestureHandling: "greedy",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      const service = new google.maps.DirectionsService();
      renderer = new google.maps.DirectionsRenderer({ suppressMarkers: false });
      renderer.setMap(map);

      service.route(
        { origin, destination, travelMode: mode },
        (result, status) => {
          if (status === "OK" && result) {
            renderer!.setDirections(result);
            map!.fitBounds(bounds);
          } else {
            console.error("Directions failed:", status);
          }
        }
      );
    });

    return () => {
      renderer?.setMap(null);
      // @ts-expect-error: release reference
      map = null;
    };
  }, [apiKey, mapId, origin, destination, mode, zoom, bounds]);

  return (
    <div className="w-full">
      <div className="mb-2">
        <label className="mr-2 font-semibold">移動手段:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as google.maps.TravelMode)}
          className="border p-1 rounded"
        >
          <option value="WALKING">徒歩</option>
          <option value="DRIVING">車</option>
        </select>
      </div>
      <div ref={divRef} className="w-full border rounded" style={{ height }} />
    </div>
  );
}
