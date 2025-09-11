"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;

    // 現在地があれば locationbias を付与
    const locationbias = buildLocationBias(lat, lng, 1500);
    const params = new URLSearchParams({ keyword });
    if (locationbias) params.set("locationbias", locationbias);

    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="p-4 space-y-12">
      {/* ヒーロー */}
      <Hero />

      {/* 機能メニュー */}
      <Features />

      {/* 🔍 検索バー（現在地ボタン付き） */}
      <section className="flex justify-center mt-8">
        <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="神社名や地域で検索..."
            className="border rounded p-2 flex-1"
          />

          {/* 現在地ボタン：クリックで lat/lng を保持 */}
          <UseMyLocationButton
            onPick={(la, ln) => {
              setLat(la);
              setLng(ln);
            }}
            className="border rounded px-3 py-2"
          />

          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            検索
          </button>
        </form>
      </section>

      {/* 現在地バッジ（任意表示） */}
      {lat !== undefined && lng !== undefined && (
        <p className="text-xs text-gray-500 text-center">
          現在地を使用中（半径1500m）: {lat.toFixed(4)}, {lng.toFixed(4)}
        </p>
      )}
    </main>
  );
}
