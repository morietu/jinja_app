// apps/web/src/components/shrine/DetailDisclosureBlock.tsx;
"use client";

import * as React from "react";

type Props = {
  title: string;
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

export default function DetailDisclosureBlock({ title, summary, children, defaultOpen = false }: Props) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {!open ? (
            <div className="mt-0.5 text-xs text-slate-500 line-clamp-2 whitespace-pre-line">{summary}</div>
          ) : null}
        </div>
        <span className="text-xs text-slate-500">{open ? "閉じる" : "開く"}</span>
      </button>

      {open ? <div className="px-3 pb-3 pt-1">{children}</div> : null}
    </div>
  );
}
