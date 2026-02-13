"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { getGoriyakuTags } from "@/lib/api/tags";
import { buildShrineHref } from "@/lib/nav/buildShrineHref";
import { createShrine } from "@/lib/api/shrines";
import { isApiError } from "@/lib/api/errors";

type Tag = { id: number; name: string };

export default function NewShrinePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name_jp: "",
    address: "",
    goriyaku: "",
    sajin: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 409 のときだけ true
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    getGoriyakuTags()
      .then(setTags)
      .catch(() => {
        setErrors((prev) => ({ ...prev, tags: "ご利益タグの取得に失敗しました" }));
      });
  }, []);

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const geocodeAddress = async (address: string) => {
    if (!MAPBOX_TOKEN) throw new Error("missing_mapbox_token");

    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`);
    url.searchParams.set("access_token", MAPBOX_TOKEN);
    url.searchParams.set("limit", "1");
    url.searchParams.set("language", "ja");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Mapbox HTTP ${res.status}`);

    const data = await res.json();
    const feat = data?.features?.[0];
    if (feat?.center?.length === 2) {
      const [lon, lat] = feat.center;
      return { latitude: lat as number, longitude: lon as number };
    }
    throw new Error("geocode_not_found");
  };

  const clearGeneral = () => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.general;
      return next;
    });
  };

  const toggleTag = (id: number) => {
    if (isSubmitting) return;

    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

    setErrors((prev) => {
      const next = { ...prev };
      delete next.tags;
      delete next.general;
      return next;
    });
    setIsDuplicate(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.currentTarget;

    setForm((prev) => ({ ...prev, [name]: value }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      delete next.general;
      return next;
    });
    setIsDuplicate(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const name = form.name_jp.trim();
    const addr = form.address.trim(); // 住所は任意（空でもOK）

    if (!name) {
      setErrors((prev) => ({ ...prev, name_jp: "神社名は必須です" }));
      return;
    }

    setIsSubmitting(true);
    setIsDuplicate(false);
    clearGeneral();

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      // 住所があり、トークンもある時だけ geocode
      if (addr && MAPBOX_TOKEN) {
        try {
          const coords = await geocodeAddress(addr);
          latitude = coords.latitude;
          longitude = coords.longitude;
        } catch (err) {
          const msg =
            (err as any)?.message === "missing_mapbox_token"
              ? "位置情報取得が無効です（トークン未設定）"
              : "住所から位置を取得できませんでした";
          setErrors((prev) => ({ ...prev, address: msg }));
          return;
        }
      }

      const shrine = await createShrine({
        name_jp: name,
        address: addr, // 空文字でも送る（バックエンドが allow_blank ならOK）
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
        goriyaku: form.goriyaku,
        sajin: form.sajin,
        goriyakuTagIds: selectedTags,
      });

      const id = (shrine as any)?.id;
      router.push(typeof id === "number" ? buildShrineHref(id) : "/shrines");
    } catch (err: unknown) {
      if (isApiError(err)) {
        // 400: field errors をフォームに反映
        if (err.status === 400 && err.body && typeof err.body === "object") {
          const next: Record<string, string> = {};
          for (const [k, v] of Object.entries(err.body)) {
            if (Array.isArray(v) && typeof v[0] === "string") next[k] = v[0];
            else if (typeof v === "string") next[k] = v;
          }
          setErrors((prev) => ({ ...prev, ...next, general: "入力を確認してください。" }));
          setIsDuplicate(false);
          return;
        }

        // 409: 重複
        if (err.status === 409) {
          setErrors((prev) => ({
            ...prev,
            general: "この神社はすでに登録されています。一覧から開けます。",
          }));
          setIsDuplicate(true);
          return;
        }
      }

      setErrors((prev) => ({ ...prev, general: "登録に失敗しました。" }));
      setIsDuplicate(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">神社新規登録</h1>

      {errors.general && (
        <div className="space-y-2">
          <p className="text-red-500">{errors.general}</p>

          {/* 409 のときだけ出す */}
          {isDuplicate && (
            <button
              type="button"
              className="border rounded px-3 py-2 w-full"
              onClick={() => {
                const q = form.name_jp.trim();
                if (!q) return;
                clearGeneral();
                setIsDuplicate(false);
                router.push(`/shrines?q=${encodeURIComponent(q)}`);
              }}
            >
              一覧で探す
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            name="name_jp"
            placeholder="神社名 *"
            value={form.name_jp}
            onChange={handleChange}
            className="border p-2 w-full"
            disabled={isSubmitting}
          />
          {errors.name_jp && <p className="text-red-500 text-sm">{errors.name_jp}</p>}
        </div>

        <div>
          <input
            name="address"
            placeholder="住所（任意）"
            value={form.address}
            onChange={handleChange}
            className="border p-2 w-full"
            disabled={isSubmitting}
          />
          {errors.address && <p className="text-red-500 text-sm">{errors.address}</p>}
          {!MAPBOX_TOKEN && form.address && (
            <p className="text-xs text-slate-500">※ 現在は位置情報の自動取得は無効です（トークン未設定）</p>
          )}
        </div>

        <div>
          <h2 className="font-bold">ご利益タグ</h2>
          {errors.tags && <p className="text-red-500 text-sm">{errors.tags}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                disabled={isSubmitting}
                className={`px-3 py-1 rounded border ${
                  selectedTags.includes(tag.id) ? "bg-blue-500 text-white" : "bg-gray-100"
                } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </button>
            ))}
            {tags.length === 0 && !errors.tags && (
              <p className="text-xs text-slate-500">タグがまだありません（後で追加できます）</p>
            )}
          </div>
        </div>

        <input
          name="goriyaku"
          placeholder="ご利益"
          value={form.goriyaku}
          onChange={handleChange}
          className="border p-2 w-full"
          disabled={isSubmitting}
        />

        <input
          name="sajin"
          placeholder="祭神"
          value={form.sajin}
          onChange={handleChange}
          className="border p-2 w-full"
          disabled={isSubmitting}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-500 text-white p-2 w-full rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "登録中..." : "登録する"}
        </button>
      </form>
    </div>
  );
}
