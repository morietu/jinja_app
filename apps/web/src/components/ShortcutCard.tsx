// apps/web/src/components/ShortcutCard.tsx
"use client";

import Link from "next/link";
import { ReactNode } from "react";

type ShortcutCardProps = {
  href: string;
  title: string;
  description: string;
  icon?: ReactNode;
};

export function ShortcutCard({ href, title, description, icon }: ShortcutCardProps) {
  return (
    <Link
      href={href}
      className="
        block rounded-2xl border border-slate-200 bg-slate-50
        px-4 py-3 text-left shadow-sm
        transition-colors hover:bg-white
      "
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon && <div className="text-base">{icon}</div>}
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">{description}</p>
    </Link>
  );
}
