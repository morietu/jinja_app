// apps/web/src/hooks/usePopularShrines.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPopular, type Shrine } from "@/lib/api/popular";

export function usePopularShrines(opts: {
  limit?: number;
  near?: string; // "lat,lng"
  radiusKm?: number;
}) {
  const { limit = 20, near, radiusKm } = opts;

  const [items, setItems] = useState<Shrine[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  const load = useCallback(
    async (urlOverride?: string) => {
      setLoading(true);
      setError(null);
      try {
        // ▼ next ページ用：backend から返ってきた URL をそのまま叩く
        if (urlOverride) {
          const { items: got, next } = await fetchPopular({
            limit,
            near,
            radius_km: radiusKm,
            urlOverride,
          });
          setItems((prev) => [...prev, ...got]);
          setNext(next ?? null);
          // ページング時はフォールバック状態そのまま
          return;
        }

        // ▼ 1ページ目：近傍付きで取得
        const { items: first, next: firstNext } = await fetchPopular({
          limit,
          near,
          radius_km: radiusKm,
          urlOverride: null,
        });

        // 近傍指定あり ＋ 0件 → 全国人気TOPにフォールバック
        if (near && radiusKm && first.length === 0) {
          const { items: fbItems, next: fbNext } = await fetchPopular({
            limit,
            urlOverride: null, // near 指定なし
          });
          setItems(fbItems);
          setNext(fbNext ?? null);
          setIsFallback(true);
        } else {
          setItems(first);
          setNext(firstNext ?? null);
          setIsFallback(false);
        }
      } catch (e: any) {
        setError(e?.message ?? "failed to fetch popular shrines");
      } finally {
        setLoading(false);
      }
    },
    [limit, near, radiusKm],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(() => (next ? load(next) : undefined), [next, load]);

  return { items, loading, error, next, loadMore, isFallback };
}
