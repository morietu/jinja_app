// apps/web/src/components/shrine/DetailSection.tsx
"use client";

import * as React from "react";

export default function DetailSection({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border bg-white p-4 ${className}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold text-slate-500">{title}</h2>
        {right ? <div className="text-[11px] text-slate-500">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
