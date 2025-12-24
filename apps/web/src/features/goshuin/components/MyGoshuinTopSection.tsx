"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useMyGoshuin } from "@/features/mypage/hooks";

function GoshuinCardMini({
  title,
  imageUrl,
  shrineName,
  isPublic,
  showBadge = true,
  href,
}: {
  title?: string | null;
  imageUrl?: string | null;
  shrineName?: string | null;
  isPublic: boolean;
  showBadge?: boolean;
  href?: string;
}) {
  const Inner = (
    <>
      <div className="aspect-[4/5] bg-slate-100">
        {imageUrl ? (
          <img src={imageUrl} alt={title ?? "御朱印"} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">画像なし</div>
        )}
      </div>

      <div className="space-y-1 p-3">
        <div className="truncate text-sm font-medium text-slate-800">{title || "（無題）"}</div>
        {shrineName ? <div className="truncate text-[11px] text-slate-500">{shrineName}</div> : null}

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
    </>
  );

  return href ? (
    <Link href={href} className="block overflow-hidden rounded-2xl border bg-white shadow-sm hover:opacity-95">
      {Inner}
    </Link>
  ) : (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm opacity-60 cursor-not-allowed">{Inner}</div>
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
  

  const { items, loading, error } = useMyGoshuin({ enabled: isLoggedIn });

  const hasAny = (items ?? []).length > 0;
  const hasPublic = (items ?? []).some((g) => g.is_public);
  const latestPublic = (items ?? []).filter((g) => g.is_public).slice(0, 4);

  const showPlaceholders = !isLoggedIn || (!loading && !error && latestPublic.length === 0);
  const GRID = "grid grid-cols-2 gap-4 sm:grid-cols-4";

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
        <div className={GRID}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={i >= 2 ? "hidden sm:block" : ""}>
              <div className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : showPlaceholders ? (
        <>
          <div className={GRID}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={i >= 2 ? "hidden sm:block" : ""}>
                <PlaceholderToriiCard label={i === 0 ? "鳥居イメージ" : "あなたの御朱印"} />
              </div>
            ))}
          </div>

          {emptyText && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {emptyText}
            </div>
          )}
        </>
      ) : (
        <div className={GRID}>
          {latestPublic.map((g, i) => (
            <div key={g.id} className={i >= 2 ? "hidden sm:block" : ""}>
              <GoshuinCardMini
                href={g.shrine ? `/shrines/${g.shrine}` : undefined}
                title={g.title}
                imageUrl={g.image_url}
                shrineName={g.shrine_name ?? null}
                isPublic={g.is_public}
                showBadge={false}
              />
            </div>
          ))}
          
        </div>
      )}
    </>
  );

  return <div className="space-y-4">{thumbs}</div>;
}
