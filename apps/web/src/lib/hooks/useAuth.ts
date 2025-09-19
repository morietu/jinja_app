"use client";
import { useEffect, useState, useCallback } from "react";
import { getCurrentUser, type UserMe } from "@/lib/api/users";
import { login as loginApi, logout as logoutApi } from "@/lib/api/auth";

export function useAuth() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState(true);

  // 初期ロード
  useEffect(() => {
    (async () => {
      try {
        const me = await getCurrentUser();
        setUser(me);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    await loginApi(username, password);     // /api/auth/jwt/create/ → HttpOnly Cookie 設定
    const me = await getCurrentUser();      // Cookieで /users/me/ 取得
    setUser(me);
    return !!me;
  }, []);

  const logout = useCallback(async () => {
    try { await logoutApi(); } catch {}
    setUser(null);
  }, []);

  return { user, loading, login, logout, isLoggedIn: !!user };
}
