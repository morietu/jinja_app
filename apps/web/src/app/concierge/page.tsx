"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFavorite } from "@/hooks/useFavorite";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), { ssr: false });

// ===== Types =====
type LatLng = { lat: number; lng: number };
type ShrineLite = {
  id: number;
  name_jp?: string;
  name?: string;
  address?: string;
  latitude: number | string;
  longitude: number | string;
  goriyaku_tags?: { id: number; name: string }[];
  distance?: number; // km
};

type GeocodeResult = {
  lat: number;
  lon: number;
  formatted: string;
  precision: "rooftop" | "street" | "city" | "region" | "approx";
  provider: string;
};

const NEARBY_RADIUS_M = 2000;

// ===== Config =====
const API_BASE =
  process.env.NEXT_PUBLIC_API ??
  process.env.NEXT_PUBLIC_BACKEND_ORIGIN ??
  "http://localhost:8000";

// ===== Common GET (null返しでUIを落とさない) =====
async function apiGet<T>(
  path: string,
  params?: Record<string, string | number>,
  signal?: AbortSignal
): Promise<T | null> {
  const qs = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${API_BASE}${path}${qs.toString() ? `?${qs.toString()}` : ""}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// 簡易★ボタン（初期はfalseでOK）
function FavButton({ shrineId }: { shrineId: number }) {
  const { fav, busy, toggle } = useFavorite(false, String(shrineId));
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={fav} className="text-sm">
      {busy ? "…" : fav ? "★" : "☆"}
    </button>
  );
}

export default function ConciergePage() {
  const [mode, setMode] = useState<"popular" | "nearby">("popular");

  // 起点
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string>("現在地");

  // 検索UI
  const [q, setQ] = useState("");
  const [geoCandidates, setGeoCandidates] = useState<GeocodeResult[]>([]);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);

  // 候補3件
  const [candidates, setCandidates] = useState<ShrineLite[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // 通知
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [searching, setSearching] = useState(false);

  // 中断用
  const listAbortRef = useRef<AbortController | null>(null);
  const geocodeAbortRef = useRef<AbortController | null>(null);

  // 現在地取得（失敗してもUI継続）
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("現在地");
      },
      () => setOrigin(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // 候補3件取得：mode に応じて入口エンドポイントを変える
  const fetchCandidates = useCallback(
    async (o: LatLng | null) => {
      setLoadingList(true);
      setError(null);

      if (listAbortRef.current) listAbortRef.current.abort();
      listAbortRef.current = new AbortController();

      try {
        const baseParams: Record<string, string | number> = { limit: 3 };
        if (o) {
          baseParams.lat = o.lat;
          baseParams.lng = o.lng;
        }

        let list: any[] = [];

        // 近い順モード：/nearby を最優先（起点が必要）
        if (mode === "nearby" && o) {
          const params = { ...baseParams, radius: NEARBY_RADIUS_M };
          const data = await apiGet<any>(
            "/api/shrines/nearby/",
            params,
            listAbortRef.current.signal
          );
          list = Array.isArray(data) ? data : (data as any)?.results ?? [];
          if (list.length > 0) {
            const cs: ShrineLite[] = list.slice(0, 3).map((s: any) => ({
              id: s.id,
              name_jp: s.name_jp ?? s.name,
              address: s.address ?? "",
              latitude: Number(s.latitude),
              longitude: Number(s.longitude),
              goriyaku_tags: s.goriyaku_tags,
              distance: typeof s.distance === "number" ? s.distance : undefined,
            }));
            setCandidates(cs);
            setSelectedIdx(0);
            return;
          }
        }

        // 人気順（または nearby でデータなし）→ popular → ranking → shrines
        if (!list || list.length === 0) {
          let data = await apiGet<any>(
            "/api/shrines/popular/",
            baseParams,
            listAbortRef.current.signal
          );
          list = Array.isArray(data) ? data : (data as any)?.results ?? [];

          if (!list || list.length === 0) {
            data = await apiGet<any>("/api/ranking", baseParams, listAbortRef.current.signal);
            list = Array.isArray(data) ? data : (data as any)?.results ?? [];
          }
          if (!list || list.length === 0) {
            data = await apiGet<any>("/api/shrines/", baseParams, listAbortRef.current.signal);
            list = Array.isArray(data) ? data : (data as any)?.results ?? [];
          }
        }

        if (!list || list.length === 0) {
          setCandidates([]);
          setSelectedIdx(0);
          return;
        }

        const cs: ShrineLite[] = list.slice(0, 3).map((s: any) => ({
          id: s.id,
          name_jp: s.name_jp ?? s.name,
          address: s.address ?? "",
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          goriyaku_tags: s.goriyaku_tags,
          distance: typeof s.distance === "number" ? s.distance : undefined,
        }));
        setCandidates(cs);
        setSelectedIdx(0);
      } catch {
        setError("候補の取得に失敗しました");
        setCandidates([]);
      } finally {
        setLoadingList(false);
      }
    },
    [mode]
  );

  // 起点 or mode が変わったら候補を取得
  useEffect(() => {
    fetchCandidates(origin);
    return () => listAbortRef.current?.abort();
  }, [origin, mode, fetchCandidates]);

  // 住所検索
  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setGeoCandidates([]);
    setGeoMsg(null);

    if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
    geocodeAbortRef.current = new AbortController();

    try {
      const r = await fetch(
        `${API_BASE}/api/geocode?q=${encodeURIComponent(q)}&limit=5`,
        { cache: "no-store", signal: geocodeAbortRef.current.signal }
      );
      const data = await r.json();

      if (data?.result) {
        const r0: GeocodeResult = data.result;
        const o = { lat: r0.lat, lng: r0.lon };
        setOrigin(o);
        setOriginLabel(r0.formatted || q);
        setGeoMsg("起点を更新しました");
        fetchCandidates(o);
      } else if (Array.isArray(data?.candidates) && data.candidates.length > 0) {
        setGeoCandidates(data.candidates);
        setGeoMsg("候補から選んでください");
      } else {
        setGeoMsg(data?.message || "見つかりませんでした");
      }
    } catch {
      setGeoMsg("検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  // 候補から起点選択
  const selectGeocode = (g: GeocodeResult) => {
    const o = { lat: g.lat, lng: g.lon };
    setOrigin(o);
    setOriginLabel(g.formatted);
    setGeoCandidates([]);
    setGeoMsg("起点を更新しました");
    fetchCandidates(o);
  };

  const selected = candidates[selectedIdx] || null;
  const destination = useMemo(
    () => (selected ? { lat: Number(selected.latitude), lng: Number(selected.longitude) } : null),
    [selected]
  );

  return (
    <main className="p-4 space-y-6">
      <h1 className="text-xl font-bold">AI神社コンシェルジュ（スポット×ルート）</h1>

      {/* 並び替えトグル */}
      <div className="flex gap-2">
        <button
          className={`px-2 py-1 rounded ${mode === "popular" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setMode("popular")}
        >
          人気順
        </button>
        <button
          className={`px-2 py-1 rounded ${mode === "nearby" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
          onClick={() => setMode("nearby")}
          disabled={!origin}
          title={!origin ? "起点を設定してください" : ""}
        >
          近い順
        </button>
      </div>

      {/* 起点入力 */}
      <section className="space-y-3">
        <div className="text-sm text-gray-600">
          起点：{origin ? originLabel : "未設定（現在地取得を許可 or 検索）"}
        </div>
        <form onSubmit={onSearch} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="起点の場所（例：東京駅／渋谷駅／明治神宮外苑）"
            className="border rounded p-2 flex-1"
            aria-label="起点の場所を入力"
          />
          <button
            type="submit"
            disabled={searching || !q.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded"
            aria-busy={searching}
          >
            {searching ? "検索中..." : "検索"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const o = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  setOrigin(o);
                  setOriginLabel("現在地");
                  fetchCandidates(o);
                },
                () => setGeoMsg("現在地を取得できませんでした")
              );
            }}
            className="bg-gray-200 px-3 py-2 rounded"
          >
            現在地を使う
          </button>
        </form>

        {/* geocode 候補 */}
        {geoMsg && <p className="text-sm text-gray-700">{geoMsg}</p>}
        {geoCandidates.length > 0 && (
          <ul className="border rounded divide-y">
            {geoCandidates.map((g, i) => (
              <li
                key={`${g.lat}-${g.lon}-${i}`}
                className="p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => selectGeocode(g)}
              >
                {g.formatted} <span className="text-xs text-gray-500">({g.precision})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 候補3件 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">おすすめスポット</h2>
        {loadingList ? (
          <p>候補を取得中…</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : candidates.length === 0 ? (
          <p>候補がありません</p>
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {candidates.map((s, idx) => (
              <li
                key={s.id}
                className={`border rounded p-3 cursor-pointer ${idx === selectedIdx ? "ring-2 ring-blue-400" : ""}`}
                onClick={() => setSelectedIdx(idx)}
              >
                <div className="font-semibold">{s.name_jp ?? s.name}</div>
                <div className="text-sm text-gray-600">{s.address ?? ""}</div>

                {/* 距離（nearby応答にあれば表示、単位はmに丸め） */}
                {typeof s.distance === "number" && (
                  <div className="text-xs text-gray-500 mt-1">{Math.round(s.distance * 1000)}m</div>
                )}

                {Array.isArray(s.goriyaku_tags) && s.goriyaku_tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.goriyaku_tags.slice(0, 4).map((t) => (
                      <span key={t.id} className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex gap-2 items-center">
                  <Link href={`/shrines/${s.id}`} className="text-blue-600 underline text-sm">
                    詳細へ
                  </Link>
                  <FavButton shrineId={s.id} />
                </div>

                {origin && (
                  <a
                    className="text-xs underline mt-2 inline-block"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${Number(
                      s.latitude
                    )},${Number(s.longitude)}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    外部マップで経路
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ルート表示 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">ルート案内</h2>
        {!origin ? (
          <p>現在地が未取得です。起点を検索して設定してください。</p>
        ) : !destination ? (
          <p>候補を選択してください。</p>
        ) : (
          <RouteMap origin={origin} destination={destination} />
        )}
      </section>
    </main>
  );
}
