// apps/web/src/features/mypage/components/MyGoshuinList.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type { Goshuin } from "@/lib/api/goshuin";
import GoshuinDetailModal from "./GoshuinDetailModal";


type Props = {
  items: Goshuin[] | null;
  loading: boolean;
  error: string | null;
  // 親が一覧から消すためのコールバック（任意・非同期も許容）
  onDelete?: (id: number) => Promise<void> | void;
  onToggleVisibility?: (id: number) => void;
};

export default function MyGoshuinList({ items, loading, error, onDelete, onToggleVisibility }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Goshuin | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleCardClick = (g: Goshuin) => {
    setSelected(g);
    setDetailOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!onDelete) return; // 念のためガード

    if (!window.confirm("この御朱印を削除しますか？")) return;

    try {
      setDeletingId(id);
      // 親（useMyGoshuin.removeItem）に一任
      await Promise.resolve(onDelete(id));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" role="status" aria-busy="true" aria-live="polite">
        <div className="h-4 w-32 rounded bg-gray-100" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="mb-2 h-20 w-full rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        まだ御朱印が登録されていません。上のフォームから最初の1枚をアップロードしてみてください。
      </p>
    );
  }

  const canDelete = deletingId === null;

  return (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">登録済みの御朱印</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((g) => (
            <div
              key={g.id}
              className="relative cursor-pointer rounded-lg border bg-white p-2 text-xs hover:bg-gray-50"
              onClick={() => handleCardClick(g)}
            >
              {/* 削除ボタン */}
              <button
                type="button"
                className="absolute right-1 top-1 rounded bg-white/80 px-1 text-[10px] text-red-600 shadow disabled:opacity-50"
                disabled={!canDelete || deletingId === g.id || !onDelete}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deletingId === g.id || !onDelete) return;
                  void handleDelete(g.id);
                }}
              >
                {deletingId === g.id ? "削除中…" : "削除"}
              </button>

              {/* 画像 */}
              {g.image_url ? (
                <div className="relative mb-2 aspect-[3/4] overflow-hidden rounded">
                  <Image
                    src={g.image_url}
                    alt={g.shrine_name ? `${g.shrine_name}の御朱印` : "御朱印"}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                    unoptimized // ★ これを追加
                  />
                </div>
              ) : (
                <div className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-gray-50">画像なし</div>
              )}

              {/* 情報＋公開トグル */}
              <div className="space-y-1">
                <p className="truncate font-medium">{g.title || g.shrine_name || "タイトル未設定"}</p>
                {g.shrine_name && g.title && <p className="truncate text-[11px] text-gray-600">{g.shrine_name}</p>}

                {g.created_at && (
                  <p className="text-[10px] text-gray-500">
                    登録日: {new Date(g.created_at).toLocaleDateString("ja-JP")}
                  </p>
                )}

                <p className="text-[10px] text-gray-500">公開設定: {g.is_public ? "公開" : "非公開"}</p>

                {onToggleVisibility && (
                  <button
                    type="button"
                    className="mt-1 rounded border px-2 py-0.5 text-[10px] text-gray-700 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(g.id);
                    }}
                  >
                    {g.is_public ? "非公開にする" : "公開にする"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <GoshuinDetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            // 必要なら selected をクリア
            // setSelected(null);
          }
        }}
        goshuin={selected}
      />
    </>
  );
}
