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
  onOpenDetail?: (g: Goshuin) => void;
  onDelete?: (id: number) => void;
  onToggleVisibility?: (id: number, next: boolean) => void;
};

function toProxiedMedia(url: string): string {
  if (url.startsWith("/media/")) return url;
  try {
    const u = new URL(url);
    if (u.pathname.startsWith("/media/")) return `${u.pathname}${u.search}`;
  } catch (e) {
    void e;
  }
  return url;
}

export default function MyGoshuinCard({
  item,
  isDeleting,
  isToggling,
  onOpenDetail,
  onDelete,
  onToggleVisibility,
}: Props) {
  const shrineName = item.shrine_name ?? (item as any)?.shrine?.name_jp ?? null;
  const { created_at, is_public, image_url } = item;

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

  const proxiedImageUrl = image_url ? toProxiedMedia(image_url) : null;

  const createdAtLabel =
    created_at &&
    new Date(created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  const visibilityLabel = is_public ? "公開" : "非公開";

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
            alt={shrineName ?? "御朱印"}
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

        <div className="absolute inset-x-0 bottom-4 z-40 pointer-events-none px-3">
          <div className="flex items-center justify-end gap-2">
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
                aria-label={isToggling ? "切り替え中…" : is_public ? "非公開にする" : "公開する"}
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
                aria-label={isDeleting ? "削除中…" : "削除"}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 p-4">
          <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground">
            {item.title || shrineName || "タイトル未設定"}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{shrineName ?? "-"}</p>
          <p className="text-[11px] text-muted-foreground">
            登録日: <time>{createdAtLabel ?? "-"}</time>
          </p>
          <p className="text-[11px] text-muted-foreground">
            公開設定: <span className="font-medium">{visibilityLabel}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
