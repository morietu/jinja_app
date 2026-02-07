// apps/web/src/features/map/components/MapCardListClient.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";

const FALLBACK = { lat: 35.681236, lng: 139.767125 }; // 東京駅（仮）
const DEFAULT_LIMIT = 10;

function enc(v: string) {
  return encodeURIComponent(v);
}

function buildGoogleMapsSearchUrl(name: string, address?: string) {
  const q = address ? `${name} ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${enc(q)}`;
}

function buildGoogleMapsDirUrl(dest: { lat?: number; lng?: number; address?: string }) {
  if (typeof dest.lat === "number" && typeof dest.lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(`${dest.lat},${dest.lng}`)}`;
  }
  if (dest.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${enc(dest.address)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${enc("東京駅")}`;
}

export default function MapCardListClient() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);

  const [items, setItems] = useState<PlacesNearbyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 位置情報
  useEffect(() => {
    let cancelled = false;
    setLoadingLoc(true);

    if (!navigator.geolocation) {
      setCoords(FALLBACK);
      setLoadingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoadingLoc(false);
      },
      () => {
        if (cancelled) return;
        setCoords(FALLBACK);
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    setErr(null);
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        limit: String(DEFAULT_LIMIT),
      });
      const r = await fetch(`/api/places/nearby?${qs.toString()}`, { cache: "no-store" });
      const data = (await r.json().catch(() => null)) as PlacesNearbyResponse | null;
      const results = Array.isArray(data?.results) ? data!.results : [];
      setItems(results);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // coords が決まったら nearby 取得
  useEffect(() => {
    if (!coords) return;
    void fetchNearby(coords.lat, coords.lng);
  }, [coords, fetchNearby]);

  const title = useMemo(() => {
    if (loadingLoc) return "位置情報を取得中…";
    if (coords && coords.lat === FALLBACK.lat && coords.lng === FALLBACK.lng) return "近くの神社（仮の場所）";
    return "近くの神社";
  }, [coords, loadingLoc]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <button
          type="button"
          onClick={() => coords && fetchNearby(coords.lat, coords.lng)}
          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          disabled={!coords || loading}
        >
          更新
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          取得に失敗しました: {err}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">近くの神社を探しています…</div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">近くの候補が見つかりませんでした。</div>
      )}

      <ul className="space-y-3">
        {items.map((p) => {
          const searchUrl = buildGoogleMapsSearchUrl(p.name, p.address ?? undefined);
          const dirUrl = buildGoogleMapsDirUrl({ lat: p.lat, lng: p.lng, address: p.address ?? undefined });

          return (
            <li key={p.place_id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                {p.address && <p className="text-xs text-slate-500">{p.address}</p>}
                {(p.rating != null || p.user_ratings_total != null) && (
                  <p className="text-[11px] text-slate-400">
                    {p.rating != null ? `★${p.rating}` : ""}
                    {p.user_ratings_total != null ? `（${p.user_ratings_total}件）` : ""}
                    {" ※詳細はGoogleマップで確認"}
                  </p>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <a
                  className="flex-1 rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  href={searchUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Googleマップで見る
                </a>
                <a
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                  href={dirUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  ルート
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
