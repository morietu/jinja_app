// apps/web/src/features/concierge/components/ThreadList.tsx
import type { ConciergeThread } from "@/lib/api/concierge";
import ThreadListItem from "./ThreadListItem";

type Props = {
  threads: ConciergeThread[] | null | undefined;
  selectedId: string | null;
  loading: boolean;
  requiresLogin?: boolean;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
};

export function ThreadList({ threads, selectedId, loading, requiresLogin, onSelect, onCreateNew }: Props) {
  if (requiresLogin) {
    return (
      <div className="text-xs text-gray-500 px-3 py-2 space-y-2">
        <p>ログインすると、これまでの相談履歴を一覧で確認できます。</p>
        {/* ログイン導線を付けるならここでボタン or Link */}
      </div>
    );
  }
  const safeThreads = Array.isArray(threads)
    ? threads.filter((t): t is ConciergeThread => !!t && typeof (t as any).id === "number")
    : [];

  // 未ログイン：履歴エリアは「ログイン特典」として説明だけ出す
  if (requiresLogin) {
    return (
      <div className="flex flex-col h-full px-3 py-2 text-xs text-gray-500">
        <p className="mb-2">ログインすると、これまでの相談履歴を一覧で確認できます。</p>
        <button
          type="button"
          onClick={onCreateNew}
          className="self-start mt-1 rounded-full border px-3 py-1 text-[11px]"
          disabled={loading}
        >
          ログインせずに新しい相談をはじめる
        </button>
      </div>
    );
  }

  // ログイン済み：通常の履歴リスト
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2">
        <p className="text-xs text-gray-600">相談履歴</p>
        <button
          type="button"
          onClick={onCreateNew}
          className="text-[11px] text-blue-600 underline disabled:text-gray-400"
          disabled={loading}
        >
          新しい相談
        </button>
      </div>

      {loading && <p className="px-3 pb-2 text-[11px] text-gray-400">読み込み中です…</p>}

      {!loading && safeThreads.length === 0 && (
        <p className="px-3 pb-2 text-[11px] text-gray-400">まだ相談履歴がありません。</p>
      )}

      <ul className="flex-1 space-y-1 overflow-y-auto px-1 pb-2">
        {safeThreads.map((t) => {
          const idStr = String((t as any).id);
          return (
            <ThreadListItem key={idStr} thread={t} selected={idStr === selectedId} onClick={() => onSelect(idStr)} />
          );
        })}
      </ul>
    </div>
  );
}
