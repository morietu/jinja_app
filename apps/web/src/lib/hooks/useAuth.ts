// apps/web/src/lib/hooks/useAuth.ts
"use client";
import { useEffect, useState, useCallback } from "react";
import { getCurrentUser, type UserMe } from "@/lib/api/users";
import {
  loginApi as loginApiCompat,
  logout as logoutApi,
} from "@/lib/api/auth";

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
    await loginApiCompat(username, password); // Cookie 設定（Next API 経由）
    const me = await getCurrentUser();
    setUser(me);
    return !!me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch {}
    setUser(null);
  }, []);

  const isLoggedIn = !!user;
  const isAuthenticated = isLoggedIn; // 互換用

  return { user, loading, login, logout, isLoggedIn, isAuthenticated };
}
