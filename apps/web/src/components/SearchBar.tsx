"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

type Props = { className?: string };

export default function SearchBar({ className }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("keyword") ?? "");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  useEffect(() => {
    setQ(sp.get("keyword") ?? "");
  }, [sp]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = q.trim();
    if (!keyword) return;
    const params = new URLSearchParams({ keyword });
    const lb = buildLocationBias(lat, lng, 1500);
    if (lb) params.set("locationbias", lb);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <form onSubmit={onSubmit} className={className ?? "flex gap-2 w-full"}>
      <input
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
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        検索
      </button>
    </form>
  );
}
