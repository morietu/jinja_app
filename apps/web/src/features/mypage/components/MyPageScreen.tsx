// apps/web/src/features/mypage/components/MyPageScreen.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { SectionCard } from "@/components/layout/SectionCard";
import GoshuinUploadForm from "./GoshuinUploadForm";
import MyGoshuinList from "./MyGoshuinList";
import { useMyGoshuin } from "@/features/mypage/hooks";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function MyPageScreen() {
  const { user, isLoggedIn, loading, logout } = useAuth();

  const goshuinEnabled = !loading && isLoggedIn && !!user;

  const router = useRouter();
  const sp = useSearchParams(); // ✅ これが必要

  const shrineId = Number(sp.get("shrine") ?? "");
  const hasShrine = Number.isFinite(shrineId) && shrineId > 0;

  const {
    items,
    loading: goshuinLoading,
    error: goshuinError,
    addItem,
    removeItem,
    toggleVisibility,
  } = useMyGoshuin({ enabled: goshuinEnabled });

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="py-6">
        読み込み中…
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-bold">御朱印帳</h1>
        <div className="rounded-lg border bg-white p-6">
          <p className="mb-3">御朱印帳を利用するにはログインしてください。</p>
          <Link
            className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            href={`/login?next=${encodeURIComponent(hasShrine ? `/mypage?tab=goshuin&shrine=${shrineId}` : `/mypage?tab=goshuin`)}`}
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">御朱印帳</h1>
        <button onClick={logout} className="rounded bg-gray-200 px-3 py-1 hover:bg-gray-300" type="button">
          ログアウト
        </button>
      </header>

      <div className="space-y-4">
        <div id="goshuin-upload">
          <SectionCard
            title="御朱印アップロード"
            description="御朱印画像（推奨サイズ：5MB 以下）をアップロードできます。画像とタイトルを選んで登録してください。"
          >
            <GoshuinUploadForm
              onUploaded={(created) => {
                addItem(created); // ✅ まずローカル反映

                if (hasShrine) router.push(`/shrines/${shrineId}?toast=goshuin_saved#goshuins`);
                else router.push(`/mypage?tab=goshuin&toast=goshuin_saved#goshuin-upload`);
              }}
            />
          </SectionCard>
        </div>

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
