// 例: apps/web/components/FavoriteButton.tsx
"use client";
import { useState } from "react";
import { addFavorite, removeFavorite } from "@/lib/favorites";

export default function FavoriteButton({ shrineId }: { shrineId: number }) {
  const [favId, setFavId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      if (favId == null) {
        const created = await addFavorite(shrineId);
        setFavId(created.id);
      } else {
        await removeFavorite(favId);
        setFavId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={onClick} disabled={loading}>
      {favId ? "★ お気に入り解除" : "☆ お気に入り"}
    </button>
  );
}
