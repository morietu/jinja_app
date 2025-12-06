// apps/web/src/features/concierge/components/ThreadListItem.tsx
import type { ConciergeThread } from "@/lib/api/concierge";

type Props = {
  thread: ConciergeThread;
  selected: boolean;
  onClick: () => void;
};

export default function ThreadListItem({ thread, selected, onClick }: Props) {
  const lastMessageAtText = thread.last_message_at ? new Date(thread.last_message_at).toLocaleString("ja-JP") : "";

  const baseClass = "w-full rounded-md border px-3 py-2 text-left transition-colors hover:bg-gray-50";
  const selectedClass = selected ? " border-blue-500 bg-blue-50" : " border-gray-200 bg-white";

  return (
    <li>
      <button type="button" className={baseClass + selectedClass} onClick={onClick} aria-pressed={selected}>
        <div className="font-medium line-clamp-1">{thread.title || "相談スレッド"}</div>
        {lastMessageAtText && <div className="mt-1 text-xs text-gray-500">{lastMessageAtText}</div>}
      </button>
    </li>
  );
}
