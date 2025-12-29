// apps/web/src/components/ConciergeCard.tsx
"use client";

import { useState } from "react";
import api from "@/lib/api/client";
import { useFavorite } from "@/hooks/useFavorite";
import Image from "next/image";

type Shrine = {
  name: string;
  display_name?: string | null;
  address?: string | null;
  display_address?: string | null;

  // chat/plan どっちも来る可能性がある
  lat?: number | null;
  lng?: number | null;
  location?: { lat?: number | null; lng?: number | null } | string | null;

  id?: number | null;
  place_id?: string | null;
  reason?: string | null;
  photo_url?: string | null;

  // nearby等の互換用（無い場合がある）
  distance_m?: number | null;
  duration_min?: number | null;
};

type Props = {
  s: Shrine;
  index?: number;
  onImported?: (payload: { id: number; place_id?: string | null }) => void;
  onFavorited?: (place_id?: string | null) => void;
  /** コンシェルジュ候補用に「地図で見る」ボタンを出すかどうか */
  showMapButton?: boolean;
  /** ルート案内用に、親へ「この神社を選んだよ」を伝える */
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
  onImported,
  onFavorited,
  showMapButton = false,
  onRouteSelect,
}: Props) {
  const title = (s.display_name || s.name || "").trim() || "（名称不明）";
  const addrText = (s.display_address ?? s.address ?? null)?.toString().trim() || null;

  const reasonText = (typeof s.reason === "string" ? s.reason.trim() : "") || "静かに手を合わせたい社";

  // coords は lat/lng を最優先、無ければ location(obj) を見る
  const lat = s.lat ?? (typeof s.location === "object" ? (s.location?.lat ?? null) : null);
  const lng = s.lng ?? (typeof s.location === "object" ? (s.location?.lng ?? null) : null);

  const canMap = typeof lat === "number" && typeof lng === "number";

  const gmapsLink = canMap
    ? `https://www.google.com/maps/dir/?api=1&destination=${Number(lat)},${Number(lng)}${
        s.place_id ? `&destination_place_id=${encodeURIComponent(s.place_id)}` : ""
      }`
    : undefined;
  
  // 取り込み済み表示（初期はDBにidがあればtrue）
  const [imported, setImported] = useState<boolean>(!!s.id);
  const [err, setErr] = useState<string | null>(null);

  // お気に入りの追加/削除/トグル
  const { fav, busy, add, toggle } = useFavorite({
    shrineId: s.id ?? undefined,
    placeId: s.place_id ?? undefined,
    initial: false,
  });


  // place_id からShrine作成→お気に入り登録
  async function onImport() {
    if (!s.place_id) {
      setErr("place_idがありません（地図候補のみの可能性）。");
      return;
    }
    setErr(null);
    try {
      const { data } = await api.post("places/find/", { place_id: s.place_id });
      const shrineId: number | undefined = data?.shrine_id ?? data?.id ?? data?.shrine?.id;
      if (!shrineId) throw new Error("取り込みレスポンスに shrine_id がありません。");

      await add(); // お気に入り登録
      setImported(true);
      onImported?.({ id: shrineId, place_id: s.place_id });
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e?.message ?? "保存に失敗しました。もう一度お試しください。";
      setErr(msg);
    }
  }

  function onFavClick() {
    toggle().catch(() => setErr("お気に入り更新に失敗しました"));
    onFavorited?.(s.place_id);
  }

  return (
    <div className="rounded-xl border bg-white px-3 py-3 shadow-sm min-h-[200px] transition hover:-translate-y-0.5 hover:shadow-md">
      {!!s.photo_url && (
        <div className="relative mb-3 h-36 w-full">
          <Image
            src={s.photo_url}
            alt={s.name}
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

          {typeof s.distance_m === "number" && typeof s.duration_min === "number" && (
            <p className="mt-1 text-sm">
              距離 <span className="font-medium">{(s.distance_m / 1000).toFixed(1)} km</span> ／ 目安{" "}
              <span className="font-medium">{s.duration_min} 分</span>
            </p>
          )}

          <p className="mt-1 text-sm text-gray-700">{reasonText}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onFavClick}
              disabled={busy}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                fav ? "bg-yellow-50 border-yellow-300" : "hover:bg-gray-50"
              } disabled:opacity-60`}
              aria-pressed={fav}
            >
              {busy ? "…" : fav ? "★ お気に入り中" : "☆ お気に入り"}
            </button>

            <button
              disabled={busy || imported || !s.place_id}
              onClick={onImport}
              className={`rounded-lg px-3 py-1.5 text-sm text-white transition ${
                imported ? "bg-gray-400" : "bg-emerald-600 hover:bg-emerald-700"
              } disabled:opacity-60`}
              title={!s.place_id ? "place_idが無いので保存できません" : ""}
            >
              {imported ? "保存済み" : busy ? "保存中…" : "＋ DBへ取り込む"}
            </button>

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
                {showMapButton ? "地図で見る" : "ルートを見る"}
              </a>
            )}
          </div>

          {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
        </div>
      </div>
    </div>
  );
}
