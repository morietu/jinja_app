// src/features/home/components/HomeHero.tsx
"use client";

import Link from "next/link";

export function HomeHero() {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <div>
        <div className="text-3xl mb-1">⛩</div>
        <h1 className="text-2xl font-bold tracking-tight leading-tight">
          人生の節目を整理する
          <br />
          神社コンシェルジュ
        </h1>
        <p className="text-xs text-gray-600 leading-relaxed mt-2">
          今の悩みや迷いを書くだけで
          <br />
          相性のよい神社を整理して提案します
        </p>
      </div>

      <Link
        href="/concierge"
        className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold bg-black text-white shadow-md active:scale-[0.98] transition"
      >
        相談して神社を見つける
      </Link>

      <Link
        href="/map"
        className="inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-semibold bg-emerald-600 text-white shadow-md active:scale-[0.98] transition"
      >
        地図から神社を見る
      </Link>
    </div>
  );
}
