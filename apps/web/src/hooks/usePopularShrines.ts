"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPopular, fetchPopularPage, type Shrine } from "@/lib/api/popular";

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { items: first, next: firstNext } = await fetchPopular({
        limit,
        near,
        radius_km: radiusKm,
      });

      if (near && radiusKm && first.length === 0) {
        const { items: fbItems, next: fbNext } = await fetchPopular({ limit });
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
  }, [limit, near, radiusKm]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!next) return;

    setLoading(true);
    setError(null);

    try {
      const { items: got, next: n2 } = await fetchPopularPage(next);
      setItems((prev) => [...prev, ...got]);
      setNext(n2 ?? null);
    } catch (e: any) {
      setError(e?.message ?? "failed to fetch popular shrines");
    } finally {
      setLoading(false);
    }
  }, [next]);

  return { items, loading, error, next, loadMore, isFallback };
}
