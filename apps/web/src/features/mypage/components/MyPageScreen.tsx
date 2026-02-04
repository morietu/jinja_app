// apps/web/src/features/mypage/components/MyPageScreen.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { SectionCard } from "@/components/layout/SectionCard";
import GoshuinUploadForm from "./GoshuinUploadForm";
import MyGoshuinList from "./MyGoshuinList";
import { useMyGoshuin } from "@/features/mypage/hooks";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { useRouter } from "next/navigation";


export default function MyPageScreen() {
  const router = useRouter();
  const { user, isLoggedIn, loading, logout } = useAuth();

  const goshuinEnabled = !loading && isLoggedIn && !!user;

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

        <button
          type="button"
          onClick={async () => {
            await logout();
            router.replace("/");
            router.refresh();
          }}
          className="rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
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
                addItem(created);
                const href = hasShrine
                  ? buildShrineHref(shrineId, { query: { toast: "goshuin_saved" }, hash: "goshuins" })
                  : `/mypage?tab=goshuin&toast=goshuin_saved#goshuin-upload`;

                router.push(href);
                router.refresh();
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
            navigateOnCardClick
          />
        </SectionCard>
      </div>
    </main>
  );
}
