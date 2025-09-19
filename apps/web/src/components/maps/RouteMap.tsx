// apps/web/src/components/maps/RouteMap.tsx
"use client";

import { useEffect, useRef, useCallback } from "react";

type GmLatLng = google.maps.LatLngLiteral;
type GmLocation = GmLatLng | { placeId: string };

export default function RouteMap({
  origin,
  destination,
  // google.maps.TravelMode のユニオンをそのまま受ける
  travelMode = "WALKING" as google.maps.TravelMode,
  zoom = 14,
}: {
  origin: GmLocation | null;
  destination: GmLocation | null;
  travelMode?: google.maps.TravelMode;
  zoom?: number;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const svcRef = useRef<google.maps.DirectionsService | null>(null);
  const renRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const startRef = useRef<google.maps.Marker | null>(null);
  const endRef = useRef<google.maps.Marker | null>(null);

  const setMarker = useCallback(
    (
      ref: React.MutableRefObject<google.maps.Marker | null>,
      pos: GmLatLng | null,
      title: string
    ) => {
      const g = (window as any).google as typeof google | undefined;
      if (!g || !mapRef.current) return;

      if (ref.current) {
        ref.current.setMap(null);
        ref.current = null;
      }
      if (pos) {
        ref.current = new g.maps.Marker({
          position: pos,
          map: mapRef.current,
          title,
        });
      }
    },
    []
  );

  // 初期化
  useEffect(() => {
    const g = (window as any).google as typeof google | undefined;
    if (!g || !divRef.current) return;

    if (!mapRef.current) {
      mapRef.current = new g.maps.Map(divRef.current, {
        zoom,
        center: { lat: 35.681236, lng: 139.767125 }, // デフォ: 東京駅
      });
    } else {
      mapRef.current.setZoom(zoom);
    }

    if (!svcRef.current) svcRef.current = new g.maps.DirectionsService();
    if (!renRef.current) {
      renRef.current = new g.maps.DirectionsRenderer({ suppressMarkers: true });
      renRef.current.setMap(mapRef.current);
    }

    return () => {
      renRef.current?.setMap(null);
      renRef.current = null;
      svcRef.current = null;
      startRef.current?.setMap(null);
      startRef.current = null;
      endRef.current?.setMap(null);
      endRef.current = null;
    };
  }, [zoom]);

  // ルート計算
  useEffect(() => {
    const g = (window as any).google as typeof google | undefined;
    if (!g || !svcRef.current || !renRef.current) return;
    if (!origin || !destination) return;

    const toLatLng = (o: GmLocation): GmLatLng | null =>
      "placeId" in o ? null : (o as GmLatLng);

    const req: google.maps.DirectionsRequest = {
      origin,
      destination,
      travelMode,
    };

    svcRef.current.route(
      req,
      (res: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (status === g.maps.DirectionsStatus.OK && res) {
          renRef.current!.setDirections(res);

          const leg = res.routes[0]?.legs?.[0];
          const oPos = toLatLng(origin) ?? leg?.start_location?.toJSON?.() ?? null;
          const dPos = toLatLng(destination) ?? leg?.end_location?.toJSON?.() ?? null;

          setMarker(startRef, oPos, "出発");
          setMarker(endRef, dPos, "到着");

          if (mapRef.current && oPos && dPos) {
            const bounds = new g.maps.LatLngBounds();
            bounds.extend(oPos);
            bounds.extend(dPos);
            mapRef.current.fitBounds(bounds);
          }
        } else {
          // 失敗時はルート消去＆分かる範囲でマーカーのみ
          renRef.current!.setDirections({ routes: [] } as any);
          setMarker(startRef, toLatLng(origin), "出発");
          setMarker(endRef, toLatLng(destination), "到着");
        }
      }
    );
  }, [origin, destination, travelMode, setMarker]);

  return <div ref={divRef} className="w-full h-80 rounded border" />;
}
