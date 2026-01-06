// apps/web/src/features/home/components/HomeNearbySection.tsx
"use client";

import Link from "next/link";

export function HomeNearbySection() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">近くの神社を探す</p>
        <p className="text-xs text-slate-600">地図から周辺の神社を探せます。</p>
      </div>

      <div className="mt-3">
        <Link
          href="/map"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          地図を開く
        </Link>
      </div>
    </div>
  );
}
