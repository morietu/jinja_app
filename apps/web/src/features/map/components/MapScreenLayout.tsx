"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import GoogleMap from "@/components/map/providers/GoogleMap";
import { useGeolocation } from "@/hooks/useGeolocation";
import MapNearbyPicker from "@/features/map/components/MapNearbyPicker";

export default function MapScreenLayout() {
  const router = useRouter();
  const sp = useSearchParams();

  const pick = sp.get("pick"); // "goshuin" のときだけ戻る
  const isPickMode = pick === "goshuin";


  const returnTo = sp.get("return");
  const returnHash = sp.get("returnHash");

  const { coords } = useGeolocation();
  const center = useMemo(() => coords ?? { lat: 35.681236, lng: 139.767125 }, [coords]);

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const ensureShrine = useCallback(async (placeId: string) => {
    const r = await fetch("/api/shrines/from-place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ place_id: placeId }),
    });
    if (!r.ok) throw new Error("from-place failed");
    return (await r.json()) as { shrine_id: number };
  }, []);



  const goPicked = useCallback(async () => {
    if (pick !== "goshuin") return;
    if (!selectedPlaceId) return;

    const { shrine_id } = await ensureShrine(selectedPlaceId);

    const base = returnTo ? decodeURIComponent(returnTo) : "/mypage?tab=goshuin";
    const sep = base.includes("?") ? "&" : "?";

    const withShrine = `${base}${sep}shrine=${shrine_id}`;
    const hash = returnHash ? `#${returnHash}` : "";

    router.push(`${withShrine}${hash}`);
  }, [pick, selectedPlaceId, ensureShrine, router, returnTo, returnHash]);

  const markers: { id: string; position: { lat: number; lng: number }; label?: string }[] = [];

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="h-1/2 min-h-[220px] border-b">
        <GoogleMap center={center} zoom={13} markers={markers} className="h-full w-full" />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 pb-2 pt-3">
            <p className="text-xs font-semibold text-gray-700">{isPickMode ? "神社を選択" : "近くの神社"}</p>

            {isPickMode && (
              <button
                type="button"
                onClick={goPicked}
                disabled={!selectedPlaceId}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
              >
                この神社で続ける
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <MapNearbyPicker
              limit={10}
              selectedPlaceId={selectedPlaceId}
              onSelectPlaceId={setSelectedPlaceId}
              
            />
          </div>
        </div>
      </div>
    </div>
  );
}
