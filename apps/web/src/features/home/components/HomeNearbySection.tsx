// apps/web/src/features/home/components/HomeNearbySection.tsx
"use client";

import axios from "axios";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api/http";
import type { NearbyListState } from "@/components/nearby/NearbyList";
import type { NearbyItem } from "@/components/nearby/types";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

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

const LIMIT = 10;

function toNearbyItem(p: PlacesNearbyResponse["results"][number]): NearbyItem {
  return {
    kind: "place",
    place_id: p.place_id,
    title: p.name,
    subtitle: p.address,
    lat: p.lat,
    lng: p.lng,
    distance_m: p.distance_m ?? null,
    rating: p.rating ?? null,
    user_ratings_total: p.user_ratings_total ?? null,
    icon: p.icon ?? null,
  };
}

export function HomeNearbySection() {
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [state, setState] = useState<NearbyListState>("loading");
  const [items, setItems] = useState<NearbyItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    try {
      setState("loading");
      setErrorMessage(undefined);

      const data = await apiGet<PlacesNearbyResponse>(`/places/nearby/?lat=${lat}&lng=${lng}&limit=${LIMIT}`);
      
      const mapped = (data.results ?? []).map(toNearbyItem);

      if (!mapped.length) {
        setItems([]);
        setState("empty");
        return;
      }

      setItems(mapped);
      setState("success");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setItems([]);
        setErrorMessage(undefined);
        setState("empty");
        return;
      }
      setErrorMessage("近くの神社の取得に失敗しました。時間をおいて再度お試しください。");
      setState("error");
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("この端末では位置情報が利用できません。");
      setState("error");
      return;
    }

    setState("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);
        fetchNearby(la, ln);
      },
      () => {
        setErrorMessage("位置情報の取得に失敗しました。ブラウザの設定を確認し、再度お試しください。");
        setState("error");
      },
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }, [fetchNearby]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const handleRefetch = () => {
    if (typeof lat === "number" && typeof lng === "number") fetchNearby(lat, lng);
    else requestLocation();
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
          limit={LIMIT}
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
    </div>
  );
}
