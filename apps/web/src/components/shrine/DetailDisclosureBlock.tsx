// apps/web/src/components/shrine/DetailDisclosureBlock.tsx
"use client";

import * as React from "react";

type SignalLevel = "weak" | "medium" | "strong";

type Props = {
  title: string;
  summary: string;
  level?: SignalLevel;
  hint?: string | null;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function levelBorderClass(level: SignalLevel) {
  if (level === "strong") return "border-emerald-200";
  if (level === "medium") return "border-slate-200";
  return "border-slate-100";
}

function levelDotClass(level: SignalLevel) {
  if (level === "strong") return "bg-emerald-500";
  if (level === "medium") return "bg-amber-400";
  return "bg-slate-300";
}

export default function DetailDisclosureBlock({
  title,
  summary,
  children,
  defaultOpen = false,
  level = "weak",
  hint = null,
}: Props) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className={cn("rounded-xl border bg-white", levelBorderClass(level))}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("mt-1 size-2 shrink-0 rounded-full", levelDotClass(level))} aria-hidden="true" />

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-900">{title}</div>

                {!open && level === "strong" && hint ? (
                  <span
                    className="inline-flex size-5 items-center justify-center rounded-full border border-slate-200 text-[11px] text-slate-600"
                    title={hint}
                    aria-label={hint}
                  >
                    i
                  </span>
                ) : null}
              </div>

              {!open ? <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">{summary}</div> : null}
            </div>
          </div>
        </div>

        <span className="shrink-0 text-xs text-slate-500">{open ? "閉じる" : "開く"}</span>
      </button>

      {open ? <div className="px-3 pb-3 pt-1">{children}</div> : null}
    </div>
  );
}
