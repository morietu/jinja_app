"use client";

import { useFavorite } from "@/hooks/useFavorite";

export default function FavoriteButton({
  shrineId,
  initialFav = false,
}: {
  shrineId: number;
  initialFav?: boolean;
}) {
  const { fav, busy, toggle } = useFavorite(String(shrineId), initialFav ?? false);

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-pressed={fav}
      className="text-sm"
      title={fav ? "お気に入り解除" : "お気に入りに追加"}
    >
      {busy ? "…" : fav ? "★" : "☆"}
    </button>
  );
}
