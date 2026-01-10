// apps/web/src/features/map/components/MapNearbyPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

type Props = {
  limit?: number;
  selectedPlaceId: string | null;
  onSelectPlaceId: (pid: string | null) => void;

  // ✅ 追加：/map?place_id=... で来たときに “選択済みカード” を先頭に出す
  initialSelectedPlace?: {
    place_id: string | null;
    name: string | null;
    address: string | null;
  };
};

const FALLBACK = { lat: 35.681236, lng: 139.767125 };

export default function MapNearbyPicker({ limit = 10, selectedPlaceId, onSelectPlaceId, initialSelectedPlace }: Props) {
  const { coords } = useGeolocation();
  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const [loading, setLoading] = useState(true);

  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const la = coords?.lat ?? FALLBACK.lat;
  const ln = coords?.lng ?? FALLBACK.lng;

  useEffect(() => {
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
  }, [la, ln, limit]);

  // ✅ 選択変更時にその行へスクロール
  useEffect(() => {
    if (!selectedPlaceId) return;
    const el = rowRefs.current[selectedPlaceId];
    if (!el) return;

    const id = window.setTimeout(() => {
      try {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      } catch {
        // ignore
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, [selectedPlaceId, items.length]);

  const hasSelectedInList = useMemo(() => {
    if (!selectedPlaceId) return false;
    return items.some((x) => x.place_id === selectedPlaceId);
  }, [items, selectedPlaceId]);

  const seed = initialSelectedPlace?.place_id
    ? {
        place_id: initialSelectedPlace.place_id,
        name: initialSelectedPlace.name ?? "選択中の神社",
        address: initialSelectedPlace.address ?? "",
      }
    : null;

  // ✅ seed が items に既に含まれてたら重複表示しない
  const showSeedCard = useMemo(() => {
    if (!seed) return false;
    return !items.some((x) => x.place_id === seed.place_id);
  }, [seed, items]);

  if (loading && !seed) {
    return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">読み込み中…</div>;
  }

  return (
    <div className="space-y-2">
      {/* ✅ 先頭：選択済みカード（= 2枚目状態の起点） */}
      {seed && (
        <button
          key={`seed:${seed.place_id}`}
          type="button"
          onClick={() => onSelectPlaceId(seed.place_id)}
          className={`w-full rounded-xl border p-3 text-left ${
            seed.place_id === selectedPlaceId ? "border-emerald-400 bg-emerald-50" : "bg-white"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">選択中</div>
          <div className="mt-1 text-sm font-semibold">{seed.name}</div>
          {!!seed.address && <div className="mt-1 text-xs text-slate-600">{seed.address}</div>}
        </button>
      )}

      {/* ✅ seed が近隣候補に存在しない時だけメッセージ */}
      {!!selectedPlaceId && !hasSelectedInList && (
        <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-900">
          選択中の神社は「近くの候補」に見つかりませんでした（場所が離れている可能性）。地図上で確認できます。
        </div>
      )}

      {/* ✅ 近隣候補 */}
      {loading && (
        <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">近くの候補を読み込み中…</div>
      )}

      {!loading && !items.length && (
        <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">
          近くの候補が見つかりませんでした。
        </div>
      )}

      {items.map((x) => {
        const active = x.place_id === selectedPlaceId;

        return (
          <button
            key={x.place_id}
            ref={(node) => {
              rowRefs.current[x.place_id] = node;
            }}
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
