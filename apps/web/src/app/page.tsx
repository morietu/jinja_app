// apps/web/src/app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { HomeRankingSection } from "@/features/home/components/HomeRankingSection";
import { HomeNearbySection } from "@/features/home/components/HomeNearbySection";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        {/* ヒーロー：メイン導線はコンシェルジュ */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-black/30 px-3 py-1 text-xs font-medium text-amber-300">
            <span className="text-lg">⛩</span>
            <span>今の気持ちから、ぴったりの神社を案内します</span>
          </p>

          <h1 className="mt-4 text-2xl font-semibold text-slate-50">神社ナビ</h1>
          <p className="mt-2 text-sm text-slate-200">
            今の気持ちや悩みを伝えると、あなたに合った神社をコンシェルジュが提案します。
          </p>

          <button
            className="mt-6 w-full rounded-full bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
            onClick={() => router.push("/concierge")}
          >
            今の気持ちから神社を探す
          </button>
        </section>

        {/* 近くの神社 */}
        <section>
          <HomeNearbySection />
        </section>

        {/* 人気ランキング（既存） */}
        <section>
          <HomeRankingSection />
        </section>

        

          
        
      </div>
    </main>
  );
}
