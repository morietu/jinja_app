// src/features/concierge/components/ConciergeHistoryList.tsx
"use client";

import type { ConciergeHistoryItem } from "../historyTypes";
type Props = {
  histories: ConciergeHistoryItem[];
  selectedId?: number | null;
  onSelect: (id: number) => void;
};

export function ConciergeHistoryList({ histories, selectedId, onSelect }: Props) {
  if (!histories.length) {
    return <div className="text-xs text-gray-500">まだ相談履歴はありません。</div>;
  }

  return (
    <div className="mt-1 rounded-lg border bg-white max-h-80 overflow-y-auto">
      <ul className="divide-y">
        {histories.map((h) => {
          const selected = h.id === selectedId;
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onSelect(h.id)}
                className={[
                  "w-full text-left px-3 py-2 text-sm flex flex-col gap-1",
                  "hover:bg-gray-50 cursor-pointer",
                  selected ? "bg-blue-50 border-l-4 border-l-blue-500" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium line-clamp-1">{h.title ?? "無題の相談"}</p>
                  <span className="shrink-0 text-[11px] text-gray-400">
                    {/* ここは既存のフォーマッタに差し替え */}
                    {new Date(h.last_message_at).toLocaleString("ja-JP", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {h.last_message && <p className="text-xs text-gray-600 line-clamp-2">{h.last_message}</p>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
