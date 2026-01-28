// apps/web/src/features/map/components/MapNearbyPicker.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";
import Link from "next/link";

type Props = {
  limit?: number;
  coords: { lat: number; lng: number } | null;
  selectedPlaceId: string | null;
  onSelectPlaceId: (pid: string | null) => void;
  initialSelectedPlace?: {
    place_id: string | null;
    name: string | null;
    address: string | null;
  };
};


export default function MapNearbyPicker({
  limit = 10,
  coords,
  selectedPlaceId,
  onSelectPlaceId,
  initialSelectedPlace,
}: Props) {
  const sp = useSearchParams();
  const isPickMode = sp.get("pick") === "goshuin";

  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const [loading, setLoading] = useState(true);

  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const la = coords?.lat ?? null;
  const ln = coords?.lng ?? null;

  
  useEffect(() => {
    if (la == null || ln == null) {
      setLoading(true);
      return;
    }

    const ac = new AbortController();
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/places/nearby?lat=${la}&lng=${ln}&limit=${limit}`, {
          cache: "no-store",
          signal: ac.signal, // ✅ ここ
        });
        if (!r.ok) throw new Error(`nearby failed: ${r.status}`);
        const data = (await r.json()) as PlacesNearbyResponse;
        if (alive) setItems(data.results ?? []);
      } catch (e) {
        // ✅ abortは「エラー扱いしない」方がログが静か
        if ((e as any)?.name === "AbortError") return;
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      ac.abort(); // ✅ cleanupで中断
    };
  }, [la, ln, limit]);

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
      {isPickMode && !!selectedPlaceId && !hasSelectedInList && (
        <div className="rounded-xl border bg-amber-50 p-3 text-xs text-amber-900">
          選択中の神社は「近くの候補」に見つかりませんでした（場所が離れている可能性）。地図上で確認できます。
        </div>
      )}

      {showPinnedSelected &&
        (() => {
          const pid = initialSelectedPlace?.place_id;
          if (!pid) return null;

          const tid = sp.get("tid");
          const hrefSp = new URLSearchParams();
          hrefSp.set("ctx", "map");
          if (tid) hrefSp.set("tid", tid);

          const href = `/shrines/from-place/${encodeURIComponent(pid)}?${hrefSp.toString()}`;

          if (isPickMode) {
            return (
              <button
                type="button"
                onClick={() => onSelectPlaceId(pid)}
                className="w-full rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-left"
              >
                <div className="text-[11px] font-semibold text-emerald-700">選択中</div>
                <div className="mt-1 text-sm font-semibold">{initialSelectedPlace?.name ?? "（名称不明）"}</div>
                <div className="mt-1 text-xs text-slate-600">{initialSelectedPlace?.address ?? ""}</div>
                <div className="mt-2 text-[11px] text-slate-600">この神社を選択中です</div>
              </button>
            );
          }

          return (
            <Link href={href} className="block w-full rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-left">
              <div className="text-[11px] font-semibold text-emerald-700">おすすめ（起点）</div>
              <div className="mt-1 text-sm font-semibold">{initialSelectedPlace?.name ?? "（名称不明）"}</div>
              <div className="mt-1 text-xs text-slate-600">{initialSelectedPlace?.address ?? ""}</div>
              <div className="mt-2 text-[11px] text-slate-600">タップで神社の詳細へ</div>
            </Link>
          );
        })()}

      {items.map((x) => {
        const active = x.place_id === selectedPlaceId;

        const tid = sp.get("tid");
        const hrefSp = new URLSearchParams();
        hrefSp.set("ctx", "map");
        if (tid) hrefSp.set("tid", tid);

        const href = `/shrines/from-place/${encodeURIComponent(x.place_id)}?${hrefSp.toString()}`;

        if (isPickMode) {
          return (
            <button
              key={x.place_id}
              ref={(node) => {
                rowRefs.current[x.place_id] = node;
              }}
              type="button"
              onClick={() => {
                onSelectPlaceId(x.place_id);
              }}
              className={`w-full rounded-xl border p-3 text-left ${
                active ? "border-emerald-400 bg-emerald-50" : "bg-white"
              }`}
            >
              <div className="text-sm font-semibold">{x.name}</div>
              <div className="mt-1 text-xs text-slate-600">{x.address}</div>
            </button>
          );
        }

        // 通常モード：Link で詳細へ（onClick で selectedPlaceId を触らない）
        return (
          <Link
            key={x.place_id}
            href={href}
            className={`block w-full rounded-xl border p-3 text-left ${
              active ? "border-emerald-400 bg-emerald-50" : "bg-white"
            }`}
          >
            <div className="text-sm font-semibold">{x.name}</div>
            <div className="mt-1 text-xs text-slate-600">{x.address}</div>
            <div className="mt-2 text-[11px] text-slate-500">タップで詳細へ</div>
          </Link>
        );
      })}
    </div>
  );
}
