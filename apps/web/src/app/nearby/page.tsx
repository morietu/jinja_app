// apps/web/src/app/nearby/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NearbyPage() {
  const base = process.env.API_BASE ?? ""; // サーバー専用環境変数にしておく
  const res = await fetch(`${base}/api/shrines/nearby`, { cache: "no-store" }); // ←重要
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as {
    results: { id: string; name: string }[];
  };

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-xl font-bold">近くの神社</h1>
      <ul className="grid gap-2">
        {data.results.map((s) => (
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
