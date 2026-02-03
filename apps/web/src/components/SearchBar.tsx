// apps/web/src/components/SearchBar.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

type Props = {
  className?: string;
  initialKeyword?: string;
  initialLocationBias?: string;
  initialFilters?: Record<string, string>;
};

export default function SearchBar({
  className,
  initialKeyword = "",
  initialLocationBias = "",
  initialFilters = {},
}: Props) {
  const [q, setQ] = useState(initialKeyword);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  // 親からの初期値の変化を反映
  useEffect(() => {
    setQ(initialKeyword);
  }, [initialKeyword]);

  // locationbias は「今の座標があればそれ優先、なければ initial を使う」
  const locationbias = useMemo(() => {
    const lb = buildLocationBias(lat, lng, 1500);
    return lb ?? initialLocationBias ?? "";
  }, [lat, lng, initialLocationBias]);

  const disabled = q.trim().length === 0;

  return (
    <form action="/map" method="get" className={className ?? "flex gap-2 w-full"}>
      {/* 既存フィルタを引き継ぐ（hidden inputs） */}
      {Object.entries(initialFilters).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {/* locationbias も GET で送る */}
      {locationbias ? <input type="hidden" name="locationbias" value={locationbias} /> : null}

      {/* keyword を GET で送る */}
      <input
        name="keyword"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="神社名や地域で検索..."
        className="border rounded p-2 flex-1"
      />

      <UseMyLocationButton
        onPick={(la, ln) => {
          setLat(la);
          setLng(ln);
        }}
        className="border rounded px-3 py-2"
      />

      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded" disabled={disabled}>
        検索
      </button>
    </form>
  );
}
