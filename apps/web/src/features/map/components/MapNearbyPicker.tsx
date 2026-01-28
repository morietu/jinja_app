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
  onSelect: (x: { placeId: string; lat?: number | null; lng?: number | null }) => void;
  initialSelectedPlace?: {
    place_id: string | null;
    name: string | null;
    address: string | null;
  };
};

export default function MapNearbyPicker(props: Props) {
  const { limit = 10, coords, selectedPlaceId, onSelect, initialSelectedPlace } = props;

  const sp = useSearchParams();
  const isPickMode = sp.get("pick") === "goshuin";

  const la = coords?.lat ?? null;
  const ln = coords?.lng ?? null;

  const [phase, setPhase] = useState<"waiting_coords" | "loading" | "ready">("waiting_coords");
  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const lastKeyRef = useRef<string>("");

  // ✅ fetch effect（phaseもここで管理）
  useEffect(() => {
    console.log("nearby effect", { la, ln, limit });

    if (la == null || ln == null) {
      lastKeyRef.current = ""; // ✅ リセット（好みだけど安定する）
      setPhase("waiting_coords");
      setItems([]); // 残像消したいなら
      return;
    }

    const key = `${la},${ln},${limit}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    const ac = new AbortController();
    setPhase("loading");

    (async () => {
      try {
        const r = await fetch(`/api/places/nearby?lat=${la}&lng=${ln}&limit=${limit}`, {
          cache: "no-store",
          signal: ac.signal,
        });
        if (!r.ok) throw new Error(`nearby failed: ${r.status}`);
        const data = (await r.json()) as PlacesNearbyResponse;
        setItems(data.results ?? []);
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setItems([]);
      } finally {
        if (!ac.signal.aborted) setPhase("ready");
      }
    })();

    return () => ac.abort();
  }, [la, ln, limit]);

  // ✅ useMemo 群（itemsが空でもOK）
  const hasSelectedInList = useMemo(() => {
    if (!selectedPlaceId) return false;
    return items.some((x) => x.place_id === selectedPlaceId);
  }, [items, selectedPlaceId]);

  const showPinnedSelected = useMemo(() => {
    if (!selectedPlaceId) return false;
    if (hasSelectedInList) return false;
    const pid = initialSelectedPlace?.place_id ?? null;
    return !!pid && pid === selectedPlaceId;
  }, [selectedPlaceId, hasSelectedInList, initialSelectedPlace?.place_id]);

  // ✅ scroll effect（phaseと無関係に宣言してOK）
  useEffect(() => {
    if (!isPickMode) return;
    if (!selectedPlaceId) return;

    const el = rowRefs.current[selectedPlaceId];
    if (!el) return;

    const id = window.setTimeout(() => {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }, 0);

    return () => window.clearTimeout(id);
  }, [isPickMode, selectedPlaceId, items.length]);

  // ✅ ここから return 分岐（hooksの後）
  if (phase === "waiting_coords") {
    return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">位置情報を取得中…</div>;
  }
  if (phase === "loading") {
    return <div className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-500">読み込み中…</div>;
  }

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
                onClick={() => onSelect({ placeId: pid })}
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
                onSelect({ placeId: x.place_id, lat: x.lat ?? null, lng: x.lng ?? null });
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
