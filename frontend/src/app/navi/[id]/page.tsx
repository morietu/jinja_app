"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getShrine, Shrine } from "@/lib/api/shrines";

const RouteMap = dynamic(() => import("@/components/maps/RouteMap"), { ssr: false });

export default function NaviPage() {
  const params = useParams();
  const raw = params?.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);

  const [shrine, setShrine] = useState<Shrine | null>(null);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setError("無効なIDです");
      return;
    }
    getShrine(id)
      .then(setShrine)
      .catch(() => setError("神社情報の取得に失敗しました"));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setOrigin(null),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, [id]);

  if (error) return <p className="p-4 text-red-500">{error}</p>;
  if (!shrine) return <p className="p-4">神社情報を取得中…</p>;
  if (!origin) return <p className="p-4">現在地の取得を許可してください。</p>;

  const destination = { lat: Number(shrine.latitude), lng: Number(shrine.longitude) };

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-xl font-bold">ナビ：{shrine.name_jp}</h1>
      <p>{shrine.address}</p>
      <RouteMap origin={origin} destination={destination} />
      <a
        className="inline-block underline"
        target="_blank" rel="noopener noreferrer"
        href={`https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`}
      >
        Googleマップで開く
      </a>
    </main>
  );
}
