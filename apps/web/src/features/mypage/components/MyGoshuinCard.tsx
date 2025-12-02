// apps/web/src/features/mypage/components/MyGoshuinCard.tsx
"use client";

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

export function MyGoshuinCard({ item, isDeleting, isToggling, onOpenDetail, onDelete, onToggleVisibility }: Props) {
  const handleClickCard = () => {
    if (onOpenDetail) onOpenDetail(item);
  };

  const handleClickDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onDelete) return;
    onDelete(item.id);
  };

  const handleClickToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onToggleVisibility) return;
    const next = !item.is_public;
    onToggleVisibility(item.id, next);
  };

  const createdAtLabel =
    item.created_at &&
    new Date(item.created_at).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const visibilityLabel = item.is_public ? "公開" : "非公開";

  const deleteAriaLabel = isDeleting ? "削除中…" : "削除";
  const toggleAriaLabel = isToggling ? "切り替え中…" : item.is_public ? "非公開にする" : "公開する";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClickCard}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClickCard();
        }
      }}
      className="group relative flex flex-col bg-card rounded-3xl overflow-hidden border border-border/20 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:border-border/40 hover:-translate-y-0.5"
    >
      {/* 画像エリア */}
      <div className="relative aspect-[4/5] bg-gradient-to-br from-muted to-muted/60 overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.shrine_name ?? "御朱印"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            sizes="(max-width: 640px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground/80">
            画像なし
          </div>
        )}

        {/* 公開ステータスバッジ（非公開のみ表示） */}
        {!item.is_public && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500/95 to-pink-500/95 backdrop-blur-sm text-xs font-semibold text-white shadow-lg">
              <EyeOff className="h-3.5 w-3.5" />
              非公開
            </span>
          </div>
        )}

        {/* 操作アイコン（右上） */}
        <div className="absolute top-3 right-3 flex gap-2 transition-all duration-300">
          {onToggleVisibility && (
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "h-9 w-9 rounded-full shadow-lg backdrop-blur-md transition-all duration-300",
                "bg-white/90 hover:bg-white hover:scale-110",
                "dark:bg-black/60 dark:hover:bg-black/80",
                "opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2",
              )}
              onClick={handleClickToggle}
              aria-label={toggleAriaLabel}
              disabled={isToggling}
            >
              {item.is_public ? (
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
                "h-9 w-9 rounded-full shadow-lg backdrop-blur-md transition-all duration-300 delay-75",
                "bg-white/90 hover:bg-red-500 hover:text-white hover:scale-110",
                "dark:bg-black/60 dark:hover:bg-red-500",
                "opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2",
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

      {/* 情報エリア */}
      <div className="flex flex-col gap-1 p-4">
        <h3 className="font-semibold text-sm text-foreground line-clamp-1 tracking-tight">
          {item.title || item.shrine_name || "タイトル未設定"}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{item.shrine_name ?? "-"}</p>

        {/* ✅ テストが期待しているテキスト */}
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
