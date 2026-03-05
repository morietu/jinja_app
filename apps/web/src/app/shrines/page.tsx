// apps/web/src/app/shrines/page.tsx
"use client";
import { ShrineCard } from "@/components/shrines/ShrineCard";
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
            <ShrineCard
              name={p.title}
              address={p.address ?? undefined}
              recommendReason={p.description ?? undefined}
              imageUrl={p.imageUrl ?? undefined}
              tags={p.badges ?? []}
              href={`/shrines/${p.shrineId}`}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
