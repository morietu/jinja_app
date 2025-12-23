// apps/web/src/features/mypage/components/MyPageScreen.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { SectionCard } from "@/components/layout/SectionCard";
import GoshuinUploadForm from "./GoshuinUploadForm";
import MyGoshuinList from "./MyGoshuinList";
import { useMyGoshuin } from "@/features/mypage/hooks";

export default function MyPageScreen() {
  const { user, isLoggedIn, loading, logout } = useAuth();

  const goshuinEnabled = !loading && isLoggedIn && !!user;

  const {
    items,
    loading: goshuinLoading,
    error: goshuinError,
    addItem,
    removeItem,
    toggleVisibility,
  } = useMyGoshuin({ enabled: goshuinEnabled });

  // --- 読み込み中 ---
  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">マイページ</h1>
          <div className="rounded bg-gray-100 px-3 py-1 text-gray-400">…</div>
        </header>

        <section className="mt-4 rounded-lg border bg-white p-6" role="status" aria-busy="true" aria-live="polite">
          <div className="mb-4 flex items-center gap-4">
            <div className="size-12 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-100" />
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
        <h1 className="mb-4 text-xl font-bold">御朱印帳</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="mb-3">御朱印帳を利用するにはログインしてください。</p>
          <Link
            href="/login?next=/mypage?tab=goshuin"
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
        <h1 className="text-xl font-bold">御朱印帳</h1>
        <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300" type="button">
          ログアウト
        </button>
      </header>

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
    </main>
  );
}
