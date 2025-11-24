"use client";

import { useEffect, useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { getPopularShrines, type Shrine } from "@/lib/api/shrines";
import { NearbyList } from "@/components/nearby/NearbyList";
import type { ShrineListItem } from "@/components/nearby/NearbyList.Item";
import { useRouter } from "next/navigation";

type UIState = "loading" | "success" | "empty" | "error";

const NEARBY_RADIUS_KM = 30; // C: まず30km圏内で検索（必要なら調整）

export default function NearbyShrines({ limit = 10 }: { limit?: number }) {
  const { coords, error: geoError, loading: geoLoading } = useGeolocation();
  const [state, setState] = useState<UIState>("loading");
  const [items, setItems] = useState<ShrineListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [usedFallback, setUsedFallback] = useState(false);
  const router = useRouter();

  const canFetch = useMemo(() => !!coords && !geoError, [coords, geoError]);

  const toItem = (s: Shrine): ShrineListItem => ({
    id: String((s as any).id ?? (s as any).shrine_id ?? crypto.randomUUID()),
    name: (s as any).name_jp ?? (s as any).name ?? "名称未設定",
    address: (s as any).address ?? undefined,
    distanceMeters: (s as any).distance_m ?? (s as any).distance ?? 0,
    durationMinutes: (s as any).walking_minutes ?? undefined,
  });

  const load = async () => {
    if (!coords) return;
    setState("loading");
    setErrorMessage(undefined);
    setUsedFallback(false);

    try {
      // --- C: まず「近くの人気神社」を広めの半径で検索 ---
      let results = await getPopularShrines({
        limit,
        nearLat: coords.lat,
        nearLng: coords.lng,
        radiusKm: NEARBY_RADIUS_KM,
      });

      // --- B: 0件なら全国人気TOPにフォールバック ---
      if (!results || results.length === 0) {
        results = await getPopularShrines({ limit });
        setUsedFallback(true);
      }

      const mapped = (results ?? []).map(toItem);

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

  // 位置情報段階のUIも NearbyList へ委譲
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

  // フォールバック時のメッセージを少しだけ足しておく（必要なければ削除）
  const extraMessage =
    usedFallback && !errorMessage ? "近くには見つからなかったため、人気の神社を表示しています。" : undefined;

  return (
    <NearbyList
      lat={coords?.lat ?? 0}
      lng={coords?.lng ?? 0}
      limit={limit}
      state={state}
      items={items}
      errorMessage={errorMessage ?? extraMessage}
      onRefetch={() => load()}
      onRetry={() => load()}
      onItemClick={(id) => router.push(`/shrines/${id}`)}
      className="space-y-3"
      aria-label="近くの神社"
    />
  );
}
