// apps/web/src/app/shrines/page.tsx
"use client";

import { useEffect, useState } from "react";
import { getShrines, type Shrine } from "@/lib/api/shrines";
import ShrineCard from "@/components/shrine/ShrineCard";
import { buildShrineListItemModel } from "@/lib/shrine/buildShrineListItemModel";

export default function ShrinesPage() {
  const [shrines, setShrines] = useState<Shrine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShrines()
      .then(setShrines)
      .catch(() => setError("神社データの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="p-4">読み込み中...</p>;
  }

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">神社一覧</h1>
      {error && <p className="text-red-500">{error}</p>}
      <ul className="grid gap-4">
        {shrines.map((shrine) => {
          const model = buildShrineListItemModel(shrine);
          return (
            <li key={shrine.id}>
              <ShrineCard {...model.cardProps} />
            </li>
          );
        })}
      </ul>
    </main>
  );
}
