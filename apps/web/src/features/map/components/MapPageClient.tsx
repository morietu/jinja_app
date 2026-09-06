// apps/web/src/features/map/components/MapPageClient.tsx
"use client";

import { type FormEvent, useState } from "react";
import { PlaceSuggestBox } from "@/components/PlaceSuggestBox";
import { ExploreLayout } from "@/features/explore/components/ExploreLayout";
import type { ExploreViewMode } from "@/features/explore/components/ViewModeTabs";
import type { Shrine } from "@/lib/api/shrines";
import NearbyShrineCardListClient from "@/features/map/components/NearbyShrineCardListClient";

function PlaceSelectedCard({ item }: { item: Shrine }) {
  return (
    <div className="rounded-3xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-background-subtle)] px-5 py-6">
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--kt-color-text-primary)]">{item.name_jp}</p>
        {"address" in item && (item as any).address ? (
          <p className="text-xs text-[var(--kt-color-text-muted)]">{(item as any).address}</p>
        ) : null}
        <p className="text-[11px] text-[var(--kt-color-text-muted)]">{String((item as any).id ?? "")}</p>
      </div>
    </div>
  );
}

export default function MapPageClient() {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Shrine | null>(null);
  const [viewMode, setViewMode] = useState<ExploreViewMode>("map");

  const mode: "nearby" | "search" = selected ? "search" : "nearby";

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleSelectTag = (tagName: string) => {
    setKeyword(tagName);
    setSelected(null);
  };

  return (
    <ExploreLayout
      activeTag={keyword}
      inputValue={keyword}
      onInputValueChange={setKeyword}
      onSearchSubmit={handleSearchSubmit}
      goriyakuTags={[]}
      tagsLoading={false}
      tagsError={null}
      activeGoriyakuTag={null}
      onSelectTag={handleSelectTag}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      searchSlot={
        <PlaceSuggestBox value={keyword} onChange={setKeyword} onSelect={(it) => setSelected(it)} />
      }
    >
      {mode === "nearby" && <NearbyShrineCardListClient />}

      {mode === "search" && selected && (
        <div className="space-y-3">
          <p className="text-[11px] font-medium tracking-[0.2em] text-[var(--kt-color-text-muted)]">SELECTED PLACE</p>
          <PlaceSelectedCard item={selected} />
        </div>
      )}
    </ExploreLayout>
  );
}
