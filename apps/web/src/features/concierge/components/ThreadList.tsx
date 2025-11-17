// apps/web/src/features/concierge/components/ThreadList.tsx
import type { ConciergeThread } from "@/lib/api/concierge";
import ThreadListItem from "./ThreadListItem";

type Props = {
  threads: ConciergeThread[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
};

export default function ThreadList({ threads, selectedId, loading, onSelect, onCreateNew }: Props) {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">相談スレッド</h2>
        <button type="button" onClick={onCreateNew} className="rounded bg-blue-600 px-2 py-1 text-sm text-white">
          新しい相談
        </button>
      </div>
      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}
      {!loading && threads.length === 0 && <p className="text-sm text-gray-500">まだ相談はありません。</p>}
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {threads.map((t) => (
          <ThreadListItem key={t.id} thread={t} selected={t.id === selectedId} onClick={() => onSelect(t.id)} />
        ))}
      </ul>
    </div>
  );
}
