// apps/web/src/components/shrine/ShrineCloseLink.tsx
"use client";

import Link from "next/link";
import type { Close } from "@/lib/navigation/shrineClose";

type Props = { close: Close };

export default function ShrineCloseLink({ close }: Props) {
  if (close.kind === "link") {
    return (
      <Link href={close.href} prefetch={false}>
        ← {close.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
    >
      ← {close.label}
    </button>
  );
}
