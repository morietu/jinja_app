"use client";

import { useState } from "react";
import PlaceSuggestBox from "@/components/PlaceSuggestBox";
import type { PlaceCacheItem } from "@/lib/api/placeCaches";
import NearbyShrineCardListClient from "@/features/map/components/NearbyShrineCardListClient";
import { buildGoogleMapsDirUrl, buildGoogleMapsSearchUrl } from "@/lib/maps/googleMaps";


function PlaceSelectedCard({ item }: { item: PlaceCacheItem }) {
  // 最短はここで detail に飛ばす（後で）
  // const href = `/places/${item.place_id}` みたいな導線に差し替え可能
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
        <p className="text-xs text-slate-500">{item.address}</p>
        <p className="text-[11px] text-slate-400">{item.place_id}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          className="flex-1 rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
          href={buildGoogleMapsSearchUrl(item.name, item.address ?? undefined)}
          target="_blank"
          rel="noreferrer"
        >
          Googleマップで見る
        </a>
        <a
          className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
          href={buildGoogleMapsDirUrl({
            lat: item.lat ?? undefined,
            lng: item.lng ?? undefined,
            address: item.address ?? undefined,
            fallbackName: item.name,
          })}
          target="_blank"
          rel="noreferrer"
        >
          ルート
        </a>
      </div>
    </div>
  );
}

export default function MapPageClient() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PlaceCacheItem | null>(null);

  const mode: "nearby" | "search" = selected ? "search" : "nearby";

  const canClear = query.trim().length > 0 || selected != null;

  return (
    <div className="space-y-3">
      {/* 検索入力 + クリア */}
      <div className="space-y-2">
        <PlaceSuggestBox
          value={query}
          onChange={(v) => {
            setQuery(v);
            setSelected(null); // 入力し直したら未確定に戻す
          }}
          onSelect={(it) => {
            setSelected(it);
            setQuery(it.name); // “確定感”
          }}
        />

        {canClear && (
          <button
            type="button"
            className="w-full rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setQuery("");
              setSelected(null);
            }}
          >
            クリアして近くの神社に戻る
          </button>
        )}
      </div>

      {/* 表示分岐 */}
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
