// apps/web/src/features/map/components/MapNearbyPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

type Props = {
  limit?: number;
  selectedPlaceId: string | null;
  onSelectPlaceId: (pid: string | null) => void;
};

const FALLBACK = { lat: 35.681236, lng: 139.767125 };

export default function MapNearbyPicker({ limit = 10, selectedPlaceId, onSelectPlaceId }: Props) {
  const { coords } = useGeolocation();
  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ 行ref（place_id -> button）
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

  // ✅ seed（=「選択中のplaceIdが近くの候補に居ない」）判定
  const seed = useMemo(() => {
    if (!selectedPlaceId) return null;
    const hit = items.find((x) => x.place_id === selectedPlaceId);
    return hit ? null : selectedPlaceId;
  }, [items, selectedPlaceId]);
  // ✅ seed のときだけ、一覧の上に注意カードを出す（ESLintの unused を解消）

  // ✅ 初期選択・選択変更時に、その行へスクロール（見える位置に）
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

  if (loading) return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">読み込み中…</div>;

  if (!items.length) {
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">近くの候補が見つかりませんでした。</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ✅ seed = 近隣候補に存在しない（遠方/固定スポットから来た） */}
      {seed && (
        <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-900">
          選択中の神社は「近くの候補」に見つかりませんでした（場所が離れている可能性）。地図上で確認できます。
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
