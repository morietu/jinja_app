// apps/web/src/components/ConciergeCard.tsx
"use client";

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
  showMapButton?: boolean;
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

export default function ConciergeCard({ s, index = 0, showMapButton = false, onRouteSelect }: Props) {
  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;
  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "静かに手を合わせたい社";
  const tag = benefitLabel(pickBenefitTagFromRec(s as any));

  const latRaw = s.lat ?? (typeof s.location === "object" ? (s.location?.lat ?? null) : null);
  const lngRaw = s.lng ?? (typeof s.location === "object" ? (s.location?.lng ?? null) : null);

  const parseNum = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  let lat = parseNum(latRaw);
  let lng = parseNum(lngRaw);

  if ((lat == null || lng == null) && typeof s.location === "string") {
    const m = s.location.split(",").map((x) => x.trim());
    if (m.length >= 2) {
      lat = parseNum(m[0]);
      lng = parseNum(m[1]);
    }
  }

  const isValidLatLng = (a: number | null, b: number | null) =>
    a != null && b != null && a >= -90 && a <= 90 && b >= -180 && b <= 180;

  const canMap = isValidLatLng(lat, lng);
  const gmapsLink = canMap
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
        s.place_id ? `&destination_place_id=${encodeURIComponent(s.place_id)}` : ""
      }`
    : `https://www.google.com/maps?q=${encodeURIComponent([title, addrText].filter(Boolean).join(" "))}`;

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
        </div>
      </div>
    </div>
  );
}
