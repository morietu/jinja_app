// apps/web/src/lib/auth/AuthProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

/* =========================
 * ログイン復元フラグ（/concierge用）
 * ======================= */
const LS_AUTH = "auth:logged_in";

function markLoggedIn() {
  try {
    localStorage.setItem(LS_AUTH, "1");
  } catch {
    // localStorage が使えない環境（Safari私用/SSR等）は無視してOK
  }
}

function markLoggedOut() {
  try {
    localStorage.removeItem(LS_AUTH);
  } catch {
    // localStorage が使えない環境（Safari私用/SSR等）は無視してOK
  }
}

function maybeLoggedIn(): boolean {
  try {
    return localStorage.getItem(LS_AUTH) === "1";
  } catch {
    // localStorage が使えない環境では未ログイン扱い
    return false;
  }
}

async function fetchMe(): Promise<User> {
  const r = await fetch("/api/users/me/", {
    credentials: "include",
    cache: "no-store",
  });

  if (r.status === 401) {
    markLoggedOut(); // ✅ フラグ腐敗を掃除
    return null;
  }

  if (!r.ok) {
    throw new Error("failed to fetch user");
  }

  return await r.json();
}

function shouldAutoFetchMe(pathname: string | null): boolean {
  if (!pathname) return true;

  // ✅ ログイン画面は未ログインが前提なので叩かない
  if (pathname === "/login" || pathname === "/signup") return false;

  // ✅ concierge(Simple) でも叩かない（ノイズ消し）
  if (pathname === "/concierge") return false;

  // 実験場はOK
  if (pathname.startsWith("/concierge/full")) return true;

  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = async () => {
    const me = await fetchMe();
    setUser(me);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (shouldAutoFetchMe(pathname)) {
          await refreshMe();
        } else {
          // /concierge: 基本は叩かない
          // ただし「ログイン済みフラグ」があるなら復元のために叩く（ログインボタンを消すため）
          if (maybeLoggedIn()) {
            await refreshMe();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const login = async (username: string, password: string) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!r.ok) throw new Error("login failed");

    markLoggedIn();
    await refreshMe();
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    markLoggedOut();
    setUser(null);
  };

  const isLoggedIn = !!user;

  return <Ctx.Provider value={{ user, loading, isLoggedIn, login, logout, refreshMe }}>{children}</Ctx.Provider>;
}
