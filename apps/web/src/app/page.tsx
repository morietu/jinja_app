// apps/web/src/app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { HomeRankingSection } from "@/features/home/components/HomeRankingSection";
import { HomeNearbySection } from "@/features/home/components/HomeNearbySection";
import { SectionCard } from "@/components/layout/SectionCard";





export default function HomePage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8">
        {/* ヒーロー：メイン導線はコンシェルジュ */}
        <SectionCard>
          <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            <span className="text-lg">⛩</span>
            <span>今の気持ちから、ぴったりの神社を案内します</span>
          </p>

          <h1 className="mt-4 text-2xl font-semibold text-slate-900">神社ナビ</h1>
          <p className="mt-2 text-sm text-slate-700">
            今の気持ちや悩みを伝えると、あなたに合った神社をコンシェルジュが提案します。
          </p>

          <button
            className="mt-6 w-full rounded-full bg-amber-500 py-3 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400"
            onClick={() => router.push("/concierge")}
          >
            今の気持ちから神社を探す
          </button>
        </SectionCard>

        {/* 近くの神社 */}
        <SectionCard
          title="今いる場所の近くの神社"
          description="位置情報をもとに、徒歩圏内の神社を優先して表示します。"
        >
          <HomeNearbySection />
        </SectionCard>

        {/* 人気ランキング（既存） */}
        <SectionCard
          title="今人気の神社ランキング（30日）"
          description="最近30日間の御朱印アップ数・お気に入り数をもとにしたランキングです。"
        >
          <HomeRankingSection />
        </SectionCard>
      </div>
    </main>
  );
}
