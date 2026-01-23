"use client";

import * as React from "react";
import type { ConciergeModeSignal } from "@/features/concierge/types/unified";

type Props = {
  mode?: ConciergeModeSignal | null;
};

export default function ModeBadge({ mode }: Props) {
  const label = typeof mode?.ui_label_ja === "string" ? mode.ui_label_ja.trim() : "";
  const note = typeof mode?.ui_note_ja === "string" ? mode.ui_note_ja.trim() : "";

  if (!label && !note) return null;

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

  // Flow A: バッジは出さず、説明があるならアイコンだけ
  if (!note) return null;

  return (
    <button
      type="button"
      className="text-[11px] text-slate-400 hover:text-slate-600"
      title={note}
      aria-label="おすすめの並べ替え方法"
    >
      ⓘ
    </button>
  );
}
