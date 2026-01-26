// apps/web/src/features/home/components/HomeMainClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { HomeConciergeInlineClient } from "./HomeConciergeInlineClient";
import { HomeNearbySection } from "./HomeNearbySection";
import HomeGoshuinFeedSection from "@/features/home/components/HomeGoshuinFeedSection";

export function HomeMainClient() {
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const savedScrollYRef = useRef(0);

  const openConcierge = () => {
    savedScrollYRef.current = window.scrollY;
    setConciergeOpen(true);
  };

  const closeConcierge = () => {
    setConciergeOpen(false);
  };

  // ✅ ロゴ等から送られる close をホームで受ける
  useEffect(() => {
    const onClose = () => {
      console.log("[jinja] close event received (HomeMainClient)");
      closeConcierge();
    };
    window.addEventListener("jinja:close-concierge", onClose);
    return () => window.removeEventListener("jinja:close-concierge", onClose);
  }, []);

  // ✅ 戻る/復帰時も閉じる（Safari系の変挙動対策）
  useEffect(() => {
    const onPageShow = () => closeConcierge();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // ✅ 閉じたら元のスクロールに戻す（“戻った感”を作る）
  useEffect(() => {
    if (conciergeOpen) return;
    window.scrollTo({ top: savedScrollYRef.current, behavior: "auto" });
  }, [conciergeOpen]);

  return (
    <>
      <SectionCard>
        <HomeConciergeInlineClient open={conciergeOpen} onOpen={openConcierge} onClose={closeConcierge} />
      </SectionCard>

      {!conciergeOpen && (
        <>
          <SectionCard title="最新の公開御朱印" description="タップで神社詳細へ">
            <HomeGoshuinFeedSection limit={12} />
          </SectionCard>

          <SectionCard
            title="今いる場所の近くの神社"
            description="位置情報をもとに、徒歩圏内の神社を優先して表示します。"
          >
            <HomeNearbySection />
          </SectionCard>
        </>
      )}
    </>
  );
}
