// apps/web/src/features/concierge/components/ThreadList.tsx
import type { ConciergeThread } from "@/lib/api/concierge";
import ThreadListItem from "./ThreadListItem";

type Props = {
  threads: ConciergeThread[] | null | undefined;
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
};

export default function ThreadList({ threads, selectedId, loading, onSelect, onCreateNew }: Props) {
  const items = Array.isArray(threads) ? threads.filter((t): t is ConciergeThread => Boolean(t)) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">スレッド</h2>
        <button type="button" onClick={onCreateNew} className="rounded bg-blue-500 px-2 py-1 text-xs text-white">
          新規
        </button>
      </div>

      {loading && <p className="text-xs text-gray-500">読み込み中...</p>}

      {!loading && items.length === 0 && <p className="text-xs text-gray-500">まだスレッドはありません。</p>}

      {!loading && items.length > 0 && (
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {items.map((t) => (
            <ThreadListItem key={t.id} thread={t} selected={t.id === selectedId} onClick={() => onSelect(t.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
