// apps/web/src/features/mypage/components/hooks/useMyGoshuin.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMyGoshuin, deleteMyGoshuin, updateMyGoshuinVisibility, type Goshuin } from "@/lib/api/goshuin";

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

      if (!items) return;

      const prev = items;
      // 楽観的削除
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

  const toggleVisibility = useCallback(
    async (id: number) => {
      if (!items) return;

      const prev = items;
      const target = items.find((g) => g.id === id);
      if (!target) return;

      const nextFlag = !target.is_public;

      // 楽観的更新
      setItems(items.map((g) => (g.id === id ? { ...g, is_public: nextFlag } : g)));

      try {
        await updateMyGoshuinVisibility(id, nextFlag);
      } catch (e) {
        console.error(e);
        // ロールバック
        setItems(prev);
        setError("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
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
    toggleVisibility,
  };
}
