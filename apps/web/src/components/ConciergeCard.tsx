"use client";

import Image from "next/image";
import Link from "next/link";
import { pickBenefitTagFromRec, benefitLabel } from "@/lib/concierge/benefitTag";

type Shrine = {
  name: string;
  display_name?: string | null;
  address?: string | null;
  display_address?: string | null;

  lat?: number | null;
  lng?: number | null;
  location?: { lat?: number | null; lng?: number | null } | string | null;

  id?: number | null; // shrine_id（DB）
  place_id?: string | null; // Google place id
  reason?: string | null;
  photo_url?: string | null;

  distance_m?: number | null;
  duration_min?: number | null;
};

type Props = {
  s: Shrine;
  index?: number; // ★ primary 判定に使う
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

export default function ConciergeCard({ s, index = 0, onRouteSelect }: Props) {
  const isPrimary = index === 0;

  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;
  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "まずは代表的な候補から表示しています。";
  const tag = benefitLabel(pickBenefitTagFromRec(s as any));

  // --- lat / lng 正規化 ---
  const parseNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  let lat = parseNum(s.lat) ?? (typeof s.location === "object" ? parseNum(s.location?.lat) : null);
  let lng = parseNum(s.lng) ?? (typeof s.location === "object" ? parseNum(s.location?.lng) : null);

  if ((lat == null || lng == null) && typeof s.location === "string") {
    const m = s.location.split(",").map((x) => x.trim());
    if (m.length >= 2) {
      lat = parseNum(m[0]);
      lng = parseNum(m[1]);
    }
  }

  const canLatLng = lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

  // --- Google Maps（主導線：ルート） ---
  const gmapsRouteLink = canLatLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${
        s.place_id ? `&destination_place_id=${encodeURIComponent(s.place_id)}` : ""
      }`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [title, addrText].filter(Boolean).join(" "),
      )}`;

  // --- アプリ内 /map（補助導線：primaryのみ） ---
  const mapHref = (() => {
    const sp = new URLSearchParams();
    if (s.id != null) sp.set("shrine_id", String(s.id));
    if (s.place_id) sp.set("place_id", s.place_id);
    if (canLatLng) {
      sp.set("lat", String(lat));
      sp.set("lng", String(lng));
    }
    if (title) sp.set("name", title);
    if (addrText) sp.set("addr", addrText);
    return `/map?${sp.toString()}`;
  })();

  return (
    <div className="rounded-xl border bg-white px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      {!!s.photo_url && (
        <div className="relative mb-3 h-36 w-full">
          <Image
            src={s.photo_url}
            alt={title}
            fill
            className="rounded-lg object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
            priority={isPrimary}
          />
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
          <span className="text-sm text-gray-500">{isPrimary ? "★" : "◎"}</span>
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

          {/* --- 主導線ボタン（全カード共通） --- */}
          <div className="mt-3">
            <a
              href={gmapsRouteLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                onRouteSelect?.({
                  name: title,
                  lat,
                  lng,
                  place_id: s.place_id ?? null,
                  distance_m: s.distance_m ?? 0,
                  duration_min: s.duration_min ?? 0,
                  gmapsLink: gmapsRouteLink,
                });
              }}
            >
              Googleマップでルートを見る
            </a>
          </div>

          {/* --- 補助導線（primaryのみ） --- */}
          {isPrimary && (
            <div className="mt-2 text-right">
              <Link
                href={mapHref}
                className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                アプリ内マップで周辺も確認する
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
