// apps/web/src/components/shrine/PlaceShrineCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";

type Props = {
  placeId: string;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;

  detailHref?: string;
  detailLabel?: string;
};

export default function PlaceShrineCard({
  placeId,
  title,
  address,
  description,
  imageUrl,
  detailHref,
  detailLabel = "詳細を見る",
}: Props) {
  const href = detailHref ?? `/shrines/resolve?place_id=${encodeURIComponent(placeId)}`;

  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      badges={["未登録"]}
      detailHref={href}
      detailLabel={detailLabel}
    />
  );
}
