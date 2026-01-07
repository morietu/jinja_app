"use client";

import { useState } from "react";
import { HomeConciergeInlineClient } from "./HomeConciergeInlineClient";
import { HomeNearbySection } from "./HomeNearbySection";
import { PublicGoshuinsClient } from "./PublicGoshuinsClient";

export function HomeMainClient({ publicResults }) {
  const [conciergeOpen, setConciergeOpen] = useState(false);

  return (
    <>
      <HomeConciergeInlineClient onToggle={setConciergeOpen} />

      {!conciergeOpen && (
        <>
          <HomeNearbySection />
          <PublicGoshuinsClient results={publicResults} />
        </>
      )}
    </>
  );
}
