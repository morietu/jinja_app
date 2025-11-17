// apps/web/src/features/concierge/components/ThreadListItem.tsx
import type { ConciergeThread } from "@/lib/api/concierge";

type Props = {
  thread: ConciergeThread;
  selected: boolean;
  onClick: () => void;
};

export default function ThreadListItem({ thread, selected, onClick }: Props) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded px-3 py-2 text-left text-sm ${
          selected ? "bg-blue-50 border border-blue-300" : "hover:bg-gray-50"
        }`}
      >
        <div className="font-medium line-clamp-1">{thread.title}</div>
        <div className="mt-1 text-xs text-gray-500">{new Date(thread.last_message_at).toLocaleString()}</div>
      </button>
    </li>
  );
}
