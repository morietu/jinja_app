"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShrine } from "@/lib/api/shrines";

export default function NewShrinePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name_jp: "",
    address: "",
    latitude: 0,
    longitude: 0,
    goriyaku: "",
    sajin: "",
  });
  const [error, setError] = useState<{ [key: string]: string }>({});

  // 住所から緯度経度を自動取得
  const geocodeAddress = async (address: string) => {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
      )}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
    );
    const data = await res.json();
    if (data.features?.length > 0) {
      const [lon, lat] = data.features[0].center;
      return { latitude: lat, longitude: lon };
    }
    throw new Error("住所から位置を取得できませんでした");
  };
  
  
   return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">神社新規登録</h1>
      {errors.general && <p className="text-red-500">{errors.general}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            name="name_jp"
            placeholder="神社名 *"
            value={form.name_jp}
            onChange={handleChange}
            className="border p-2 w-full"
          />
          {errors.name_jp && <p className="text-red-500 text-sm">{errors.name_jp}</p>}
        </div>
        <div>
          <input
            name="address"
            placeholder="住所"
            value={form.address}
            onChange={handleChange}
            className="border p-2 w-full"
          />
          {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
        </div>
        <input
          name="goriyaku"
          placeholder="ご利益"
          value={form.goriyaku}
          onChange={handleChange}
          className="border p-2 w-full"
        />
        <input
          name="sajin"
          placeholder="祭神"
          value={form.sajin}
          onChange={handleChange}
          className="border p-2 w-full"
        />
        <button type="submit" className="bg-blue-500 text-white p-2 w-full rounded">
          登録する
        </button>
      </form>
    </div>
  );
}