"use client";

import * as React from "react";

export type DetailSectionVariant = "primary" | "secondary" | "tertiary";

const SECTION_CLASS: Record<DetailSectionVariant, string> = {
  primary: "rounded-2xl border border-slate-300 bg-white p-6 shadow-lg",
  secondary: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm",
  tertiary: "rounded-2xl border border-slate-200 bg-slate-50 p-4",
};

const TITLE_CLASS: Record<DetailSectionVariant, string> = {
  primary: "text-base font-semibold text-slate-900",
  secondary: "text-sm font-semibold text-slate-900",
  tertiary: "text-xs font-semibold text-slate-500",
};

const RIGHT_CLASS: Record<DetailSectionVariant, string> = {
  primary: "text-xs text-slate-500",
  secondary: "text-xs text-slate-500",
  tertiary: "text-[11px] text-slate-400",
};

export default function DetailSection({
  title,
  right,
  children,
  className = "",
  variant = "secondary",
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: DetailSectionVariant;
}) {
  return (
    <section className={`${SECTION_CLASS[variant]} ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className={TITLE_CLASS[variant]}>{title}</h2>
        {right ? <div className={RIGHT_CLASS[variant]}>{right}</div> : null}
      </div>
      {children}
    </section>
  );
}
