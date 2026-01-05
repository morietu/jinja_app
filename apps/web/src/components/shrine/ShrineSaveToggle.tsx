"use client";

import { useFavorite } from "@/hooks/useFavorite";

type Props = {
  shrineId: number;
};

export default function ShrineSaveToggle({ shrineId }: Props) {
  const { fav, busy, toggle } = useFavorite({ shrineId, initial: false });

  return (
    <button
      type="button"
      onClick={() => toggle()}
      disabled={busy}
      className={`inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        fav ? "bg-yellow-50 border-yellow-300" : "bg-white hover:bg-gray-50"
      } disabled:opacity-60`}
      aria-pressed={fav}
    >
      {busy ? "…" : fav ? "保存済み" : "保存"}
    </button>
  );
}
