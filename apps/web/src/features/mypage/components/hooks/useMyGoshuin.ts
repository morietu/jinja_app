// apps/web/src/features/mypage/hooks/useMyGoshuin.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMyGoshuin, type Goshuin } from "@/lib/api/goshuin";

export function useMyGoshuin() {
  const [items, setItems] = useState<Goshuin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMyGoshuin();
      setItems(data);
    } catch {
      setError("御朱印一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = useCallback((g: Goshuin) => {
    setItems((prev) => {
      if (!prev) return [g];
      return [g, ...prev];
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: load,
    addItem,
  };
}
