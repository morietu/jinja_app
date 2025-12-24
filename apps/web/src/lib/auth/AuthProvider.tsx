"use client";

import { createContext, useContext, useEffect, useState } from "react";

type User = { id: number; email?: string; name?: string; username?: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider is missing");
  return ctx;
};

async function fetchMe(): Promise<User> {
  const r = await fetch("/api/users/me/", {
    credentials: "include",
    cache: "no-store",
  });
  if (!r.ok) return null;
  return await r.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    const me = await fetchMe();
    setUser(me);
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshMe();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include", // ✅必須
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error("login failed");
    await refreshMe(); // ✅ここで user を更新
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const isLoggedIn = !!user;

  return <Ctx.Provider value={{ user, loading, isLoggedIn, login, logout, refreshMe }}>{children}</Ctx.Provider>;
}
