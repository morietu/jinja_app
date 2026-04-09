"use client";
// apps/web/src/lib/auth/AuthProvider.tsx

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/lib/api/users";
import type { AuthState, AuthUser } from "@/lib/auth/types";

type AuthCtx = {
  user: AuthUser | null;
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

async function fetchMe(): Promise<AuthUser | null> {
  const me = await getCurrentUser();

  if (!me) {
    markLoggedOut();
    return null;
  }

  return me;
}

function shouldAutoFetchMe(pathname: string | null): boolean {
  if (!pathname) return true;

  // ログイン画面は未ログインが前提なので叩かない
  if (pathname === "/login" || pathname === "/signup" || pathname === "/auth/login" || pathname === "/auth/register") {
    return false;
  }

  // concierge(Simple) では基本叩かない
  if (pathname === "/concierge") return false;

  // 実験場はOK
  if (pathname.startsWith("/concierge/full")) return true;

  return true;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [authState, setAuthState] = useState<AuthState>({
    status: "unknown",
    user: null,
    isHydrating: true,
  });

  const refreshMe = async () => {
    try {
      const me = await fetchMe();

      setAuthState({
        status: me ? "authenticated" : "guest",
        user: me,
        isHydrating: false,
      });
    } catch {
      setAuthState({
        status: "guest",
        user: null,
        isHydrating: false,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const shouldFetch = shouldAutoFetchMe(pathname) || maybeLoggedIn();

        if (!shouldFetch) {
          if (!cancelled) {
            setAuthState({
              status: "guest",
              user: null,
              isHydrating: false,
            });
          }
          return;
        }

        const me = await fetchMe();

        if (!cancelled) {
          setAuthState({
            status: me ? "authenticated" : "guest",
            user: me,
            isHydrating: false,
          });
        }
      } catch {
        if (!cancelled) {
          setAuthState({
            status: "guest",
            user: null,
            isHydrating: false,
          });
        }
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
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    markLoggedOut();

    setAuthState({
      status: "guest",
      user: null,
      isHydrating: false,
    });
  };

  const user = authState.user;
  const loading = authState.isHydrating;
  const isLoggedIn = authState.status === "authenticated" && !!authState.user;

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        isLoggedIn,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
