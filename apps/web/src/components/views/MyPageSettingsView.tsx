"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { updateUser } from "@/lib/api/users";
import { useAuth as useAuthContext } from "@/lib/auth/AuthProvider";
import type { AuthUser } from "@/lib/auth/types";
import { buildLoginHref } from "@/lib/nav/login";

export default function MyPageSettingsView() {
  const router = useRouter();
  const { user: authUser, loading, logout, refreshMe } = useAuthContext();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) {
      setUser(null);
      return;
    }

    setUser(authUser);
    setIsPublic(Boolean(authUser.profile?.is_public));
  }, [authUser]);

  const handleTogglePublic = async (next: boolean) => {
    if (saving) return;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);
    setIsPublic(next);

    try {
      const updated = await updateUser({ is_public: next });
      setUser(updated);
      setIsPublic(Boolean(updated.profile?.is_public));
      setSaveMessage("公開設定を保存しました。");
      await refreshMe();
    } catch {
      setIsPublic(!next);
      setSaveError("公開設定を保存できませんでした。時間をおいて、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const ok = window.confirm("ログアウトしますか？");
    if (!ok) return;

    await logout();
    router.replace("/");
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-[var(--kt-color-text-secondary)]" role="status" aria-busy="true">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <h1 className="mb-4 text-xl font-semibold">設定</h1>
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-6">
          <p className="mb-3 text-sm text-[var(--kt-color-text-secondary)]">ログインしてご利用ください。</p>
          <Link
            href={buildLoginHref("/mypage/settings")}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  const username = (user.username ?? "").trim();
  const hasPublicPage = Boolean(username) && isPublic;

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-[var(--kt-color-text-primary)] sm:px-6">
      <div>
        <Link href="/mypage" className="text-xs text-[var(--kt-color-text-muted)] underline">
          ← マイページへ
        </Link>
        <h1 className="mt-2 text-xl font-semibold">設定</h1>
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5">
        <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--kt-color-text-secondary)]">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => void handleTogglePublic(e.target.checked)}
            disabled={saving}
            className="h-5 w-5 rounded border-[var(--kt-color-border-strong)] text-[var(--kt-color-action-primary)] focus:ring-[var(--kt-color-border-default)] disabled:opacity-60"
          />
          <span>プロフィールを公開</span>
        </label>

        {hasPublicPage ? (
          <div className="border-t border-[var(--kt-color-border-default)] pt-4">
            <p className="text-xs text-[var(--kt-color-text-muted)]">公開プロフィールページ</p>
            <Link
              href={`/users/${username}`}
              className="mt-1 inline-flex min-h-11 items-center break-all text-sm text-[var(--kt-color-text-secondary)] underline transition hover:text-[var(--kt-color-text-primary)]"
            >
              /users/{username}
            </Link>
          </div>
        ) : null}

        {saveMessage ? (
          <p role="status" className="text-sm font-medium text-[var(--kt-color-status-success)]">
            {saveMessage}
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="text-sm font-medium text-[var(--kt-color-status-error)]">
            {saveError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 text-sm font-medium text-[var(--kt-color-status-error)] transition hover:bg-[var(--kt-color-background-subtle)]"
        >
          ログアウト
        </button>
      </section>
    </main>
  );
}
