// apps/web/src/features/home/components/HomeConciergeInlineClient.tsx
"use client";

import Link from "next/link";

type Props = {
  className?: string;
  open: boolean; // 互換のため一旦残す（使わない）
  onOpen: () => void; // 同上
  onClose: () => void; // 同上
};

export function HomeConciergeInlineClient({ className }: Props) {
  return (
    <div className={className}>
      <Link
        href="/concierge"
        className="block w-full rounded-full bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
      >
        今の気持ちから神社を探す
      </Link>
    </div>
  );
}
