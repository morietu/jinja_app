// apps/web/src/components/SearchBar.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

type Props = {
  className?: string;
  initialKeyword?: string;          // ★ 追加
  initialLocationBias?: string;     // （必要なら）
};

export default function SearchBar({
  className,
  initialKeyword = "",
  initialLocationBias = "",
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialKeyword);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  // 親からの初期値の変化を反映
  useEffect(() => {
    setQ(initialKeyword);
  }, [initialKeyword]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = q.trim();
    if (!keyword) return;

    const params = new URLSearchParams({ keyword });

    // 位置バイアス（ボタンで取れた場合を優先。なければ初期値を使う）
    const lb = buildLocationBias(lat, lng, 1500);
    if (lb) params.set("locationbias", lb);
    else if (initialLocationBias) params.set("locationbias", initialLocationBias);

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
