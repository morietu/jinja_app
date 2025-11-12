// apps/web/src/hooks/usePopularShrines.ts
import { useCallback, useEffect, useState } from "react";
import { fetchPopular, type Shrine } from "@/lib/api/popular";

export function usePopularShrines(opts: {
  limit?: number;
  near?: string;
  radiusKm?: number;
}) {
  const { limit = 20, near, radiusKm } = opts;
  const [items, setItems] = useState<Shrine[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (urlOverride?: string) => {
      setLoading(true);
      setError(null);
      try {
        const { items: got, next } = await fetchPopular({
          limit,
          near,
          radius_km: radiusKm,
          urlOverride,
        });
        setItems((prev) => (urlOverride ? [...prev, ...got] : got));
        setNext(next ?? null);
      } catch (e: any) {
        setError(e?.message ?? "failed");
      } finally {
        setLoading(false);
      }
    },
    [limit, near, radiusKm]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(
    () => (next ? load(next) : undefined),
    [next, load]
  );

  return { items, loading, error, next, loadMore };
}
