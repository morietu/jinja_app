"use client";

import { useEffect, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

type Props = {
  limit?: number;
  selectedPlaceId: string | null;
  onSelectPlaceId: (pid: string) => void;
};

const FALLBACK = { lat: 35.681236, lng: 139.767125 };

export default function MapNearbyPicker({ limit = 10, selectedPlaceId, onSelectPlaceId }: Props) {
  const { coords } = useGeolocation();
  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const la = coords?.lat ?? FALLBACK.lat;
    const ln = coords?.lng ?? FALLBACK.lng;

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/places/nearby?lat=${la}&lng=${ln}&limit=${limit}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`nearby failed: ${r.status}`);
        const data = (await r.json()) as PlacesNearbyResponse;
        if (alive) setItems(data.results ?? []);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [coords?.lat, coords?.lng, limit]);

  if (loading) return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">読み込み中…</div>;
  if (!items.length)
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">近くの候補が見つかりませんでした。</div>
    );

  return (
    <div className="space-y-2">
      {items.map((x) => {
        const active = x.place_id === selectedPlaceId;
        return (
          <button
            key={x.place_id}
            type="button"
            onClick={() => onSelectPlaceId(x.place_id)}
            className={`w-full rounded-xl border p-3 text-left ${
              active ? "border-emerald-400 bg-emerald-50" : "bg-white"
            }`}
          >
            <div className="text-sm font-semibold">{x.name}</div>
            <div className="mt-1 text-xs text-slate-600">{x.address}</div>
          </button>
        );
      })}
    </div>
  );
}
