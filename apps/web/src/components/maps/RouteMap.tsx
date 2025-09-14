"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

type Props = {
  origin: LatLng;
  destination: LatLng;
  defaultMode?: "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT";
  zoom?: number;
  height?: number | string; // px or "384px"
};

export default function RouteMap({
  origin,
  destination,
  defaultMode = "WALKING",
  zoom = 14,
  height = 384,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const svcRef = useRef<google.maps.DirectionsService | null>(null);
  const renRef = useRef<google.maps.DirectionsRenderer | null>(null);

  // UI用の移動手段（prop名と衝突しないように travelMode に統一）
  const [travelMode, setTravelMode] = useState<
    "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT"
  >(defaultMode);

  // ① Maps をロードして地図を1回だけ初期化
  useEffect(() => {
    if (!apiKey || !containerRef.current || mapRef.current) return;

    const loader = new Loader({ apiKey, version: "weekly" });
    let cancelled = false;

    loader.load().then(() => {
      if (cancelled || !containerRef.current) return;

      mapRef.current = new google.maps.Map(containerRef.current, {
        center: origin,
        zoom,
        mapId,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
      });

      svcRef.current = new google.maps.DirectionsService();
      renRef.current = new google.maps.DirectionsRenderer({ suppressMarkers: false });
      renRef.current.setMap(mapRef.current!);
    });

    return () => {
      cancelled = true;
      renRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapId, zoom]);

  // ② ルートを更新（origin/destination/mode が変わったとき）
  useEffect(() => {
    const map = mapRef.current;
    const svc = svcRef.current;
    const ren = renRef.current;
    if (!map || !svc || !ren) return; // 未初期化なら何もしない
    if (!origin || !destination) return;

    const gmMode =
      travelMode === "DRIVING" ? google.maps.TravelMode.DRIVING :
      travelMode === "BICYCLING" ? google.maps.TravelMode.BICYCLING :
      travelMode === "TRANSIT" ? google.maps.TravelMode.TRANSIT :
      google.maps.TravelMode.WALKING;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(origin);
    bounds.extend(destination);

    svc.route(
      { origin, destination, travelMode: gmMode, provideRouteAlternatives: false },
      (result, status) => {
        if (status === "OK" && result) {
          ren.setDirections(result);
          try {
            map.fitBounds(bounds);
          } catch {
            map.setCenter(origin);
            map.setZoom(zoom);
          }
        } else {
          console.error("Directions failed:", status);
          map.setCenter(origin);
          map.setZoom(zoom);
        }
      }
    );
  }, [origin, destination, travelMode, zoom]);

  return (
    <div className="w-full">
      <div className="mb-2">
        <label className="mr-2 font-semibold">移動手段:</label>
        <select
          value={travelMode}
          onChange={(e) =>
            setTravelMode(e.target.value as "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT")
          }
          className="border p-1 rounded"
        >
          <option value="WALKING">徒歩</option>
          <option value="DRIVING">車</option>
          <option value="BICYCLING">自転車</option>
          <option value="TRANSIT">公共交通</option>
        </select>
      </div>
      <div
        ref={containerRef}
        className="w-full border rounded"
        style={{ height: typeof height === "number" ? `${height}px` : height }}
      />
    </div>
  );
}
