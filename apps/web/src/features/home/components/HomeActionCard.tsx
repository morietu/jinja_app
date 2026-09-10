// apps/web/src/features/home/components/HomeActionCard.tsx
//
// Home下部の2カラムグリッドを構成する1枚。アイコン・題名・一行の補足だけを
// 持つ最小のカードで、装飾要素は足さない（世界観は余白と明度差で表す）。
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type HomeActionCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick?: () => void;
};

export function HomeActionCard({ href, icon: Icon, title, subtitle, onClick }: HomeActionCardProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-4 transition hover:border-[var(--kt-color-border-strong)] hover:bg-[var(--kt-color-surface-elevated)]"
    >
      <Icon className="size-[18px] text-[var(--kt-color-text-secondary)]" aria-hidden />
      <div className="mt-4">
        <p className="text-[13px] font-medium text-[var(--kt-color-text-primary)]">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-[var(--kt-color-text-secondary)]">{subtitle}</p>
      </div>
    </Link>
  );
}
