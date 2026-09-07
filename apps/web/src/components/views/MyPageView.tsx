"use client";

import Link from "next/link";

import { useAuth as useAuthContext } from "@/lib/auth/AuthProvider";
import type { Favorite } from "@/lib/api/favorites";
import type { ConciergeThread } from "@/lib/api/concierge/types";
import type { BillingStatus } from "@/lib/api/billing";
import { resolveAccessLevel } from "@/lib/premium/accessLevel";
import { buildLoginHref } from "@/lib/nav/login";
import { resolveDisplayName } from "@/features/mypage/lib/hubPreview";
import AccountSummarySection from "@/features/mypage/components/hub/AccountSummarySection";
import RecentConsultationsSection from "@/features/mypage/components/hub/RecentConsultationsSection";
import FavoritesSection from "@/features/mypage/components/FavoritesSection";

type Props = {
  favorites: Favorite[];
  favoritesFetchFailed: boolean;
  threads: ConciergeThread[];
  threadsFetchFailed: boolean;
  billingStatus: BillingStatus | null;
};

/**
 * /mypage のHUB。各sectionのcompositionだけを担い、
 * プロフィール編集は /mypage/profile、設定は /mypage/settings が持つ。
 */
export default function MyPageView({
  favorites,
  favoritesFetchFailed,
  threads,
  threadsFetchFailed,
  billingStatus,
}: Props) {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="p-4 text-sm text-[var(--kt-color-text-secondary)]" role="status" aria-busy="true">
        読み込み中...
      </div>
    );
  }

  // middleware.ts が /mypage/:path* を保護しているため通常は到達しないが、
  // access_token cookieが残ったまま失効した場合のfallbackとして残す。
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <h1 className="mb-4 text-xl font-semibold">マイページ</h1>
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-6">
          <p className="mb-3 text-sm text-[var(--kt-color-text-secondary)]">ログインしてご利用ください。</p>
          <Link
            href={buildLoginHref("/mypage")}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  // Planの最終判定はBackend（/api/billings/status/）を正本とし、ここでは表示へ落とすだけ。
  const isPremium = resolveAccessLevel(billingStatus, true) === "premium";

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-[var(--kt-color-text-primary)] sm:px-6">
      <h1 className="text-xl font-semibold">マイページ</h1>

      <AccountSummarySection
        displayName={resolveDisplayName(user)}
        email={user.email ?? null}
        isPremium={isPremium}
      />

      <RecentConsultationsSection threads={threads} fetchFailed={threadsFetchFailed} />

      <FavoritesSection favorites={favorites} fetchFailed={favoritesFetchFailed} />

      <section
        aria-labelledby="mypage-settings-entry-title"
        className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5"
      >
        <h2 id="mypage-settings-entry-title" className="text-sm font-medium text-[var(--kt-color-text-secondary)]">
          設定
        </h2>
        <Link
          href="/mypage/settings"
          className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 text-sm text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] hover:text-[var(--kt-color-text-primary)]"
        >
          設定を開く
        </Link>
      </section>
    </main>
  );
}
