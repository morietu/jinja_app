// apps/web/src/hooks/useGeolocation.ts
"use client";

import { useEffect, useRef, useState } from "react";

type Coords = { lat: number; lng: number };

function roundCoord(n: number, digits: number) {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

function haversineM(a: Coords, b: Coords) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function useGeolocation(opts?: {
  roundDigits?: number; // default 4
  minMoveM?: number; // default 50
  minIntervalMs?: number; // default 1000
}) {
  const roundDigits = opts?.roundDigits ?? 4;
  const minMoveM = opts?.minMoveM ?? 50;
  const minIntervalMs = opts?.minIntervalMs ?? 1000;

  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const lastAcceptedRef = useRef<Coords | null>(null);
  const lastAcceptedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("このブラウザは位置情報に対応していません。");
      setLoading(false);
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastAcceptedAtRef.current < minIntervalMs) return;

        const nextRaw = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const next = {
          lat: roundCoord(nextRaw.lat, roundDigits),
          lng: roundCoord(nextRaw.lng, roundDigits),
        };

        const prev = lastAcceptedRef.current;
        if (prev) {
          const d = haversineM(prev, next);
          if (d < minMoveM) return;
        }

        lastAcceptedRef.current = next;
        lastAcceptedAtRef.current = now;

        setCoords(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message || "位置情報の取得に失敗しました。");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [roundDigits, minMoveM, minIntervalMs]);

  return { coords, error, loading };
}
