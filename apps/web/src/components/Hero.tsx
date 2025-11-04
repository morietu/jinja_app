// apps/web/src/components/Hero.tsx
"use client";

import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-50 via-white to-sky-50 px-6 py-16 sm:px-10 sm:py-20">
      {/* 背景のデコ */}
      <div className="pointer-events-none absolute -left-24 -top-24 size-48 rounded-full bg-emerald-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 size-56 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          神社まわりを、もっとやさしく
        </h1>
        <p className="mt-3 text-gray-600">
          近くの神社を探す、相談する、ルートを作る。御朱印の管理もこれ一つで。
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/concierge"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white shadow transition hover:bg-emerald-700"
          >
            はじめる（AIコンシェルジュ）
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 transition hover:bg-gray-50"
          >
            まずは検索
          </Link>
        </div>
      </div>
    </section>
  );
}
