// apps/web/src/features/home/components/HomeMainClient.tsx
"use client";

import { SectionCard } from "@/components/layout/SectionCard";
import { HomeConciergeInlineClient } from "./HomeConciergeInlineClient";
import { HomeNearbySection } from "./HomeNearbySection";
import HomeGoshuinFeedSection from "@/features/home/components/HomeGoshuinFeedSection";

export function HomeMainClient() {
  return (
    <>
      <SectionCard>
        <HomeConciergeInlineClient />
      </SectionCard>

      <SectionCard title="最新の公開御朱印" description="タップで神社詳細へ">
        <HomeGoshuinFeedSection limit={12} />
      </SectionCard>

      <SectionCard title="今いる場所の近くの神社" description="位置情報をもとに、徒歩圏内の神社を優先して表示します。">
        <HomeNearbySection />
      </SectionCard>
    </>
  );
}
