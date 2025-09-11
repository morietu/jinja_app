// apps/web/src/app/plan/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

type PlanResp = {
  query: string;
  transportation: "walk" | "car";
  main: any | null;
  alternatives: any[];
  route_hints: any;
};

export default function PlanPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const query = (sp.get("query") || "").trim();
  const locationbiasQ = sp.get("locationbias") || "";

  const [mode, setMode] = useState<"walk" | "car">(
    (sp.get("mode") as "walk" | "car") || "walk"
  );
  const [data, setData] = useState<PlanResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 位置取得（任意）
  const [myLat, setMyLat] = useState<number | undefined>();
  const [myLng, setMyLng] = useState<number | undefined>();
  const locationbiasFromMyLoc = useMemo(
    () => buildLocationBias(myLat, myLng, 1500),
    [myLat, myLng]
  );

  // クエリストリングを安全に更新
  const updateQS = (patch: Record<string, string | undefined>) => {
    const usp = new URLSearchParams(Array.from(sp.entries()));
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) usp.delete(k);
      else usp.set(k, v);
    });
    router.replace(`/plan?${usp.toString()}`);
  };

  // API リクエスト（/api リライト経由 → next.config.ts の rewrites が効く）
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!query) {
      setData(null);
      return;
    }
    setLoading(true);
    setErr(null);

    // 直前のリクエストを中断
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const usp = new URLSearchParams({
      query,
      language: "ja",
      transportation: mode,
    });
    if (locationbiasQ) usp.set("locationbias", locationbiasQ);

    fetch(`/api/concierge/plan/?${usp.toString()}`, {
      cache: "no-store",
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          const t = await r.text().catch(() => "");
          throw new Error(`HTTP ${r.status} ${t}`);
        }
        return r.json();
      })
      .then((json) => setData(json))
      .catch((e) => {
        if (e.name !== "AbortError") setErr(e.message || "取得に失敗しました");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });

    // アンマウント時に中断
    return () => ac.abort();
  }, [query, locationbiasQ, mode, sp]);

  return (
    <main className="p-4 max-w-2xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">参拝プラン</h1>

      {/* 条件行 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="text-sm text-gray-600">
          対象: <strong className="text-gray-900">{query || "（未指定）"}</strong>
        </div>

        <div className="ml-auto flex gap-2 items-center">
          <select
            className="border rounded p-1"
            value={mode}
            onChange={(e) => {
              const m = e.target.value as "walk" | "car";
              setMode(m);
              updateQS({ mode: m });
            }}
          >
            <option value="walk">徒歩</option>
            <option value="car">車</option>
          </select>

          {/* 現在地 → locationbias に反映 */}
          <UseMyLocationButton
            onPick={(lat, lng) => {
              setMyLat(lat);
              setMyLng(lng);
              const lb = buildLocationBias(lat, lng, 1500);
              updateQS({ locationbias: lb });
            }}
          />
        </div>
      </div>

      {/* locationbias の表示（あれば） */}
      {(locationbiasQ || locationbiasFromMyLoc) && (
        <p className="text-xs text-gray-500">
          locationbias:
          <code className="ml-1">
            {locationbiasQ || locationbiasFromMyLoc}
          </code>
        </p>
      )}

      {/* ステータス */}
      {loading && <p>プラン作成中…</p>}
      {err && <p className="text-red-600 text-sm">エラー: {err}</p>}

      {/* 結果 */}
      {data && (
        <div className="space-y-3">
          <section className="p-3 border rounded">
            <h2 className="font-semibold">メイン</h2>
            {data.main ? (
              <div>
                <div>{data.main.name}</div>
                <div className="text-sm text-gray-600">{data.main.address}</div>
                {data.main.rating && (
                  <div className="text-sm">
                    ★ {data.main.rating}（{data.main.user_ratings_total ?? 0}件）
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">見つかりませんでした</p>
            )}
          </section>

          <section className="p-3 border rounded">
            <h3 className="font-semibold">近隣候補</h3>
            {data.alternatives.length === 0 ? (
              <p className="text-sm text-gray-500">候補がありません</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {data.alternatives.map((a, i) => (
                  <li key={a.place_id ?? i}>
                    <div>{a.name}</div>
                    <div className="text-xs text-gray-600">{a.address}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
