// apps/web/src/app/nearby/page.tsx
import { apiGet } from "@/lib/api/http";

export default async function NearbyPage() {
  const data = await apiGet<{ results: { id: string; name: string }[] }>(
    "/api/shrines/nearby"
  );

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
