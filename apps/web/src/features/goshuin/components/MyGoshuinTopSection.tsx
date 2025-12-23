"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMyGoshuin } from "@/features/mypage/hooks";




function GoshuinCardMini({
  title,
  imageUrl,
  shrineName,
  isPublic,
}: {
  title?: string | null;
  imageUrl?: string | null;
  shrineName?: string | null;
  isPublic: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[4/5] bg-muted">
        {imageUrl ? (
          
          <img src={imageUrl} alt={title ?? "御朱印"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">画像なし</div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-800">{title || "（無題）"}</div>
            <div className="truncate text-[11px] text-slate-500">{shrineName || ""}</div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
              isPublic ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {isPublic ? "公開" : "非公開"}
          </span>
        </div>
      </div>
    </div>
  );
}

function PlaceholderToriiCard({ label = "サンプル" }: { label?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[4/5] bg-slate-100">
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          <div className="text-3xl">⛩</div>
          <div className="text-[11px] text-slate-500">{label}</div>
        </div>
      </div>
      <div className="p-3">
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="mt-2 h-2 w-16 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function MyGoshuinTopSection() {
  const { isLoggedIn, user } = useAuth();
  const username = user?.username ?? null;

  const { items, loading, error, reload } = useMyGoshuin({
    enabled: isLoggedIn,
  });


  const hasPublic = Boolean(items?.some((g) => g.is_public));
  const publicUrl = username ? `/g/${encodeURIComponent(username)}` : null;

  
  const latest = (items ?? []).slice(0, 4);
  const showPlaceholders = !isLoggedIn || (!loading && !error && latest.length === 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">あなたの御朱印</h2>
          <p className="mt-1 text-xs text-slate-500">アップロードした御朱印をここで確認できます。</p>
        </div>

        <div className="flex items-center gap-2">
          {/* ログイン済なら公開ページ導線（公開が無いなら disabled 表示） */}
          {isLoggedIn && publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className={`rounded-md px-3 py-2 text-xs font-medium ${
                hasPublic
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "pointer-events-none bg-slate-100 text-slate-400"
              }`}
              aria-disabled={!hasPublic}
              title={hasPublic ? "公開御朱印帳を開く" : "公開中の御朱印がありません"}
            >
              公開ページ
            </a>
          )}

          {!isLoggedIn ? (
            <Link href="/login?next=/" className="rounded-md bg-orange-500 px-3 py-2 text-xs font-medium text-white">
              ログイン
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void reload()}
              className="rounded-md bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200"
            >
              更新
            </button>
          )}
        </div>
      </header>

      {/* サムネ領域（未ログインでもイメージが伝わるように出す） */}
      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : showPlaceholders ? (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <PlaceholderToriiCard key={i} label={i < 3 ? "鳥居イメージ" : "あなたの御朱印"} />
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {!isLoggedIn
                ? "ログインすると、御朱印を保存してここに並べられます。"
                : "まだ御朱印がありません。下から画像をアップロードできます。"}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {latest.map((g) => (
              <GoshuinCardMini
                key={g.id}
                title={g.title}
                imageUrl={g.image_url}
                shrineName={g.shrine_name ?? null}
                isPublic={g.is_public}
              />
            ))}
          </div>
        )}
      </div>

      {/* 最短の動線：ログイン時だけアップロードを出す */}
      {isLoggedIn && hasPublic && user?.username && (
        <Link href={`/g/${user.username}`} className="text-xs text-blue-600 underline">
          公開御朱印帳を見る
        </Link>
      )}
    </section>
  );
}
