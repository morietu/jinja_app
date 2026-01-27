// apps/web/src/features/mypage/hooks.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { devLog } from "@/lib/client/logging";

import axios from "axios";
import type { Goshuin } from "@/lib/api/goshuin";
import {
  fetchMyGoshuin as fetchMyGoshuinApi,
  deleteMyGoshuin,
  updateMyGoshuinVisibility,
  uploadMyGoshuin,
} from "@/lib/api/goshuin";

type PlanLimitErrorBody = {
  code?: string;
  limit?: number;
  detail?: string;
};

function getPlanLimitExceededBody(e: unknown): PlanLimitErrorBody | null {
  if (!axios.isAxiosError(e)) return null;

  const status = e.response?.status;
  const data = e.response?.data as any;

  if (status === 403 && data?.code === "PLAN_LIMIT_EXCEEDED") {
    return {
      code: data.code,
      limit: data.limit,
      detail: data.detail,
    };
  }
  return null;
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

  const itemsRef = useRef<Goshuin[] | null>(null);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const removeItem = useCallback(async (id: number) => {
    const snapshot = itemsRef.current; // ★最新の配列を確保
    setItems((cur) => (cur ? cur.filter((g) => g.id !== id) : cur));

    try {
      await deleteMyGoshuin(id);
      setError(null);
    } catch (e) {
      setItems(snapshot ?? null); // ★丸ごとロールバック
      setError("削除に失敗しました。時間をおいて再度お試しください。");
      devLog("MyGoshuin:DELETE_FAILED", { message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const toggleVisibility = useCallback(async (id: number, next: boolean) => {
    const snapshot = itemsRef.current; // ★最新の配列を確保
    setItems((cur) => (cur ? cur.map((g) => (g.id === id ? { ...g, is_public: next } : g)) : cur));

    try {
      const updated = await updateMyGoshuinVisibility(id, next);
      setItems((cur) => (cur ? cur.map((g) => (g.id === id ? { ...g, is_public: updated.is_public } : g)) : cur));
      setError(null);
    } catch (e) {
      setItems(snapshot ?? null); // ★丸ごとロールバック（これが一番堅い）
      setError("公開設定の更新に失敗しました。時間をおいて再度お試しください。");
      devLog("MyGoshuin:VISIBILITY_FAILED", { message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // ① 先に addItem（upload が使う）
  const addItem = useCallback((item: Goshuin) => {
    setItems((prev) => {
      const list = prev ?? [];
      const exists = list.some((x) => x.id === item.id);
      if (exists) return list.map((x) => (x.id === item.id ? item : x));
      return [item, ...list];
    });
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
      devLog("MyGoshuin:LOAD_FAILED", { message: e instanceof Error ? e.message : String(e) });
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
        const body = getPlanLimitExceededBody(e);
        if (body) {
          const limit = body.limit ?? 10;
          setError(`御朱印は最大${limit}件までです。不要な御朱印を削除してから追加してください。`);
          return null;
        }
        setError("アップロードに失敗しました。時間をおいて再度お試しください。");
        devLog("MyGoshuin:UPLOAD_FAILED", { message: e instanceof Error ? e.message : String(e) });
        return null;
      }
    },
    [addItem],
  );

  // ⑤ reload は load を呼ぶだけ
  const reload = useCallback(async () => {
    await load();
  }, [load]);

  
  

  

  return { items, loading, error, upload, addItem, removeItem, toggleVisibility, reload };
}



  
