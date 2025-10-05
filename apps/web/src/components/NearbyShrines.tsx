"use client";

import { useEffect, useState } from "react";
import { fetchNearestShrines, type Shrine } from "@/lib/shrines";
import { useGeolocation } from "@/hooks/useGeolocation";

export default function NearbyShrines({ limit = 10 }: { limit?: number }) {
  const { coords, error: geoError, loading } = useGeolocation();
  const [items, setItems] = useState<Shrine[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    async function run() {
      if (!coords) return;
      setFetching(true);
      setErr(null);
      try {
        const list = await fetchNearestShrines(coords.lat, coords.lng, limit);
        setItems(list);
      } catch (e: any) {
        setErr(e?.message ?? "取得に失敗しました");
      } finally {
        setFetching(false);
      }
    }
    run();
  }, [coords?.lat, coords?.lng, limit]);

  if (loading) return <p>現在地を取得中…</p>;
  if (geoError) return <p>位置情報エラー: {geoError}</p>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2>近くの神社</h2>
      {fetching && <p>読み込み中…</p>}
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {!fetching && !items.length && <p>近くの神社が見つかりませんでした。</p>}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((s) => (
          <li key={s.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
            <strong>{s.name_jp}</strong>
            {s.distance_text ? <span>（{s.distance_text}）</span> : null}
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
