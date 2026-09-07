"use client";

import Link from "next/link";
import type { Favorite } from "@/lib/api/favorites";
import { normalizeFavorite } from "@/lib/favorites/normalize";
import { LABELS } from "@/lib/ui/labels";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { buildShrineResolveHref } from "@/lib/nav/buildShrineResolveHref";

type Props = {
  favorite: Favorite;
  onUnsave?: () => void;
  onAddGoshuin?: () => void;

  disabled?: boolean;
  unsaveLoading?: boolean;
  addLoading?: boolean;

  canAddGoshuin?: boolean;

  /**
   * 公開御朱印の件数badgeと「御朱印を見る」導線を出すか。
   * 既定はtrue（/favorites の全件一覧は従来どおり表示する）。
   * /mypage HUBのpreviewだけがfalseを渡す。
   */
  showGoshuinInfo?: boolean;
};

export function FavoriteShrineCard({
  favorite,
  onUnsave,
  onAddGoshuin,
  disabled,
  unsaveLoading,
  addLoading,
  canAddGoshuin,
  showGoshuinInfo = true,
}: Props) {
  const { shrineId, placeId } = normalizeFavorite(favorite);

  const href = shrineId ? buildShrineHref(shrineId) : placeId ? buildShrineResolveHref(placeId) : "/map";

  const title =
    (favorite.shrine?.name_jp && favorite.shrine.name_jp.trim()) ||
    (shrineId ? `神社 #${shrineId}` : placeId ? `place_id: ${placeId}` : `id: ${favorite.id}`);

  const sub = (favorite.shrine?.address && favorite.shrine.address.trim()) || null;

  const publicGoshuinCount = Number(favorite.public_goshuin_count ?? 0);
  const hasPublicGoshuins = showGoshuinInfo && publicGoshuinCount > 0;

  const goshuinHref = shrineId && hasPublicGoshuins ? buildShrineHref(shrineId, { subpath: "goshuins" }) : null;

  const allowAdd = canAddGoshuin ?? Boolean(shrineId || placeId);

  return (
    <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--kt-color-text-primary)]">{title}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-[var(--kt-color-text-muted)]">{sub}</p>}

          {hasPublicGoshuins ? (
            <div className="mt-2">
              <span className="inline-flex items-center rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-2 py-0.5 text-[11px] font-medium text-[var(--kt-color-text-secondary)]">
                御朱印 {publicGoshuinCount}件
              </span>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {href && (
              <Link href={href} className="text-xs text-[var(--kt-color-text-secondary)] hover:text-[var(--kt-color-text-primary)] hover:underline">
                {LABELS.shrineDetail}
              </Link>
            )}

            {goshuinHref && (
              <Link href={goshuinHref} className="text-xs text-[var(--kt-color-action-primary)] hover:text-[var(--kt-color-action-primary-hover)] hover:underline">
                御朱印を見る
              </Link>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
          {onAddGoshuin && (
            <button
              type="button"
              onClick={onAddGoshuin}
              disabled={disabled || addLoading || !allowAdd}
              className="rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-1 text-xs font-medium text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] disabled:opacity-40"
            >
              {addLoading ? LABELS.moving : LABELS.addGoshuin}
            </button>
          )}

          {onUnsave && (
            <button
              type="button"
              onClick={onUnsave}
              disabled={disabled || unsaveLoading}
              className="rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-1 text-xs font-medium text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] disabled:opacity-40"
            >
              {unsaveLoading ? LABELS.removing : LABELS.unsave}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
