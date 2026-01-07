"use client";

import { useEffect, useRef, useState } from "react";
import { SectionCard } from "@/components/layout/SectionCard";
import { HomeConciergeInlineClient } from "./HomeConciergeInlineClient";
import { HomeNearbySection } from "./HomeNearbySection";
import { PublicGoshuinsClient } from "./PublicGoshuinsClient";

type Props = { publicResults: any[] };

export function HomeMainClient({ publicResults }: Props) {
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const savedScrollYRef = useRef(0);

  const handleToggle = (open: boolean) => {
    if (open) {
      savedScrollYRef.current = window.scrollY;
      setConciergeOpen(true);
      return;
    }
    setConciergeOpen(false);
  };

  useEffect(() => {
    if (conciergeOpen) return;
    window.scrollTo({ top: savedScrollYRef.current, behavior: "auto" });
  }, [conciergeOpen]);

  return (
    <>
      <SectionCard>
        <HomeConciergeInlineClient onToggle={handleToggle} />
      </SectionCard>

      {!conciergeOpen && (
        <>
          <SectionCard
            title="今いる場所の近くの神社"
            description="位置情報をもとに、徒歩圏内の神社を優先して表示します。"
          >
            <HomeNearbySection />
          </SectionCard>

          <SectionCard title="御朱印" description="公開御朱印">
            <PublicGoshuinsClient results={publicResults} />
          </SectionCard>
        </>
      )}
    </>
  );
}
