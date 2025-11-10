// apps/web/src/app/nearby/NearbyClient.tsx
"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string };

export default function NearbyClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE ?? "";
        const res = await fetch(`${base}/api/shrines/nearby`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { results: Item[] };
        setItems(data.results ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "failed");
      }
    })();
  }, []);

  if (err) return <main className="p-4">取得に失敗: {err}</main>;

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-xl font-bold">近くの神社</h1>
      <ul className="grid gap-2">
        {items.map((s) => (
          <li
            key={s.id}
            data-testid="nearby-item"
            className="p-3 rounded border"
          >
            {s.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
