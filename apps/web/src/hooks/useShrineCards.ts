// apps/web/src/hooks/useShrineCards.ts
"use client";

import { useEffect, useMemo, useState } from "react";
import { getShrines, type Shrine } from "@/lib/api/shrines";
import { buildShrineCardProps, type ShrineCardAdapterProps } from "@/components/shrine/buildShrineCardProps";

type Result = {
  cards: ShrineCardAdapterProps[];
  loading: boolean;
  error: string | null;
};

export function useShrineCards(): Result {
  const [shrines, setShrines] = useState<Shrine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    getShrines()
      .then((data) => {
        if (!alive) return;
        setShrines(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!alive) return;
        setError("神社データの取得に失敗しました");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const cards = useMemo(() => {
    return shrines.map((s) => buildShrineCardProps(s).cardProps);
  }, [shrines]);

  return { cards, loading, error };
}
