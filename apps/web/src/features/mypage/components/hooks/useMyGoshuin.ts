// apps/web/src/features/mypage/components/hooks/useMyGoshuin.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMyGoshuin, deleteMyGoshuin, type Goshuin } from "@/lib/api/goshuin";

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

  const removeItem = useCallback(
    async (id: number) => {
      setError(null);

      // items が null のときは何もしない
      if (!items) return;

      // 楽観的に削除
      const prev = items;
      setItems(prev.filter((g) => g.id !== id));

      try {
        await deleteMyGoshuin(id);
      } catch (e) {
        console.error(e);
        // ロールバック
        setItems(prev);
        setError("削除に失敗しました。時間をおいて再度お試しください。");
      }
    },
    [items],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return {
    items,
    loading,
    error,
    reload: load,
    addItem,
    removeItem,
  };
}
