// apps/web/src/app/shrines/page.tsx
"use client";

import ShrineCard from "@/components/shrine/ShrineCard";
import { useShrineCards } from "@/hooks/useShrineCards";

export default function ShrinesPage() {
  const { cards, loading, error } = useShrineCards();

  if (loading) return <p className="p-4">読み込み中...</p>;

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">神社一覧</h1>
      {error && <p className="text-red-500">{error}</p>}

      <ul className="grid gap-4">
        {cards.map((p) => (
          <li key={p.shrineId}>
            <ShrineCard {...p} />
          </li>
        ))}
      </ul>
    </main>
  );
}
