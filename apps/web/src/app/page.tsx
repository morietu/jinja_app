// src/app/page.tsx
import HomeCards from "@/components/HomeCards";
import { HomeHero } from "@/features/home/components/HomeHero";
import { HomeRankingSection } from "@/features/home/components/HomeRankingSection";

export default function HomePage() {
  return (
    <section className="px-4 py-4 max-w-md mx-auto space-y-6">
      <HomeHero />

      <HomeRankingSection />

      {/* 既存コンテンツ（必要に応じて整理） */}
      <div className="mt-4">
        <HomeCards />
      </div>
    </section>
  );
}
