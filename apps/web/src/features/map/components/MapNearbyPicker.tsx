"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import { resolvePlace } from "@/lib/api/places";
import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";

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
  const router = useRouter();

  const isPickMode = sp.get("pick") === "goshuin";

  const la = coords?.lat ?? null;
  const ln = coords?.lng ?? null;

  const [phase, setPhase] = useState<"waiting_coords" | "loading" | "ready">("waiting_coords");
  const [items, setItems] = useState<PlacesNearbyResponse["results"]>([]);
  const rowRefs = useRef<Record<string, HTMLElement | null>>({});

  const [resolvingPid, setResolvingPid] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");

  const tid = sp.get("tid");

  // ctx/tid 付きで /shrines/resolve を作る（文字列連結の事故を防ぐ）
  const buildResolveHref = useCallback(
    (placeId: string) => {
      const q = new URLSearchParams();
      q.set("place_id", placeId);
      q.set("ctx", "map");
      if (tid) q.set("tid", tid);
      return `/shrines/resolve?${q.toString()}`;
    },
    [tid],
  );

  // ✅ fetch effect（phaseもここで管理）
  useEffect(() => {
    console.log("nearby effect", { la, ln, limit });

    if (la == null || ln == null) {
      lastKeyRef.current = "";
      setPhase("waiting_coords");
      setItems([]);
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

  // ✅ scroll effect
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

          const href = buildResolveHref(pid);

          if (isPickMode) {
            return (
              <button
                type="button"
                disabled={resolvingPid === pid}
                onClick={async () => {
                  if (resolvingPid) return;
                  setResolvingPid(pid);
                  try {
                    const r = await resolvePlace(pid);
                    // pickモードは「確定」なので直接 shrine 詳細へ
                    const q = new URLSearchParams();
                    q.set("ctx", "map");
                    if (tid) q.set("tid", tid);
                    router.push(`/shrines/${r.shrine_id}?${q.toString()}`);
                  } finally {
                    setResolvingPid(null);
                  }
                }}
                className={`w-full rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-left ${
                  resolvingPid === pid ? "opacity-60" : ""
                }`}
              >
                <div className="text-[11px] font-semibold text-emerald-700">選択中</div>
                <div className="mt-1 text-sm font-semibold">{initialSelectedPlace?.name ?? "（名称不明）"}</div>
                <div className="mt-1 text-xs text-slate-600">{initialSelectedPlace?.address ?? ""}</div>
                <div className="mt-2 text-[11px] text-slate-600">この神社を選択中です</div>
              </button>
            );
          }

          // 通常モード：resolve 統一（from-place を踏ませない）
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
        const href = buildResolveHref(x.place_id);

        if (isPickMode) {
          return (
            <button
              key={x.place_id}
              ref={(node) => {
                rowRefs.current[x.place_id] = node;
              }}
              type="button"
              onClick={async () => {
                // pick は選択だけ（詳細遷移しない）
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

        // 通常モード：Link で詳細へ
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
