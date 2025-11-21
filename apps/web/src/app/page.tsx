// apps/web/src/app/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { HomeRankingSection } from "@/features/home/components/HomeRankingSection";
import { ConciergeQuickActions } from "@/components/concierge/ConciergeQuickActions";
import { ShortcutCard } from "@/components/ShortcutCard";
import { ShortcutCardGrid } from "@/components/ShortcutCardGrid";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* ヒーロー：メイン導線はこれだけ */}
      <section className="mb-10">
        <h1 className="text-2xl font-semibold">神社ナビ</h1>
        <p className="mt-1 text-sm text-gray-600">
          今の気持ちや悩みを伝えると、あなたに合った神社をコンシェルジュが提案します。
        </p>

        <button
          className="mt-6 w-full rounded-full bg-black py-3 text-center text-sm font-medium text-white"
          onClick={() => router.push("/concierge")}
        >
          今の気持ちから神社を探す
        </button>
      </section>
      {/* ランキングなど既存コンテンツ（必要に応じてそのまま） */}
      <section className="mb-8">
        <HomeRankingSection />
      </section>
      {/* 一番下にカードをまとめる */}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-gray-800">おすすめ</h2>
        <p className="text-xs text-gray-500 mb-3">
          現在地や診断結果から神社を提案。チャット・地図・ランキングから選べます。
        </p>
        <ConciergeQuickActions variant="compact" />
      </section>
      <ShortcutCardGrid>
        <ShortcutCard href="/map" title="地図で探す" description="地図上で神社の位置を確認しながら探せます。" />
        <ShortcutCard
          href="/map?mode=nearby" // 既存仕様に合わせて調整
          title="近くの神社"
          description="現在地の近くにある神社を一覧で表示します。"
        />
        <ShortcutCard
          href="/concierge"
          title="コンシェルジュに相談"
          description="お参りの目的や悩みに合わせて神社を提案します。"
        />
      </ShortcutCardGrid>
    </main>
  );
}
