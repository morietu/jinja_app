// apps/web/src/features/mypage/components/MyGoshuinCard.tsx
"use client";

import type { MouseEvent, KeyboardEvent } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  item: Goshuin;
  isDeleting?: boolean;
  isToggling?: boolean;
  onOpenDetail?: (g: Goshuin) => void; // 親が「遷移」or「モーダル」を決める
  onDelete?: (id: number) => void;
  onToggleVisibility?: (id: number, next: boolean) => void;
};

function toProxiedMediaUrl(image_url?: string | null): string | null {
  if (!image_url) return null;
  if (image_url.startsWith("/media/")) return image_url;

  try {
    const u = new URL(image_url);
    if (u.pathname.startsWith("/media/")) return `${u.pathname}${u.search}`;
  } catch {
    // 非URL（相対パス等）の場合はそのまま使う

    return image_url;
}

export default function MyGoshuinCard({
  item,
  isDeleting,
  isToggling,
  onOpenDetail,
  onDelete,
  onToggleVisibility,
}: Props) {
  const { shrine_name, created_at, is_public, image_url } = item;

  const proxiedImageUrl = image_url ? toProxiedMediaUrl(image_url) : null;

  const createdAtLabel =
    created_at &&
    new Date(created_at).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const visibilityLabel = is_public ? "公開" : "非公開";
  const deleteAriaLabel = isDeleting ? "削除中…" : "削除";
  const toggleAriaLabel = isToggling ? "切り替え中…" : is_public ? "非公開にする" : "公開する";

  const handleClickCard = () => onOpenDetail?.(item);

  const handleClickDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onDelete?.(item.id);
  };

  const handleClickToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onToggleVisibility) return;
    onToggleVisibility(item.id, !item.is_public);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClickCard}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClickCard();
        }
      }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/20 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-muted to-muted/60">
        {proxiedImageUrl ? (
          <Image
            src={proxiedImageUrl}
            alt={shrine_name ?? "御朱印"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground/80">
            画像なし
          </div>
        )}

        {!is_public && (
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500/95 to-pink-500/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
              <EyeOff className="h-3.5 w-3.5" />
              非公開
            </span>
          </div>
        )}

        <div className={cn("absolute right-3 top-3 flex gap-2 transition-all duration-300", "pointer-events-none")}>
          {onToggleVisibility && (
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "pointer-events-auto",
                "h-9 w-9 rounded-full bg-white/90 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white",
                "dark:bg-black/60 dark:hover:bg-black/80",
                "supports-[hover:hover]:opacity-0 supports-[hover:hover]:translate-y-2",
                "supports-[hover:hover]:group-hover:opacity-100 supports-[hover:hover]:group-hover:translate-y-0",
              )}
              onClick={handleClickToggle}
              aria-label={toggleAriaLabel}
              disabled={isToggling}
            >
              {is_public ? (
                <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}

          {onDelete && (
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "pointer-events-auto",
                "h-9 w-9 rounded-full bg-white/90 shadow-lg backdrop-blur-md transition-all duration-300 delay-75 hover:scale-110 hover:bg-red-500 hover:text-white",
                "dark:bg-black/60 dark:hover:bg-red-500",
                "supports-[hover:hover]:opacity-0 supports-[hover:hover]:translate-y-2",
                "supports-[hover:hover]:group-hover:opacity-100 supports-[hover:hover]:group-hover:translate-y-0",
              )}
              onClick={handleClickDelete}
              aria-label={deleteAriaLabel}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground">
          {item.title || shrine_name || "タイトル未設定"}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{shrine_name ?? "-"}</p>

        <p className="text-[11px] text-muted-foreground">
          登録日: <time>{createdAtLabel ?? "-"}</time>
        </p>
        <p className="text-[11px] text-muted-foreground">
          公開設定: <span className="font-medium">{visibilityLabel}</span>
        </p>
      </div>
    </article>
  );
}
