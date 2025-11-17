"use client";
// src/app/concierge/page.tsx

import api from "@/lib/api";


import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFavorite } from "@/hooks/useFavorite";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";


const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
});

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
  distance_m?: number;
  distance_text?: string;
};

type GeocodeResult = {
  lat: number;
  lon: number;
  formatted: string;
  precision: "rooftop" | "street" | "city" | "region" | "approx";
  provider: string;
};

// ===== 共通GET（null返しでUIを落とさない / Axios版） =====
async function apiGet<T>(
  path: string,
  params?: Record<string, string | number>,
  signal?: AbortSignal
): Promise<T | null> {
  try {
    // 先頭スラッシュは削る（baseURLと二重スラッシュ防止）
    const p = path.replace(/^\//, "");
    const res = await api.get<T>(p, { params, signal });
    return (res.data as T) ?? null;
  } catch {
    return null;
  }
}

function fmtDistance({ meters, text }: { meters?: number; text?: string }) {
  if (text && text.trim()) return text;
  if (typeof meters !== "number") return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return `${(Math.round(km * 10) / 10).toFixed(1)}km`;
}

// 簡易★ボタン（初期はfalseでOK）
function FavButton({ shrineId }: { shrineId: number }) {
  const { fav, busy, toggle } = useFavorite({ shrineId, initial: false });
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      className="text-sm"
    >
      {busy ? "…" : fav ? "★" : "☆"}
    </button>
  );
}

export default function ConciergePage() {
  const [mode, setMode] = useState<"popular" | "nearby">("popular");
  const [radiusM, setRadiusM] = useState<number>(2000);

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

        // 近い順モード：/shrines/nearest/（起点が必要）
        if (mode === "nearby" && o) {
          const params = { ...baseParams, lat: o.lat, lng: o.lng, radius_m: radiusM };
          const data = await apiGet<any>(
            "/shrines/nearest/",
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
              distance_m:
                typeof s.distance === "number" ? s.distance : undefined,
              distance_text:
                typeof s.distance_text === "string"
                  ? s.distance_text
                  : undefined,
            }));
            setCandidates(cs);
            setSelectedIdx(0);
            return;
          }
        }

        // 人気順（or nearbyでデータなし）→ populars → shrines
        if (!list || list.length === 0) {
          const popParams = {
            ...baseParams,
            ...(o ? { lat: o.lat, lng: o.lng } : {}),
          };
          let data = await apiGet<any>(
            "/populars/",
            popParams,
            listAbortRef.current.signal
          );
          list = Array.isArray(data) ? data : (data as any)?.results ?? [];

          if (!list || list.length === 0) {
            data = await apiGet<any>(
              "/shrines/",
              baseParams,
              listAbortRef.current.signal
            );
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
          distance_m: typeof s.distance === "number" ? s.distance : undefined,
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
    [mode, radiusM]
  );

  // 起点 or mode が変わったら候補を取得
  useEffect(() => {
    fetchCandidates(origin);
    return () => listAbortRef.current?.abort();
  }, [origin, mode, radiusM, fetchCandidates]);

  // 住所検索
  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    // 外部API遮断中はスキップ
    if (process.env.NEXT_PUBLIC_DISABLE_EXTERNAL_APIS === "1") {
      setGeoMsg(
        "開発モード: 外部APIが無効です（場所検索はOFF）。現在地ボタン or 手動で候補を選んでください。"
      );
      return;
    }

    if (!q.trim()) return;
    setSearching(true);
    setGeoCandidates([]);
    setGeoMsg(null);

    if (geocodeAbortRef.current) geocodeAbortRef.current.abort();
    geocodeAbortRef.current = new AbortController();

    try {
      // /places/search/?q=...（プロキシ経由）
      const data = await apiGet<any>(
        "/places/search/",
        { q },
        geocodeAbortRef.current.signal
      );
      const first = data?.results?.[0];
      if (
        first &&
        typeof first.lat === "number" &&
        typeof first.lng === "number"
      ) {
        const o = { lat: first.lat, lng: first.lng };
        setOrigin(o);
        setOriginLabel(first.name ?? first.address ?? q);
        setGeoMsg("起点を更新しました");
        fetchCandidates(o);
      } else {
        setGeoMsg("見つかりませんでした");
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
    () =>
      selected
        ? { lat: Number(selected.latitude), lng: Number(selected.longitude) }
        : null,
    [selected]
  );

  // apps/web/src/app/concierge/page.tsx の return 部分イメージ

return (
  <main className="max-w-6xl mx-auto p-4 space-y-6">
    <h1 className="text-xl font-bold">AI神社コンシェルジュ（スポット×ルート）</h1>

    {/* 2カラムレイアウト：左＝相談＆履歴、右＝検索〜ルート */}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* === 左カラム：相談フォーム + 履歴 + ログ === */}
      <section className="space-y-4 rounded-lg border bg-white p-4">
        <ConciergeLayout />
      </section>

      

      {/* === 右カラム：検索条件 + おすすめスポット + ルート案内 === */}
      <section className="space-y-4">
        {/* 検索条件エリア */}
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">検索条件</h2>

          {/* 並び替え + 半径 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("popular")}
              aria-pressed={mode === "popular"}
              className={`px-2 py-1 rounded text-sm ${mode === "popular" ? "bg-blue-600 text-white" : "bg-gray-100"}`}
            >
              人気順
            </button>

            <button
              type="button"
              onClick={() => setMode("nearby")}
              disabled={!origin}
              aria-pressed={mode === "nearby"}
              title={!origin ? "起点を設定してください" : ""}
              className={`px-2 py-1 rounded text-sm ${
                mode === "nearby" ? "bg-blue-600 text-white" : "bg-gray-100"
              } ${!origin ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              近い順
            </button>

            {mode === "nearby" && (
              <label className="ml-2 flex items-center gap-1 text-sm">
                半径
                <select
                  value={radiusM}
                  onChange={(e) => setRadiusM(Number(e.target.value))}
                  disabled={!origin}
                  className="rounded border px-2 py-1"
                  aria-label="検索半径"
                >
                  <option value={500}>500m</option>
                  <option value={1000}>1km</option>
                  <option value={2000}>2km</option>
                </select>
              </label>
            )}
          </div>

          {/* 起点入力 */}
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              起点：{origin ? originLabel : "未設定（現在地取得を許可 or 検索）"}
            </div>

            <form onSubmit={onSearch} className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="起点の場所（例：東京駅／渋谷駅／明治神宮外苑）"
                className="flex-1 rounded border p-2"
                aria-label="起点の場所を入力"
              />

              <button
                type="submit"
                disabled={searching || !q.trim()}
                aria-busy={searching}
                className="rounded bg-blue-500 px-4 py-2 text-sm text-white disabled:opacity-60"
              >
                {searching ? "起点を検索中..." : "起点を検索"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) return;
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      const o = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                      };
                      setOrigin(o);
                      setOriginLabel("現在地");
                      fetchCandidates(o);
                    },
                    () => setGeoMsg("現在地を取得できませんでした"),
                  );
                }}
                className="rounded bg-gray-200 px-3 py-2 text-sm"
              >
                現在地を使う
              </button>
            </form>

            {geoMsg && <p className="text-sm text-gray-700">{geoMsg}</p>}
            {geoCandidates.length > 0 && (
              <ul className="divide-y rounded border">
                {geoCandidates.map((g, i) => (
                  <li
                    key={`${g.lat}-${g.lon}-${i}`}
                    className="cursor-pointer p-2 hover:bg-gray-50"
                    onClick={() => selectGeocode(g)}
                  >
                    {g.formatted} <span className="text-xs text-gray-500">({g.precision})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* おすすめスポット */}
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">おすすめスポット</h2>
          {loadingList ? (
            <p>候補を取得中…</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : candidates.length === 0 ? (
            <p>候補がありません</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {candidates.map((s, idx) => (
                <li
                  key={s.id}
                  className={`cursor-pointer rounded border p-3 ${idx === selectedIdx ? "ring-2 ring-blue-400" : ""}`}
                  onClick={() => setSelectedIdx(idx)}
                >
                  <div className="font-semibold">{s.name_jp ?? s.name}</div>
                  <div className="text-sm text-gray-600">{s.address ?? ""}</div>

                  {(typeof s.distance_m === "number" || s.distance_text) && (
                    <div className="mt-1 text-xs text-gray-500">
                      {fmtDistance({
                        meters: s.distance_m,
                        text: s.distance_text,
                      })}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Link href={`/shrines/${s.id}`} className="text-sm text-blue-600 underline">
                      詳細へ
                    </Link>
                    <FavButton shrineId={s.id} />
                  </div>

                  {origin && (
                    <a
                      className="mt-2 inline-block text-xs underline"
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${
                        origin.lng
                      }&destination=${Number(s.latitude)},${Number(s.longitude)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      外部マップで経路
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ルート表示 */}
        <div className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold">ルート案内</h2>
          {!origin ? (
            <p>現在地が未取得です。起点を検索して設定してください。</p>
          ) : !destination ? (
            <p>候補を選択してください。</p>
          ) : (
            <RouteMap origin={origin} destination={destination} />
          )}
        </div>
      </section>
    </div>
  </main>
);
}
