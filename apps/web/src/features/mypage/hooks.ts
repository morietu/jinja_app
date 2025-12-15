// apps/web/src/features/mypage/hooks.ts
"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMe, type MeResponse } from "@/lib/api/mypage";
import type { Goshuin } from "@/lib/api/goshuin";
import {
  fetchMyGoshuin as fetchMyGoshuinApi,
  deleteMyGoshuin,
  updateMyGoshuinVisibility,
  uploadMyGoshuin,
} from "@/lib/api/goshuin";

type PlanLimitError = {
  code?: string;
  limit?: number;
  detail?: string;
};

function isPlanLimitExceeded(e: unknown): e is PlanLimitError {
  return !!e && typeof e === "object" && (e as any).code === "PLAN_LIMIT_EXCEEDED";
}

/**
 * /api/my/profile/（= Django /api/users/me/）を叩くフック
 */
export function useMe() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchMe(); // res は MeResponse
        if (!cancelled) {
          setData(res); // ★ res.user ではなく res そのもの
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

  // ① 先に addItem（upload が使う）
  const addItem = useCallback((item: Goshuin) => {
    setItems((prev) => (prev ? [item, ...prev] : [item]));
  }, []);

  // ② load（初回ロード / reload が使う）
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

  // ③ 初回ロードは load を呼ぶだけ（←ここが置き場）
  useEffect(() => {
    void load();
  }, [load]);

  // ④ upload（addItem を使う）
  const upload = useCallback(
    async (input: { shrineId: number; title: string; isPublic: boolean; file: File }) => {
      try {
        const created = await uploadMyGoshuin(input);
        addItem(created);
        setError(null);
        return created;
      } catch (e) {
        if (isPlanLimitExceeded(e)) {
          const limit = (e as any).limit ?? 10;
          setError(`御朱印は最大${limit}件までです。不要な御朱印を削除してから追加してください。`);
          return null;
        }
        setError("アップロードに失敗しました。時間をおいて再度お試しください。");
        console.error(e);
        return null;
      }
    },
    [addItem],
  );

  // ⑤ reload は load を呼ぶだけ
  const reload = useCallback(async () => {
    await load();
  }, [load]);

  // ⑥ removeItem / toggleVisibility（今のままでOK）
  const removeItem = useCallback(
    async (id: number) => {
      const prev = items;
      if (items) setItems(items.filter((g) => g.id !== id));

      try {
        await deleteMyGoshuin(id);
        setError(null);
      } catch (e) {
        setItems(prev ?? null);
        setError("削除に失敗しました。時間をおいて再度お試しください。");
        console.error(e);
      }
    },
    [items],
  );

  const toggleVisibility = useCallback(
    async (id: number, next: boolean) => {
      if (!items) return;

      setItems(items.map((g) => (g.id === id ? { ...g, is_public: next } : g)));

      try {
        const updated = await updateMyGoshuinVisibility(id, next);
        setItems((prev) => (prev ? prev.map((g) => (g.id === id ? { ...g, is_public: updated.is_public } : g)) : prev));
        setError(null);
      } catch (e) {
        const target = items.find((g) => g.id === id);
        const original = target ? target.is_public : true;
        setItems((prev) => (prev ? prev.map((g) => (g.id === id ? { ...g, is_public: original } : g)) : prev));
        setError("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
        console.error(e);
      }
    },
    [items],
  );

  return { items, loading, error, upload, addItem, removeItem, toggleVisibility, reload };
}



  
