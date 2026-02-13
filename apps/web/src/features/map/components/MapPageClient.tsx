// apps/web/src/features/map/components/MapPageClient.tsx
"use client";

import { useState } from "react";
import { PlaceSuggestBox } from "@/components/PlaceSuggestBox";
import type { Shrine } from "@/lib/api/shrines";
import NearbyShrineCardListClient from "@/features/map/components/NearbyShrineCardListClient";
import { buildGoogleMapsDirUrl, buildGoogleMapsSearchUrl } from "@/lib/maps/googleMaps";

function PlaceSelectedCard({ item }: { item: Shrine }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{item.name_jp}</p>
        {"address" in item && (item as any).address ? (
          <p className="text-xs text-slate-500">{(item as any).address}</p>
        ) : null}
        <p className="text-[11px] text-slate-400">{String((item as any).id ?? "")}</p>
      </div>
    </div>
  );
}

export default function MapPageClient() {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Shrine | null>(null);

  const mode: "nearby" | "search" = selected ? "search" : "nearby";

  return (
    <div className="space-y-3">
      <PlaceSuggestBox value={keyword} onChange={setKeyword} onSelect={(it) => setSelected(it)} />

      {mode === "nearby" && <NearbyShrineCardListClient />}

      {mode === "search" && selected && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">検索結果</p>
          <PlaceSelectedCard item={selected} />
        </div>
      )}
    </div>
  );
}
