// apps/web/src/features/mypage/hooks.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMe, type MeResponse } from "@/lib/api/mypage";
import type { Goshuin } from "@/lib/api/goshuin";
import { fetchMyGoshuin as fetchMyGoshuinApi, deleteMyGoshuin, updateMyGoshuinVisibility } from "@/lib/api/goshuin";

/**
 * /api/users/me/ を叩くシンプルなフック
 */
export function useMe() {
  const [data, setData] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchMe();
        if (!cancelled) {
          setData(res.user);
        }
      } catch (e) {
        if (!cancelled) {
          setError("ユーザー情報の取得に失敗しました");
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
  }, []);

  return { me: data, loading, error };
}

type UseMyGoshuinOptions = {
  enabled?: boolean;
};

/**
 * マイ御朱印の一覧取得＋CRUD 用フック
 * - 初回ロード
 * - reload()
 * - addItem
 * - removeItem（失敗時ロールバック）
 * - toggleVisibility（失敗時ロールバック）
 */
export function useMyGoshuin(options: UseMyGoshuinOptions = {}) {
  const { enabled = true } = options;

  const [items, setItems] = useState<Goshuin[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetchMyGoshuinApi();
      setItems(res);
      setError(null);
    } catch (e) {
      setItems(null);
      setError("御朱印一覧の取得に失敗しました。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // 初回ロード
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!enabled) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetchMyGoshuinApi();
        if (!cancelled) {
          setItems(res);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setItems(null);
          setError("御朱印一覧の取得に失敗しました。");
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

  // 明示的な再読み込み API
  const reload = useCallback(async () => {
    await load();
  }, [load]);

  // アップロード成功時に先頭へ追加
  const addItem = useCallback((item: Goshuin) => {
    setItems((prev) => {
      if (!prev) return [item];
      return [item, ...prev];
    });
  }, []);

  // 削除（失敗時ロールバック＋メッセージ）
  const removeItem = useCallback(
    async (id: number) => {
      const prev = items;

      // 楽観的に削除
      if (items) {
        setItems(items.filter((g) => g.id !== id));
      }

      try {
        await deleteMyGoshuin(id);
        setError(null);
      } catch (e) {
        // ❗ 失敗したら元の一覧に戻す
        setItems(prev ?? null);
        setError("削除に失敗しました。時間をおいて再度お試しください。");
        console.error(e);
      }
    },
    [items],
  );

  // 公開 / 非公開切り替え（失敗時ロールバック＋メッセージ）
  const toggleVisibility = useCallback(
    async (id: number) => {
      if (!items) return;

      // いまの状態から next を決める
      const target = items.find((g) => g.id === id);
      const next = target ? !target.is_public : true;

      // 楽観的更新
      setItems(items.map((g) => (g.id === id ? { ...g, is_public: next } : g)));

      try {
        const updated = await updateMyGoshuinVisibility(id, next);
        // サーバー結果で確定
        setItems((prev) => (prev ? prev.map((g) => (g.id === id ? { ...g, is_public: updated.is_public } : g)) : prev));
        setError(null);
      } catch (e) {
        // 失敗したら元に戻す
        setItems((prev) => (prev ? prev.map((g) => (g.id === id ? { ...g, is_public: !g.is_public } : g)) : prev));
        setError("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
        console.error(e);
      }
    },
    [items],
  );

  return {
    items,
    loading,
    error,
    addItem,
    removeItem,
    toggleVisibility,
    reload,
  };
}
