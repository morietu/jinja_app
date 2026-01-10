// apps/web/src/features/map/components/MapNearbyPicker.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

type Props = {
  limit?: number;
  selectedPlaceId: string | null;
  onSelectPlaceId: (pid: string | null) => void;


  // ✅ MapScreenLayout から渡される「初期選択の見た目用」
  initialSelectedPlace?: {
    place_id: string | null;
    name: string | null;
    address: string | null;
  };
};

const FALLBACK = { lat: 35.681236, lng: 139.767125 };

export default function MapNearbyPicker({ limit = 10, selectedPlaceId, onSelectPlaceId, initialSelectedPlace }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ pick=goshuin のときだけ「選択して戻る」モード
  const isPickMode = sp.get("pick") === "goshuin";

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

  // ✅ 通常モード：place_id から神社詳細へ遷移（/shrines/from-place/[placeId]）
  const goDetail = useCallback(
    (placeId: string) => {
      // “見た目の即時反映”が欲しいならここで query を付けてもOKだが、
      // まずは素直に placeId だけで遷移する
      router.push(`/shrines/from-place/${encodeURIComponent(placeId)}`);
    },
    [router],
  );

  const handleClick = useCallback(
    (placeId: string) => {
      if (isPickMode) {
        onSelectPlaceId(placeId);
        return;
      }
      goDetail(placeId);
    },
    [isPickMode, onSelectPlaceId, goDetail],
  );

  // ✅ 選択中が近隣候補にいるか？
  const hasSelectedInList = useMemo(() => {
    if (!selectedPlaceId) return false;
    return items.some((x) => x.place_id === selectedPlaceId);
  }, [items, selectedPlaceId]);

  // ✅ 「選択中カード（固定表示）」を出す条件：
  // - selectedPlaceId がある
  // - 近隣候補に無い
  // - initialSelectedPlace が place_id を持っていて selected と一致
  const showPinnedSelected = useMemo(() => {
    if (!selectedPlaceId) return false;
    if (hasSelectedInList) return false;

    const pid = initialSelectedPlace?.place_id ?? null;
    if (!pid) return false;

    return pid === selectedPlaceId;
  }, [selectedPlaceId, hasSelectedInList, initialSelectedPlace?.place_id]);

  // ✅ pickモードのときだけ：初期選択・選択変更時に、その行へスクロール
  useEffect(() => {
    if (!isPickMode) return;
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
  }, [isPickMode, selectedPlaceId, items.length]);

  if (loading) return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">読み込み中…</div>;

  if (!items.length && !showPinnedSelected) {
    return (
      <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">近くの候補が見つかりませんでした。</div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ✅ pickモード時のみ：選択中が近隣候補にいない場合の違和感ケア */}
      {isPickMode && !!selectedPlaceId && !hasSelectedInList && (
        <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-900">
          選択中の神社は「近くの候補」に見つかりませんでした（場所が離れている可能性）。地図上で確認できます。
        </div>
      )}

      {/* ✅ 2枚目状態の核：選択中（固定）カードを最上段に表示 */}
      {showPinnedSelected && (
        <button
          type="button"
          onClick={() => {
            const pid = initialSelectedPlace?.place_id;
            if (!pid) return;
            // pick無し：詳細へ / pickあり：選択に戻る
            handleClick(pid);
          }}
          className="w-full rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-left"
        >
          <div className="text-[11px] font-semibold text-emerald-700">{isPickMode ? "選択中" : "おすすめ（起点）"}</div>
          <div className="mt-1 text-sm font-semibold">{initialSelectedPlace?.name ?? "（名称不明）"}</div>
          <div className="mt-1 text-xs text-slate-600">{initialSelectedPlace?.address ?? ""}</div>
          <div className="mt-2 text-[11px] text-slate-600">
            {isPickMode ? "この神社を選択中です" : "タップで神社の詳細へ"}
          </div>
        </button>
      )}

      {/* 近隣候補リスト */}
      {items.map((x) => {
        const active = x.place_id === selectedPlaceId;

        return (
          <button
            key={x.place_id}
            ref={(node) => {
              rowRefs.current[x.place_id] = node;
            }}
            type="button"
            onClick={() => handleClick(x.place_id)}
            className={`w-full rounded-xl border p-3 text-left ${
              // pick無しは遷移するのでアクティブ強調は薄めでも良いが、いまは共通のまま
              active ? "border-emerald-400 bg-emerald-50" : "bg-white"
            }`}
          >
            <div className="text-sm font-semibold">{x.name}</div>
            <div className="mt-1 text-xs text-slate-600">{x.address}</div>
            {!isPickMode && <div className="mt-2 text-[11px] text-slate-500">タップで詳細へ</div>}
          </button>
        );
      })}
    </div>
  );
}
