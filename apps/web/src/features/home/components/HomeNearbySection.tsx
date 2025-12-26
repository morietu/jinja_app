// apps/web/src/features/home/components/HomeNearbySection.tsx
"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { NearbyListState } from "@/components/nearby/NearbyList";
import type { NearbyItem } from "@/components/nearby/types";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";
import { toast } from "sonner";

const NearbyList = dynamic(() => import("@/components/nearby/NearbyList").then((m) => m.NearbyList), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  ),
});

const FETCH_LIMIT = 10;     // APIに取りに行く数（精度確保）
const DISPLAY_LIMIT = 3;    // トップで見せる数（UX）

const FALLBACK = { lat: 35.681236, lng: 139.767125 }; // 東京駅

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

async function fetchNearbyViaBFF(lat: number, lng: number, limit: number) {
  const radius = 2000;
  const r = await fetch(`/api/places/nearby?lat=${lat}&lng=${lng}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`nearby bff failed: ${r.status}`);
  return (await r.json()) as PlacesNearbyResponse;
}

export function HomeNearbySection() {
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [state, setState] = useState<NearbyListState>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [usingFallback, setUsingFallback] = useState(false);

  const runFetch = useCallback(async (la: number, ln: number, opts?: { fallbackUsed?: boolean; msg?: string }) => {
    setState("loading");
    setErrorMessage(opts?.msg);
    setUsingFallback(!!opts?.fallbackUsed);

    if (opts?.fallbackUsed && opts?.msg) {
      toast(opts.msg);
    }

    try {
      const data = await fetchNearbyViaBFF(la, ln, FETCH_LIMIT);
      const mapped = (data.results ?? []).map(toNearbyItem);

      console.log(
        "nearby items distance_m:",
        mapped.map((x) => ({ title: x.title, distance_m: x.distance_m })),
      );
      const sliced = mapped.slice(0, DISPLAY_LIMIT);


      setLat(la);
      setLng(ln);

      if (!sliced.length) {
        setItems([]);
        setState("empty");
        toast("近くに神社が見つかりませんでした");
        return;
      }

      setItems(sliced);
      setState("success");
    } catch {
      setItems([]);
      setState("error");
      setErrorMessage("近くの神社の取得に失敗しました。時間をおいて再度お試しください。");
      toast("近くの神社の取得に失敗しました");
    }
  }, []);

  const requestLocation = useCallback(() => {
    // geolocation 未対応 → fallback で必ず動かす
    if (!("geolocation" in navigator)) {
      void runFetch(FALLBACK.lat, FALLBACK.lng, {
        fallbackUsed: true,
        msg: "位置情報が利用できないため、東京駅周辺を表示しています。",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void runFetch(pos.coords.latitude, pos.coords.longitude, { fallbackUsed: false, msg: undefined });
      },
      (e) => {
        void runFetch(FALLBACK.lat, FALLBACK.lng, {
          fallbackUsed: true,
          msg: `位置情報の取得に失敗したため、東京駅周辺を表示しています。(code=${e.code})`,
        });
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [runFetch]);

    useEffect(() => {
      toast("toast動作テスト");
      requestLocation();
    }, [requestLocation]);

  const handleRefetch = () => {
    if (typeof lat === "number" && typeof lng === "number") {
      void runFetch(lat, lng, { fallbackUsed: usingFallback, msg: errorMessage });
    } else {
      requestLocation();
    }
  };

  const hasResults = state === "success" && items.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {hasResults && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefetch}
            className="hidden rounded-full text-xs text-slate-600 hover:bg-slate-100 sm:inline-flex"
          >
            再検索
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 sm:p-3">
        <NearbyList
          lat={lat}
          lng={lng}
          limit={DISPLAY_LIMIT}
          state={state}
          items={items}
          errorMessage={errorMessage}
          onRefetch={handleRefetch}
          onRetry={requestLocation}
          itemHref={(item) => {
            if (item.kind !== "place") return null;

            const usp = new URLSearchParams();
            usp.set("place_id", item.place_id);

            if (typeof lat === "number" && typeof lng === "number") {
              usp.set("locationbias", `circle:1500@${lat},${lng}`);
            }
            return `/shrines/resolve?${usp.toString()}`;
          }}
        />
      </div>

      {usingFallback ? <div className="text-xs text-slate-500">※ 現在地の代わりに東京駅周辺を表示中</div> : null}
    </div>
  );
}
