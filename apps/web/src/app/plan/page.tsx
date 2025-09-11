"use client";

import { useState } from "react";
import UseMyLocationButton from "@/components/UseMyLocationButton";
import { buildLocationBias } from "@/lib/locationBias";

export default function PlanPage() {
  const [query, setQuery] = useState("浅草神社");
  const [mode, setMode] = useState<"walk" | "car">("walk");
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();

  const lb = buildLocationBias(lat, lng, 1500);

  return (
    <main className="p-4 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold">参拝プラン（簡易デモ）</h1>

      <div className="flex gap-2">
        <input
          className="border rounded p-2 flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="神社名や地名"
        />
        <select
          className="border rounded p-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as "walk" | "car")}
        >
          <option value="walk">徒歩</option>
          <option value="car">車</option>
        </select>
        <UseMyLocationButton
          onPick={(la, ln) => {
            setLat(la);
            setLng(ln);
          }}
        />
      </div>

      <p className="text-xs text-gray-500">
        locationbias: {lb || "(未設定)"}
      </p>

      {/* 実API連携は後続PRで */}
    </main>
  );
}
