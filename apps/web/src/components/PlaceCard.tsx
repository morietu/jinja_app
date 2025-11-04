// apps/web/src/components/PlaceCard.tsx
"use client";
import Image from "next/image";


type Place = {
  place_id: string;
  name: string;
  address?: string | null;
  rating?: number | null;
  user_ratings_total?: number | null;
  icon?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function PlaceCard({ p }: { p: Place }) {
  const gm = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    p.name
  )}&query_place_id=${encodeURIComponent(p.place_id)}`;

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-gray-100">
          - {}
          {p.icon ? (
            <Image src={p.icon} alt="" width={20} height={20} />
          ) : (
            <span className="text-sm text-gray-500">◎</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="font-semibold leading-tight">{p.name}</h3>
            {typeof p.rating === "number" && (
              <span className="text-xs text-gray-600">
                ★ {p.rating.toFixed(1)}
              </span>
            )}
            {typeof p.user_ratings_total === "number" && (
              <span className="text-xs text-gray-500">
                （{p.user_ratings_total}件）
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-sm text-gray-600">
            {p.address ?? "-"}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={gm}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition hover:bg-gray-50"
            >
              Googleマップで見る
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
