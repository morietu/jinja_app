"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildLoginHref } from "@/lib/nav/login";

export function HeaderAuthButtons() {
  const { isLoggedIn, loading, logout } = useAuth();

  const pathname = usePathname();
  const sp = useSearchParams();

  const loginHref = useMemo(() => {
    const current = pathname + (sp?.toString() ? `?${sp.toString()}` : "");
    return buildLoginHref(current);
  }, [pathname, sp]);

  const myPageHref = "/mypage?tab=profile";

  return (
    <div className="flex items-center gap-2">
      <Link
        href={myPageHref}
        // ナビゲーションは静かに保つ。goldは各ページの主アクションのために温存し、
        // 全ページ常設のヘッダーリンクがCTA階層の最上位を占めないようにする。
        className="rounded-md border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-xs font-medium text-[var(--kt-color-text-secondary)]"
      >
        マイページ
      </Link>

      {!loading && isLoggedIn && (
        <button
          type="button"
          onClick={async () => {
            await logout();
            window.location.href = "/";
          }}
          className="rounded-md border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-xs font-medium text-[var(--kt-color-text-secondary)]"
        >
          ログアウト
        </button>
      )}

      {!loading && !isLoggedIn && (
        <Link
          href={loginHref}
          // 未ログイン時もページ側の主CTA(相談をはじめる)と同時に表示されるため、
          // ヘッダー側は金を使わない。画面内でgoldを持つのは主CTAのみとする。
          className="rounded-md border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-xs font-medium text-[var(--kt-color-text-secondary)]"
        >
          ログイン
        </Link>
      )}
    </div>
  );
}
