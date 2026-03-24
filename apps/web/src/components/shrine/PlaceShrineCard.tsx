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
  placeId: _placeId,
  title,
  address,
  description,
  imageUrl,
  detailHref,
  detailLabel = "詳細を見る",
}: Props) {
  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      badges={["未登録"]}
      detailHref={detailHref}
      detailLabel={detailLabel}
    />
  );
}
