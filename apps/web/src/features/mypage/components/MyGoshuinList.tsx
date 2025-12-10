// apps/web/src/features/mypage/components/MyGoshuinList.tsx
import { useState } from "react";
import type { Goshuin } from "@/lib/api/goshuin";
import GoshuinDetailModal from "./GoshuinDetailModal";
import MyGoshuinCard from "./MyGoshuinCard";

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

  // --- 状態別レンダー ---

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white p-6 shadow-sm" role="status" aria-busy="true" aria-live="polite">
        <h3 className="mb-3 text-sm font-medium text-gray-800">登録済みの御朱印</h3>
        <div className="grid grid-cols-2 gap-5 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-3xl bg-muted animate-pulse" />
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
  const handleOpenDetail = (g: Goshuin) => {
    setSelected(g);
    setDetailOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!onDelete) return;
    const ok = window.confirm("この御朱印を削除しますか？");
    if (!ok) return;

    try {
      setDeletingId(id);
      await onDelete(id);
    } finally {
      setDeletingId((current) => (current === id ? null : current));
    }
  };

  // ★ ここを「id, next をそのまま使う」関数にする
  const handleToggleVisibility = async (id: number, next: boolean) => {
    if (!onToggleVisibility) return;

    try {
      setTogglingId(id);
      await onToggleVisibility(id, next);
    } finally {
      setTogglingId((current) => (current === id ? null : current));
    }
  };

  // -----------------
  // 本体レンダー
  // -----------------
  return (
    <>
      <section className="space-y-3 rounded-2xl border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-gray-800">登録済みの御朱印</h3>

        <div className="grid grid-cols-2 gap-5 sm:gap-6">
          {items.map((g) => (
            <MyGoshuinCard
              key={g.id}
              item={g}
              isDeleting={deletingId === g.id}
              isToggling={togglingId === g.id}
              onOpenDetail={handleOpenDetail}
              onDelete={onDelete ? handleDelete : undefined}
              onToggleVisibility={onToggleVisibility ? handleToggleVisibility : undefined}
            />
          ))}
        </div>
      </section>

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
