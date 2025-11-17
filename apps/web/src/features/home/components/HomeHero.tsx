// src/features/home/components/HomeHero.tsx
"use client";

import Link from "next/link";

export function HomeHero() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">神社ナビ</h1>
        <p className="text-xs text-gray-600 leading-relaxed">
          今の気持ちや悩みを伝えると、
          <br />
          あなたに合った神社をコンシェルジュが提案します。
        </p>
      </div>

      <Link
        href="/concierge"
        className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold bg-black text-white shadow-md active:scale-[0.98] transition"
      >
        今の気持ちから神社を探す
      </Link>
    </div>
  );
}
