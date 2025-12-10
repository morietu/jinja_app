// apps/web/src/features/mypage/components/MyGoshuinCard.tsx
"use client";

import type { MouseEvent, KeyboardEvent } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// 使いたければ他のコンポーネント用に
export type MyGoshuin = {
  id: number;
  shrine_name: string;
  shrine_address?: string | null;
  visited_at?: string | null; // "2025-12-10" など
  created_at?: string | null;
  is_public: boolean;
  image_url?: string | null;
};

type Props = {
  item: Goshuin;
  isDeleting?: boolean;
  isToggling?: boolean;
  onOpenDetail?: (g: Goshuin) => void;
  onDelete?: (id: number) => void;
  onToggleVisibility?: (id: number, next: boolean) => void;
};

export default function MyGoshuinCard({
  item,
  isDeleting,
  isToggling,
  onOpenDetail,
  onDelete,
  onToggleVisibility,
}: Props) {
  const { shrine_name, shrine_address, visited_at, created_at, is_public, image_url } = item;

  const handleClickCard = () => {
    if (onOpenDetail) {
      onOpenDetail(item);
    }
  };

  const handleClickDelete = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onDelete) return;
    onDelete(item.id);
  };

  const handleClickToggle = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!onToggleVisibility) return;
    const next = !item.is_public;
    onToggleVisibility(item.id, next);
  };

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
      {/* 画像エリア：アスペクト比固定 */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-muted to-muted/60">
        {image_url ? (
          <Image
            src={image_url}
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

        {/* 公開ステータスバッジ（非公開のみ表示） */}
        {!is_public && (
          <div className="absolute left-3 top-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500/95 to-pink-500/95 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
              <EyeOff className="h-3.5 w-3.5" />
              非公開
            </span>
          </div>
        )}

        {/* 操作アイコン（右上） */}
        <div className="absolute right-3 top-3 flex gap-2 transition-all duration-300">
          {onToggleVisibility && (
            <Button
              size="icon"
              variant="secondary"
              className={cn(
                "h-9 w-9 translate-y-2 rounded-full bg-white/90 shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white",
                "dark:bg-black/60 dark:hover:bg-black/80",
                "opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
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
                "h-9 w-9 translate-y-2 rounded-full bg-white/90 shadow-lg backdrop-blur-md transition-all duration-300 delay-75 hover:scale-110 hover:bg-red-500 hover:text-white",
                "dark:bg-black/60 dark:hover:bg-red-500",
                "opacity-0 group-hover:translate-y-0 group-hover:opacity-100",
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
        <h3 className="line-clamp-1 text-sm font-semibold tracking-tight text-foreground">
          {item.title || shrine_name || "タイトル未設定"}
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">{shrine_name ?? "-"}</p>

        {/* 登録日・公開設定（テストが期待しているテキスト） */}
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
