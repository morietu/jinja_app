// apps/web/src/components/shrine/DetailDisclosureBlock.tsx
"use client";

import * as React from "react";
import type { SignalLevel } from "@/lib/shrine/buildShrineExplanation";

type LevelLike = SignalLevel | "low";

type Props = {
  title: string;
  summary: string;
  defaultOpen?: boolean;
  children: React.ReactNode;

  level?: LevelLike;
  hint?: string | null;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function levelLabel(level?: LevelLike) {
  if (!level) return null;
  if (level === "low") return "低";
  if (level === "strong") return "高";
  if (level === "medium") return "中";
  return "低"; // weak
}

export default function DetailDisclosureBlock({ title, summary, defaultOpen = false, children, level, hint }: Props) {
  const [open, setOpen] = React.useState(defaultOpen);
  const lv = levelLabel(level);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn("w-full px-4 py-3 text-left", "flex items-start justify-between gap-3", "hover:bg-slate-50")}
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
            {lv ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                {lv}
              </span>
            ) : null}
          </div>
          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{summary}</div>
        </div>

        <span className={cn("shrink-0 text-slate-500 transition-transform", open && "rotate-180")} aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <div className="border-t bg-white px-4 pb-4 pt-3">
          {hint ? <div className="mb-3 text-xs text-slate-500">{hint}</div> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}
