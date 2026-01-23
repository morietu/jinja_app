"use client";

import * as React from "react";
import type { ConciergeModeSignal } from "@/features/concierge/types/unified";

type Props = {
  mode?: ConciergeModeSignal | null;
};

export default function ModeBadge({ mode }: Props) {
  const label = typeof mode?.ui_label_ja === "string" ? mode.ui_label_ja.trim() : "";
  const note = typeof mode?.ui_note_ja === "string" ? mode.ui_note_ja.trim() : "";

  const [open, setOpen] = React.useState(false);

  if (!label && !note) return null;

  // Flow B：従来どおり
  if (mode?.flow === "B") {
    if (!label) return null;
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
          {label}
        </span>
        {note ? (
          <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[160px]" title={note}>
            {note}
          </span>
        ) : null}
      </div>
    );
  }

  // Flow A：説明専用
  if (!note) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
        aria-label="並び順について"
        onClick={() => setOpen((v) => !v)}
      >
        並び順
      </button>

      {open && (
        <div
          className="
            absolute right-0 z-20 mt-2 w-72
            rounded-xl border bg-white p-3
            text-sm text-slate-700 shadow-lg
          "
        >
          <div className="text-xs font-semibold text-slate-900">並び順について</div>
          <div className="mt-1 whitespace-pre-line">{note}</div>

          <div className="mt-2 text-right">
            <button
              type="button"
              className="text-[11px] font-semibold text-slate-500 hover:underline"
              onClick={() => setOpen(false)}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
