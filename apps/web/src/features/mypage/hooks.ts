// apps/web/src/features/mypage/hooks.ts
"use client";

import { useEffect, useState, useCallback } from "react";

import type { Goshuin } from "@/lib/api/goshuin";
import { fetchMyGoshuin as fetchMyGoshuinApi, deleteMyGoshuin, updateMyGoshuinVisibility } from "@/lib/api/goshuin";

// useMe はそのままでOK

type UseMyGoshuinOptions = {
  enabled?: boolean;
};

export function useMyGoshuin(options: UseMyGoshuinOptions = {}) {
  const { enabled = true } = options;

  const [items, setItems] = useState<Goshuin[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchMyGoshuinApi();
        if (!cancelled) {
          setItems(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError("御朱印一覧の取得に失敗しました");
          console.error(e);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const addItem = useCallback((item: Goshuin) => {
    setItems((prev) => {
      if (!prev) return [item];
      return [item, ...prev];
    });
  }, []);

  const removeItem = useCallback(async (id: number) => {
    try {
      await deleteMyGoshuin(id);
      setItems((prev) => (prev ? prev.filter((g) => g.id !== id) : prev));
    } catch (e) {
      setError("御朱印の削除に失敗しました");
      console.error(e);
    }
  }, []);

  const toggleVisibility = useCallback(async (id: number, next: boolean) => {
    try {
      const updated = await updateMyGoshuinVisibility(id, next);
      setItems((prev) => (prev ? prev.map((g) => (g.id === id ? { ...g, is_public: updated.is_public } : g)) : prev));
    } catch (e) {
      setError("公開状態の変更に失敗しました");
      console.error(e);
    }
  }, []);

  return {
    items,
    loading,
    error,
    addItem,
    removeItem,
    toggleVisibility,
  };
}
