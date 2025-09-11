// apps/web/src/components/UseMyLocationButton.tsx
"use client";
import { useState } from "react";
import { webLocator } from "@/lib/location.web";

type Props = {
  onPick: (lat: number, lng: number) => void;
  label?: string;
  busyLabel?: string;
  className?: string;
};

export default function UseMyLocationButton({
  onPick,
  label = "現在地を使う",
  busyLabel = "取得中…",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        try {
          const p = await webLocator.current();
          onPick(p.lat, p.lng);
        } catch (e: any) {
          alert(e?.message ?? "位置情報の取得に失敗しました");
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className={className}
      aria-busy={loading}
    >
      {loading ? busyLabel : label}
    </button>
  );
}
