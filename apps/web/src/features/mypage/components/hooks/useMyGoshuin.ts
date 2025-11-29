// apps/web/src/features/mypage/components/hooks/useMyGoshuin.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Goshuin } from "@/lib/api/goshuin";
import { fetchMyGoshuin, deleteMyGoshuin, updateMyGoshuinVisibility } from "@/lib/api/goshuin";

type State = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
};

export function useMyGoshuin() {
  const [state, setState] = useState<State>({
    items: null,
    loading: true,
    error: null,
  });

  // 初回ロード
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const items = await fetchMyGoshuin();
        if (cancelled) return;
        console.debug("useMyGoshuin: fetched items", {
          count: Array.isArray(items) ? items.length : 0,
          sample: items?.slice?.(0, 3),
        });
        setState({ items, loading: false, error: null });
      } catch (_err) {
        if (cancelled) return;
        console.warn("[useMyGoshuin] fetchMyGoshuin failed", _err);
        setState({
          items: null,
          loading: false,
          error: "御朱印一覧の取得に失敗しました。",
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // addItem: items が null のとき新しく配列を作り、その後は「先頭に」追加
  const addItem = useCallback((item: Goshuin) => {
    setState((prev) => {
      const current = prev.items ?? [];
      return {
        ...prev,
        items: [item, ...current],
      };
    });
  }, []);

  // removeItem: 楽観的削除 + 失敗時ロールバック
  const removeItem = useCallback(async (id: number) => {
    let previous: Goshuin[] | null = null;

    setState((prev) => {
      previous = prev.items ?? null;
      if (!prev.items) return prev;
      const nextItems = prev.items.filter((g) => g.id !== id);
      return { ...prev, items: nextItems, error: null };
    });

    try {
      await deleteMyGoshuin(id);
    } catch (_err) {
      console.warn("[useMyGoshuin] deleteMyGoshuin failed", _err);
      setState((prev) => ({
        ...prev,
        items: previous,
        error: "削除に失敗しました。時間をおいて再度お試しください。",
      }));
    }
  }, []);

  // toggleVisibility: 楽観的に is_public を反転し、API 失敗時はロールバック
  const toggleVisibility = useCallback(
    async (id: number) => {
      const currentItems = state.items;
      if (!currentItems) return;

      const target = currentItems.find((g) => g.id === id);
      if (!target) return;

      const nextPublic = !target.is_public;

      // 楽観更新
      setState((prev) => ({
        ...prev,
        items: prev.items ? prev.items.map((g) => (g.id === id ? { ...g, is_public: nextPublic } : g)) : prev.items,
        error: null,
      }));

      try {
        await updateMyGoshuinVisibility(id, nextPublic);
      } catch (err) {
        console.warn("[useMyGoshuin] updateMyGoshuinVisibility failed", err);
        setState((prev) => ({
          ...prev,
          items: prev.items
            ? prev.items.map((g) => (g.id === id ? { ...g, is_public: target.is_public } : g))
            : prev.items,
          error: "公開設定の更新に失敗しました。時間をおいて再度お試しください。",
        }));
      }
    },
    [state.items],
  );

  // 再読み込み
  const reload = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const items = await fetchMyGoshuin();
      console.debug("useMyGoshuin: reload fetched items", { count: Array.isArray(items) ? items.length : 0 });
      setState({ items, loading: false, error: null });
    } catch (_err) {
      console.warn("[useMyGoshuin] fetchMyGoshuin failed", _err);
      setState({
        items: null,
        loading: false,
        error: "御朱印一覧の取得に失敗しました。",
      });
    }
  }, []);



  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    reload,
    addItem,
    removeItem,
    toggleVisibility,
  };
}
