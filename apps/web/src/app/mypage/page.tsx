"use client";

import React, { useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import type { User } from "@/lib/types/user";

type TabKey = "profile" | "favorites" | "goshuin" | "settings";
const TABS: TabKey[] = ["profile", "favorites", "goshuin", "settings"];

function sanitizeTab(v?: string | null): TabKey {
  if (!v) return "profile";
  return (TABS.includes(v as TabKey) ? v : "profile") as TabKey;
}

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

export default function MyPage() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const [tab, setTab] = useTab();

  const tabs = useMemo(
    () => [
      { key: "profile" as const,   label: "プロフィール" },
      { key: "favorites" as const, label: "お気に入り（準備中）" },
      { key: "goshuin" as const,   label: "御朱印（準備中）" },
      { key: "settings" as const,  label: "設定" },
    ],
    []
  );

  // ← ここで1回だけ宣言（以降の条件分岐より前）
  const onTabsKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"] as const;
      if (!keys.includes(e.key as any)) return;
      e.preventDefault();

      const idx = tabs.findIndex((t) => t.key === tab);
      const last = tabs.length - 1;

      if (e.key === "Home")      setTab(tabs[0].key,  { focus: true });
      else if (e.key === "End")  setTab(tabs[last].key, { focus: true });
      else if (e.key === "ArrowLeft") {
        const next = idx <= 0 ? last : idx - 1;
        setTab(tabs[next].key, { focus: true });
      } else if (e.key === "ArrowRight") {
        const next = idx >= last ? 0 : idx + 1;
        setTab(tabs[next].key, { focus: true });
      }
    },
    [tab, tabs, setTab]
  );

  // --- 読み込み中
  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">マイページ</h1>
          <div className="px-3 py-1 rounded bg-gray-100 text-gray-400">…</div>
        </header>

        <nav className="flex gap-2 flex-wrap" role="tablist" aria-label="マイページ内タブ" aria-orientation="horizontal">
          {tabs.map((t) => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              className="px-3 py-1 rounded border bg-gray-50 text-gray-400 cursor-wait"
              type="button"
              disabled
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Skeletonのみ */}
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

  // --- 未ログイン
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

  // --- ログイン時の表示
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">マイページ</h1>
        <button onClick={logout} className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" type="button">
          ログアウト
        </button>
      </header>

      <nav
        className="flex gap-2 flex-wrap"
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
                "px-3 py-1 rounded border " +
                (isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white hover:bg-gray-50")
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
        {tab === "profile"   && <ProfilePanel user={user!} />}
        {tab === "favorites" && <FavoritesPanel />}
        {tab === "goshuin"   && <GoshuinPanel />}
        {tab === "settings"  && <SettingsPanel />}
      </section>
    </main>
  );
}

// --- 子では useAuth() を呼ばず、親の user を受け取る
function ProfilePanel({ user }: { user: User }) {
  if (!user) return null;

  const p = user.profile ?? {};
  const nickname = p.nickname || user.username || "-";
  const isPublic = !!p.is_public;
  const email = user?.email || "-";
  const iconUrl = user?.profile?.icon_url || "";

  const birthday = p.birthday ? new Date(p.birthday) : null;
  const age = birthday ? calcAge(birthday) : null;


  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img src={iconUrl} alt={nickname} className="size-12 rounded-full object-cover ring-1 ring-gray-200" />
        ) : (
          <div className="size-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold select-none">
            {nickname.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold truncate">{nickname}</h2>
            <span
              className={
                "text-xs px-2 py-0.5 rounded-full border " +
                (isPublic ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200")
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
        <div className="sm:col-span-2 break-words">{user.username ?? "-"}</div>

        <div className="sm:col-span-1 text-gray-500">メール</div>
        <div className="sm:col-span-2 break-words">{email}</div>

        <div className="sm:col-span-1 text-gray-500">生年月日</div>
        <div className="sm:col-span-2">
          {birthday ? formatDateJp(birthday) : "-"}
        </div>

        <div className="sm:col-span-1 text-gray-500">地域</div>
        <div className="sm:col-span-2">{p.location || "-"}</div>

        <div className="sm:col-span-1 text-gray-500">Web</div>
        <div className="sm:col-span-2">
          {p.website ? (
            <a className="text-blue-600 hover:underline break-all" href={p.website} target="_blank" rel="noreferrer">
              {p.website}
            </a>
          ) : (
            "-"
          )}
        </div>
      </dl>

      <p className="text-sm text-gray-500">プロフィール編集は後続対応（現状は表示のみ）。</p>
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
      <p className="text-gray-600">登録・編集はサーバーの準備が整ってから有効化します（現状はUIのみ）。</p>
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

function calcAge(bday: Date) {
  const today = new Date();
  let age = today.getFullYear() - bday.getFullYear();
  const m = today.getMonth() - bday.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bday.getDate())) age--;
  return age;
}
function formatDateJp(d: Date) {
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
}
