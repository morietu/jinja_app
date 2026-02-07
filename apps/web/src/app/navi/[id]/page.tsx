"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { getShrine } from "@/lib/api/shrines";
import type { Shrine } from "@/lib/api/shrines";

function enc(v: string) {
  return encodeURIComponent(v);
}

export default function NaviPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(() => {
    setLocDenied(false);
    if (!navigator.geolocation) {
      setLocDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setOrigin(null);
        setLocDenied(true);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError("無効なIDです");
      return;
    }

    setError(null);
    setShrine(null);

    getShrine(id)
      .then(setShrine)
      .catch(() => setError("神社情報の取得に失敗しました"));

    getLocation();
  }, [id, getLocation]);

  const destination = useMemo(() => {
    const lat = Number((shrine as any)?.latitude ?? (shrine as any)?.lat ?? NaN);
    const lng = Number((shrine as any)?.longitude ?? (shrine as any)?.lng ?? NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [shrine]);

  const dirUrl = useMemo(() => {
    if (!origin || !destination) return null;
    const org = enc(`${origin.lat},${origin.lng}`);
    const dest = enc(`${destination.lat},${destination.lng}`);
    return `https://www.google.com/maps/dir/?api=1&origin=${org}&destination=${dest}`;
  }, [origin, destination]);

  const searchUrl = useMemo(() => {
    if (!destination) return null;
    const q = enc(`${destination.lat},${destination.lng}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }, [destination]);

  if (error) return <p className="p-4 text-red-500">{error}</p>;
  if (!shrine) return <p className="p-4">神社情報を取得中…</p>;
  if (!destination) {
    return (
      <div className="p-4 space-y-2">
        <p className="text-red-500">この神社に位置情報（緯度経度）がありません。</p>
        {shrine.address && (
          <a
            className="inline-block underline"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${enc(`${shrine.name_jp ?? ""} ${shrine.address}`)}`}
          >
            住所でGoogleマップ検索
          </a>
        )}
      </div>
    );
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-xl font-bold">ナビ：{shrine.name_jp}</h1>
      {shrine.address && <p className="text-sm text-slate-600">{shrine.address}</p>}

      {origin ? (
        <div className="flex gap-2">
          {searchUrl && (
            <a
              className="flex-1 rounded-xl border px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
              target="_blank"
              rel="noopener noreferrer"
              href={searchUrl}
            >
              Googleマップで見る
            </a>
          )}
          {dirUrl && (
            <a
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-95"
              target="_blank"
              rel="noopener noreferrer"
              href={dirUrl}
            >
              ルート
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            {locDenied ? "現在地の取得ができませんでした（許可が必要です）。" : "現在地を取得中…"}
          </p>
          <button
            type="button"
            onClick={getLocation}
            className="rounded-xl border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            もう一度取得する
          </button>
        </div>
      )}
    </main>
  );
}
