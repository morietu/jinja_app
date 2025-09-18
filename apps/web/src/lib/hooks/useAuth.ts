// apps/web/src/lib/hooks/useAuth.ts
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, type UserProfile } from "@/lib/api/users";
import { setAuthToken } from "@/lib/apiClient";

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const readAccessToken = () =>
    (typeof window !== "undefined" &&
      (localStorage.getItem("access_token") || localStorage.getItem("access"))) ||
    null;

  const clearTokens = () => {
    if (typeof window === "undefined") return;
    ["access_token", "access", "refresh_token", "refresh"].forEach((k) =>
      localStorage.removeItem(k)
    );
    setAuthToken(null);
  };

  const checkAuth = useCallback(async () => {
    setLoading(true);

    try {
      const token = readAccessToken();
      if (!token) {
        // 未ログイン
        setUser(null);
        setError(null);
        setLoading(false);
        return false;
      }

      // Authorization ヘッダを確実にセット
      setAuthToken(token);

      // ← ここは例外を投げず、未ログインやネットワーク時は null を返す設計
      const me = await getCurrentUser();

      if (me) {
        setUser(me);
        setError(null);
        setLoading(false);
        return true;
      } else {
        // トークンはあるがユーザーが取れない＝期限切れ等とみなす
        clearTokens();
        setUser(null);
        setError("セッションが期限切れです。再度ログインしてください。");
        setLoading(false);
        return false;
      }
    } catch (e) {
      // 念のためのフォールバック（想定外の例外）
      console.error("認証チェック例外:", e);
      clearTokens();
      setUser(null);
      setError("サーバーに接続できません。");
      setLoading(false);
      return false;
    }
  }, []);

  // ログイン後（トークン保存後）に呼べば、me を取り直して state を更新
  const login = useCallback(async () => {
    setError(null);
    return checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  const requireAuth = useCallback(
    (redirectTo = "/login") => {
      if (!user && !loading) {
        router.push(redirectTo);
        return false;
      }
      return true;
    },
    [user, loading, router]
  );

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return {
    user,
    loading,
    error,
    checkAuth,
    login,
    logout,
    requireAuth,
    isAuthenticated: !!user,
  };
}
