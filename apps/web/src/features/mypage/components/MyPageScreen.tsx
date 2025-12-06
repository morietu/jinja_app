// apps/web/src/features/mypage/components/MyPageScreen.tsx
"use client";

import React, { useMemo, useCallback, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type { TabKey } from "@/app/mypage/tabs";
import { sanitizeTab } from "@/app/mypage/tabs";
import ProfileSection from "./ProfileSection";
import GoshuinUploadForm from "./GoshuinUploadForm";
import MyGoshuinList from "./MyGoshuinList";
import { useMyGoshuin } from "./hooks/useMyGoshuin";

function useTab(): [TabKey, (t: TabKey, opts?: { focus?: boolean }) => void] {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sanitizeTab(sp.get("tab"));

  const setTab = (t: TabKey, opts?: { focus?: boolean }) => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("tab", t);
    router.replace(`/mypage?${usp.toString()}`);
    if (opts?.focus) {
      queueMicrotask(() => {
        const el = document.getElementById(`tab-${t}`);
        if (el instanceof HTMLButtonElement) el.focus();
      });
    }
  };

  return [current, setTab];
}

export default function MyPageScreen() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const [tab, setTab] = useTab();

  const goshuinEnabled = !loading && isLoggedIn && !!user;

  const {
    items,
    loading: goshuinLoading,
    error: goshuinError,
    addItem,
    removeItem,
    toggleVisibility,
  } = useMyGoshuin({ enabled: goshuinEnabled });

  const tabs = useMemo(
    () => [
      { key: "profile" as TabKey, label: "プロフィール" },
      { key: "favorites" as TabKey, label: "お気に入り（準備中）" },
      { key: "goshuin" as TabKey, label: "御朱印" }, // ← 準備中ではない
      { key: "settings" as TabKey, label: "設定" },
    ],
    [],
  );

  const onTabsKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;
      if (!keys.includes(e.key as any)) return;
      e.preventDefault();
      const idx = tabs.findIndex((t) => t.key === tab);
      const last = tabs.length - 1;
      if (e.key === "Home") setTab(tabs[0].key, { focus: true });
      else if (e.key === "End") setTab(tabs[last].key, { focus: true });
      else if (e.key === "ArrowLeft") setTab(tabs[idx <= 0 ? last : idx - 1].key, { focus: true });
      else if (e.key === "ArrowRight") setTab(tabs[idx >= last ? 0 : idx + 1].key, { focus: true });
    },
    [tab, tabs, setTab],
  );

  const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="rounded-2xl border border-orange-100 bg-white px-6 py-5 shadow-sm">
      {title && (
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-800">
          <span className="inline-block h-5 w-1 rounded-full bg-orange-400" />
          {title}
        </h2>
      )}
      {children}
    </section>
  );

  // --- 読み込み中 ---
  if (loading) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">マイページ</h1>
          <div className="rounded bg-gray-100 px-3 py-1 text-gray-400">…</div>
        </header>

        <nav
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="マイページ内タブ"
          aria-orientation="horizontal"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              className="cursor-wait rounded border bg-gray-50 px-3 py-1 text-gray-400"
              type="button"
              disabled
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="rounded-lg border bg-white p-6" role="status" aria-busy="true" aria-live="polite">
          <div className="mb-4 flex items-center gap-4">
            <div className="size-12 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-100 sm:col-span-3" />
            ))}
          </div>
        </section>
      </main>
    );
  }

  // --- 未ログイン ---
  if (!isLoggedIn || !user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-bold">マイページ</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="mb-3">マイページを利用するにはログインしてください。</p>
          <Link
            href="/login?next=/mypage"
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  // --- ログイン時 ---
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">マイページ</h1>
        <div className="flex gap-2">
          <Link href="/mypage/edit" className="rounded border px-3 py-1 hover:bg-gray-50">
            編集へ
          </Link>
          <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300" type="button">
            ログアウト
          </button>
        </div>
      </header>

      <nav
        className="flex flex-wrap gap-2 rounded-full bg-orange-50/40 px-2 py-2"
        role="tablist"
        aria-label="マイページ内タブ"
        aria-orientation="horizontal"
        onKeyDown={onTabsKeyDown}
      >
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${t.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setTab(t.key, { focus: true })}
              className={
                "rounded-full border px-3 py-1 text-sm " +
                (isActive
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                  : "border-transparent bg-white text-gray-700 hover:bg-orange-50")
              }
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="rounded-lg border bg-white"
      >
        {tab === "profile" && (
          <div className="space-y-6 p-6 text-sm text-gray-600">
            <SectionCard title="プロフィール">
              <ProfileSection user={user} />
            </SectionCard>
          </div>
        )}

        {tab === "favorites" && (
          <div className="space-y-6 p-6 text-sm text-gray-600">
            <SectionCard title="お気に入り">
              <p className="mb-1 text-xs text-orange-600">※ この機能は準備中です。</p>
              <p className="text-sm text-gray-600">お気に入り一覧の閲覧・削除は、バックエンド実装後に有効化します。</p>
            </SectionCard>
          </div>
        )}

        {tab === "goshuin" && (
          <div className="space-y-6 p-6 text-sm text-gray-600">
            <SectionCard title="御朱印アップロード">
              <p className="mb-3 text-xs text-gray-500">
                御朱印画像（推奨サイズ：5MB 以下）をアップロードできます。画像とタイトルを選んで登録してください。
              </p>
              <GoshuinUploadForm onUploaded={addItem} />
            </SectionCard>

            {/* 登録済みリスト */}
            <section>
              <MyGoshuinList
                items={items}
                loading={goshuinLoading}
                error={goshuinError}
                onDelete={removeItem}
                onToggleVisibility={toggleVisibility}
              />
            </section>
          </div>
        )}

        {tab === "settings" && (
          <div className="space-y-6 p-6 text-sm text-gray-600">
            <SectionCard title="設定">
              <p className="mb-1 text-xs text-gray-500">テーマや通知などの設定は、今後のアップデートで追加予定です。</p>
              <p className="text-sm text-gray-600">現在はアカウント情報の編集と、ログアウトのみ利用できます。</p>
            </SectionCard>
          </div>
        )}
      </section>
    </main>
  );
}
