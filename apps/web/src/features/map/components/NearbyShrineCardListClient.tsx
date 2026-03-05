"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { PlacesNearbyResponse } from "@/lib/api/places.nearby.types";
import { buildGoogleMapsDirUrl, buildGoogleMapsSearchUrl } from "@/lib/maps/googleMaps";
import { buildMapDetailHref } from "@/lib/nav/buildMapDetailHref";

import Link from "next/link";

const FALLBACK = { lat: 35.681236, lng: 139.767125 }; // 東京駅
const DEFAULT_LIMIT = 10;

type NearbyState = "idle" | "loading" | "error" | "empty" | "ready";
type NearbyItemView = PlacesNearbyResponse["results"][number] & {
  detailHref?: string | null;
};

const DEBUG = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEBUG_LOG === "1";

function dedupeKey(p: any) {
  const sid = p?.shrine_id ?? null;
  const pid = p?.place_id ?? null;
  if (pid) return `place:${pid}`;
  if (sid) return `shrine:${sid}`;
  // fallbackは “idx混ぜると毎回変わってデバッグ不能” なので注意
  return `fallback:${p?.name ?? ""}:${p?.lat ?? ""},${p?.lng ?? ""}:${p?.address ?? ""}`;
}

function logDedupe(label: string, arr: any[]) {
  if (!DEBUG) return;
  const keys = arr.map((p) => dedupeKey(p));
  const unique = new Set(keys);
  clientLog(label, { total: keys.length, unique: unique.size, dup: keys.length - unique.size });
  // 必要ならこれも（重いので普段はオフ）
  // console.log(keys);
}


function clientLog(event: string, payload?: Record<string, unknown>) {
  if (!DEBUG) return;
  console.log(`[map] ${event}`, payload ?? {});
}

export default function NearbyShrineCardListClient() {
  const sp = useSearchParams();
  const tid = sp.get("tid");

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [usedFallback, setUsedFallback] = useState(false);

  const [items, setItems] = useState<NearbyItemView[]>([]);
  const [state, setState] = useState<NearbyState>("idle");
  const [err, setErr] = useState<string | null>(null);

  const lastKeyRef = useRef<string>("");
  const abortRef = useRef<AbortController | null>(null);

  // 位置情報取得
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
        clientLog("LOC_FAILED", { code: (e as any).code });
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

  const fetchNearby = useCallback(
    async (lat: number, lng: number) => {
      // ✅ state を依存に入れると setState(loading) で関数が再生成され、
      // 呼び出し側の useEffect が再発火するリスクがあるため、state は依存から外します。
      const key = `${lat},${lng},${DEFAULT_LIMIT},${tid ?? ""}`;
      if (lastKeyRef.current === key && items.length > 0) return; // state の代わりに items を参照
      lastKeyRef.current = key;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setErr(null);
      setState("loading");

      try {
        const qs = new URLSearchParams({
          lat: String(lat),
          lng: String(lng),
          limit: String(DEFAULT_LIMIT),
        });

        const r = await fetch(`/api/places/nearby?${qs.toString()}`, {
          cache: "no-store",
          signal: ac.signal,
        });

        if (!r.ok) {
          setErr(`status=${r.status}`);
          setItems([]);
          setState("error");
          return;
        }

        const data = (await r.json()) as PlacesNearbyResponse;
        const results = Array.isArray(data?.results) ? data.results : [];

        
        
        
        // ✅ ここで一括で View Model 化
        const viewItems: NearbyItemView[] = results.map((p) => ({
          ...p,
          detailHref: buildMapDetailHref({
            shrineId: (p as any).shrine_id ?? null,
            placeId: p.place_id ?? null,
            tid,
          }),
        }));



        setItems(viewItems);
        setState(viewItems.length === 0 ? "empty" : "ready");
        clientLog("NEARBY_OK", { count: viewItems.length });
      } catch (e) {
        if ((e as any)?.name === "AbortError") return;
        setErr(e instanceof Error ? e.message : "Fetch error");
        setItems([]);
        setState("error");
      }
    },
    [tid, items.length], // stateを外し、リトライを許容するために items.length を参照
  );

  useEffect(() => {
    if (!coords) return;
    fetchNearby(coords.lat, coords.lng);
    return () => abortRef.current?.abort();
  }, [coords, fetchNearby]);

  useEffect(() => {
    logDedupe("NEARBY_RENDER_ITEMS", items);
  }, [items]);

  // UI Helper
  const title = loadingLoc ? "位置情報を取得中…" : "近くの神社";
  const canAction = !!coords && state !== "loading";

  const googleSearchNearbyUrl = useMemo(() => {
    const base = usedFallback ? "東京駅 周辺 神社" : "周辺 神社";
    return buildGoogleMapsSearchUrl(base);
  }, [usedFallback]);

  return (
    <div className="flex flex-col gap-3">
      {/* デバッグ用表示：必要なら残す */}
      {DEBUG && (
        <div className="text-[10px] text-slate-400">
          state={state} | items={items.length}
        </div>
      )}

      {usedFallback && !loadingLoc && (
        <div className="rounded-xl border bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          現在地が取れないため仮の場所（東京駅）で検索中
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">{title}</p>
        <button
          type="button"
          onClick={() => {
            if (!coords) return;
            lastKeyRef.current = ""; // ✅ 更新ボタンだけ強制リフレッシュ
            void fetchNearby(coords.lat, coords.lng);
          }}
          className="rounded-full border px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={!canAction}
        >
          {state === "loading" ? "更新中…" : "更新"}
        </button>
      </div>

      {/* エラー表示 */}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          取得に失敗しました: {err}
        </div>
      )}

      {/* ローディング・スケルトン風 */}
      {state === "loading" && items.length === 0 && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {/* 空・エラー時のフォールバック */}
      {(state === "empty" || state === "error") && (
        <div className="rounded-xl border bg-white p-4 text-center">
          <p className="text-sm text-slate-500">
            {state === "error" ? "情報の取得に失敗しました。" : "近くに候補が見つかりませんでした。"}
          </p>
          <div className="mt-3 flex gap-2">
            <a
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white"
              href={googleSearchNearbyUrl}
              target="_blank"
              rel="noreferrer"
            >
              Googleマップで探す
            </a>
          </div>
        </div>
      )}

      {/* リスト表示 */}
      {state !== "loading" && items.length > 0 ? (
        <ul className="space-y-3">
          {items.map((p) => {
            const shrineId = (p as any).shrine_id ?? null;

            const key =
              p.place_id ??
              (shrineId
                ? `shrine:${shrineId}`
                : `fallback:${p.name}:${p.lat ?? ""},${p.lng ?? ""}:${p.address ?? ""}`);

            return (
              <li key={key} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  {p.address ? <p className="text-xs text-slate-500">{p.address}</p> : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {p.detailHref ? (
                    <Link
                      className="col-span-2 rounded-xl bg-slate-900 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                      href={p.detailHref}
                      prefetch={false}
                    >
                      詳細を見る
                    </Link>
                  ) : null}

                  <a
                    className="rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    href={buildGoogleMapsSearchUrl(p.name, p.address ?? undefined)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Googleマップ
                  </a>

                  <a
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
                    href={buildGoogleMapsDirUrl({
                      lat: p.lat ?? undefined,
                      lng: p.lng ?? undefined,
                      address: p.address ?? undefined,
                      fallbackName: p.name,
                    })}
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
      ) : null}
    </div>
  );
}
