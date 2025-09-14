"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormEvent, ChangeEvent } from "react";
import { createShrine } from "@/lib/api/shrines";
import { getGoriyakuTags } from "@/lib/api/tags";

type Tag = { id: number; name: string };

export default function NewShrinePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name_jp: "",
    address: "",
    goriyaku: "",
    sajin: "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  // ご利益タグ一覧を取得
  useEffect(() => {
    getGoriyakuTags().then(setTags).catch(() => {
      setErrors((prev) => ({ ...prev, tags: "ご利益タグの取得に失敗しました" }));
    });
  }, []);

  // ご利益タグ選択切り替え
  const toggleTag = (id: number) => {
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

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
      return { latitude: lat as number, longitude: lon as number };
    }
    throw new Error("住所から位置を取得できませんでした");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 必須チェック
    if (!form.name_jp) {
      setErrors({ name_jp: "神社名は必須です" });
      return;
    }

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (form.address) {
        try {
          const coords = await geocodeAddress(form.address);
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch {
          setErrors((prev) => ({ ...prev, address: "住所から位置を取得できませんでした" }));
          return;
        }
      }

      // 🔧 API の DTO を ID 配列で揃える
      const shrine = await createShrine({
        name_jp: form.name_jp,
        address: form.address || "",
        latitude,
        longitude,
        goriyaku: form.goriyaku,
        sajin: form.sajin,
        goriyakuTagIds: selectedTags, // ← ここが重要（number[] をそのまま渡す）
      });

      router.push(`/shrines/${shrine.id}`);
    } catch (err) {
      setErrors((prev) => ({ ...prev, general: "登録に失敗しました。" }));
    }
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
          {errors.name_jp && (
            <p className="text-red-500 text-sm">{errors.name_jp}</p>
          )}
        </div>

        <div>
          <input
            name="address"
            placeholder="住所"
            value={form.address}
            onChange={handleChange}
            className="border p-2 w-full"
          />
          {errors.address && (
            <p className="text-red-500 text-sm">{errors.address}</p>
          )}
        </div>

        <div>
          <h2 className="font-bold">ご利益タグ</h2>
          {errors.tags && (
            <p className="text-red-500 text-sm">{errors.tags}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`px-3 py-1 rounded border ${
                  selectedTags.includes(tag.id)
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
          </div>
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

        <button
          type="submit"
          className="bg-blue-500 text-white p-2 w-full rounded"
        >
          登録する
        </button>
      </form>
    </div>
  );
}
