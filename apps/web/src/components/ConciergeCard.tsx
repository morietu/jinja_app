"use client";

import { useState } from "react";
import api from "@/lib/api/client";
import { createFavoriteByShrineId } from "@/lib/api/favorites";
import { useFavorite } from "@/hooks/useFavorite"; // ★ 追加

type Shrine = {
  name: string;
  id?: number | null;
  place_id?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_m: number;
  duration_min: number;
  reason: string;
  photo_url?: string | null;
};

export default function ConciergeCard({
  s,
  index = 0,
  onImported,
  onFavorited,
}: {
  s: Shrine;
  index?: number;
  onImported?: (payload: { id: number; place_id?: string | null }) => void;
  onFavorited?: (place_id?: string | null) => void;
}) {
  // 「取り込み済み」表示用（初期は DB に id があれば true）
  const [imported, setImported] = useState<boolean>(!!s.id);
  const [err, setErr] = useState<string | null>(null);

  // お気に入りの追加/削除/トグルはフックに一元化
  const { fav, busy, add, remove, toggle } = useFavorite({
    shrineId: s.id ?? undefined,        // あれば優先
    placeId: s.place_id ?? undefined,   // なければ place から作成してお気に入りまで
    initial: false,
  });


  const km = (s.distance_m / 1000).toFixed(1);
  const isPrimary = index === 0;

  // (1) place_id → /api/places/find/ で Shrine を作成/取得（または既存取得）
  // (2) 返ってきた shrine_id を /api/favorites/ へ登録（401時は内部でrefresh）
  async function onImport() {
    if (!s.place_id) {
      setErr("place_idがありません（地図候補のみの可能性）。");
      return;
    }
    setErr(null);
    try {
      // place → shrine
      const { data } = await api.post("places/find/", { place_id: s.place_id });
      const shrineId: number | undefined =
        data?.shrine_id ?? data?.id ?? data?.shrine?.id;
      if (!shrineId) throw new Error("取り込みレスポンスに shrine_id がありません。");

      // お気に入りへ（401 は createFavoriteByShrineId 内で自動リフレッシュ）
      await add();                 // フック経由でお気に入り登録＆状態更新
     setImported(true);
     onImported?.({ id: shrineId, place_id: s.place_id });
    } catch (e: any) {
      const msg =
        e?.response?.data?.detail ||
        e?.message ||
        "保存に失敗しました。もう一度お試しください。";
      setErr(msg);
    }
  }

  function onFavClick() {
    // 楽観更新はフック側で行われるのでそのまま
    toggle().catch(() => {
      // 失敗時の通知（必要ならトースト等に置き換え）
      setErr("お気に入り更新に失敗しました");
    });
    onFavorited?.(s.place_id);
  }

  const gmapsLink =
    s.lat && s.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${Number(s.lat)},${Number(
          s.lng
        )}&destination_place_id=${encodeURIComponent(s.place_id ?? "")}`
      : undefined;

  return (
    <div className="border rounded-lg p-3 flex gap-3">
      {!!s.photo_url && (
        <img
          src={s.photo_url}
          alt={s.name}
          className="w-20 h-20 object-cover rounded-md flex-shrink-0"
          loading="lazy"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {isPrimary && (
            <span className="text-xs px-2 py-0.5 rounded bg-black text-white">一押し</span>
          )}
          <h3 className="font-semibold truncate">{s.name}</h3>
        </div>

        {s.address && (
          <div className="text-sm text-gray-600 mt-0.5 truncate">{s.address}</div>
        )}

        <div className="text-sm mt-1">
          距離 <span className="font-medium">{km} km</span> ／ 目安{" "}
          <span className="font-medium">{s.duration_min} 分</span>
        </div>

        <p className="text-sm text-gray-700 mt-1">{s.reason}</p>

        <div className="mt-2 flex flex-wrap gap-2">
          {/* お気に入りトグル */}
          <button
            onClick={onFavClick}
            disabled={busy}
            className={`px-3 py-1 border rounded ${
              fav ? "bg-yellow-100 border-yellow-300" : ""
            } disabled:opacity-60`}
            aria-pressed={fav}
          >
            {busy ? "…" : fav ? "★ お気に入りに追加済み" : "☆ お気に入り"}
          </button>

          {/* DB 取り込み（place_id が無い候補は非活性） */}
          <button
            disabled={busy || imported || !s.place_id}
            onClick={onImport}
            className={`px-3 py-1 rounded ${
              imported ? "bg-gray-200 text-gray-600" : "bg-black text-white hover:opacity-90"
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
              className="px-3 py-1 border rounded hover:bg-gray-50"
            >
              ルートを見る
            </a>
          )}
        </div>

        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
      </div>
    </div>
  );
}
