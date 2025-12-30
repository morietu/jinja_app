// apps/web/src/components/ConciergeCard.tsx
"use client";

import { useState } from "react";
import { useFavorite } from "@/hooks/useFavorite";
import Image from "next/image";
import { pickBenefitTagFromRec, benefitLabel } from "@/lib/concierge/benefitTag";

type Shrine = {
  name: string;
  display_name?: string | null;
  address?: string | null;
  display_address?: string | null;

  lat?: number | null;
  lng?: number | null;
  location?: { lat?: number | null; lng?: number | null } | string | null;

  id?: number | null;
  place_id?: string | null;
  reason?: string | null;
  photo_url?: string | null;

  distance_m?: number | null;
  duration_min?: number | null;
};

type Props = {
  s: Shrine;
  index?: number;

  onFavorited?: (place_id?: string | null) => void;

  /** ラベルを「地図で見る」にするか（falseなら「ルート開始」） */
  showMapButton?: boolean;

  /**
   * 保存ボタン表示フラグ（命名はそのまま使う）
   * - Primary: true（保存ボタン出す）
   * - 他候補リスト: false（保存ボタン出さない）
   */
  showSaveOnly?: boolean;

  onRouteSelect?: (payload: {
    name: string;
    lat?: number | null;
    lng?: number | null;
    place_id?: string | null;
    distance_m: number;
    duration_min: number;
    gmapsLink?: string;
  }) => void;
};

export default function ConciergeCard({
  s,
  index = 0,
  onFavorited,
  showMapButton = false,
  onRouteSelect,
  showSaveOnly = false,
}: Props) {
  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;
  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "静かに手を合わせたい社";

  const tag = benefitLabel(pickBenefitTagFromRec(s as any));

  // coords: lat/lng を最優先、無ければ location(obj)
  const lat = s.lat ?? (typeof s.location === "object" ? (s.location?.lat ?? null) : null);
  const lng = s.lng ?? (typeof s.location === "object" ? (s.location?.lng ?? null) : null);

  const canMap = Number.isFinite(lat) && Number.isFinite(lng);

  const gmapsLink = canMap
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
        s.place_id ? `&destination_place_id=${encodeURIComponent(s.place_id)}` : ""
      }`
    : undefined;

  const [err, setErr] = useState<string | null>(null);

  const { fav, busy, toggle } = useFavorite({
    shrineId: s.id ?? undefined,
    placeId: s.place_id ?? undefined,
    initial: false,
  });

  function onSaveClick() {
    setErr(null);
    toggle()
      .then(() => onFavorited?.(s.place_id))
      .catch(() => setErr("保存の更新に失敗しました"));
  }

  return (
    <div className="rounded-xl border bg-white px-3 py-3 shadow-sm min-h-[200px] transition hover:-translate-y-0.5 hover:shadow-md">
      {!!s.photo_url && (
        <div className="relative mb-3 h-36 w-full">
          <Image
            src={s.photo_url}
            alt={title}
            fill
            className="rounded-lg object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={index === 0}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
          <span className="text-sm text-gray-500">{index === 0 ? "★" : "◎"}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{title}</h3>
          {addrText && <p className="mt-1 text-sm text-gray-600 truncate">{addrText}</p>}

          <p className="mt-2 text-sm text-gray-800">
            {tag && (
              <span className="mr-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {tag}
              </span>
            )}
            {reasonText}
          </p>

          {typeof s.distance_m === "number" && typeof s.duration_min === "number" && (
            <p className="mt-2 text-xs text-gray-600">
              距離 {(s.distance_m / 1000).toFixed(1)} km ・ 目安 {s.duration_min} 分
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {showSaveOnly && (
              <button
                onClick={onSaveClick}
                disabled={busy}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  fav ? "bg-yellow-50 border-yellow-300" : "hover:bg-gray-50"
                } disabled:opacity-60`}
                aria-pressed={fav}
              >
                {busy ? "…" : fav ? "保存済み" : "保存"}
              </button>
            )}

            {gmapsLink && (
              <a
                href={gmapsLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm transition hover:bg-gray-50"
                onClick={() => {
                  onRouteSelect?.({
                    name: title,
                    lat,
                    lng,
                    place_id: s.place_id ?? null,
                    distance_m: s.distance_m ?? 0,
                    duration_min: s.duration_min ?? 0,
                    gmapsLink,
                  });
                }}
              >
                {showMapButton ? "地図で見る" : "ルート開始"}
              </a>
            )}
          </div>

          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        </div>
      </div>
    </div>
  );
}
