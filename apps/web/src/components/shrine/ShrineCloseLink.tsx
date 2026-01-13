// apps/web/src/components/shrine/ShrineCloseLink.tsx
"use client";

import Link from "next/link";
import type { Close } from "@/lib/navigation/shrineClose";

type Props = { close: Close };

export default function ShrineCloseLink({ close }: Props) {
  if (close.kind === "back") {
    return (
      <button
        type="button"
        onClick={() => history.back()}
        className="block w-full text-center text-xs text-slate-500 hover:underline"
      >
        {close.label}
      </button>
    );
  }

  return (
    <Link href={close.href} className="block text-center text-xs text-slate-500 hover:underline">
      {close.label}
    </Link>
  );
}
