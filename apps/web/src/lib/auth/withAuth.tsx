"use client";

import { ComponentType, FC, ReactNode, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function withAuth<P extends Record<string, unknown>>(
  Comp: ComponentType<P>
): FC<P> {
  const Guard: FC<P> = (props) => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const sp = useSearchParams();

    useEffect(() => {
      if (!loading && !user) {
        const next = encodeURIComponent(
          window.location.pathname + (window.location.search || "")
        );
        router.replace(`/login?next=${next}`);
      }
    }, [user, loading, router, sp]);

    if (!user) return null;
    return <Comp {...(props as P)} />;
  };

  Guard.displayName = `WithAuth(${
    Comp.displayName || (Comp as any).name || "Component"
  })`;
  return Guard;
}

/**
 * HOCが使いにくい場合の代替：ラッパーコンポーネント
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (!user) return null;
  return <>{children}</>;
}
