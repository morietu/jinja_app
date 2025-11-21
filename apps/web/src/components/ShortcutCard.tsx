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
      className="flex flex-col gap-2 rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        {icon && <div className="text-lg">{icon}</div>}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-gray-600">{description}</p>
    </Link>
  );
}
