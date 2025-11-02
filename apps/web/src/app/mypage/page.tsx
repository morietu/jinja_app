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

        <nav className="flex gap-2 flex-wrap" role="tablist" aria-label="マイページ内タブ">
  {tabs.map((t) => (
    <button
      key={t.key}
      role="tab"
      aria-selected={tab === t.key}
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

        <section className="rounded-lg border bg-white p-6" role="status" aria-busy="true" aria-live="polite">
  <div className="flex items-center gap-4 mb-4">
    <div className="size-12 rounded-full bg-gray-200 animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-1/4 animate-pulse" />
    </div>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="sm:col-span-3 h-4 bg-gray-100 rounded animate-pulse" />
    ))}
  </div>
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

type UserProfile = {
  nickname?: string | null;
  is_public?: boolean | null;
  bio?: string | null;
  icon_url?: string | null; // 将来サーバーが返す想定
};

// --- 子では useAuth() を呼ばず、親の user を受け取る
type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile?: UserProfile;
};

function ProfilePanel({ user }: { user: User }) {
  if (!user) return null;
  const nickname = user?.profile?.nickname || user?.username || "-";
  const isPublic = Boolean(user?.profile?.is_public);
  const email = user?.email || "-";
  // ① 画像アイコンが来たら使う（なければ頭文字アバター）
  const iconUrl = user?.profile?.icon_url || "";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        {/* アバター */}
        {iconUrl ? (
          <img
            src={iconUrl}
            alt={nickname}
            className="size-12 rounded-full object-cover ring-1 ring-gray-200"
          />
        ) : (
          <div className="size-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold select-none">
            {nickname.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{nickname}</h2>
            {/* 公開/非公開チップ */}
            <span
              className={
                "text-xs px-2 py-0.5 rounded-full border " +
                (isPublic
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-gray-50 text-gray-600 border-gray-200")
              }
              title={isPublic ? "プロフィールは公開です" : "プロフィールは非公開です"}
            >
              {isPublic ? "公開" : "非公開"}
            </span>
          </div>
          <p className="text-gray-500 text-sm truncate">{email}</p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1 text-gray-500">ユーザー名</div>
        <div className="sm:col-span-2 break-words">{user?.username ?? "-"}</div>

        <div className="sm:col-span-1 text-gray-500">メール</div>
        <div className="sm:col-span-2 break-words">{email}</div>
      </dl>

      <p className="text-sm text-gray-500">
        プロフィール編集は後続対応（現状は表示のみ）。
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
