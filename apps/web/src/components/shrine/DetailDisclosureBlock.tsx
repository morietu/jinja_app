// apps/web/src/components/shrine/DetailDisclosureBlock.tsx
"use client";

import * as React from "react";

type Props = {
  title: string;
  summary?: string; // ✅ optional にする
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function DetailDisclosureBlock({ title, summary, defaultOpen = false, children }: Props) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          {summary ? <div className="mt-0.5 text-xs text-slate-500">{summary}</div> : null}
        </div>
        <span className="text-xs font-semibold text-slate-500">{open ? "閉じる" : "タップして開く"}</span>
      </button>

      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
