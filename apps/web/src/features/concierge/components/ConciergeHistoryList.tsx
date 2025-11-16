// src/features/concierge/components/ConciergeHistoryList.tsx
"use client";

import type { ConciergeHistoryItem } from "../types";

type Props = {
  histories: ConciergeHistoryItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
};

export function ConciergeHistoryList({ histories, selectedId, onSelect }: Props) {
  if (!histories || histories.length === 0) {
    return <p className="text-xs text-gray-500">まだ履歴がありません。</p>;
  }

  return (
    <div className="rounded border bg-white max-h-64 md:max-h-80 overflow-y-auto text-sm">
      <ul className="divide-y">
        {histories.map((h) => {
          const isActive = h.id === selectedId;
          const createdAtLabel = h.created_at ? new Date(h.created_at).toLocaleString("ja-JP") : "";

          return (
            <li
              key={h.id}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                isActive ? "bg-blue-50 ring-1 ring-blue-300" : ""
              }`}
              onClick={() => onSelect(isActive ? null : h.id)}
            >
              <div className="truncate text-sm">{h.title?.trim() || "無題の履歴"}</div>
              {createdAtLabel && <div className="mt-0.5 text-[11px] text-gray-500">{createdAtLabel}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
