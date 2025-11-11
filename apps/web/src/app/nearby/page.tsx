"use client";

import { useEffect, useState } from "react";

type ShrineItem = {
  id: number;
  name_jp: string | null;
  distance_m?: number | null;
};

export default function NearbyPage() {
  const [items, setItems] = useState<ShrineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let abort = false;

    async function run() {
      try {
        // 位置情報取得（失敗時は東京駅にフォールバック）
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          if (!navigator.geolocation)
            return rej(new Error("geolocation not supported"));
          navigator.geolocation.getCurrentPosition(res, rej, {
            enableHighAccuracy: true,
            timeout: 8000,
          });
        }).catch(() => null as GeolocationPosition | null);

        const lat = pos?.coords?.latitude ?? 35.681236; // fallback: 東京駅
        const lng = pos?.coords?.longitude ?? 139.767125;

        // 同一オリジンの /api を使用（SSR/環境変数不要）
        const r = await fetch(
          `/api/shrines/nearest?lat=${lat}&lng=${lng}&limit=20`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();

        // 互換: 配列 or {results: []}
        const list: ShrineItem[] = Array.isArray(data)
          ? data
          : data.results ?? [];
        if (!abort) setItems(list);
      } catch (e: any) {
        if (!abort) setErr(e?.message ?? "failed to load");
      } finally {
        if (!abort) setLoading(false);
      }
    }

    run();
    return () => {
      abort = true;
    };
  }, []);

  if (loading) return <main className="p-4">近くの神社を検索中…</main>;
  if (err) return <main className="p-4 text-red-600">読み込み失敗: {err}</main>;
  if (!items.length)
    return <main className="p-4">近くの神社が見つかりませんでした。</main>;

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-xl font-bold">近くの神社</h1>
      <ul className="grid gap-2">
        {items.map((s) => (
          <li
            key={s.id}
            data-testid="nearby-item"
            className="p-3 rounded border"
          >
            <div className="font-medium">{s.name_jp ?? `#${s.id}`}</div>
            {typeof s.distance_m === "number" && (
              <div className="text-sm text-gray-500">
                {Math.round(s.distance_m)} m
              </div>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
