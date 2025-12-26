"use client";

import { useEffect, useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getPopularShrines, type Shrine } from "@/lib/api/shrines";
import { NearbyList } from "@/components/nearby/NearbyList";
import type { NearbyItem } from "@/components/nearby/types";

type UIState = "loading" | "success" | "empty" | "error";

const NEARBY_RADIUS_KM = 30;

export default function NearbyShrines({ 
  limit = 10,
  onSelectPlaceId,
  selectedPlaceId,
}: {
  limit?: number;
  onSelectPlaceId?: (placeId: string) => void;
  selectedPlaceId?: string | null;
}) {
  const { coords, error: geoError, loading: geoLoading } = useGeolocation();
  const [state, setState] = useState<UIState>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [usedFallback, setUsedFallback] = useState(false);

  const canFetch = useMemo(() => !!coords && !geoError, [coords, geoError]);

  const toItem = (s: Shrine): NearbyItem | null => {
    const rawId = (s as any).id ?? (s as any).shrine_id;
    if (rawId == null) return null;

    const lat = (s as any).lat;
    const lng = (s as any).lng;
    const distance = (s as any).distance_m ?? (s as any).distance;

    return {
      kind: "temple",
      temple_id: String(rawId),

      title: (s as any).name_jp ?? (s as any).name ?? "名称未設定",
      subtitle: (s as any).address ?? undefined,

      lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
      lng: Number.isFinite(Number(lng)) ? Number(lng) : null,

      distance_m: Number.isFinite(Number(distance)) ? Number(distance) : null,
      duration_min: (s as any).walking_minutes ?? null,
    };
  };

  const isNearbyItem = (x: NearbyItem | null): x is NearbyItem => x !== null;

  const load = async () => {
    if (!coords) return;
    setState("loading");
    setErrorMessage(undefined);
    setUsedFallback(false);

    try {
      let results = await getPopularShrines({
        limit,
        nearLat: coords.lat,
        nearLng: coords.lng,
        radiusKm: NEARBY_RADIUS_KM,
      });

      if (!results || results.length === 0) {
        results = await getPopularShrines({ limit });
        setUsedFallback(true);
      }


      const mapped = (results ?? []).map(toItem).filter(isNearbyItem);
      if (mapped.length === 0) {
        setItems([]);
        setState("empty");
      } else {
        setItems(mapped);
        setState("success");
      }
    } catch (e: any) {
      setItems([]);
      setErrorMessage(e?.message ?? "取得に失敗しました");
      setState("error");
    }
  };

  useEffect(() => {
    if (!canFetch) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canFetch, limit, coords?.lat, coords?.lng]);

  if (geoLoading) {
    return (
      <NearbyList
        lat={coords?.lat ?? 0}
        lng={coords?.lng ?? 0}
        limit={limit}
        state="loading"
        className="space-y-3"
        aria-label="現在地取得中"
      />
    );
  }

  if (geoError) {
    return (
      <NearbyList
        lat={coords?.lat ?? 0}
        lng={coords?.lng ?? 0}
        limit={limit}
        state="error"
        errorMessage={`位置情報エラー: ${geoError}`}
        onRetry={() => location.reload()}
        className="space-y-3"
        aria-label="位置情報エラー"
      />
    );
  }

  const extraMessage =
    usedFallback && !errorMessage ? "近くには見つからなかったため、人気の神社を表示しています。" : undefined;

  const lat = coords?.lat;
  const lng = coords?.lng;

  return (
    <NearbyList
      lat={coords?.lat ?? 0}
      lng={coords?.lng ?? 0}
      limit={limit}
      state={state}
      items={items}
      errorMessage={errorMessage ?? extraMessage}
      onRefetch={() => void load()}
      onRetry={() => void load()}
      className="space-y-3"
      aria-label="近くの神社"
      itemHref={onSelectPlaceId ? () => null : (item) => {
        // NearbyShrines は kind: "temple" を作っているのでここも合わせる
        if (item.kind !== "temple") return null;

        const usp = new URLSearchParams();
        usp.set("focus", item.temple_id);

        if (typeof lat === "number" && typeof lng === "number") {
          usp.set("lat", String(lat));
          usp.set("lng", String(lng));
        }

        return `/map?${usp.toString()}`;
      }}
      onItemClick={(item) => {
        // place のときだけ選択できる（kind が違うなら合わせて調整）
        if (item.kind !== "place") return;
        onSelectPlaceId?.(item.place_id);
      }}
    />
  );
}
