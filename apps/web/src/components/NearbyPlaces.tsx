// apps/web/src/components/NearbyPlaces.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useGeolocation } from "@/hooks/useGeolocation";
import { NearbyList } from "@/components/nearby/NearbyList";
import type { NearbyItem } from "@/components/nearby/types";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

type UIState = "loading" | "success" | "empty" | "error";

const FETCH_LIMIT = 10;
const FALLBACK = { lat: 35.681236, lng: 139.767125 };

function toNearbyItem(p: PlacesNearbyResponse["results"][number]): NearbyItem {
  return {
    kind: "place",
    place_id: p.place_id,
    title: p.name,
    subtitle: p.address ?? undefined,
    lat: p.lat,
    lng: p.lng,
    distance_m: p.distance_m ?? null,
    rating: p.rating ?? null,
    user_ratings_total: p.user_ratings_total ?? null,
    icon: p.icon ?? null,
  };
}

async function fetchNearby(lat: number, lng: number, limit: number) {
  const r = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`nearby failed: ${r.status}`);
  return (await r.json()) as PlacesNearbyResponse;
}

export default function NearbyPlaces({
  limit = 10,
  onSelectPlaceId,
  selectedPlaceId: _selectedPlaceId,
}: {
  limit?: number;
  onSelectPlaceId?: (placeId: string) => void;
  selectedPlaceId?: string | null;
}) {
  const { coords, error: geoError, loading: geoLoading } = useGeolocation();

  const [state, setState] = useState<UIState>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();

  // 「このマウントで使う座標」を一度だけ確定して固定
  const decidedRef = useRef(false);
  const fixedLatRef = useRef<number>(FALLBACK.lat);
  const fixedLngRef = useRef<number>(FALLBACK.lng);

  // fetch 二重実行防止
  const inflightRef = useRef(false);


  const pickCoordsOnce = useCallback(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    if (typeof coords?.lat === "number" && typeof coords?.lng === "number" && !geoError) {
      fixedLatRef.current = coords.lat;
      fixedLngRef.current = coords.lng;
    } else {
      fixedLatRef.current = FALLBACK.lat;
      fixedLngRef.current = FALLBACK.lng;
    }
  }, [coords?.lat, coords?.lng, geoError]);

  const runFetch = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;

    setState("loading");
    setErrorMessage(undefined);

    const la = fixedLatRef.current;
    const ln = fixedLngRef.current;

    try {
      const data = await fetchNearby(la, ln, Math.min(limit, FETCH_LIMIT));
      const mapped = (data.results ?? []).map(toNearbyItem);

      if (mapped.length === 0) {
        setItems([]);
        setState("empty");
        return;
      }

      setItems(mapped);
      setState("success");
    } catch {
      setItems([]);
      setState("error");
      setErrorMessage("近くの神社の取得に失敗しました。");
    } finally {
      inflightRef.current = false;
    }
  }, [limit]);

  const didFetchRef = useRef(false);
  
  // 「coordsが取れたらそれで1回だけ」「取れなければfallbackで1回だけ」
  useEffect(() => {
    if (geoLoading) return;
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    pickCoordsOnce();
    void runFetch();
  }, [geoLoading, pickCoordsOnce, runFetch]);

  // 手動再検索（必要なら coords を再評価したい場合は decidedRef を外す）
  const handleRefetch = () => {
    // “このマウントでの座標決定” をやり直したいならリセットする
    decidedRef.current = false;
    pickCoordsOnce();
    void runFetch();
  };

  const lat = fixedLatRef.current;
  const lng = fixedLngRef.current;

  return (
    <NearbyList
      lat={lat}
      lng={lng}
      limit={limit}
      state={state}
      items={items}
      errorMessage={geoError ? `位置情報エラー: ${geoError}` : errorMessage}
      onRefetch={handleRefetch}
      onRetry={handleRefetch}
      itemHref={onSelectPlaceId ? () => null : undefined}
      onItemClick={(item) => {
        if (item.kind !== "place") return;
        onSelectPlaceId?.(item.place_id);
      }}
    />
  );
}
