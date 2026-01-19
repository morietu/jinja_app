// apps/web/src/components/shrine/PlaceShrineCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";

type Props = {
  placeId: string;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
};

export default function PlaceShrineCard({ placeId, title, address, description, imageUrl }: Props) {
  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      badges={["未登録"]}
      detailHref={`/shrines/from-place/${placeId}`}
    />
  );
}
