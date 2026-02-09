// apps/web/src/features/map/components/MapCardListClient.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { PlacesNearbyResponse, PlacesNearbyResult } from "@/lib/api/places.nearby.types";
import PlaceSuggestBox from "@/components/PlaceSuggestBox";
import type { PlaceCacheItem } from "@/lib/api/placeCaches";




const FALLBACK = { lat: 35.681236, lng: 139.767125 }; // 東京駅（仮）
const DEFAULT_LIMIT = 10;

type NearbyState = "idle" | "loading" | "error" | "empty" | "ready";

// ✅ 最小 client log（DEBUG_LOG=1 のときだけ）
const DEBUG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LOG === "1";
function clientLog(event: string, payload?: Record<string, unknown>) {
  if (!DEBUG) return;

  console.log(`[map] ${event}`, payload ?? {});
}

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
  const [usedFallback, setUsedFallback] = useState(false);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceCacheItem | null>(null);
  const mode: "nearby" | "search" = selected ? "search" : "nearby";

  const [items, setItems] = useState<PlacesNearbyResult[]>([]);
  const [state, setState] = useState<NearbyState>("idle");
  const [err, setErr] = useState<string | null>(null);

  // 位置情報
  useEffect(() => {
    let cancelled = false;
    setLoadingLoc(true);

    if (!navigator.geolocation) {
      clientLog("LOC_UNSUPPORTED");
      setCoords(FALLBACK);
      setUsedFallback(true);
      setLoadingLoc(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        clientLog("LOC_OK", { acc: pos.coords.accuracy });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsedFallback(false);
        setLoadingLoc(false);
      },
      (e) => {
        if (cancelled) return;
        // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
        const code = (e as GeolocationPositionError | undefined)?.code;
        if (code === 1) clientLog("LOC_DENIED");
        else clientLog("LOC_FAILED", { code });

        setCoords(FALLBACK);
        setUsedFallback(true);
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
    setState("loading");

    try {
      const qs = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        limit: String(DEFAULT_LIMIT),
      });

      const r = await fetch(`/api/places/nearby?${qs.toString()}`, { cache: "no-store" });

      if (!r.ok) {
        clientLog("NEARBY_ERR", { status: r.status });
        setErr(`status=${r.status}`);
        setItems([]);
        setState("error");
        return;
      }

      const data = (await r.json().catch(() => null)) as PlacesNearbyResponse | null;
      const results = Array.isArray(data?.results) ? data!.results : [];

      clientLog("NEARBY_OK", { count: results.length });
      setItems(results);

      setState(results.length === 0 ? "empty" : "ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      clientLog("NEARBY_ERR", { message: msg });
      setErr(msg);
      setItems([]);
      setState("error");
    }
  }, []);

  // coords が決まったら nearby 取得
  useEffect(() => {
    if (!coords) return;
    if (mode !== "nearby") return; // ✅ 検索確定中は nearby を取りに行かない
    void fetchNearby(coords.lat, coords.lng);
  }, [coords, fetchNearby, mode]);

  const title = useMemo(() => {
    if (loadingLoc) return "位置情報を取得中…";
    return "近くの神社";
  }, [loadingLoc]);

  // 右上の actionLabel は「更新」系だけにする
  const actionLabel = useMemo(() => {
    if (state === "loading") return "更新中…";
    return "更新";
  }, [state]);

  // empty/error のときはヘッダーに出さない
  const showHeaderAction = state === "idle" || state === "loading" || state === "ready";

  const canAction = !!coords && state !== "loading";

  // 空状態の補助リンク（周辺検索をGoogleに投げる）
  const googleSearchNearbyUrl = useMemo(() => {
    // fallbackでも「東京駅 周辺 神社」で検索できる
    const base = usedFallback ? "東京駅 周辺 神社" : "周辺 神社";
    return `https://www.google.com/maps/search/?api=1&query=${enc(base)}`;
  }, [usedFallback]);

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        <PlaceSuggestBox
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSelected(null); // ✅ 入力し直したら未確定に戻す
          }}
          onSelect={(it) => {
            setSelected(it);
            setQuery(it.name); // ✅ 確定感
          }}
        />

        {mode === "search" && (
          <button
            type="button"
            className="w-full rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
          >
            クリアして「近くの神社」に戻る
          </button>
        )}
      </div>

      {mode === "search" && selected ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-700">検索結果</p>
          <div className="mt-2 space-y-1">
            <p className="text-sm font-semibold text-slate-900">{selected.name}</p>
            <p className="text-xs text-slate-500">{selected.address}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <a
              className="flex-1 rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              href={buildGoogleMapsSearchUrl(selected.name, selected.address)}
              target="_blank"
              rel="noreferrer"
            >
              Googleマップで見る
            </a>
            <a
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
              href={buildGoogleMapsDirUrl({
                lat: selected.lat ?? undefined,
                lng: selected.lng ?? undefined,
                address: selected.address,
              })}
              target="_blank"
              rel="noreferrer"
            >
              ルート
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* ✅ Fallbackバッジ */}
          {usedFallback && !loadingLoc && (
            <div className="rounded-xl border bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              現在地が取れないため仮の場所で検索中
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">{title}</p>

            {showHeaderAction && (
              <button
                type="button"
                onClick={() => coords && fetchNearby(coords.lat, coords.lng)}
                className="rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={!canAction}
                aria-busy={state === "loading"}
              >
                {actionLabel}
              </button>
            )}
          </div>

          {/* ✅ 空状態の補足文言 */}
          {(state === "empty" || state === "error") && (
            <p className="text-[11px] text-slate-500">Googleマップで探すと、周辺の神社を直接検索できます。</p>
          )}

          {err && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              取得に失敗しました: {err}
            </div>
          )}

          {state === "loading" && (
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">近くの神社を探しています…</div>
          )}

          {(state === "empty" || state === "error") && (
            <div className="rounded-xl border bg-white p-4 text-sm text-slate-500">
              {state === "error" ? "取得に失敗しました。" : "近くの候補が見つかりませんでした。"}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => coords && fetchNearby(coords.lat, coords.lng)}
                  className="flex-1 rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={!canAction}
                >
                  再試行
                </button>
                <a
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                  href={googleSearchNearbyUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Googleマップで探す
                </a>
              </div>
            </div>
          )}

          {state === "ready" && (
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

                    {/* ✅ CTA固定（2つだけ） */}
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
          )}
        </>
      )}
    </div>
  );
}
