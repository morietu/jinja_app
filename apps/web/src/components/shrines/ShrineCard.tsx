// src/components/shrines/ShrineCard.tsx
import React from "react";
import Link from "next/link";
import Image from "next/image";


export type ShrineCardProps = {
  name: string;
  address?: string | null;
  distanceM?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  imageUrl?: string | null;
  tags?: string[];
  href?: string;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
};

export function ShrineCard(props: ShrineCardProps) {
  const {
    name,
    address,
    distanceM,
    rating,
    reviewCount,
    imageUrl,
    tags = [],
    href,
    isFavorited,
    onToggleFavorite,
  } = props;

  const body = (
    <div className="rounded-xl border p-4 flex gap-4">
      <div className="w-28 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
        {imageUrl ? (
          <Image src={imageUrl} alt={name} width={112} height={80} className="w-full h-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{name}</div>
            {address ? <div className="text-sm text-gray-600 truncate">{address}</div> : null}
          </div>

          {typeof isFavorited === "boolean" && onToggleFavorite ? (
            <button type="button" onClick={onToggleFavorite} className="text-sm px-2 py-1 border rounded-md">
              {isFavorited ? "★" : "☆"}
            </button>
          ) : null}
        </div>

        <div className="mt-2 text-sm text-gray-700 flex gap-3">
          {typeof distanceM === "number" ? <span>{distanceM}m</span> : null}
          {typeof rating === "number" ? (
            <span>
              {rating.toFixed(1)}
              {typeof reviewCount === "number" ? ` (${reviewCount})` : ""}
            </span>
          ) : null}
        </div>

        {tags.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.slice(0, 5).map((t) => (
              <span key={t} className="text-xs px-2 py-1 bg-gray-100 rounded-full">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
