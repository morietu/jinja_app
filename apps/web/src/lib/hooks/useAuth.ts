// apps/web/src/lib/hooks/useAuth.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { getCurrentUser, type UserMe } from "@/lib/api/users";
import { loginApi as loginApiCompat, logout as logoutApi } from "@/lib/api/auth";

export function useAuth() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  // 共通の me 取得関数
  const fetchMe = useCallback(async () => {
    try {
      setLoading(true);
      const me = await getCurrentUser();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初期ロード
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(
    async (username: string, password: string) => {
      await loginApiCompat(username, password); // Cookie 設定（Next API 経由）
      await fetchMe(); // ログイン後に最新 me を取得
      return true;
    },
    [fetchMe],
  );

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {
      /* noop */
    }
    setUser(null);
  }, []);

  const isLoggedIn = !!user;
  const isAuthenticated = isLoggedIn; // 互換用

  return {
    user,
    loading,
    login,
    logout,
    isLoggedIn,
    isAuthenticated,
    refresh: fetchMe, // ★ ここがポイント
  };
}
