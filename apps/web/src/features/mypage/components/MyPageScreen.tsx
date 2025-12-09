// apps/web/src/features/mypage/components/MyPageScreen.tsx
"use client";

import React, { useMemo, useCallback, KeyboardEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type { TabKey } from "@/app/mypage/tabs";
import { sanitizeTab } from "@/app/mypage/tabs";
import { SectionCard } from "@/components/layout/SectionCard";
import ProfileSection from "./ProfileSection";
import GoshuinUploadForm from "./GoshuinUploadForm";
import MyGoshuinList from "./MyGoshuinList";
import { useMyGoshuin } from "@/features/mypage/hooks";
import FavoritesSection from "./FavoritesSection";

function useTab(): [TabKey, (t: TabKey, opts?: { focus?: boolean }) => void, boolean] {
  const router = useRouter();
  const sp = useSearchParams();
  const saved = sp.get("saved") === "1";
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

  return [current, setTab, saved];
}

export default function MyPageScreen() {
  const { user, isLoggedIn, loading, logout, refresh } = useAuth();
  const [tab, setTab, saved] = useTab();
  const [showSaved, setShowSaved] = useState(saved);

  // プロフィール保存後だけ /users/me/ を取り直す
  useEffect(() => {
    if (!saved) return;
    refresh().catch((err) => {
      console.error("failed to refresh user profile", err);
    });
  }, [saved, refresh]);

  // 保存バナー表示
  useEffect(() => {
    if (!saved) return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 4000);
    return () => clearTimeout(t);
  }, [saved]);

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
      { key: "goshuin" as TabKey, label: "御朱印" },
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

  // --- 読み込み中 ---
  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
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

      <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="space-y-4">
        {showSaved && (
          <div className="mb-1 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
            プロフィールを保存しました。
          </div>
        )}

        {tab === "profile" && (
          <SectionCard title="プロフィール">
            <ProfileSection user={user} />
          </SectionCard>
        )}

        {tab === "favorites" && (
          <SectionCard title="お気に入り" description="あとで実装予定の機能です。">
            <FavoritesSection />
          </SectionCard>
        )}

        {tab === "goshuin" && (
          <div className="space-y-4">
            <SectionCard
              title="御朱印アップロード"
              description="御朱印画像（推奨サイズ：5MB 以下）をアップロードできます。画像とタイトルを選んで登録してください。"
            >
              <GoshuinUploadForm onUploaded={addItem} />
            </SectionCard>

            <SectionCard title="登録済みの御朱印">
              <MyGoshuinList
                items={items}
                loading={goshuinLoading}
                error={goshuinError}
                onDelete={removeItem}
                onToggleVisibility={toggleVisibility}
              />
            </SectionCard>
          </div>
        )}
      </section>
    </main>
  );
}
