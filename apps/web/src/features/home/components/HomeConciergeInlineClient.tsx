"use client";

import { useRouter } from "next/navigation";

export function HomeConciergeInlineClient({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => router.push("/concierge")}
        className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
      >
        今の気持ちから神社を探す
      </button>
    </div>
  );
}
