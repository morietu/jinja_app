// apps/web/src/features/home/components/HomeNearbySection.tsx
"use client";
import axios from "axios";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api/http";
import type { NearbyListState, ShrineListItem } from "@/components/nearby/NearbyList";

// NearbyList は dynamic import（前と同じ）
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

// TODO: 実際の API レスポンスに合わせて型を調整する
type NearbyApiResponse = {
  results: any[];
};

export function HomeNearbySection() {
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [state, setState] = useState<NearbyListState>("loading");
  const [items, setItems] = useState<ShrineListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // 近くの神社API呼び出し
  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    try {
      setState("loading");
      setErrorMessage(undefined);

      // TODO: 実際のAPIエンドポイントが決まったらここを更新
      const data = await apiGet<NearbyApiResponse>(`/places/nearby/?lat=${lat}&lng=${lng}&limit=${LIMIT}`);

      const results = data?.results ?? [];

      if (!results.length) {
        setItems([]);
        setState("empty");
        return;
      }

      const mapped = results as unknown as ShrineListItem[];
      setItems(mapped);
      setState("success");
    } catch (err) {
      // 🔽 ここを追加
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        // まだ API 未実装 or パス違い → ひとまず「データなし」として扱う
        setItems([]);
        setErrorMessage(undefined);
        setState("empty");
        if (process.env.NODE_ENV === "development") {
          console.info("[HomeNearbySection] nearby API not found (404). Treat as empty.");
        }
        return;
      }

      if (process.env.NODE_ENV === "development") {
        console.error("Failed to fetch nearby shrines", err);
      }
      setErrorMessage("近くの神社の取得に失敗しました。時間をおいて再度お試しください。");
      setState("error");
    }
  }, []);

  // 位置情報の取得
  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setErrorMessage("この端末では位置情報が利用できません。");
      setState("error");
      return;
    }

    setState("loading");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setLat(lat);
        setLng(lng);

        fetchNearby(lat, lng);
      },
      // エラーコールバック部分だけ差し替え

      (err) => {
        if (process.env.NODE_ENV === "development") {
          console.info("Failed to get location", err);
        }

        setErrorMessage("位置情報の取得に失敗しました。ブラウザの設定を確認し、再度お試しください。");
        setState("error");
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
      },
    );
  }, [fetchNearby]);

  // 初回マウント時に位置情報を取得
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // NearbyList からの「再検索」
  const handleRefetch = () => {
    if (typeof lat === "number" && typeof lng === "number") {
      fetchNearby(lat, lng);
    } else {
      requestLocation();
    }
  };

  // エラー状態からの「再試行」
  const handleRetry = () => {
    requestLocation();
  };
  // 一覧に結果があるかどうか
  const hasResults = state === "success" && items.length > 0;

  return (
    <div className="space-y-3">
      {/* ヘッダーの文言は SectionCard 側に移したので、ここは再検索ボタンだけ */}
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
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}
