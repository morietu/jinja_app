"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), { ssr: false });

type LatLng = { lat: number; lng: number };
type ShrineLite = {
  id: number;
  name_jp: string;
  address: string;
  latitude: number;
  longitude: number;
  goriyaku_tags?: { id: number; name: string }[];
};

type GeocodeResult = {
  lat: number;
  lon: number;
  formatted: string;
  precision: "rooftop" | "street" | "city" | "region" | "approx";
  provider: string;
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_ORIGIN ?? "http://localhost:8000";

export default function ConciergePage() {
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

  // 現在地を取得
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("現在地");
      },
      () => {
        // 取得不可でもUIは使える（住所検索で起点を決めてもらう）
        setOrigin(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // 候補3件を取得（近い順APIがあればクエリに lat/lng を付ける）
  const fetchCandidates = useCallback(async (o: LatLng | null) => {
    setLoadingList(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", "3");
      if (o) {
        // 将来サーバでサポートされたら近い順に
        qs.set("lat", String(o.lat));
        qs.set("lng", String(o.lng));
      }

      // まずランキングを試す
      const r1 = await fetch(`${BACKEND}/api/ranking?${qs.toString()}`);
      if (r1.ok) {
        const data = await r1.json();
        const arr = Array.isArray(data) ? data : data?.results ?? [];
        if (arr.length > 0) {
          const cs: ShrineLite[] = arr.slice(0, 3).map((s: any) => ({
            id: s.id,
            name_jp: s.name_jp,
            address: s.address,
            latitude: Number(s.latitude),
            longitude: Number(s.longitude),
            goriyaku_tags: s.goriyaku_tags,
          }));
          setCandidates(cs);
          setSelectedIdx(0);
          return;
        }
      }

      // フォールバック：一覧
      const r2 = await fetch(`${BACKEND}/api/shrines/?${qs.toString()}`);
      if (!r2.ok) throw new Error("shrines not ok");
      const data2 = await r2.json();
      const list = Array.isArray(data2) ? data2 : data2?.results ?? [];
      const cs: ShrineLite[] = list.slice(0, 3).map((s: any) => ({
        id: s.id,
        name_jp: s.name_jp,
        address: s.address,
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
        goriyaku_tags: s.goriyaku_tags,
      }));
      setCandidates(cs);
      setSelectedIdx(0);
    } catch (e) {
      setError("候補の取得に失敗しました");
      setCandidates([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  // 起点決定後に候補を取りにいく
  useEffect(() => {
    fetchCandidates(origin);
  }, [origin, fetchCandidates]);

  // 住所検索 → /api/geocode
  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setGeoCandidates([]);
    setGeoMsg(null);
    try {
      const r = await fetch(`${BACKEND}/api/geocode?q=${encodeURIComponent(q)}&limit=5`);
      const data = await r.json();
      if (data.result) {
        const r0: GeocodeResult = data.result;
        setOrigin({ lat: r0.lat, lng: r0.lon });
        setOriginLabel(r0.formatted || q);
        setGeoMsg("起点を更新しました");
        // 起点変更後、候補を取り直す
        fetchCandidates({ lat: r0.lat, lng: r0.lon });
      } else if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        setGeoCandidates(data.candidates);
        setGeoMsg("候補から選んでください");
      } else {
        setGeoMsg(data.message || "見つかりませんでした");
      }
    } catch (e) {
      setGeoMsg("検索に失敗しました");
    } finally {
      setSearching(false);
    }
  };

  // 候補から起点選択
  const selectGeocode = (g: GeocodeResult) => {
    setOrigin({ lat: g.lat, lng: g.lon });
    setOriginLabel(g.formatted);
    setGeoCandidates([]);
    setGeoMsg("起点を更新しました");
    fetchCandidates({ lat: g.lat, lng: g.lon });
  };

  const selected = candidates[selectedIdx] || null;
  const destination = useMemo(
    () => (selected ? { lat: selected.latitude, lng: selected.longitude } : null),
    [selected]
  );

  return (
    <main className="p-4 space-y-6">
      <h1 className="text-xl font-bold">AI神社コンシェルジュ（スポット×ルート）</h1>

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
          />
          <button
            type="submit"
            disabled={searching || !q.trim()}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {searching ? "検索中..." : "検索"}
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
                <div className="font-semibold">{s.name_jp}</div>
                <div className="text-sm text-gray-600">{s.address}</div>
                {Array.isArray(s.goriyaku_tags) && s.goriyaku_tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {s.goriyaku_tags.slice(0, 4).map((t) => (
                      <span key={t.id} className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                {origin && (
                  <a
                    className="text-xs underline mt-2 inline-block"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${s.latitude},${s.longitude}`}
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
