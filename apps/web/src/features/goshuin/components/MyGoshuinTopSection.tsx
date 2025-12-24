// MyGoshuinTopSection.tsx
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
  showBadge = true,
}: {
  title?: string | null;
  imageUrl?: string | null;
  shrineName?: string | null;
  isPublic: boolean;
  showBadge?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="aspect-[4/5] bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={title ?? "御朱印"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">画像なし</div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-800">{title || "（無題）"}</div>
          {shrineName ? <div className="truncate text-[11px] text-slate-500">{shrineName}</div> : null}
        </div>

        {showBadge && (
          <div>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] ${
                isPublic ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {isPublic ? "公開" : "非公開"}
            </span>
          </div>
        )}
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

  const publicUrl = username ? `/g/${encodeURIComponent(username)}` : null;

  const hasAny = (items ?? []).length > 0;
  const hasPublic = (items ?? []).some((g) => g.is_public);
  const showPublishCta = isLoggedIn && !loading && !error && hasAny && !hasPublic;

  const latestPublic = (items ?? []).filter((g) => g.is_public).slice(0, 2);
  const showPlaceholders = !isLoggedIn || (!loading && !error && latestPublic.length === 0);

  const emptyText = !isLoggedIn
    ? ""
    : !hasAny
      ? "まだ御朱印がありません。"
      : !hasPublic
        ? "公開中の御朱印がありません。"
        : "";

  const thumbs = (
    <>
      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : showPlaceholders ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <PlaceholderToriiCard key={i} label={i < 1 ? "鳥居イメージ" : "あなたの御朱印"} />
            ))}
          </div>

          {emptyText && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {emptyText}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {latestPublic.map((g) => (
            <GoshuinCardMini
              key={g.id}
              title={g.title}
              imageUrl={g.image_url}
              shrineName={g.shrine_name ?? null}
              isPublic={g.is_public}
              showBadge={false}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {isLoggedIn && publicUrl && (
          <Link
            href={publicUrl}
            aria-disabled={!hasPublic}
            title={hasPublic ? "公開御朱印帳を開く" : "公開中の御朱印がありません"}
            className={`rounded-md px-3 py-2 text-xs font-medium ${
              hasPublic
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "pointer-events-none bg-slate-100 text-slate-400"
            }`}
          >
            公開ページ
          </Link>
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

      {showPublishCta && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">まず1枚だけ公開してみよう</div>
          <div className="mt-1 text-[13px] text-amber-900/80">
            公開すると、あなたの「公開ページ」に表示されてカードが強くなります。
          </div>
          <div className="mt-3">
            <Link
              href="/mypage?tab=goshuin"
              className="inline-flex items-center justify-center rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-700"
            >
              公開設定をする
            </Link>
          </div>
        </div>
      )}

      <div>
        {isLoggedIn && hasPublic && publicUrl ? (
          <Link
            href={publicUrl}
            className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-label="公開御朱印帳を開く"
          >
            <div className="cursor-pointer transition-opacity hover:opacity-95">{thumbs}</div>
          </Link>
        ) : (
          thumbs
        )}
      </div>
    </div>
  );
}
