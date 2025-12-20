"use client";

import { createContext, useContext, useEffect, useState } from "react";

type User = { id: number; email?: string; name?: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider is missing");
  return ctx;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // 起動時に /api/users/me でセッション確認
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/users/me/", {
          credentials: "include",
          cache: "no-store",
        });
        if (r.ok) setUser(await r.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) throw new Error("login failed");
    const me = await fetch("/api/users/me", {
      credentials: "include",
      cache: "no-store",
    });
    setUser(me.ok ? await me.json() : null);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  );
}
