// src/components/maps/RouteMap.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadGoogleMaps } from "@/lib/gmaps";

type LatLng = { lat: number; lng: number };
type GmLocation = google.maps.LatLngLiteral | { placeId: string };

type Props = {
  origin: LatLng | { place_id: string };
  destination: LatLng | { place_id: string };
  defaultMode?: "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT";
  zoom?: number;
  height?: number | string;
};

const toGmLocation = (p: any): GmLocation | null => {
  if (!p) return null;
  if (typeof p.place_id === "string") return { placeId: p.place_id };
  const lat = Number(p.lat), lng = Number(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

export default function RouteMap({
  origin,
  destination,
  defaultMode = "WALKING",
  zoom = 14,
  height = 384,
}: Props) {
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const svcRef = useRef<google.maps.DirectionsService | null>(null);
  const renRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const startMarkerRef = useRef<any>(null);
  const endMarkerRef   = useRef<any>(null);
  const advMarkerCtorRef = useRef<any>(null);

  const [travelMode, setTravelMode] = useState<
    "WALKING" | "DRIVING" | "BICYCLING" | "TRANSIT"
  >(defaultMode);

  // ① 初期化（1回だけ）
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const g = await loadGoogleMaps();

        // まずは従来APIで初期値を用意
        let MapCtor: any = g.maps.Map;
        let DirectionsServiceCtor: any = g.maps.DirectionsService;
        let DirectionsRendererCtor: any = g.maps.DirectionsRenderer;

        // 新APIがあれば正式に importLibrary で上書き
        if (typeof g.maps.importLibrary === "function") {
          const { Map } = await g.maps.importLibrary("maps") as google.maps.MapsLibrary;
          const routes = await g.maps.importLibrary("routes") as google.maps.RoutesLibrary;
          MapCtor = Map;
          DirectionsServiceCtor = routes.DirectionsService;
          DirectionsRendererCtor = routes.DirectionsRenderer;
          try {
            const marker = await g.maps.importLibrary("marker") as google.maps.MarkerLibrary;
            advMarkerCtorRef.current = marker.AdvancedMarkerElement;
          } catch {
            advMarkerCtorRef.current = null;
          }
        }

        if (cancelled) return;

        const o = toGmLocation(origin);
        const center =
          o && "lat" in (o as any)
            ? (o as google.maps.LatLngLiteral)
            : { lat: 35.681236, lng: 139.767125 }; // 東京駅

        // ここで確実にコンストラクタ
        const map = new MapCtor(containerRef.current!, {
          center,
          zoom,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });

        mapRef.current = map;
        svcRef.current = new DirectionsServiceCtor();
        renRef.current = new DirectionsRendererCtor({
          map,
          suppressMarkers: true, // マーカーは自前で置く
        });
      } catch (e) {
        console.error("[gmaps] init failed", e);
      }
    })();

    return () => {
      cancelled = true;
      renRef.current?.setMap(null);
    };
    // origin は参照しない（再初期化を避ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, zoom]);

  // マーカー設置（Advanced があれば使う）
  const setMarker = useCallback(
    (ref: React.MutableRefObject<any>, pos: google.maps.LatLngLiteral | null, title: string) => {
      const g = (window as any).google as typeof google | undefined;
      const map = mapRef.current;
      if (!g?.maps || !map) return;

      // 既存を片付け
      if (ref.current) {
        if (typeof ref.current.setMap === "function") {
          ref.current.setMap(null);
        } else if ("map" in ref.current) {
          ref.current.map = null;
        }
        ref.current = null;
      }
      if (!pos) return;

      const Adv = advMarkerCtorRef.current;
      if (Adv) {
        ref.current = new Adv({ map, position: pos, title });
      } else {
        ref.current = new g.maps.Marker({ map, position: pos, title });
      }
    },
    []
  );

  // ② ルート更新
  useEffect(() => {
    const map = mapRef.current;
    const svc = svcRef.current;
    const ren = renRef.current;
    const g = (window as any).google as typeof google | undefined;
    if (!map || !svc || !ren || !g?.maps) return;

    const o = toGmLocation(origin);
    const d = toGmLocation(destination);
    if (!o || !d) return;

    const mode =
      travelMode === "DRIVING"
        ? g.maps.TravelMode.DRIVING
        : travelMode === "TRANSIT"
        ? g.maps.TravelMode.TRANSIT
        : travelMode === "BICYCLING"
        ? g.maps.TravelMode.BICYCLING
        : g.maps.TravelMode.WALKING;

    const req: google.maps.DirectionsRequest = {
      origin: o as any,
      destination: d as any,
      travelMode: mode,
    };

    svc.route(req, (res, status) => {
      if (status === g.maps.DirectionsStatus.OK && res) {
        ren.setDirections(res);
        const leg = res.routes?.[0]?.legs?.[0];

        const startPos = leg?.start_location
          ? { lat: leg.start_location.lat(), lng: leg.start_location.lng() }
          : ("lat" in (o as any) ? (o as google.maps.LatLngLiteral) : null);
        const endPos = leg?.end_location
          ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() }
          : ("lat" in (d as any) ? (d as google.maps.LatLngLiteral) : null);

        setMarker(startMarkerRef, startPos, "出発");
        setMarker(endMarkerRef,   endPos,   "到着");

        // 軽くフィット
        const b = new g.maps.LatLngBounds();
        if (startPos) b.extend(startPos);
        if (endPos)   b.extend(endPos);
        if (!b.isEmpty()) map.fitBounds(b);
      } else {
        console.error("[gmaps] directions failed:", status);
        setMarker(startMarkerRef, "lat" in (o as any) ? (o as any) : null, "出発");
        setMarker(endMarkerRef,   "lat" in (d as any) ? (d as any) : null, "到着");
        if ("lat" in (o as any)) map.setCenter(o as any);
        map.setZoom(zoom);
      }
    });
  }, [origin, destination, travelMode, zoom, setMarker]);

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
