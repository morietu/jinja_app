// apps/web/src/components/shrine/ShrinePhotoGallery.tsx
"use client";

import { useState } from "react";
import type { Shrine } from "@/lib/api/shrines";
import clsx from "clsx";

type Props = {
  shrine: Shrine;
  className?: string;
};

function extractPhotos(shrine: Shrine): string[] {
  const list: string[] = [];

  if (Array.isArray(shrine.photo_urls)) {
    list.push(...(shrine.photo_urls.filter(Boolean) as string[]));
  }

  // メイン画像系も fallback として追加
  const main = shrine.main_photo_url ?? shrine.main_photo ?? null;

  if (main && !list.includes(main)) {
    list.unshift(main);
  }

  // 重複削除
  return Array.from(new Set(list));
}

export default function ShrinePhotoGallery({ shrine, className }: Props) {
  const photos = extractPhotos(shrine);
  const [activeIndex, setActiveIndex] = useState(0);

  if (photos.length === 0) {
    // 画像なしプレースホルダ
    return (
      <div
        className={clsx(
          "w-full rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200",
          "flex items-center justify-center",
          "aspect-[4/3]",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <span className="text-3xl">⛩</span>
          <span className="text-xs">写真はまだ登録されていません</span>
        </div>
      </div>
    );
  }

  const active = photos[activeIndex] ?? photos[0];

  return (
    <div className={clsx("flex flex-col gap-3", className)}>
      {/* メイン画像 - スマホ優先の 4:3 / 16:9 */}
      <div className="w-full overflow-hidden rounded-2xl shadow-sm">
        <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] bg-slate-100">
          {/* Next/Image を使っているなら <Image> に置き換え */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active} alt={shrine.name_jp ?? "神社写真"} className="h-full w-full object-cover" loading="lazy" />
        </div>
      </div>

      {/* サムネイル列（複数枚のときだけ表示） */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={url + index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={clsx(
                  "relative flex-none overflow-hidden rounded-xl border",
                  "aspect-square w-16 sm:w-20",
                  isActive ? "border-emerald-500 ring-2 ring-emerald-300" : "border-slate-200",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`サムネイル ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
