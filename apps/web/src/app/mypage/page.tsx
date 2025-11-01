"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

type TabKey = "profile" | "favorites" | "goshuin" | "settings";
const TABS: TabKey[] = ["profile", "favorites", "goshuin", "settings"];

function sanitizeTab(v?: string | null): TabKey {
  if (!v) return "profile";
  return (TABS.includes(v as TabKey) ? v : "profile") as TabKey;
}

function useTab(): [TabKey, (t: TabKey) => void] {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sanitizeTab(sp.get("tab"));
  const setTab = (t: TabKey) => {
    const usp = new URLSearchParams(sp.toString());
    usp.set("tab", t);
    router.replace(`/mypage?${usp.toString()}`);
  };
  return [current, setTab];
}

export default function MyPage() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const [tab, setTab] = useTab();

  const tabs: { key: TabKey; label: string }[] = useMemo(
    () => [
      { key: "profile",   label: "プロフィール" },
      { key: "favorites", label: "お気に入り（準備中）" },
      { key: "goshuin",   label: "御朱印（準備中）" },
      { key: "settings",  label: "設定" },
    ],
    []
  );

  // --- 読み込み中でも外枠は出す（ガタつき低減）
  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">マイページ</h1>
          <div className="px-3 py-1 rounded bg-gray-100 text-gray-400">…</div>
        </header>

        <nav className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              className="px-3 py-1 rounded border bg-gray-50 text-gray-400 cursor-wait"
              type="button"
              disabled
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="rounded-lg border bg-white p-6">
          <p>読み込み中…</p>
        </section>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-xl font-bold mb-4">マイページ</h1>
        <div className="rounded-lg border p-6 bg-white">
          <p className="mb-3">マイページを利用するにはログインしてください。</p>
          <Link
            href="/login?next=/mypage"
            className="inline-block px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">マイページ</h1>
        <button
          onClick={logout}
          className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
          type="button"
        >
          ログアウト
        </button>
      </header>

      <nav className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-3 py-1 rounded border " +
              (tab === t.key
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white hover:bg-gray-50")
            }
            type="button"
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="rounded-lg border bg-white">
        {tab === "profile"   && <ProfilePanel user={user!} />}
        {tab === "favorites" && <FavoritesPanel />}
        {tab === "goshuin"   && <GoshuinPanel />}
        {tab === "settings"  && <SettingsPanel />}
      </section>
    </main>
  );
}

// --- 子では useAuth() を呼ばず、親の user を受け取る
type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: any;
};

function ProfilePanel({ user }: { user: User }) {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">プロフィール</h2>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1 text-gray-500">ユーザー名</div>
        <div className="sm:col-span-2">{user?.username ?? "-"}</div>

        <div className="sm:col-span-1 text-gray-500">メール</div>
        <div className="sm:col-span-2">{user?.email ?? "-"}</div>
      </dl>
      <p className="text-sm text-gray-500">
        本番の編集フォームはサーバーAPI接続後に追加します（表示のみ）。
      </p>
    </div>
  );
}

function FavoritesPanel() {
  return (
    <div className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">お気に入り</h2>
      <p className="text-gray-600">
        テスト段階ではバックエンドに依存するため、一覧・追加・削除は<strong>保留</strong>です。
      </p>
      <p className="text-sm text-gray-500">
        実装開始時は <code>getFavorites()</code> の読み取り → 削除だけ先に対応 → 追加は詳細/検索から、の順を推奨です。
      </p>
    </div>
  );
}

function GoshuinPanel() {
  return (
    <div className="p-6 space-y-3">
      <h2 className="text-lg font-semibold">御朱印</h2>
      <p className="text-gray-600">
        登録・編集はサーバーの準備が整ってから有効化します（現状はUIのみ）。
      </p>
      <div className="flex gap-2">
        <button className="px-3 py-1 rounded bg-gray-200 text-gray-500 cursor-not-allowed" type="button" disabled>
          新規登録（準備中）
        </button>
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">設定</h2>
      <div className="space-y-2 text-sm text-gray-600">
        <p>見た目や通知などのローカル設定は、まずはローカル state のみで実装予定。</p>
        <ul className="list-disc pl-5">
          <li>テーマ（ライト/ダーク）… ローカル保持</li>
          <li>位置情報の使用可否… 既存の geolocation フローにあわせる</li>
        </ul>
      </div>
    </div>
  );
}
