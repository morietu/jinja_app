// apps/web/src/components/shrine/ShrineCard.tsx
"use client";

import ConciergeCard from "@/components/ConciergeCard";
import { useFavorite } from "@/hooks/useFavorite";

type Props = {
  shrineId: number;
  title: string;
  address?: string | null;
  description: string;
  imageUrl?: string | null;
  goriyakuTags?: { id: number; name: string }[];
  initialFav?: boolean;
  readOnly?: boolean;
};

export default function ShrineCard({
  shrineId,
  title,
  address,
  description,
  imageUrl,
  goriyakuTags = [],
  initialFav = false,
  readOnly = false,
}: Props) {
  const { fav, busy, toggle } = useFavorite({
    shrineId,
    initial: initialFav,
  });

  const favButton = (
    <button onClick={toggle} disabled={busy || readOnly} className="text-sm font-semibold" aria-pressed={fav}>
      {fav ? "★" : "☆"}
    </button>
  );

  return (
    <ConciergeCard
      title={title}
      address={address}
      imageUrl={imageUrl}
      description={description}
      isPrimary
      badges={["正式登録", ...goriyakuTags.map((t) => t.name)]}
      detailHref={`/shrines/${shrineId}`}
      headerRight={favButton}
    />
  );
}
