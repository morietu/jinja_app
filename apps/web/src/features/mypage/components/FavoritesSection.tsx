// apps/web/src/features/mypage/components/FavoritesSection.tsx
//
// /mypage HUBの「保存した神社」preview。
// 全件一覧・保存解除は /favorites の責務なので、ここではPreview + Entry Pointに限定する。
"use client";

import Link from "next/link";

import type { Favorite } from "@/lib/api/favorites";
import { FavoriteShrineCard } from "./FavoriteShrineCard";
import { HUB_PREVIEW_LIMIT, sortFavoritesByRecentlySaved, takeHubPreview } from "@/features/mypage/lib/hubPreview";

type Props = {
  favorites: Favorite[];
  fetchFailed: boolean;
};

export default function FavoritesSection({ favorites, fetchFailed }: Props) {
  const count = favorites.length;
  const hasData = count > 0;

  // HUBのpreviewは「最近保存した順」。公開御朱印数による優先付けはしない。
  const visible = takeHubPreview(sortFavoritesByRecentlySaved(favorites), HUB_PREVIEW_LIMIT);

  return (
    <section
      aria-labelledby="mypage-saved-shrines-title"
      className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mypage-saved-shrines-title" className="text-sm font-medium text-[var(--kt-color-text-secondary)]">
          保存した神社
          {hasData ? (
            <span className="ml-2 text-xs font-normal text-[var(--kt-color-text-muted)]">{count}件</span>
          ) : null}
        </h2>

        {hasData ? (
          <Link
            href="/favorites"
            className="rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-1.5 text-xs text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] hover:text-[var(--kt-color-text-primary)]"
          >
            すべて見る
          </Link>
        ) : null}
      </header>

      {fetchFailed ? (
        <p role="alert" className="mt-3 text-sm text-[var(--kt-color-status-error)]">
          保存した神社を読み込めませんでした。
        </p>
      ) : hasData ? (
        <div className="mt-3 space-y-3">
          {visible.map((favorite) => (
            // onUnsaveを渡さないことで保存解除ボタンは描画されない（解除は /favorites の責務）。
            <FavoriteShrineCard key={favorite.id} favorite={favorite} showGoshuinInfo={false} />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] p-4">
          <p className="text-sm font-medium text-[var(--kt-color-text-secondary)]">保存した神社はまだありません</p>
          <p className="mt-1 text-xs text-[var(--kt-color-text-muted)]">気になる神社を保存できます。</p>
          <Link
            href="/map"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            近くの神社を探す
          </Link>
        </div>
      )}
    </section>
  );
}
