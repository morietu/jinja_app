// apps/web/src/features/mypage/components/MyGoshuinList.tsx
"use client";

import { MouseEvent, useState } from "react";
import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";
import GoshuinDetailModal from "./GoshuinDetailModal";

type Props = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
  onDelete?: (id: number) => void | Promise<void>;
  onToggleVisibility?: (id: number, next: boolean) => void | Promise<void>;
};

export default function MyGoshuinList({ items, loading, error, onDelete, onToggleVisibility }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Goshuin | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // -----------------
  // 状態別レンダー
  // -----------------
  if (loading) {
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm" role="status" aria-busy="true" aria-live="polite">
        <h3 className="mb-3 text-sm font-medium text-gray-800">登録済みの御朱印</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-orange-100 bg-orange-50/40" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-800">登録済みの御朱印</h3>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  if (!items || items.length === 0) {
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-gray-800">登録済みの御朱印</h3>
        <p className="text-sm text-gray-500">
          まだ御朱印が登録されていません。上のフォームからアップロードしてみてください。
        </p>
      </section>
    );
  }

  // -----------------
  // ハンドラ
  // -----------------
  const handleCardClick = (g: Goshuin) => {
    setSelected(g);
    setDetailOpen(true);
  };

  const handleDeleteClick = async (e: MouseEvent<HTMLButtonElement>, g: Goshuin) => {
    e.stopPropagation();
    if (!onDelete) return;

    const ok = window.confirm("この御朱印を削除しますか？");
    if (!ok) return;

    try {
      setDeletingId(g.id);
      await onDelete(g.id);
    } finally {
      setDeletingId((current) => (current === g.id ? null : current));
    }
  };

  const handleToggleVisibilityClick = async (e: MouseEvent<HTMLButtonElement>, g: Goshuin) => {
    e.stopPropagation();
    if (!onToggleVisibility) return;

    const next = !g.is_public;

    try {
      setTogglingId(g.id);
      await onToggleVisibility(g.id, next);
    } finally {
      setTogglingId((current) => (current === g.id ? null : current));
    }
  };

  // -----------------
  // 本体レンダー
  // -----------------
  return (
    <>
      <section className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-800">登録済みの御朱印</h3>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((g) => {
            const isDeleting = deletingId === g.id;
            const isToggling = togglingId === g.id;

            return (
              <article
                key={g.id}
                role="button"
                tabIndex={0}
                className="
    relative 
    overflow-hidden 
    rounded-2xl border border-orange-100 
    bg-white 
    p-3 text-xs 
    shadow-sm 
    hover:shadow-md 
    transition
  "
                onClick={() => handleCardClick(g)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCardClick(g);
                  }
                }}
              >
                {/* 削除ボタン（カードとは別のボタン） */}
                {onDelete && (
                  <button
                    type="button"
                    className="
        absolute right-2 top-2 
        z-10
        rounded-full border border-orange-200 
        bg-white/90 px-2 py-0.5 
        text-[11px] font-medium text-orange-600 
        shadow-sm
        hover:bg-orange-50
        disabled:opacity-50 disabled:cursor-not-allowed
      "
                    onClick={(e) => {
                      e.stopPropagation(); // カードクリックに食われない
                      handleDeleteClick(e, g);
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "削除中…" : "削除"}
                  </button>
                )}

                {/* カード本体：ただのレイアウト用 div にする */}
                <div className="flex w-full flex-col text-left">
                  {/* 画像 */}
                  <div
                    className="
        relative mb-3 aspect-[3/4] 
        rounded-2xl border border-orange-100 
        bg-orange-50/60
        p-2
      "
                  >
                    <div className="relative h-full w-full overflow-hidden rounded-xl">
                      {g.image_url ? (
                        <Image
                          src={g.image_url}
                          alt={`${g.shrine_name ?? "不明な神社"}の御朱印`}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                          画像なし
                        </div>
                      )}
                    </div>
                  </div>

                  {/* テキスト情報 */}
                  <div className="space-y-1">
                    <p className="truncate text-[13px] font-semibold text-gray-800">
                      {g.title || g.shrine_name || "タイトル未設定"}
                    </p>
                    <p className="truncate text-[11px] text-gray-500">{g.shrine_name ?? "-"}</p>
                    {g.created_at && (
                      <p className="text-[10px] text-gray-400">
                        登録日:{" "}
                        {new Date(g.created_at).toLocaleDateString("ja-JP", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-500">
                      公開設定: <span className="font-medium text-orange-600">{g.is_public ? "公開" : "非公開"}</span>
                    </p>

                    {onToggleVisibility && (
                      <button
                        type="button"
                        className="
            mt-1 inline-flex items-center justify-center 
            rounded-full border border-orange-200 
            bg-white px-2 py-0.5 text-[10px]
            text-orange-700 hover:bg-orange-50
            disabled:opacity-50 disabled:cursor-not-allowed
          "
                        onClick={(e) => {
                          e.stopPropagation(); // モーダル開かないように
                          handleToggleVisibilityClick(e, g);
                        }}
                        disabled={isToggling}
                      >
                        {isToggling ? "切り替え中…" : g.is_public ? "非公開にする" : "公開にする"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 詳細モーダル */}
      <GoshuinDetailModal
        open={detailOpen}
        goshuin={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
          setDetailOpen(open);
        }}
      />
    </>
  );
}
